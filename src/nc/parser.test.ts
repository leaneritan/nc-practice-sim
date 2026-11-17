// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MAX_BLOCKS, MAX_SOURCE_LENGTH, parseProgram } from './parser';

describe('G-code tokenizer', () => {
  it('reads compact, lowercase, signed and decimal words', () => {
    const parsed = parseProgram('n10g01x-12.5y+.5z2.f120');
    expect(parsed.alarms).toEqual([]);
    expect(parsed.blocks).toMatchObject([{ line: 1, words: [
      { letter: 'N', value: 10 }, { letter: 'G', value: 1 },
      { letter: 'X', value: -12.5 }, { letter: 'Y', value: .5 },
      { letter: 'Z', value: 2 }, { letter: 'F', value: 120 },
    ] }]);
  });
  it('handles headers, percent delimiters, comments and physical CRLF line numbers', () => {
    const parsed = parseProgram('%\r\nO1001 (PART)\r\n\r\nN900 G00 X1 ; approach\r\n%');
    expect(parsed.alarms).toEqual([]);
    expect(parsed.blocks.map(block => block.line)).toEqual([2, 4]);
    expect(parsed.blocks[1]?.words).toContainEqual({ letter: 'X', value: 1, raw: '1' });
  });
  it('preserves lines across multiline comments and bare CR line endings', () => {
    const parsed = parseProgram('(tool\rlist)\rG0 X1');
    expect(parsed.blocks[0]?.line).toBe(3);
  });
  it('ignores comment contents including unsupported codes and semicolons', () => {
    expect(parseProgram('G0 (G999 ; X-1) X2 ; (ignored').alarms).toEqual([]);
  });
  it('permits different modal codes in one block without interpreting them', () => {
    expect(parseProgram('G21 G90 G54 M3 M8').blocks[0]?.words).toHaveLength(5);
  });
  it.each(['', ' \n\t', '%\n%', '(only a comment)', '; only a comment'])('accepts empty program %j', source => {
    expect(parseProgram(source)).toEqual({ blocks: [], alarms: [], warnings: [] });
  });
  it.each([
    ['G0 X1 X2', 'duplicateWord'], ['F10 F20', 'duplicateWord'],
    ['G0 X', 'syntax'], ['G1 X1.2.3', 'syntax'], ['G1 X--2', 'syntax'],
    ['G0 X1e3', 'unsupportedWord'], ['G1 X[1+2]', 'syntax'],
    ['#1=2', 'syntax'], ['G0 % X1', 'syntax'], ['G0 XNaN', 'syntax'],
    ['G0 A10', 'unsupportedWord'], ['G4 L100', 'unsupportedWord'],
    ['(nested (comment))', 'comment'], ['G0 X1)', 'comment'],
    ['(unterminated', 'comment'],
  ])('rejects %s with %s', (source, code) => {
    expect(parseProgram(source).alarms[0]).toMatchObject({ code, line: 1 });
  });
  it('reports the opening line of an unterminated comment', () => {
    expect(parseProgram('\n\n(start\nend').alarms[0]?.line).toBe(3);
  });
  it('does not concatenate digits separated by a comment', () => {
    expect(parseProgram('G0 X1(comment)2').alarms[0]?.code).toBe('syntax');
  });
  it('discards all parsed blocks on a syntax error', () => {
    const result = parseProgram('G0 X1\nG1 X?');
    expect(result.blocks).toEqual([]);
    expect(result.alarms[0]?.line).toBe(2);
  });
  it('rejects non-finite numeric input', () => {
    expect(parseProgram(`G0 X${'9'.repeat(400)}`).alarms[0]?.code).toBe('invalidValue');
  });
  it('bounds source size and block count', () => {
    expect(parseProgram(' '.repeat(MAX_SOURCE_LENGTH + 1)).alarms[0]?.code).toBe('limit');
    expect(parseProgram('\n'.repeat(MAX_BLOCKS)).alarms[0]).toMatchObject({ code: 'limit', line: MAX_BLOCKS + 1 });
  });
});
