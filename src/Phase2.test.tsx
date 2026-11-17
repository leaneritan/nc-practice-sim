import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { en } from './i18n/en';
import { ja } from './i18n/ja';
import { useAppStore } from './store';
import { PathView } from './components/PathView';
import { runProgram } from './nc';

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ language: 'en', program: en.sampleProgram, strictDecimals: false, optionalStop: false });
});

describe('Phase 2 page flows', () => {
  it('shows both canvas views and exactly three sample choices', () => {
    render(<App />);
    expect(screen.getByRole('img', { name: en.xyCanvas })).toBeVisible();
    expect(screen.getByRole('img', { name: en.xzCanvas })).toBeVisible();
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByText(en.stockNote)).toBeVisible();
    expect(screen.queryByRole('note', { name: en.decimalWarning })).not.toBeInTheDocument();
  });
  it('loads each chosen sample only when Load is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByRole('combobox'), 'drilling');
    expect(screen.getByRole('textbox')).toHaveValue(en.sampleProgram);
    await user.click(screen.getByRole('button', { name: en.reset }));
    expect(screen.getByRole('textbox')).toHaveValue(en.samples.drilling.program);
    await user.click(screen.getByRole('button', { name: en.run }));
    expect(screen.getByRole('status')).toHaveTextContent(en.complete);
    expect(screen.getByRole('list', { name: en.events })).toHaveTextContent(en.dwell + ' 500');
    expect(screen.getByRole('list', { name: en.events })).toHaveTextContent(en.optionalSkipped);
    await user.selectOptions(screen.getByRole('combobox'), 'tapping');
    await user.click(screen.getByRole('button', { name: en.reset }));
    expect(screen.getByRole('textbox')).toHaveValue(en.samples.tapping.program);
  });
  it('warns immediately, keeps normal mm values, and rescales only after a strict-mode Run', async () => {
    useAppStore.setState({ program: 'G0 X10' });
    const user = userEvent.setup();
    render(<App />);
    const note = screen.getByRole('note', { name: en.decimalWarning });
    expect(note).toHaveTextContent('0.010 mm');
    expect(note).toHaveClass('decimal-warning');
    await user.click(screen.getByRole('button', { name: en.run }));
    expect(screen.getByRole('table')).toHaveTextContent('X 10');
    await user.click(screen.getByRole('checkbox', { name: en.strictDecimals }));
    expect(screen.getByRole('status')).toHaveTextContent(en.stale);
    expect(note).toHaveTextContent(en.decimalStrict);
    await user.click(screen.getByRole('button', { name: en.run }));
    expect(screen.getByRole('table')).toHaveTextContent('X 0.01');
    await user.type(screen.getByRole('textbox'), '.');
    expect(screen.queryByRole('note', { name: en.decimalWarning })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: en.run }));
    expect(screen.getByRole('table')).toHaveTextContent('X 10');
  });
  it('localizes the warning and settings without modifying the program', async () => {
    useAppStore.setState({ program: 'G0 X10' });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '日本語' }));
    expect(screen.getByRole('note', { name: ja.decimalWarning })).toHaveTextContent(ja.decimalExplanation);
    expect(screen.getByRole('checkbox', { name: ja.strictDecimals })).toBeVisible();
    expect(screen.getByRole('textbox')).toHaveValue('G0 X10');
    expect(screen.getByRole('img', { name: ja.xyCanvas })).toBeVisible();
  });
  it('persists settings and defaults old Phase 1 storage to non-strict input', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('checkbox', { name: en.strictDecimals }));
    await user.click(screen.getByRole('checkbox', { name: en.optionalStop }));
    const saved = localStorage.getItem('nc-practice-phase1');
    expect(JSON.parse(saved!).state).toMatchObject({ strictDecimals: true, optionalStop: true });
    act(() => useAppStore.setState({ strictDecimals: false, optionalStop: false }));
    localStorage.setItem('nc-practice-phase1', saved!);
    await act(() => useAppStore.persist.rehydrate());
    expect(screen.getByRole('checkbox', { name: en.strictDecimals })).toBeChecked();
    localStorage.setItem('nc-practice-phase1', JSON.stringify({ state: { language: 'en', program: 'G0 X10' }, version: 0 }));
    await act(() => useAppStore.persist.rehydrate());
    expect(screen.getByRole('checkbox', { name: en.strictDecimals })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: en.optionalStop })).not.toBeChecked();
  });
  it('pauses tapping at M00, continues through reversals and disables Continue after edits', async () => {
    useAppStore.setState({ program: en.samples.tapping.program });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: en.run }));
    expect(screen.getByRole('status')).toHaveTextContent(en.paused);
    expect(screen.getByRole('list', { name: en.events })).not.toHaveTextContent(en.spindleCCW);
    await user.click(screen.getByRole('button', { name: en.continueRun }));
    expect(screen.getByRole('status')).toHaveTextContent(en.complete);
    expect(screen.getByRole('list', { name: en.events })).toHaveTextContent(en.spindleCCW);
    expect(screen.getByRole('list', { name: en.events })).toHaveTextContent(en.dwell + ' 250');
    await user.click(screen.getByRole('button', { name: en.run }));
    await user.click(screen.getByRole('checkbox', { name: en.strictDecimals }));
    expect(screen.getByRole('button', { name: en.continueRun })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: en.run }));
    expect(screen.getByRole('button', { name: en.continueRun })).toBeEnabled();
    await user.type(screen.getByRole('textbox'), '\n');
    expect(screen.getByRole('button', { name: en.continueRun })).toBeDisabled();
  });
  it('honors M01 only when the checkbox was enabled for the Run', async () => {
    useAppStore.setState({ program: 'G0 X1.\nM1\nX2.' });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('checkbox', { name: en.optionalStop }));
    await user.click(screen.getByRole('button', { name: en.run }));
    expect(screen.getAllByRole('row')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: en.continueRun }));
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });
  it('paginates the event log and bounds long warning lists', async () => {
    useAppStore.setState({ program: 'G82 R2 Z-2 P100 F100\n' + 'X1\n'.repeat(60) });
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText(en.warningLimit)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: en.run }));
    expect(within(screen.getByRole('list', { name: en.events })).getAllByRole('listitem')).toHaveLength(50);
    const pagination = screen.getByRole('navigation', { name: en.events });
    await user.click(within(pagination).getByRole('button', { name: en.next }));
    expect(within(screen.getByRole('list', { name: en.events })).getAllByRole('listitem')).toHaveLength(11);
    await user.click(within(pagination).getByRole('button', { name: en.previous }));
    expect(within(screen.getByRole('list', { name: en.events })).getAllByRole('listitem')).toHaveLength(50);
  });
});

it('draws both canvases with dashed rapids, solid feeds, stock/vise rectangles and tool markers', () => {
  const ctx = {
    setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    fillText: vi.fn(), setLineDash: vi.fn(), arc: vi.fn(),
  };
  const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  const result = runProgram('G0 X10.\nG1 Y20. F100');
  const view = render(<PathView segments={result.segments} position={result.state.position} />);
  expect(ctx.strokeRect).toHaveBeenCalledTimes(8);
  expect(ctx.setLineDash).toHaveBeenCalledWith([6, 5]);
  expect(ctx.setLineDash).toHaveBeenCalledWith([]);
  expect(ctx.arc).toHaveBeenCalledTimes(2);
  view.unmount();
  spy.mockReturnValue(null);
});
