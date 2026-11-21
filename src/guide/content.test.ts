// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chapterIds, parseGuide, helpChapter, screenChapters } from './chapters';
import { glossary } from '../i18n/glossary';
import { en } from '../i18n/en';
import { ja } from '../i18n/ja';
import { defaultOffsets, defaultTools, simulationOptions } from '../setup';
import { parseProgram, runProgram } from '../nc';

const sources = { en: readFileSync(new URL('./en.md', import.meta.url), 'utf8'), ja: readFileSync(new URL('./ja.md', import.meta.url), 'utf8') };
describe('editable bilingual guide contract', () => {
  it.each(['en', 'ja'] as const)('%s has all eight complete chapters and synchronized repository exports', language => {
    const source = sources[language], chapters = parseGuide(source);
    expect(chapters.map(c => c.id)).toEqual(chapterIds);
    for (const c of chapters) {
      expect(c.title.trim().length).toBeGreaterThan(0);
      expect(c.markdown).toMatch(/^1\. /m);
      expect(c.markdown).toMatch(/^2\. /m);
      expect(c.markdown).toContain('```text');
    }
    expect(readFileSync(new URL(`../../docs/guide-${language}.md`, import.meta.url), 'utf8')).toBe(source);
    for (const match of source.matchAll(/\]\(term:([^)]+)\)/g)) expect(glossary.some(t => t.id === match[1])).toBe(true);
    for (const match of source.matchAll(/\]\(#([^)]+)\)/g)) expect(chapterIds).toContain(match[1]);
    expect(source).not.toContain('<!-- ALARM_TABLE -->');
  });
  it.each(['en', 'ja'] as const)('%s lists every alarm with both meanings, cause and fix', language => {
    const checking = parseGuide(sources[language]).find(c => c.id === 'checking')!;
    const rows = checking.markdown.split('\n').filter(line => /^\| `\w+` \|/.test(line));
    expect(rows).toHaveLength(Object.keys(en.alarms).length);
    for (const [code, meaning] of Object.entries(en.alarms)) {
      const row = rows.find(line => line.startsWith(`| \`${code}\` |`));
      expect(row, code).toContain(meaning);
      expect(row, code).toContain(ja.alarms[code as keyof typeof ja.alarms]);
      const cells = row!.split('|').slice(1, -1).map(c => c.trim());
      expect(cells).toHaveLength(5);
      expect(cells[3]!.length).toBeGreaterThan(8);
      expect(cells[4]!.length).toBeGreaterThan(8);
    }
  });
  it('keeps all contextual help mappings valid, including Mazatrol and temporary MDI', () => {
    for (const screen of Object.keys(screenChapters) as (keyof typeof screenChapters)[]) {
      for (const mazatrol of [true, false]) for (const mdi of [true, false]) {
        expect(chapterIds).toContain(helpChapter(screen, mazatrol, mdi));
      }
    }
    expect(helpChapter('PROGRAM', true, false)).toBe('mazatrol');
    expect(helpChapter('PROGRAM', true, true)).toBe('gcode');
  });
  it('documents independent machine-coordinate WPC and the spindle gauge line in both languages', () => {
    expect(sources.en).toContain('spindle gauge line');
    expect(sources.ja).toContain('主軸端（ゲージライン）');
    expect(sources.en).not.toContain('machine reference point');
    expect(sources.ja).not.toContain('機械の基準点');
    for (const source of Object.values(sources)) {
      const chapter = parseGuide(source).find(c => c.id === 'mazatrol')!.markdown;
      expect(chapter).toContain('G10 L2 P1 X-500.0000 Y-250.0000 Z-400.0000');
      expect(chapter).not.toMatch(/relative to G54|G54からの移動/);
    }
    expect(sources.en).toContain('one M code per line');
    expect(sources.ja).toContain('1行にMコード1つ');
  });
  it('rejects accidentally removed, repeated or reordered chapter numbers', () => {
    for (const text of [sources.en.replace('## 8.', '## 9.'), sources.en.replace('## 2.', '## 1.'), '']) expect(() => parseGuide(text)).toThrow();
  });
  it('executes both fully commented examples with identical safe motions and decimal handling', () => {
    const results = Object.values(sources).map(source => {
      const code = source.match(/```gcode\n([\s\S]*?)```/)![1]!;
      expect(code.trim().split('\n').every(line => line.includes('(') && line.endsWith(')'))).toBe(true);
      expect(parseProgram(code).blocks.every(block => block.words.filter(word => word.letter === 'M').length <= 1)).toBe(true);
      const options = simulationOptions(defaultOffsets(), defaultTools());
      const result = runProgram(code, options);
      expect(result.alarms).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.state.ended).toBe(true);
      expect(result.state.position.z).toBe(0);
      expect(result.stock!.drilledHoles).toHaveLength(2);
      expect(result.segments).toEqual(runProgram(code, { ...options, strictDecimals: true }).segments);
      return result;
    });
    expect(results[0]!.segments).toEqual(results[1]!.segments);
  });
});
