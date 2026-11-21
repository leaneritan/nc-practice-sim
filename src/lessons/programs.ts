import { defaultTools } from '../setup';
import { autoTools, blankMazatrol } from '../nc/mazatrol/model';
import type { CuttingUnit, MazatrolProgram } from '../nc/mazatrol/model';
import { expandMazatrol } from '../nc/mazatrol/expand';
import type { HoleGoal, LessonDefinition, LessonDraft, Track } from './types';

/** Reference solutions are used for regression checks. Targets are defined independently in target.ts. */
export function solutionProgram(lesson: LessonDefinition): MazatrolProgram {
  const p = blankMazatrol(), target = lesson.target;
  const cuts: CuttingUnit[] = [];
  if (target.face < 0) cuts.push({ id: 'face', kind: 'FACE MILL', x: 0, y: 0, width: 100, height: 60, top: 0, depth: -target.face, tools: [] });
  const pointUnit = (kind: 'DRILLING' | 'TAPPING' | 'RGH CBOR', list: HoleGoal[]) => {
    if (!list.length) return;
    const first = list[0]!;
    cuts.push({ id: kind, kind, top: first.top, depth: first.top - (kind === 'TAPPING' ? first.tap!.bottom : kind === 'RGH CBOR' ? first.counterbore!.bottom : first.bottom),
      diameter: kind === 'TAPPING' ? first.tap!.diameter : kind === 'RGH CBOR' ? first.counterbore!.diameter : first.diameter,
      pitch: first.tap?.pitch ?? 1.25, shapes: list.map(h => ({ kind: 'PT', x: h.x, y: h.y })), tools: [] });
  };
  pointUnit('TAPPING', target.holes.filter(h => h.tap));
  pointUnit('DRILLING', target.holes.filter(h => !h.tap));
  pointUnit('RGH CBOR', target.holes.filter(h => h.counterbore));
  if (target.pocket) {
    const r = target.pocket;
    cuts.push({ id: 'pocket', kind: 'POCKET', x: r.x, y: r.y, width: r.width, height: r.height, top: target.face, depth: target.face - r.bottom, tools: [] });
  }
  if (target.contour) {
    const r = target.contour;
    cuts.push({ id: 'contour', kind: 'LINE OUT', top: target.face, depth: target.face - r.bottom, tools: [], start: { x: r.x, y: r.y },
      edges: [{ kind: 'LINE', x: r.x + r.width, y: r.y }, { kind: 'LINE', x: r.x + r.width, y: r.y + r.height }, { kind: 'LINE', x: r.x, y: r.y + r.height }, { kind: 'LINE', x: r.x, y: r.y }] });
  }
  for (const unit of cuts) unit.tools = autoTools(unit, 'A5052', defaultTools());
  p.units.splice(2, 0, ...cuts);
  return p;
}

export function eiaFor(program: MazatrolProgram): string {
  // Keep one M code per line, as taught in the guide. The remaining words stay with the first M.
  return expandMazatrol(program, defaultTools()).source.split('\n').flatMap(line => {
    if (line.startsWith('(')) return [line];
    const codes = [...line.matchAll(/\bM\d+\b/g)];
    return codes.length < 2 ? [line] : [line.slice(0, codes[1]!.index).trim(), ...codes.slice(1).map(m => m[0])];
  }).join('\n');
}

export function starterProgram(lesson: LessonDefinition, track: Track): LessonDraft {
  const p = solutionProgram(lesson);
  // Deliberately unfinished, but runnable: learners set the goal dimensions and repeat the features.
  if (lesson.id === 'combined') p.units = [p.units[0]!, p.units[1]!, p.units[2]!, p.units.at(-1)!];
  for (const unit of p.units) if ('tools' in unit) {
    unit.depth = lesson.id === 'face' || lesson.id === 'combined' ? 0.5 : 2;
    if ('shapes' in unit) unit.shapes = unit.shapes.slice(0, 1);
    if (unit.kind === 'POCKET') { unit.width = 20; unit.height = 10; }
    unit.tools = autoTools(unit, 'A5052', defaultTools());
  }
  return track === 'mazatrol' ? { kind: 'mazatrol', data: p } : { kind: 'eia', source: eiaFor(p) };
}
