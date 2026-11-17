import type { Alarm, Block, ParseResult, Word } from './types';

const letters = new Set('GMXYZIJRFQHSTNO');
export const MAX_SOURCE_LENGTH = 200_000;
export const MAX_BLOCKS = 10_000;

/** Tokenize without eval. Comments may span lines; physical line numbers survive. */
export function parseProgram(source: string): ParseResult {
  const blocks: Block[] = [];
  const fail = (code: Alarm['code'], line: number, detail: string): ParseResult =>
    ({ blocks: [], alarms: [{ code, line, detail }] });
  if (source.length > MAX_SOURCE_LENGTH) return fail('limit', 1, 'source');
  let inComment = false;
  let commentLine = 0;
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > MAX_BLOCKS) return fail('limit', MAX_BLOCKS + 1, 'blocks');
  for (const [index, raw] of lines.entries()) {
    const line = index + 1;
    let clean = '';
    for (const char of raw) {
      if (char === '(') {
        if (inComment) return fail('comment', line, '(');
        inComment = true;
        commentLine = line;
        clean += ' ';
      } else if (char === ')') {
        if (!inComment) return fail('comment', line, ')');
        inComment = false;
        clean += ' ';
      } else if (!inComment) {
        if (char === ';') break;
        clean += char;
      }
    }
    clean = clean.trim().toUpperCase();
    if (!clean || clean === '%') continue;
    const words: Word[] = [];
    const seen = new Set<string>();
    let cursor = 0;
    while (cursor < clean.length) {
      if (/\s/.test(clean[cursor]!)) { cursor++; continue; }
      const match = /^([A-Z])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/.exec(clean.slice(cursor));
      if (!match) return fail('syntax', line, clean.slice(cursor, cursor + 24));
      const letter = match[1]!;
      const value = Number(match[2]);
      if (!letters.has(letter)) return fail('unsupportedWord', line, letter);
      if (!Number.isFinite(value)) return fail('invalidValue', line, letter);
      if (seen.has(letter) && letter !== 'G' && letter !== 'M') {
        return fail('duplicateWord', line, letter);
      }
      seen.add(letter);
      words.push({ letter, value });
      cursor += match[0].length;
    }
    blocks.push({ line, words });
  }
  if (inComment) return fail('comment', commentLine, '(');
  return { blocks, alarms: [] };
}
