import './test/legacySetup';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { en } from './i18n/en';
import { ja } from './i18n/ja';
import { useAppStore } from './store';
import { defaultOffsets, defaultTools, restoreSetup } from './setup';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] }); localStorage.clear();
  useAppStore.setState({ language: 'en', program: 'G1 X10. F60\nM30', workOffsets: defaultOffsets(), tools: defaultTools(), strictDecimals: false, optionalStop: false });
});
afterEach(() => vi.useRealTimers());
const button = (name: string) => screen.getByRole('button', { name });
const tab = (name: string) => screen.getByRole('tab', { name });
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const position = (kind: 'work' | 'machine' | 'remaining', axis = 'X') => Number(screen.getByLabelText(`${kind === 'work' ? en.panel.workPosition : kind === 'machine' ? en.panel.machinePosition : en.panel.remaining} ${axis}`).textContent);
const user = () => userEvent.setup();

describe('Phase 3 control panel', () => {
  it('exposes six screens and eight modes with TAPE disabled, and keeps key names in Japanese', async () => {
    const u = user(); render(<App />);
    expect(screen.getAllByRole('tab')).toHaveLength(6);
    expect(button('TAPE')).toBeDisabled(); expect(button('CYCLE START')).toBeDisabled();
    expect(button('EDIT')).toHaveAttribute('aria-pressed', 'true');
    await u.click(button('日本語'));
    expect(button('CYCLE START')).toBeVisible(); expect(tab('WORK OFFSET')).toBeVisible();
    expect(screen.getByText(ja.disclaimer)).toBeVisible();
  });
  it('MEMORY advances live, holds in mid-move, resumes and resets without teleporting', async () => {
    const u = user(); render(<App />);
    await u.click(button('MEMORY')); await u.click(button('CYCLE START'));
    advance(1000); expect(position('machine')).toBeCloseTo(1); expect(position('remaining')).toBeCloseTo(9);
    await u.click(button('FEED HOLD')); advance(5000);
    expect(position('machine')).toBeCloseTo(1); expect(screen.getByRole('status', { name: en.panel.statusLabel })).toHaveTextContent(en.panel.status.held);
    expect(button('EDIT')).toBeDisabled();
    await u.click(button('CYCLE START')); advance(1000); expect(position('machine')).toBeCloseTo(2);
    await u.click(button('RESET')); advance(5000);
    expect(position('machine')).toBeCloseTo(2); expect(position('remaining')).toBe(0);
    expect(button('EDIT')).toBeEnabled();
  });
  it('SINGLE BLOCK advances source blocks instead of all motions at once', async () => {
    useAppStore.setState({ program: 'G0 X1.\nX2.\nM30' });
    const u = user(); render(<App />);
    await u.click(screen.getByRole('checkbox', { name: 'SINGLE BLOCK' }));
    await u.click(button('MEMORY')); await u.click(button('CYCLE START')); advance(1000);
    expect(position('machine')).toBe(1); expect(screen.getByRole('status', { name: en.panel.statusLabel })).toHaveTextContent(en.panel.status.singleBlock);
    await u.click(button('CYCLE START')); advance(1000); expect(position('machine')).toBe(2);
    await u.click(button('CYCLE START')); advance(100); expect(screen.getByRole('status', { name: en.panel.statusLabel })).toHaveTextContent(en.panel.status.complete);
  });
  it('updates feed/spindle overrides, DRY RUN and coolant controls', async () => {
    useAppStore.setState({ program: 'M3 S1000\nG1 X100. F60' });
    const u = user(); render(<App />);
    await u.click(button('MEMORY')); await u.click(button('CYCLE START')); advance(1000);
    fireEvent.change(screen.getByRole('slider', { name: en.panel.feedOverride }), { target: { value: '50' } });
    fireEvent.change(screen.getByRole('slider', { name: en.panel.spindleOverride }), { target: { value: '120' } });
    advance(1000); expect(position('machine')).toBeCloseTo(1.5);
    expect(screen.getByRole('status', { name: en.panel.statusLabel })).toHaveTextContent('S 1200.000');
    await u.click(button('COOLANT')); expect(button('COOLANT')).toHaveAttribute('aria-pressed', 'true');
    await u.click(screen.getByRole('checkbox', { name: 'DRY RUN' })); advance(600);
    expect(position('machine')).toBeCloseTo(6.5);
  });
  it('M00/M01 stop through the panel and resume with CYCLE START', async () => {
    useAppStore.setState({ program: 'G0 X1. M0\nX2. M1\nX3.\nM30' });
    const u = user(); render(<App />);
    await u.click(screen.getByRole('checkbox', { name: 'OPTIONAL STOP' }));
    await u.click(button('MEMORY')); await u.click(button('CYCLE START')); advance(1000); expect(position('machine')).toBe(1);
    expect(screen.getByRole('status', { name: en.panel.statusLabel })).toHaveTextContent(en.panel.status.programStop);
    await u.click(button('CYCLE START')); advance(1000); expect(position('machine')).toBe(2);
    await u.click(button('CYCLE START')); advance(1000); expect(position('machine')).toBe(3);
  });
  it('preserves modal state across separate MDI entries without editing the memory program', async () => {
    const u = user(); render(<App />);
    const program = useAppStore.getState().program;
    await u.click(button('MDI'));
    await u.type(screen.getByRole('textbox', { name: en.panel.mdiLabel }), 'G91 G1 X2. F600 M3 S400');
    await u.click(button('CYCLE START')); advance(1000); expect(position('machine')).toBe(2);
    await u.click(tab('PROGRAM'));
    await u.clear(screen.getByRole('textbox', { name: en.panel.mdiLabel }));
    await u.type(screen.getByRole('textbox', { name: en.panel.mdiLabel }), 'X3.');
    await u.click(button('CYCLE START')); advance(1000); expect(position('machine')).toBe(5);
    expect(screen.getByRole('status', { name: en.panel.statusLabel })).toHaveTextContent('S 400.000');
    expect(useAppStore.getState().program).toBe(program);
  });
  it('HANDLE applies the selected multiplier and JOG stops on pointer release or blur', async () => {
    const u = user(); render(<App />);
    await u.click(button('HANDLE'));
    await u.selectOptions(screen.getByRole('combobox', { name: en.panel.handleScale }), '100');
    await u.click(button('X+')); expect(position('machine')).toBeCloseTo(.1);
    await u.click(button('X−')); expect(position('machine')).toBe(0);
    await u.click(button('JOG'));
    fireEvent.pointerDown(button('X+'), { pointerId: 1 }); advance(400);
    fireEvent.pointerUp(button('X+'), { pointerId: 1 });
    const heldPosition = position('machine'); expect(heldPosition).toBeGreaterThan(1);
    advance(1000); expect(position('machine')).toBe(heldPosition);
    fireEvent.pointerDown(button('Y+'), { pointerId: 2 }); advance(100); fireEvent(window, new Event('blur'));
    const y = position('machine', 'Y'); advance(500); expect(position('machine', 'Y')).toBe(y);
  });
  it('keyboard jog ignores editable input and uses key-up to stop', async () => {
    const u = user(); render(<App />); await u.click(button('JOG'));
    fireEvent.keyDown(document.body, { key: 'ArrowRight' }); advance(300); fireEvent.keyUp(window, { key: 'ArrowRight' });
    const x = position('machine'); expect(x).toBeGreaterThan(0); advance(500); expect(position('machine')).toBe(x);
    await u.click(tab('PROGRAM'));
    const input = screen.getByRole('textbox', { name: en.programLabel }); fireEvent.keyDown(input, { key: 'ArrowRight' }); advance(300);
    await u.click(tab('POSITION')); expect(position('machine')).toBe(x);
  });
  it('routes parser alarms to ALARM and RESET clears them', async () => {
    useAppStore.setState({ program: 'G0 X1.\nG999' });
    const u = user(); render(<App />); await u.click(button('MEMORY')); await u.click(button('CYCLE START')); advance(1000);
    await u.click(tab('ALARM'));
    expect(screen.getByRole('alert')).toHaveTextContent(en.alarms.unsupportedCode);
    expect(screen.getByRole('alert')).toHaveTextContent('2');
    await u.click(button('RESET')); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(en.panel.noAlarms)).toBeVisible();
  });
});

describe('editable setup and WORK-coordinate integration', () => {
  it('edits G54 and H1, persists them, then shows different work and machine positions', async () => {
    useAppStore.setState({ program: 'G54 G43 H1 G0 X10. Y15. Z5.\nM30' });
    const u = user(); render(<App />);
    await u.click(tab('WORK OFFSET'));
    for (const [axis, value] of [['X', '100'], ['Y', '200'], ['Z', '30']]) {
      const input = screen.getByRole('spinbutton', { name: `G54 ${axis}` });
      await u.clear(input); await u.type(input, value!); await u.tab();
    }
    await u.click(tab('TOOL DATA'));
    const length = screen.getByRole('spinbutton', { name: `${en.panel.length} H1` });
    await u.clear(length); await u.type(length, '50'); await u.tab();
    expect(useAppStore.getState().tools[0]?.length).toBe(50);
    expect(JSON.parse(localStorage.getItem('nc-practice-phase1')!).state.workOffsets[54]).toEqual({ x: 100, y: 200, z: 30 });
    await u.click(button('MEMORY')); await u.click(button('CYCLE START')); advance(5000);
    expect(position('work')).toBe(10); expect(position('work', 'Y')).toBe(15); expect(position('work', 'Z')).toBe(5);
    expect(position('machine')).toBe(110); expect(position('machine', 'Y')).toBe(215); expect(position('machine', 'Z')).toBe(85);
    expect(screen.getByRole('img', { name: en.xyCanvas })).toBeVisible();
    expect(screen.getByRole('img', { name: en.xzCanvas })).toBeVisible();
  });
  it('SHAPE CHECK lists work-space arc centers and endpoints with edited offsets and H', async () => {
    const offsets = defaultOffsets(); offsets[55] = { x: 100, y: 200, z: 30 };
    const tools = defaultTools(); tools[1]!.length = 50;
    useAppStore.setState({ workOffsets: offsets, tools, program: 'G55 G43 H2 G0 X0. Y0. Z0.\nG3 X10. Y10. I0. J10. F100' });
    const u = user(); render(<App />); await u.click(tab('SHAPE CHECK')); await u.click(button(en.run));
    const table = screen.getByRole('table');
    expect(table).toHaveTextContent('X 10 · Y 10 · Z 0');
    expect(table).toHaveTextContent('Centre: X 0 · Y 10 · Z 0');
    expect(table).not.toHaveTextContent('X 110 · Y 210 · Z 80');
    await u.click(tab('POSITION')); expect(position('machine')).toBe(0); expect(position('machine', 'Z')).toBe(80);
  });
  it('locks setup while running or held and allows edits after RESET', async () => {
    const u = user(); render(<App />); await u.click(button('MEMORY')); await u.click(button('CYCLE START')); advance(100);
    await u.click(tab('WORK OFFSET')); expect(screen.getByRole('spinbutton', { name: 'G54 X' })).toBeDisabled();
    await u.click(button('FEED HOLD')); await u.click(tab('TOOL DATA'));
    expect(screen.getByRole('spinbutton', { name: `${en.panel.length} H1` })).toBeDisabled();
    await u.click(button('RESET')); expect(screen.getByRole('spinbutton', { name: `${en.panel.length} H1` })).toBeEnabled();
  });
  it('selects a work frame without moving the machine and rejects invalid saved values', async () => {
    const offsets = defaultOffsets(); offsets[55].x = 100;
    useAppStore.setState({ workOffsets: offsets });
    const u = user(); render(<App />); await u.click(tab('WORK OFFSET')); await u.click(button('Select G55'));
    await u.click(tab('POSITION')); expect(position('machine')).toBe(0); expect(position('work')).toBe(-100);
    await u.click(tab('TOOL DATA')); const input = screen.getByRole('spinbutton', { name: `${en.panel.length} H1` });
    await u.clear(input); await u.type(input, '-10'); await u.tab();
    expect(input).toHaveAttribute('aria-invalid', 'true'); expect(useAppStore.getState().tools[0]?.length).toBe(0);
    expect(screen.getByRole('alert')).toHaveTextContent(en.panel.invalidNumber);
  });
  it('validates browser setup schema and migrates Phase 1/2 storage safely', () => {
    expect(restoreSetup(null).workOffsets[54]).toEqual({ x: -500, y: -250, z: -400 });
    expect(restoreSetup(null).tools[0]?.length).toBe(120);
    const restored = restoreSetup({ workOffsets: { 54: { x: NaN, y: 0, z: 0 }, 55: { x: -20, y: 30, z: 40 } }, tools: [null, { pocket: 2, kind: 'tap', nominal: 8, actual: 8, length: 60, life: 100 }] });
    expect(restored.workOffsets[54]).toEqual({ x: -500, y: -250, z: -400 });
    expect(restored.workOffsets[55]).toEqual({ x: -20, y: 30, z: 40 });
    expect(restored.tools[1]).toMatchObject({ kind: 'tap', length: 60 });
    expect(restored.tools[0]).toMatchObject({ kind: 'endMill', length: 120 });
  });
});
