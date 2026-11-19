import { useState } from "react";
import { useI18n } from "../i18n";
import { NumberField } from "./SetupScreens";
import { useAppStore } from "../store";
import { toolKinds } from "../setup";
import type {
  MazatrolProgram,
  CuttingUnit,
  Shape,
  ToolRow,
  Unit,
} from "../nc/mazatrol/model";
import {
  autoTools,
  newShape,
  newUnit,
  shapeKinds,
  unitKinds,
  pointDepth,
} from "../nc/mazatrol/model";
import type { Expansion } from "../nc/mazatrol/expand";
import { Term } from "./Term";
import type { TermId } from "../i18n/glossary";

const unitTerms: Record<Unit["kind"], TermId> = {
  COMMON: "commonUnit",
  WPC: "wpcUnit",
  DRILLING: "drilling",
  "RGH CBOR": "counterbore",
  TAPPING: "tapping",
  REAMING: "reaming",
  "FACE MILL": "facing",
  POCKET: "pocket",
  "LINE OUT": "outsideContour",
  END: "endUnit",
};
const shapeTerms: Record<Shape["kind"] | "LINE" | "ARC", TermId> = {
  PT: "pointPattern",
  LIN: "linePattern",
  SQR: "rectanglePattern",
  GRD: "gridPattern",
  CIR: "circlePattern",
  LINE: "lineShape",
  ARC: "arcShape",
};
const fieldTerms: Record<string, TermId> = {
  initialZ: "clearance",
  top: "topSurface",
  depth: "cutDepth",
  diameter: "diameter",
  pitch: "threadPitch",
  pocket: "toolLength",
  depthPass: "depthPass",
  toolDepth: "cutDepth",
  speed: "cuttingSpeed",
  feed: "feed",
};
export function MazatrolEditor({
  data,
  disabled,
  onChange,
  expansion,
}: {
  data: MazatrolProgram;
  disabled: boolean;
  onChange: (data: MazatrolProgram) => void;
  expansion: Expansion;
}) {
  const { t } = useI18n();
  const tools = useAppStore((s) => s.tools);
  const [selected, setSelected] = useState(data.units[0]!.id);
  const [addKind, setAddKind] = useState<CuttingUnit["kind"]>("DRILLING");
  const [shapeKind, setShapeKind] = useState<Shape["kind"]>("PT");
  const index = Math.max(
    0,
    data.units.findIndex((u) => u.id === selected),
  );
  const unit = data.units[index]!;
  const replace = (next: Unit) =>
    onChange({
      ...data,
      units: data.units.map((u) => (u.id === unit.id ? next : u)),
    });
  const field = (
    key: string,
    value: number,
    commit: (n: number) => void,
    min = -10000,
    max = 10000,
  ) => (
    <label key={key}>
      {fieldTerms[key] ? (
        <Term
          id={fieldTerms[key]}
          label={t.maz.fields[key as keyof typeof t.maz.fields]}
        />
      ) : (
        t.maz.fields[key as keyof typeof t.maz.fields]
      )}
      <NumberField
        label={t.maz.fields[key as keyof typeof t.maz.fields]}
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        commit={commit}
      />
    </label>
  );
  const change = (key: string, value: unknown) =>
    replace({ ...unit, [key]: value } as Unit);
  const material =
    data.units[0]!.kind === "COMMON" ? data.units[0]!.material : "A5052";
  return (
    <section className="maz-editor">
      <p className="hint">{t.maz.imitation}</p>
      <div className="unit-list" role="group" aria-label={t.maz.units}>
        {data.units.map((u, i) => (
          <button
            key={u.id}
            aria-pressed={unit.id === u.id}
            onClick={() => setSelected(u.id)}
          >
            {i + 1} · {t.maz.unitNames[u.kind]}
          </button>
        ))}
      </div>
      <fieldset disabled={disabled} className="unit-add">
        <label>
          {t.maz.unitType}
          <select
            value={addKind}
            onChange={(e) => setAddKind(e.target.value as typeof addKind)}
          >
            {unitKinds.map((k) => (
              <option key={k} value={k}>
                {t.maz.unitNames[k]}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => {
            const u = newUnit(addKind, crypto.randomUUID());
            u.tools = autoTools(u, material, tools);
            onChange({
              ...data,
              units: [...data.units.slice(0, -1), u, data.units.at(-1)!],
            });
            setSelected(u.id);
          }}
          disabled={data.units.length >= 100}
        >
          {t.maz.addUnit}
        </button>
      </fieldset>
      <h3>
        {index + 1} ·{" "}
        <Term id={unitTerms[unit.kind]} label={t.maz.unitNames[unit.kind]} />
      </h3>
      {index > 1 && index < data.units.length - 1 && (
        <div>
          <button
            disabled={disabled || index === 2}
            onClick={() => {
              const units = [...data.units];
              [units[index - 1], units[index]] = [
                units[index]!,
                units[index - 1]!,
              ];
              onChange({ ...data, units });
            }}
          >
            {t.maz.up}
          </button>
          <button
            disabled={disabled || index === data.units.length - 2}
            onClick={() => {
              const units = [...data.units];
              [units[index + 1], units[index]] = [
                units[index]!,
                units[index + 1]!,
              ];
              onChange({ ...data, units });
            }}
          >
            {t.maz.down}
          </button>
          <button
            disabled={disabled}
            onClick={() => {
              onChange({
                ...data,
                units: data.units.filter((u) => u.id !== unit.id),
              });
              setSelected(data.units[0]!.id);
            }}
          >
            {t.maz.removeUnit}
          </button>
        </div>
      )}
      <div className="unit-fields">
        {unit.kind === "COMMON" && (
          <>
            <label>
              <Term id="material" label={t.maz.material} />
              <select
                disabled={disabled}
                value={unit.material}
                aria-label={t.maz.material}
                onChange={(e) => change("material", e.target.value)}
              >
                {["A5052", "S45C", "SUS304", "SS400"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            {field(
              "initialZ",
              unit.initialZ,
              (n) => change("initialZ", n),
              0.001,
            )}
            <p>{t.maz.multiOff}</p>
          </>
        )}
        {unit.kind === "WPC" && (
          <>
            {(["x", "y", "z", "theta"] as const).map((k) =>
              field(k, unit[k], (n) => change(k, n)),
            )}
            <p className="hint">{t.maz.wpcHint}</p>
          </>
        )}
        {"tools" in unit && (
          <>
            {field("top", unit.top, (n) => change("top", n))}
            {field("depth", unit.depth, (n) => change("depth", n), 0.001)}
            {"diameter" in unit && (
              <>
                {field(
                  "diameter",
                  unit.diameter,
                  (n) => change("diameter", n),
                  0.001,
                )}
                {unit.kind === "TAPPING" &&
                  field("pitch", unit.pitch, (n) => change("pitch", n), 0.001)}
              </>
            )}
            {(unit.kind === "FACE MILL" || unit.kind === "POCKET") &&
              (["x", "y", "width", "height"] as const).map((k) =>
                field(
                  k,
                  unit[k],
                  (n) => change(k, n),
                  ["width", "height"].includes(k) ? 0.001 : -10000,
                ),
              )}
            {unit.kind === "POCKET" && (
              <label>
                <Term id="pocketEntry" label={t.maz.entry} />
                <select
                  disabled={disabled}
                  value={unit.entry ?? "ramp"}
                  aria-label={t.maz.entry}
                  onChange={(e) => change("entry", e.target.value)}
                >
                  <option value="ramp">{t.maz.ramp}</option>
                  <option value="plunge">{t.maz.plunge}</option>
                </select>
              </label>
            )}
            {unit.kind === "LINE OUT" && (
              <>
                {field("startX", unit.start.x, (n) =>
                  change("start", { ...unit.start, x: n }),
                )}
                {field("startY", unit.start.y, (n) =>
                  change("start", { ...unit.start, y: n }),
                )}
              </>
            )}
          </>
        )}
      </div>
      {"shapes" in unit && (
        <section>
          <h4>{t.maz.shapes}</h4>
          <fieldset disabled={disabled}>
            <select
              aria-label={t.maz.shapeType}
              value={shapeKind}
              onChange={(e) => setShapeKind(e.target.value as Shape["kind"])}
            >
              {shapeKinds.map((k) => (
                <option key={k} value={k}>
                  {t.maz.shapeNames[k]}
                </option>
              ))}
            </select>
            <button
              disabled={unit.shapes.length >= 100}
              onClick={() =>
                change("shapes", [...unit.shapes, newShape(shapeKind)])
              }
            >
              {t.maz.addShape}
            </button>
          </fieldset>
          {unit.shapes.map((shape, i) => (
            <fieldset key={i} disabled={disabled}>
              <legend>
                {i + 1} ·{" "}
                <Term
                  id={shapeTerms[shape.kind]}
                  label={t.maz.shapeNames[shape.kind]}
                />
              </legend>
              <div className="unit-fields">
                {Object.entries(shape)
                  .filter(([k]) => k !== "kind")
                  .map(([k, v]) =>
                    field(k, v as number, (n) =>
                      change(
                        "shapes",
                        unit.shapes.map((s, j) =>
                          j === i ? { ...s, [k]: n } : s,
                        ),
                      ),
                    ),
                  )}
              </div>
              <button
                onClick={() =>
                  change(
                    "shapes",
                    unit.shapes.filter((_, j) => j !== i),
                  )
                }
              >
                {t.maz.removeRow}
              </button>
            </fieldset>
          ))}
        </section>
      )}
      {unit.kind === "LINE OUT" && (
        <section>
          <h4>{t.maz.shapes}</h4>
          <p className="hint">{t.maz.lineHint}</p>
          <fieldset disabled={disabled}>
            {(["LINE", "ARC"] as const).map((kind) => (
              <button
                key={kind}
                disabled={unit.edges.length >= 200}
                onClick={() =>
                  change("edges", [
                    ...unit.edges,
                    kind === "LINE"
                      ? { kind, x: 20, y: 15 }
                      : {
                          kind,
                          x: 20,
                          y: 15,
                          cx: 20,
                          cy: 30,
                          clockwise: false,
                        },
                  ])
                }
              >
                {t.maz.addShape} {t.maz.shapeNames[kind]}
              </button>
            ))}
          </fieldset>
          {unit.edges.map((edge, i) => (
            <fieldset key={i} disabled={disabled}>
              <legend>
                {i + 1} ·{" "}
                <Term
                  id={shapeTerms[edge.kind]}
                  label={t.maz.shapeNames[edge.kind]}
                />
              </legend>
              <div className="unit-fields">
                {Object.entries(edge)
                  .filter(([, v]) => typeof v === "number")
                  .map(([k, v]) =>
                    field(k, v as number, (n) =>
                      change(
                        "edges",
                        unit.edges.map((e, j) =>
                          j === i ? { ...e, [k]: n } : e,
                        ),
                      ),
                    ),
                  )}
                {edge.kind === "ARC" && (
                  <label>
                    <input
                      type="checkbox"
                      checked={edge.clockwise}
                      onChange={(e) =>
                        change(
                          "edges",
                          unit.edges.map((r, j) =>
                            j === i ? { ...r, clockwise: e.target.checked } : r,
                          ),
                        )
                      }
                    />
                    {t.maz.clockwise}
                  </label>
                )}
              </div>
              <button
                onClick={() =>
                  change(
                    "edges",
                    unit.edges.filter((_, j) => j !== i),
                  )
                }
              >
                {t.maz.removeRow}
              </button>
            </fieldset>
          ))}
        </section>
      )}
      {"tools" in unit && (
        <section>
          <h4>
            <Term id="autoTools" label={t.maz.auto} />
          </h4>
          <p className="hint">{t.maz.toolHint}</p>
          {"shapes" in unit && <p className="hint"><Term id="spotDrill" /> · {t.maz.holeHint}</p>}
          <button
            disabled={disabled}
            onClick={() => change("tools", autoTools(unit, material, tools))}
          >
            {t.maz.regenerate}
          </button>
          <button
            disabled={disabled || unit.tools.length >= 10}
            onClick={() =>
              change("tools", [
                ...unit.tools,
                {
                  kind: "endMill",
                  pocket: 1,
                  diameter: 6,
                  depthPass: 1,
                  speed: 120,
                  feed: 300,
                },
              ])
            }
          >
            {t.maz.addTool}
          </button>
          <div className="setup-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t.panel.kind}</th>
                  {["pocket", "diameter", "depthPass", "speed", "feed"].map(
                    (k) => (
                      <th key={k}>
                        <Term
                          id={fieldTerms[k]!}
                          label={t.maz.fields[k as keyof typeof t.maz.fields]}
                        />
                      </th>
                    ),
                  )}
                  <th>{t.maz.removeRow}</th>
                  {"shapes" in unit && (
                    <th>
                      <Term id="cutDepth" label={t.maz.fields.toolDepth} />
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {unit.tools.map((row, i) => {
                  const update = (key: keyof ToolRow, value: unknown) =>
                    change(
                      "tools",
                      unit.tools.map((r, j) =>
                        i === j ? { ...r, [key]: value } : r,
                      ),
                    );
                  return (
                    <tr key={i}>
                      <td>
                        <select
                          aria-label={`${t.panel.kind} ${i + 1}`}
                          disabled={disabled}
                          value={row.kind}
                          onChange={(e) => update("kind", e.target.value)}
                        >
                          {toolKinds.map((k) => (
                            <option key={k} value={k}>
                              {t.panel.kinds[k]}
                            </option>
                          ))}
                        </select>
                      </td>
                      {(
                        [
                          "pocket",
                          "diameter",
                          "depthPass",
                          "speed",
                          "feed",
                        ] as const
                      ).map((k) => (
                        <td key={k}>
                          <NumberField
                            label={`${t.maz.fields[k]} ${i + 1}`}
                            disabled={disabled}
                            value={row[k]}
                            min={k === "pocket" ? 0 : 0.001}
                            max={k === "pocket" ? 20 : 10000}
                            commit={(n) => update(k, n)}
                          />
                        </td>
                      ))}
                      <td>
                        <button
                          disabled={disabled}
                          onClick={() =>
                            change(
                              "tools",
                              unit.tools.filter((_, j) => j !== i),
                            )
                          }
                        >
                          {t.maz.removeRow}
                        </button>
                      </td>
                      {"shapes" in unit && (
                        <td>
                          <NumberField
                            label={`${t.maz.fields.toolDepth} ${i + 1}`}
                            disabled={disabled}
                            value={pointDepth(unit, row)}
                            min={0.001}
                            max={10000}
                            commit={(n) => update("depth", n)}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {expansion.issues.map((issue, i) => (
        <p className="alarm" role="alert" key={i}>
          {t.maz.unit} {data.units.findIndex((u) => u.id === issue.unit) + 1}:{" "}
          {t.maz.errors[issue.code]}
        </p>
      ))}
      <details>
        <summary>{t.maz.viewCode}</summary>
        <p className="hint">{t.maz.learningOnly}</p>
        <textarea
          readOnly
          aria-label={t.maz.viewCode}
          value={expansion.source}
        />
      </details>
    </section>
  );
}
