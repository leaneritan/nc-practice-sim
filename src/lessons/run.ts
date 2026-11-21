import { defaultOffsets, defaultTools, simulationOptions } from '../setup';
import { runProgram } from '../nc';
import { expandMazatrol, withMazatrolWpc } from '../nc/mazatrol/expand';
import { checkLesson } from '../nc/lessons/checker';
import type { LessonDefinition, LessonDraft } from './types';

/** Every attempt starts at home with fresh stock and fixed lesson tools; free-practice state is untouched. */
export function runLesson(lesson: LessonDefinition, draft: LessonDraft, strictDecimals = false) {
  const tools = defaultTools();
  const expansion = draft.kind === 'mazatrol' ? expandMazatrol(draft.data, tools) : undefined;
  const source = draft.kind === 'eia' ? draft.source : expansion!.source;
  const options = withMazatrolWpc({ ...simulationOptions(defaultOffsets(), tools), strictDecimals }, expansion?.wpc);
  const result = runProgram(source, options);
  if (expansion?.issues.length) result.alarms = expansion.issues.map(issue => ({ code: 'unitParameters', line: 0, detail: `${issue.unit}: ${issue.code}` }));
  return { source, options, result, check: checkLesson(lesson.target, result, options, source) };
}
export type LessonRun = ReturnType<typeof runLesson>;
