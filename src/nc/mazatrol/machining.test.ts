// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  autoTools,
  blankMazatrol,
  newUnit,
  pointDepth,
  sampleMazatrol,
} from "./model";
import type { CuttingUnit, PointKind } from "./model";
import { expandMazatrol } from "./expand";
import { defaultOffsets, defaultTools, simulationOptions } from "../../setup";
import { runProgram, resumeProgram } from "../interpreter";
import {
  createMachine,
  cycleStart,
  feedHold,
  resetMachine,
  setControls,
  setMode,
  tickMachine,
} from "../machine";
import { createStock, removedVolume } from "../stock";
import { validMazatrol } from "../../programs";

const tools = defaultTools();
const options = () => simulationOptions(defaultOffsets(), tools);
function pointUnit(kind: PointKind, depth = 10) {
  const unit = newUnit(kind, "holes");
  if (!("shapes" in unit)) throw Error();
  unit.depth = depth;
  unit.tools = autoTools(unit, "A5052", tools);
  return unit;
}
function pack(unit: CuttingUnit) {
  const program = blankMazatrol();
  program.units.splice(2, 0, unit);
  return program;
}
const drill = (depth: number, x = 20) => `T2 M6
G54 G0 G43 H2 Z15.
M3 S1000
G98 G83 X${x}. Y20. R2. Z-${depth.toFixed(4)} Q3. F300
G80
M5
G91 G28 Z0.
G90 G49`;
const finish = (depth: number, ream = false, x = 20) => `T${ream ? 7 : 3} M6
G54 G0 G43 H${ream ? 7 : 3} Z15.
M3 S400
${ream ? `G0 X${x}. Y20.\nG1 Z-${depth.toFixed(4)} F120\nG1 Z15.` : `G98 G84 X${x}. Y20. R2. Z-${depth.toFixed(4)} F500\nG80`}
M30`;

describe("blind pilot allowance and 90-degree spotting", () => {
  it.each(["TAPPING", "REAMING"] as const)(
    "%s drills deeper by finish allowance plus drill point",
    (kind) => {
      const unit = pointUnit(kind);
      const configured = defaultTools();
      if (kind === "REAMING") configured[1]!.actual = 7.8;
      unit.tools = autoTools(unit, "A5052", configured);
      const expected = 10 + 0.3 * 8 + 0.3 * (kind === "TAPPING" ? 6.8 : 7.8);
      expect(pointDepth(unit, unit.tools[1]!)).toBeCloseTo(expected);
      const expanded = expandMazatrol(pack(unit), configured);
      expect(expanded.issues).toEqual([]);
      const result = runProgram(
        expanded.source,
        simulationOptions(defaultOffsets(), configured),
      );
      expect(result.alarms).toEqual([]);
      expect(result.stock!.drilledHoles?.[0]?.bottom).toBeCloseTo(-expected);
    },
  );
  it.each([20, 25])("does not add allowance to through depth %s", (depth) => {
    for (const kind of ["TAPPING", "REAMING"] as const) {
      const unit = pointUnit(kind, depth);
      expect(pointDepth(unit, unit.tools[1]!)).toBe(depth);
    }
  });
  it("runs the equal-depth through-hole exception at stock thickness", () => {
    const expanded = expandMazatrol(pack(pointUnit("TAPPING", 20)), tools);
    const result = runProgram(expanded.source, options());
    expect(result.alarms).toEqual([]);
    expect(result.stock!.drilledHoles?.[0]?.bottom).toBe(-20);
  });
  it("produces an 8.5 mm spot at 4.25 mm depth with a 90-degree tool", () => {
    const unit = pointUnit("TAPPING");
    expect(unit.tools[0]).toMatchObject({
      kind: "centerDrill",
      diameter: 10,
      pocket: 6,
    });
    expect(pointDepth(unit, unit.tools[0]!)).toBe(4.25);
    const expanded = expandMazatrol(pack(unit), tools);
    const spotOnly = expanded.source.split("T2 M06")[0]!;
    const result = runProgram(spotOnly, options());
    expect(result.alarms).toEqual([]);
    expect(result.stock!.heights[20 * 101 + 24]).toBeCloseTo(-0.25);
    expect(result.stock!.heights[20 * 101 + 25]).toBe(0);
    expect(result.stock!.drilledHoles).toBeUndefined();
  });
  it("selects the smallest adequate spot tool and rejects an undersized manual choice", () => {
    const configured = defaultTools();
    configured[5]!.actual = 4;
    configured[13]!.actual = 9;
    const unit = pointUnit("TAPPING");
    unit.tools = autoTools(unit, "A5052", configured);
    expect(unit.tools[0]!.pocket).toBe(14);
    unit.tools[0] = { ...unit.tools[0]!, pocket: 6, diameter: 4 };
    expect(expandMazatrol(pack(unit), configured).issues[0]?.code).toBe(
      "diameter",
    );
    configured[13]!.actual = 4;
    expect(autoTools(unit, "A5052", configured)[0]!.pocket).toBe(0);
  });
  it("keeps total depth overrides editable and validates them on restore", () => {
    const unit = pointUnit("TAPPING");
    unit.tools[1]!.depth = 16;
    expect(pointDepth(unit, unit.tools[1]!)).toBe(16);
    const program = pack(unit);
    expect(validMazatrol(program)).toBe(true);
    expect(expandMazatrol(program, tools).source).toContain("Z-16.0000");
    unit.tools[1]!.depth = NaN;
    expect(validMazatrol(program)).toBe(false);
    expect(expandMazatrol(program, tools).issues[0]?.code).toBe("value");
  });
});

describe("shared pilot-depth alarm", () => {
  it.each([false, true])(
    "rejects equal/deeper or missing pilots for reaming=%s",
    (ream) => {
      for (const depth of [10, 11]) {
        const result = runProgram(
          `${drill(10)}\n${finish(depth, ream)}`,
          options(),
        );
        expect(result.alarms[0]?.code).toBe("pilotDepth");
        expect(
          result.segments.every((s) => s.line < result.alarms[0]!.line),
        ).toBe(true);
        expect(result.stock!.heights[20 * 101 + 20]).toBe(-10);
      }
      expect(runProgram(finish(5, ream), options()).alarms[0]?.code).toBe(
        "pilotDepth",
      );
      expect(
        runProgram(`${drill(15, 21)}\n${finish(10, ream)}`, options()).alarms[0]
          ?.code,
      ).toBe("pilotDepth");
      expect(
        runProgram(`${drill(12)}\n${finish(10, ream)}`, options()).alarms,
      ).toEqual([]);
    },
  );
  it("compares physical holes across work offsets and handles a pause/resume", () => {
    const opts = options();
    opts.workOffsets![55] = { ...opts.workOffsets![54]!, x: -510 };
    const source = `${drill(14)}\nM00\n${finish(10).replace("G54", "G55").replace("X20.", "X30.")}`;
    const paused = runProgram(source, opts);
    expect(paused.state.paused).not.toBeNull();
    const resumed = resumeProgram(paused);
    expect(resumed.alarms).toEqual([]);
    expect(resumed.state.ended).toBe(true);
    expect(paused.stock!.drilledHoles?.[0]?.bottom).toBe(-14);
  });
  it("rolls pilot history back with an unsafe drilling block and clears it with new stock", () => {
    const failed = runProgram(drill(25), options());
    expect(failed.alarms[0]?.code).toBe("belowStock");
    expect(failed.stock!.drilledHoles).toBeUndefined();
    const drilled = runProgram(drill(14), options());
    const opts = { ...options(), initialStock: drilled.stock };
    expect(runProgram(finish(10), opts).alarms).toEqual([]);
    expect(
      runProgram(finish(10), { ...opts, initialStock: createStock() }).alarms[0]
        ?.code,
    ).toBe("pilotDepth");
  });
  it("records only the reached depth during timed drilling and retains it across hold/reset", () => {
    let machine = cycleStart(
      setMode(createMachine(), "MEMORY"),
      drill(14),
      options(),
    );
    for (let i = 0; i < 300 && !machine.stock.drilledHoles?.length; i++)
      machine = tickMachine(machine, 100);
    const bottom = machine.stock.drilledHoles?.[0]?.bottom;
    expect(bottom).toBeLessThan(0);
    expect(bottom).toBeGreaterThan(-14);
    const held = feedHold(machine);
    expect(tickMachine(held, 60000).stock).toBe(held.stock);
    expect(resetMachine(held).stock).toBe(held.stock);
    machine = cycleStart(held, "", options());
    for (let i = 0; i < 100 && machine.status === "running"; i++)
      machine = tickMachine(machine, 1000);
    expect(machine.stock.drilledHoles?.[0]?.bottom).toBe(-14);
    const alarmRun = cycleStart(
      setMode(resetMachine(machine), "MEMORY"),
      finish(14),
      options(),
    );
    expect(tickMachine(alarmRun, 100000).alarms[0]?.code).toBe("pilotDepth");
  });
});

describe("pocket entry and modal cycle output", () => {
  it("ramps below each previous floor at no more than 3 degrees and stays inside the pocket", () => {
    const unit = newUnit("POCKET", "pocket");
    if (unit.kind !== "POCKET") throw Error();
    unit.tools = autoTools(unit, "A5052", tools);
    unit.width = 8;
    unit.tools[0]!.depthPass = 2;
    const result = runProgram(
      expandMazatrol(pack(unit), tools).source,
      options(),
    );
    expect(result.alarms).toEqual([]);
    const descending = result.segments.filter(
      (s) =>
        s.kind === "linear" &&
        s.to.z < s.from.z &&
        s.to.z - s.workShift.z < -1e-6,
    );
    const ramps = descending.filter(
      (s) => Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y) > 0,
    );
    expect(ramps.length).toBeGreaterThan(10);
    for (const s of ramps) {
      expect(
        Math.atan2(
          s.from.z - s.to.z,
          Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y),
        ),
      ).toBeLessThanOrEqual(Math.PI / 60 + 1e-4);
      expect(s.to.x - s.workShift.x).toBeGreaterThanOrEqual(33);
      expect(s.to.x - s.workShift.x).toBeLessThanOrEqual(35);
    }
    // Vertical moves end at already-cleared layer floors, never the new cutting depth.
    expect(
      descending
        .filter((s) => s.from.x === s.to.x && s.from.y === s.to.y)
        .map((s) => s.to.z - s.workShift.z),
    ).toEqual([-2, -4]);
  });
  it("offers 30% plunge feed and restores full cutting feed on XY passes", () => {
    const unit = newUnit("POCKET", "pocket");
    if (unit.kind !== "POCKET") throw Error();
    unit.entry = "plunge";
    unit.tools = autoTools(unit, "A5052", tools);
    const feed = unit.tools[0]!.feed;
    const program = pack(unit);
    expect(validMazatrol(program)).toBe(true);
    const result = runProgram(expandMazatrol(program, tools).source, options());
    expect(result.alarms).toEqual([]);
    for (const s of result.segments.filter((s) => s.kind === "linear")) {
      expect(s.feed).toBe(s.to.z < s.from.z ? feed * 0.3 : feed);
    }
    unit.entry = "ramp";
    const ramp = runProgram(expandMazatrol(program, tools).source, options());
    expect(removedVolume(ramp.stock!)).toBeCloseTo(
      removedVolume(result.stock!),
      3,
    );
  });
  it("emits one G81/G83/G84 declaration per tool and three XY-only repeats", () => {
    const expanded = expandMazatrol(sampleMazatrol(tools), tools);
    const lines = expanded.source.split("\n");
    for (const code of [81, 83, 84]) {
      const declarations = lines.filter((l) => l.startsWith(`G98 G${code} `));
      expect(declarations).toHaveLength(1);
      const i = lines.indexOf(declarations[0]!);
      expect(
        lines.slice(i + 1, i + 4).every((l) => /^X[\d.-]+ Y[\d.-]+$/.test(l)),
      ).toBe(true);
      expect(lines[i + 4]).toBe("G80");
    }
    let cycle = "";
    const explicit = lines
      .flatMap((line) => {
        if (/^G98 G8[134] /.test(line)) {
          cycle = line.replace(/ X[\d.-]+ Y[\d.-]+/, "");
          return [line, "G80"];
        }
        if (line === "G80") cycle = "";
        return cycle && /^X/.test(line) ? [`${cycle} ${line}`, "G80"] : [line];
      })
      .join("\n");
    const modal = runProgram(expanded.source, options());
    const repeated = runProgram(explicit, options());
    expect(modal.alarms).toEqual([]);
    expect(repeated.alarms).toEqual([]);
    const geometry = (r: typeof modal) =>
      r.segments.map(({ line: _line, ...s }) => s);
    expect(geometry(modal)).toEqual(geometry(repeated));
  });
  it("matches instant sample removal in timed single-block execution", () => {
    const expanded = expandMazatrol(sampleMazatrol(tools), tools);
    const instant = runProgram(expanded.source, options());
    let timed = cycleStart(
      setControls(setMode(createMachine(), "MEMORY"), { singleBlock: true }),
      expanded.source,
      options(),
    );
    for (
      let i = 0;
      i < 500 && !["complete", "alarm"].includes(timed.status);
      i++
    ) {
      if (timed.status === "singleBlock")
        timed = cycleStart(timed, "", options());
      timed = tickMachine(timed, 60000);
    }
    expect(timed.status).toBe("complete");
    expect(timed.alarms).toEqual([]);
    expect(timed.stock.drilledHoles).toEqual(instant.stock!.drilledHoles);
    expect(removedVolume(timed.stock)).toBeCloseTo(
      removedVolume(instant.stock!),
      3,
    );
  });
});
