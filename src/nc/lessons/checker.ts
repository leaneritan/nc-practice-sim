import { physicalTip } from '../stock';
import { parseProgram } from '../parser';
import { planBlock } from '../interpreter';
import type { AlarmCode, InterpreterOptions, RunResult, Vec3 } from '../types';
import type { LessonTarget } from '../../lessons/types';
import { targetStock } from './target';

export const LESSON_TOLERANCE = 0.1;
export type CheckCode = 'alarm' | 'incomplete' | 'invalidStock' | 'undercut' | 'overcut' | 'missingHole' | 'holePosition' | 'holeDiameter' | 'holeDepth' | 'extraHole' | 'missingTap' | 'tapDepth' | 'tapDiameter' | 'tapPitch' | 'pilotBeforeTap';
export interface CheckIssue {
  code: CheckCode; at?: Vec3; expected?: number; actual?: number; count?: number;
  actualAt?: Vec3; line?: number; alarm?: AlarmCode;
}
export interface DifferenceCell extends Vec3 { code: 'undercut' | 'overcut'; expected: number }
export interface LessonCheck { passed: boolean; score: number; maxError: number; issues: CheckIssue[]; cells: DifferenceCell[] }
interface Bore extends Vec3 { diameter: number; pitch: number; line: number; pilot: number }
const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y) <= LESSON_TOLERANCE + 1e-6;
const differs = (a: number, b: number) => Math.abs(a - b) > LESSON_TOLERANCE + 1e-6;

/** Only completed motion is evidence. A drill after a tap must never satisfy its pilot requirement. */
function tapsInOrder(result: RunResult, options: InterpreterOptions): Bore[] {
  const drilled: Bore[] = [], taps: Bore[] = [], safety = options.safety;
  if (!safety) return taps;
  for (const s of result.segments) {
    if (s.kind !== 'linear' || s.to.z >= s.from.z || Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y) > 1e-6 || s.spindle === 'off' || s.speed <= 0) continue;
    const tool = safety.tools.find(t => t.pocket === s.tool);
    if (!tool) continue;
    const point = physicalTip(s.to, safety.stockOrigin, tool, safety.stockRotation);
    const item: Bore = { ...point, diameter: tool.actual, pitch: (s.feed ?? 0) / s.speed, line: s.line, pilot: Infinity };
    if (tool.kind === 'drill') drilled.push(item);
    if (tool.kind === 'tap' && s.cycle === 84) {
      item.pilot = Math.min(...drilled.filter(d => near(d, point) && d.diameter < tool.actual).map(d => d.z));
      taps.push(item);
    }
  }
  return taps;
}
function alarmLocation(result: RunResult, source: string, options: InterpreterOptions): Vec3 | undefined {
  const block = parseProgram(source, options).blocks.find(b => b.line === result.alarms[0]?.line);
  if (!block || !options.safety) return undefined;
  // Failed blocks are atomic. Plan a diagnostic copy without safety to locate the attempted cut.
  const planned = planBlock(block, result.state, { ...options, safety: undefined }, 20000);
  const segment = planned.segments.filter(s => s.kind !== 'rapid').sort((a, b) => a.to.z - b.to.z)[0] ?? planned.segments.at(-1);
  return segment ? physicalTip(segment.to, options.safety.stockOrigin, options.safety.tools.find(t => t.pocket === segment.tool), options.safety.stockRotation) : undefined;
}
export function checkLesson(target: LessonTarget, result: RunResult, options: InterpreterOptions, source = ''): LessonCheck {
  const issues: CheckIssue[] = [], cells: DifferenceCell[] = [], expected = targetStock(target), actual = result.stock;
  for (const alarm of result.alarms) issues.push({ code: 'alarm', alarm: alarm.code, line: alarm.line, at: alarmLocation(result, source, options) });
  if (!result.state.ended || result.state.paused) issues.push({ code: 'incomplete' });
  const valid = actual && actual.width === expected.width && actual.height === expected.height && actual.cell === expected.cell &&
    actual.heights.length === expected.heights.length && actual.heights.every(Number.isFinite);
  if (!valid) return { passed: false, score: 0, maxError: 0, issues: [...issues, { code: 'invalidStock' }], cells };
  let maxError = 0;
  for (let i = 0; i < expected.heights.length; i++) {
    const error = actual.heights[i]! - expected.heights[i]!;
    maxError = Math.max(maxError, Math.abs(error));
    if (Math.abs(error) > LESSON_TOLERANCE + 1e-6) cells.push({ x: (i % actual.width) * actual.cell, y: Math.floor(i / actual.width) * actual.cell,
      z: actual.heights[i]!, expected: expected.heights[i]!, code: error > 0 ? 'undercut' : 'overcut' });
  }
  for (const code of ['undercut', 'overcut'] as const) {
    const group = cells.filter(c => c.code === code);
    const worst = group.reduce<DifferenceCell | undefined>((a, b) => !a || Math.abs(b.z - b.expected) > Math.abs(a.z - a.expected) ? b : a, undefined);
    if (worst) issues.push({ code, at: { x: worst.x, y: worst.y, z: worst.z }, expected: worst.expected, actual: worst.z, count: group.length });
  }
  const used = new Set<number>(), holes = actual.drilledHoles ?? [], taps = tapsInOrder(result, options);
  // Match in-tolerance positions first so a missing first hole does not shift
  // every later assignment and falsely report the remaining holes as misplaced.
  const assignments = new Map<number, number>();
  target.holes.forEach((h, index) => {
    const found = holes.findIndex((a, i) => !used.has(i) && near(a, h));
    if (found >= 0) { assignments.set(index, found); used.add(found); }
  });
  const pairs = target.holes.flatMap((h, goal) => holes.map((a, actual) => ({ goal, actual, distance: Math.hypot(h.x - a.x, h.y - a.y) }))).sort((a, b) => a.distance - b.distance);
  for (const pair of pairs) if (!assignments.has(pair.goal) && !used.has(pair.actual)) { assignments.set(pair.goal, pair.actual); used.add(pair.actual); }
  let featureChecks = 0, featurePassed = 0;
  const require = (condition: boolean, issue: CheckIssue) => { featureChecks++; if (condition) featurePassed++; else issues.push(issue); };
  for (const [index, h] of target.holes.entries()) {
    const at = { x: h.x, y: h.y, z: h.bottom };
    const found = assignments.get(index), hole = found === undefined ? undefined : holes[found];
    require(!!hole, { code: 'missingHole', at });
    if (hole) {
      require(near(hole, h), { code: 'holePosition', at, actualAt: { x: hole.x, y: hole.y, z: hole.bottom } });
      require(!differs(hole.diameter, h.diameter), { code: 'holeDiameter', at, expected: h.diameter, actual: hole.diameter });
      require(!differs(hole.bottom, h.bottom), { code: 'holeDepth', at, expected: h.bottom, actual: hole.bottom });
    }
    if (h.tap) {
      const matches = taps.filter(t => near(t, h));
      require(matches.length > 0, { code: 'missingTap', at: { ...at, z: h.tap.bottom } });
      for (const tap of matches) {
        require(!differs(tap.z, h.tap.bottom), { code: 'tapDepth', at, expected: h.tap.bottom, actual: tap.z, line: tap.line });
        require(!differs(tap.diameter, h.tap.diameter), { code: 'tapDiameter', at, expected: h.tap.diameter, actual: tap.diameter, line: tap.line });
        require(Math.abs(tap.pitch - h.tap.pitch) <= 0.001, { code: 'tapPitch', at, expected: h.tap.pitch, actual: tap.pitch, line: tap.line });
        require(tap.pilot < tap.z - 1e-6 && tap.pilot <= h.bottom + LESSON_TOLERANCE + 1e-6, { code: 'pilotBeforeTap', at, expected: h.bottom, ...(Number.isFinite(tap.pilot) ? { actual: tap.pilot } : {}), line: tap.line });
      }
    }
  }
  holes.forEach((h, i) => { if (!used.has(i)) issues.push({ code: 'extraHole', at: { x: h.x, y: h.y, z: h.bottom } }); });
  const passed = issues.length === 0;
  const geometryScore = 1 - cells.length / expected.heights.length;
  const score = passed ? 100 : Math.min(99, Math.round(100 * (featureChecks ? .7 * geometryScore + .3 * featurePassed / featureChecks : geometryScore)));
  return { passed, score: result.alarms.length || !result.state.ended ? Math.min(50, score) : score, maxError, issues, cells };
}
