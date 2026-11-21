import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { useAppStore } from './store';
import { usePrograms } from './programs';
import { useLessons } from './lessons/store';
import { lessons } from './lessons/catalog';
import { eiaFor, solutionProgram } from './lessons/programs';
import { en } from './i18n/en';
import { ja } from './i18n/ja';
import { defaultOffsets, defaultTools } from './setup';

const button = (name: string) => screen.getByRole('button', { name });
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); localStorage.clear();
  usePrograms.setState({ documents: [], activeId: null }); useLessons.setState({ progress: {}, drafts: {} });
  useAppStore.setState({ language: 'en', program: 'G91 G1 X-10. F60\nM30', workOffsets: defaultOffsets(), tools: defaultTools(), pocketWidth: 0, strictDecimals: false, optionalStop: false });
});
afterEach(() => vi.useRealTimers());
async function open() {
  const user = userEvent.setup(); render(<App />); await user.click(button(en.lessons.title));
  await screen.findByRole('heading', { name: en.lessons.items.face.title }); return user;
}
describe('lesson journeys', { timeout: 20000 }, () => {
  it('checks an unfinished starter, edits a Mazatrol solution, stores the pass and leaves free practice untouched', async () => {
    const user = await open(); const original = useAppStore.getState().program;
    await user.click(button(en.lessons.run));
    await screen.findByRole('heading', { name: `${en.lessons.result} · ${en.lessons.fail}` });
    expect(useLessons.getState().progress['face:mazatrol']?.attempts).toBe(1);
    await user.click(button('3 · FACE MILL'));
    const depth = screen.getByRole('spinbutton', { name: en.maz.fields.depth });
    fireEvent.change(depth, { target: { value: '1' } }); fireEvent.blur(depth);
    expect(screen.getByRole('heading', { name: `${en.lessons.result} · ${en.lessons.stale}` })).toBeInTheDocument();
    await user.click(button(en.maz.regenerate)); await user.click(button(en.lessons.run));
    await screen.findByRole('heading', { name: `${en.lessons.result} · ${en.lessons.pass}` });
    expect(useLessons.getState().progress['face:mazatrol']).toMatchObject({ attempts: 2, best: { passed: true } });
    await user.click(button(en.lessons.back));
    expect(useAppStore.getState().program).toBe(original); expect(useAppStore.getState().tools).toEqual(defaultTools());
  });
  it('keeps EIA and Mazatrol drafts/results independent and can pass the EIA track', async () => {
    const user = await open(); await user.click(button(`${en.maz.formats.eia} · ${en.lessons.untried}`));
    fireEvent.change(screen.getByLabelText(en.lessons.program), { target: { value: eiaFor(solutionProgram(lessons[0]!)) } });
    await user.click(button(en.lessons.run)); await screen.findByRole('heading', { name: `${en.lessons.result} · ${en.lessons.pass}` });
    expect(useLessons.getState().progress['face:eia']?.best.passed).toBe(true);
    expect(useLessons.getState().progress['face:mazatrol']).toBeUndefined();
    await user.click(button(`${en.maz.formats.mazatrol} · ${en.lessons.untried}`)); await user.click(button('3 · FACE MILL'));
    expect(screen.getByRole('spinbutton', { name: en.maz.fields.depth })).toHaveValue(.5);
    await user.click(button(`${en.maz.formats.eia} · ${en.lessons.pass}`));
    expect(screen.getByLabelText(en.lessons.program)).toHaveValue(eiaFor(solutionProgram(lessons[0]!)));
  });
  it('all lesson ? buttons open the matching chapter and return with the draft intact; language follows the header', async () => {
    const user = await open();
    for (const lesson of lessons) {
      const nav = screen.getByRole('navigation', { name: en.lessons.title });
      await user.click(within(nav).getByRole('button', { name: new RegExp(`^${en.lessons.items[lesson.id].title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }));
      const help = button(`${en.guide.help}: ${en.guide.chapters[lesson.chapter]}`);
      expect(help.dataset.helpChapter).toBe(lesson.chapter); await user.click(help);
      await screen.findByRole('article'); await user.click(button(en.lessons.backToLessons));
      expect(screen.getByRole('heading', { name: en.lessons.items[lesson.id].title })).toBeInTheDocument(); expect(help).toHaveFocus();
    }
    await user.click(button('日本語'));
    expect(screen.getByRole('heading', { name: ja.lessons.items.combined.title })).toBeInTheDocument();
    expect(screen.getByText(ja.lessons.tolerance)).toBeInTheDocument();
  });
  it('shows fourteen independent progress rows and validates the progress help chapter', async () => {
    const user = userEvent.setup(); render(<App />); await user.click(button(en.lessons.progress));
    const region = await screen.findByRole('region', { name: en.lessons.progress });
    expect(within(region).getAllByRole('row')).toHaveLength(15);
    await user.click(within(region).getByRole('button', { name: 'Help: Running and checking' }));
    await screen.findByRole('article'); await user.click(button(en.lessons.backToLessons));
    await user.click(button(`${en.lessons.open}: ${en.lessons.items.pocket.title} · ${en.maz.formats.eia}`));
    expect(screen.getByLabelText(en.lessons.program)).toBeInTheDocument();
  });
  it('opening lessons holds a running cycle and blocks manual keys until returning', async () => {
    const user = userEvent.setup(); render(<App />); await user.click(button('MEMORY')); await user.click(button('CYCLE START'));
    act(() => vi.advanceTimersByTime(500)); const x = screen.getByLabelText('Machine position X').textContent;
    await user.click(button(en.lessons.title)); await screen.findByRole('heading', { name: en.lessons.items.face.title });
    act(() => vi.advanceTimersByTime(2000)); await user.click(button(en.lessons.back));
    expect(screen.getByLabelText('Machine position X')).toHaveTextContent(x!);
    expect(screen.getByRole('status', { name: en.panel.statusLabel })).toHaveTextContent(en.panel.status.held);
    await user.click(button('RESET')); await user.click(button('HANDLE'));
    await user.click(button(en.lessons.title)); await screen.findByRole('heading', { name: en.lessons.items.face.title });
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' }); await user.click(button(en.lessons.back));
    expect(screen.getByLabelText('Machine position X')).toHaveTextContent(x!);
  });
});
