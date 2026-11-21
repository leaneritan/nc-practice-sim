import type { GuideChapter } from '../guide/chapters';
import type { TermId } from '../i18n/glossary';
import type { MazatrolProgram } from '../nc/mazatrol/model';

export const lessonIds = ['face', 'drill', 'tap', 'pocket', 'contour', 'counterbore', 'combined'] as const;
export type LessonId = typeof lessonIds[number];
export const tracks = ['mazatrol', 'eia'] as const;
export type Track = typeof tracks[number];
export type LessonDraft = { kind: 'mazatrol'; data: MazatrolProgram } | { kind: 'eia'; source: string };
export interface HoleGoal {
  x: number; y: number; top: number; diameter: number; bottom: number; spotDiameter: number;
  tap?: { diameter: number; bottom: number; pitch: number };
  counterbore?: { diameter: number; bottom: number };
}
export interface RectangleGoal { x: number; y: number; width: number; height: number; bottom: number; radius: number }
export interface LessonTarget {
  face: number;
  holes: HoleGoal[];
  pocket?: RectangleGoal;
  /** A cutter-width groove outside the island; the rest of the surrounding stock remains. */
  contour?: RectangleGoal;
}
export interface LessonDefinition {
  id: LessonId;
  chapter: GuideChapter;
  terms: TermId[];
  target: LessonTarget;
}
