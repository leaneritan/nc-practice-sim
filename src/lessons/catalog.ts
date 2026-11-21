import type { HoleGoal, LessonDefinition } from './types';

const holes = (points: number[][], top = 0, depth = 8): HoleGoal[] => points.map(([x, y]) => ({
  x: x!, y: y!, top, diameter: 6.8, bottom: top - depth, spotDiameter: 7.3,
}));
const taps = (points: number[][], top = 0): HoleGoal[] => holes(points, top, 14.44).map(h => ({
  ...h, spotDiameter: 8.5, tap: { diameter: 8, bottom: top - 10, pitch: 1.25 },
}));
const four = [[20, 15], [80, 15], [80, 45], [20, 45]];
/** Goals are geometry, not simulated solution programs. Add content in messages.ts and a starter in programs.ts. */
export const lessons: LessonDefinition[] = [
  { id: 'face', chapter: 'setup', terms: ['facing', 'toolLength'], target: { face: -1, holes: [] } },
  { id: 'drill', chapter: 'gcode', terms: ['drilling', 'retractPlane'], target: { face: 0, holes: holes(four) } },
  { id: 'tap', chapter: 'mazatrol', terms: ['tapping', 'spotDrill'], target: { face: 0, holes: taps(four) } },
  { id: 'pocket', chapter: 'mazatrol', terms: ['pocket', 'pocketEntry'], target: { face: 0, holes: [], pocket: { x: 30, y: 20, width: 40, height: 20, bottom: -5, radius: 3 } } },
  { id: 'contour', chapter: 'mazatrol', terms: ['outsideContour', 'lineShape'], target: { face: 0, holes: [], contour: { x: 20, y: 15, width: 60, height: 30, bottom: -3, radius: 3 } } },
  { id: 'counterbore', chapter: 'mazatrol', terms: ['counterbore', 'gridPattern'], target: { face: 0, holes: holes([[20, 15], [50, 15], [80, 15], [20, 45], [50, 45], [80, 45]], 0, 12).map(h => ({ ...h, counterbore: { diameter: 12, bottom: -3 } })) } },
  { id: 'combined', chapter: 'checking', terms: ['facing', 'tapping', 'pocket', 'counterbore', 'outsideContour'], target: {
    face: -1,
    holes: [...taps([[20, 18], [80, 18], [80, 42], [20, 42]], -1), ...holes([[50, 15], [50, 45]], -1, 8).map(h => ({ ...h, counterbore: { diameter: 10, bottom: -3 } }))],
    pocket: { x: 30, y: 20, width: 40, height: 20, bottom: -5, radius: 3 },
    contour: { x: 10, y: 10, width: 80, height: 40, bottom: -4, radius: 3 },
  } },
];
