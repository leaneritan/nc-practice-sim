import './test/legacySetup';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './PracticePreview';
import { en } from './i18n/en';
import { ja } from './i18n/ja';
import { glossary } from './i18n/glossary';
import { runProgram } from './nc';
import { safeStorage, useAppStore } from './store';

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ language: 'ja', program: ja.sampleProgram, strictDecimals: false, optionalStop: false });
});

describe('Phase 1 page', () => {
  it('starts in Japanese and displays the practice disclaimer and fixed PROGRAM key', () => {
    render(<App />);
    expect(document.documentElement.lang).toBe('ja');
    expect(document.title).toBe(ja.title);
    expect(screen.getByText(ja.disclaimer)).toBeVisible();
    expect(screen.getByRole('button', { name: 'PROGRAM' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: ja.programLabel })).toHaveValue(ja.sampleProgram);
  });
  it('runs the example and displays the same movements as the pure core', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: ja.run }));
    const expected = runProgram(ja.sampleProgram);
    expect(expected.alarms).toEqual([]);
    expect(screen.getByRole('status')).toHaveTextContent(ja.complete);
    expect(screen.getAllByRole('row')).toHaveLength(expected.segments.length + 1);
    expect(screen.getAllByRole('button', { name: '深穴あけサイクル' })).toHaveLength(1);
  });
  it('switches all interface messages, document language and stored preference', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByText(en.disclaimer)).toBeVisible();
    expect(screen.getByRole('button', { name: en.run })).toBeVisible();
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem('nc-practice-phase1')!).state.language).toBe('en');
    await user.click(screen.getByRole('button', { name: '日本語' }));
    expect(screen.getByText(ja.disclaimer)).toBeVisible();
  });
  it('shows a line-numbered localized alarm and updates it when language changes', async () => {
    useAppStore.setState({ program: 'G0 X10\nG999\nG0 X99' });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: ja.run }));
    expect(screen.getByRole('alert')).toHaveTextContent(ja.alarms.unsupportedCode);
    expect(screen.getByRole('alert')).toHaveTextContent('2');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('alert')).toHaveTextContent(en.alarms.unsupportedCode);
  });
  it('marks edited results stale, saves the program and clears old alarms on a new run', async () => {
    useAppStore.setState({ program: 'G999' });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: ja.run }));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'G0 X2');
    expect(screen.getByRole('status')).toHaveTextContent(ja.stale);
    expect(JSON.parse(localStorage.getItem('nc-practice-phase1')!).state.program).toBe('G0 X2');
    await user.click(screen.getByRole('button', { name: ja.run }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(ja.complete);
  });
  it('handles an empty program and can restore the example', async () => {
    useAppStore.setState({ program: '' });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: ja.run }));
    expect(screen.getByText(ja.empty)).toBeVisible();
    await user.click(screen.getByRole('button', { name: ja.reset }));
    expect(screen.getByRole('textbox')).toHaveValue(ja.sampleProgram);
  });
  it('paginates large results and resets to the first page on rerun', async () => {
    useAppStore.setState({ program: 'G91 G0\n' + 'X1\n'.repeat(105) });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: ja.run }));
    expect(screen.getAllByRole('row')).toHaveLength(101);
    expect(screen.getByRole('button', { name: ja.previous })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: ja.next }));
    expect(screen.getAllByRole('row')).toHaveLength(6);
    expect(screen.getByRole('button', { name: ja.next })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: ja.previous }));
    expect(screen.getAllByRole('row')).toHaveLength(101);
    await user.click(screen.getByRole('button', { name: ja.next }));
    await user.click(screen.getByRole('button', { name: ja.run }));
    expect(screen.getByRole('button', { name: ja.previous })).toBeDisabled();
  });
});

describe('glossary accessibility and localization', () => {
  it('retains the original terms and includes complete conversational entries and matching translations', () => {
    expect(glossary.slice(0, 22).map(term => term.id)).toContain('vise');
    expect(glossary.map(term => term.id)).toEqual(expect.arrayContaining(['tapping', 'autoTools', 'wpcUnit', 'gridPattern']));
    expect(new Set(glossary.map(term => term.id)).size).toBe(glossary.length);
    for (const term of glossary) for (const value of Object.values(term)) expect(value.length).toBeGreaterThan(0);
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(ja.alarms).sort()).toEqual(Object.keys(en.alarms).sort());
  });
  it('shows all five learning fields on hover and dismisses on mouse leave', async () => {
    const user = userEvent.setup();
    render(<App />);
    const trigger = screen.getAllByRole('button', { name: '早送り' }).at(-1)!;
    await user.hover(trigger);
    const tooltip = screen.getByRole('tooltip');
    for (const text of ['早送り', 'はやおくり', 'hayaokuri', 'Rapid traverse', glossary[2].meaningJa]) {
      expect(within(tooltip).getByText(text)).toBeVisible();
    }
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
    await user.unhover(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('supports tap toggling, keyboard focus, Escape and outside dismissal', async () => {
    const user = userEvent.setup();
    render(<App />);
    const trigger = screen.getAllByRole('button', { name: '早送り' }).at(-1)!;
    await user.click(trigger);
    expect(screen.getByRole('tooltip')).toBeVisible();
    await user.unhover(trigger);
    expect(screen.getByRole('tooltip')).toBeVisible();
    await user.click(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    act(() => { trigger.blur(); trigger.focus(); });
    expect(screen.getByRole('tooltip')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.click(trigger);
    await user.click(screen.getByRole('heading', { level: 1 }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('uses the English explanation while keeping Japanese reading and romaji', async () => {
    useAppStore.setState({ language: 'en' });
    const user = userEvent.setup();
    render(<App />);
    await user.hover(screen.getAllByRole('button', { name: 'Rapid traverse' }).at(-1)!);
    expect(screen.getByRole('tooltip')).toHaveTextContent(glossary[2].meaningEn);
    expect(screen.getByRole('tooltip')).toHaveTextContent('はやおくり');
  });
});

describe('local persistence resilience', () => {
  it('rehydrates the language and program and validates stored types', async () => {
    localStorage.setItem('nc-practice-phase1', JSON.stringify({ state: { language: 'en', program: 'G0 X5' }, version: 0 }));
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState()).toMatchObject({ language: 'en', program: 'G0 X5' });
    localStorage.setItem('nc-practice-phase1', JSON.stringify({ state: { language: 'xx', program: 123 }, version: 0 }));
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState()).toMatchObject({ language: 'ja', program: 'G0 X5' });
  });
  it('survives malformed saved JSON', async () => {
    localStorage.setItem('nc-practice-phase1', '{broken');
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().language).toBe('ja');
  });
  it('continues in memory when browser storage is blocked', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(safeStorage.getItem('x')).toBeNull();
    expect(() => safeStorage.removeItem('x')).not.toThrow();
    expect(() => useAppStore.getState().setLanguage('en')).not.toThrow();
    expect(useAppStore.getState().language).toBe('en');
    get.mockRestore(); set.mockRestore(); remove.mockRestore();
  });
});
