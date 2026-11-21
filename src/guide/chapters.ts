export const chapterIds = ['start', 'basics', 'controls', 'setup', 'gcode', 'mazatrol', 'checking', 'safety'] as const;
export type GuideChapter = typeof chapterIds[number];
export type MachineScreen = 'POSITION' | 'PROGRAM' | 'SHAPE CHECK' | 'TOOL DATA' | 'WORK OFFSET' | 'ALARM';
export const screenChapters: Record<MachineScreen, GuideChapter> = {
  POSITION: 'basics', PROGRAM: 'gcode', 'SHAPE CHECK': 'checking',
  'TOOL DATA': 'setup', 'WORK OFFSET': 'setup', ALARM: 'checking',
};
export function helpChapter(screen: MachineScreen, mazatrol: boolean, mdi: boolean): GuideChapter {
  return screen === 'PROGRAM' && mazatrol && !mdi ? 'mazatrol' : screenChapters[screen];
}
export interface Chapter { id: GuideChapter; number: number; title: string; markdown: string }
/** Numbered H2 headings are stable chapter boundaries; translated titles may be edited freely. */
export function parseGuide(markdown: string): Chapter[] {
  const matches = [...markdown.matchAll(/^## ([1-8])\. (.+)$/gm)];
  if (matches.length !== chapterIds.length || matches.some((m, i) => Number(m[1]) !== i + 1)) {
    throw new Error('Guide must contain numbered chapters 1–8, in order.');
  }
  return matches.map((m, i) => ({ id: chapterIds[i]!, number: i + 1, title: m[2]!,
    markdown: markdown.slice(m.index! + m[0].length, matches[i + 1]?.index ?? markdown.length).trim() }));
}
