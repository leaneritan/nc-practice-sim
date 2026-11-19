import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { useAppStore } from './store';
import { usePrograms } from './programs';
import { defaultOffsets, defaultTools } from './setup';
import { en } from './i18n/en';
import { ja } from './i18n/ja';
import { chapterIds, parseGuide, screenChapters } from './guide/chapters';
import enGuide from './guide/en.md?raw';
import jaGuide from './guide/ja.md?raw';
import type { GuideChapter } from './guide/chapters';
import { sampleMazatrol } from './nc/mazatrol/model';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  localStorage.clear();
  usePrograms.setState({ documents: [], activeId: null });
  useAppStore.setState({ language: 'en', program: 'G91 G1 X-10. F60\nM30', workOffsets: defaultOffsets(), tools: defaultTools(), pocketWidth: 0, optionalStop: false });
});
afterEach(() => vi.useRealTimers());
const button = (name: string) => screen.getByRole('button', { name });
const chapterHeading = (id: GuideChapter, language: 'en' | 'ja' = 'en') => {
  const chapter = parseGuide(language === 'en' ? enGuide : jaGuide).find(c => c.id === id)!;
  return `${chapter.number}. ${chapter.title}`;
};
async function expectChapter(id: GuideChapter, language: 'en' | 'ja' = 'en') {
  const heading = await screen.findByRole('heading', { name: chapterHeading(id, language), level: 3 });
  expect(heading).toHaveFocus();
  expect(button(chapterHeading(id, language))).toHaveAttribute('aria-current', 'page');
}
// These full-app journeys render long Markdown tables; allow for coverage overhead.
describe('Phase 6A user guide', { timeout: 15000 }, () => {
  it('opens from the header, navigates all chapters, follows language and renders Term tooltips', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(button(en.guide.title)); await expectChapter('start');
    for (const id of chapterIds) { await user.click(button(chapterHeading(id))); await expectChapter(id); }
    await user.click(button(chapterHeading('basics')));
    const article = screen.getByRole('article');
    const term = within(article).getByRole('button', { name: 'work coordinates' });
    await user.hover(term);
    expect(screen.getByRole('tooltip')).toHaveTextContent('ワーク座標系');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.click(button('日本語')); await expectChapter('basics', 'ja');
    expect(screen.getByRole('article')).toHaveTextContent('−400＋5＋120＝−275');
    await user.click(button(ja.guide.back));
    expect(button(ja.guide.title)).toHaveFocus();
    expect(useAppStore.getState().program).toBe('G91 G1 X-10. F60\nM30');
  });
  it.each(Object.entries(screenChapters))('the ? on %s opens its matching chapter and returns to that screen', async (name, chapter) => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('tab', { name }));
    const panel = screen.getByRole('tabpanel');
    const help = within(panel).getByRole('button', { name: `${en.guide.help}: ${en.guide.chapters[chapter]}` });
    expect(help).toHaveTextContent('?');
    await user.click(help); await expectChapter(chapter);
    await user.click(button(en.guide.back));
    expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
    expect(help).toHaveFocus();
  });
  it('PROGRAM help selects Mazatrol for units and G-code for MDI', async () => {
    usePrograms.getState().add('Guide example', 'mazatrol', sampleMazatrol(defaultTools()));
    const user = userEvent.setup(); render(<App />);
    await user.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: 'Help: Mazatrol' }));
    await expectChapter('mazatrol'); await user.click(button(en.guide.back));
    await user.click(button('MDI'));
    await user.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: 'Help: Writing G-code' }));
    await expectChapter('gcode');
  });
  it('every extra ? button targets a valid chapter, including the guide itself', async () => {
    const user = userEvent.setup(); render(<App />);
    const helps = screen.getAllByRole('button', { name: /^Help:/ });
    expect(helps).toHaveLength(4); // active screen, operator panel, setup actions, glossary
    for (const help of helps) {
      const chapter = help.dataset.helpChapter as GuideChapter;
      expect(chapterIds).toContain(chapter);
      await user.click(help); await expectChapter(chapter);
      const guide = screen.getByRole('region', { name: en.guide.title });
      await user.click(within(guide).getByRole('button', { name: 'Help: Start here' }));
      await expectChapter('start'); await user.click(button(en.guide.back));
    }
  });
  it('holds active motion and does not resume until CYCLE START after returning', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(button('MEMORY')); await user.click(button('CYCLE START'));
    act(() => vi.advanceTimersByTime(500));
    const x = screen.getByLabelText('Machine position X').textContent;
    await user.click(button(en.guide.title)); await expectChapter('start');
    act(() => vi.advanceTimersByTime(5000));
    await user.click(button(en.guide.back));
    expect(screen.getByLabelText('Machine position X')).toHaveTextContent(x!);
    expect(screen.getByRole('status', { name: en.panel.statusLabel })).toHaveTextContent(en.panel.status.held);
    await user.click(button('CYCLE START'));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByLabelText('Machine position X').textContent).not.toBe(x);
  });
  it('blocks manual arrow shortcuts in the guide and preserves an uncommitted editor draft', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(button('HANDLE'));
    await user.click(button('Y−'));
    const before = screen.getByLabelText('Machine position Y').textContent;
    await user.click(button(en.guide.title)); await expectChapter('start');
    fireEvent.keyDown(screen.getByRole('article'), { key: 'ArrowDown' });
    await user.click(button(en.guide.back));
    expect(screen.getByLabelText('Machine position Y').textContent).toBe(before);
    await user.click(button('EDIT')); await user.click(screen.getByRole('tab', { name: 'TOOL DATA' }));
    const length = screen.getByRole('spinbutton', { name: `${en.panel.length} H1` });
    fireEvent.change(length, { target: { value: '-2' } });
    await user.click(button(en.guide.title)); await expectChapter('start');
    await user.click(button(en.guide.back));
    expect(length).toHaveValue(-2);
    expect(useAppStore.getState().tools[0]!.length).toBe(120);
  });
});
