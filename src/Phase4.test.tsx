import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { en } from './i18n/en';
import { ja } from './i18n/ja';
import { useAppStore } from './store';
import { defaultOffsets, defaultTools } from './setup';
const source = 'T1 M6\nG54 G0 G43 H1 Z15.\nX20. Y20.\nM3 S1000\nG1 Z-2. F600\nX40. F600\nM30';
const button = (name: string) => screen.getByRole('button', { name });
const tab = (name: string) => screen.getByRole('tab', { name });
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); localStorage.clear();
  useAppStore.setState({ language: 'en', program: source, workOffsets: defaultOffsets(), tools: defaultTools(), pocketWidth: 0, optionalStop: false, strictDecimals: false });
});
afterEach(() => vi.useRealTimers());

describe('Phase 4 production setup and screens', () => {
  it('shows realistic home coordinates and restores defaults without changing program/language', async () => {
    const user = userEvent.setup(); render(<App />); await user.click(tab('POSITION'));
    expect(screen.getByLabelText('Machine position Z')).toHaveTextContent('0.000');
    expect(screen.getByLabelText('Work position Z')).toHaveTextContent('400.000');
    await user.click(tab('WORK OFFSET')); const x = screen.getByRole('spinbutton', {name:'G54 X'});
    await user.clear(x); await user.type(x,'-600'); await user.tab();
    await user.click(tab('TOOL DATA')); const length = screen.getByRole('spinbutton',{name:'Tool length H1'});
    await user.clear(length); await user.type(length,'170'); await user.tab();
    expect(useAppStore.getState().tools[0]?.length).toBe(170);
    await user.click(button(en.sim.resetSetup));
    expect(useAppStore.getState().workOffsets[54].x).toBe(-500); expect(useAppStore.getState().tools[0]?.length).toBe(120);
    expect(useAppStore.getState().program).toBe(source); expect(useAppStore.getState().language).toBe('en');
    expect(JSON.parse(localStorage.getItem('nc-practice-phase1')!).state.tools[0].length).toBe(120);
  });
  it('animates M06, removes material, holds stock through RESET and replaces it explicitly', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(button('MEMORY')); await user.click(button('CYCLE START')); advance(1000);
    expect(screen.getByRole('region',{name:en.sim.magazine})).toHaveTextContent(en.sim.changing);
    expect(button(en.sim.resetSetup)).toBeDisabled(); expect(button(en.sim.newStock)).toBeDisabled();
    advance(15000);
    expect(screen.getByRole('status',{name:en.panel.statusLabel})).toHaveTextContent(en.panel.status.complete);
    const view = await screen.findByRole('region',{name:en.sim.title});
    const volume = () => Number(within(view).getByText(/Removed volume:/).textContent!.match(/[\d.]+/)![0]);
    expect(volume()).toBeGreaterThan(100);
    expect(screen.getByLabelText('Work position Z')).toHaveTextContent('-2.000');
    expect(screen.getByLabelText('Machine position Z')).toHaveTextContent('-282.000');
    const removed = volume(); await user.click(button('RESET')); expect(volume()).toBe(removed);
    await user.click(button(en.sim.newStock)); expect(volume()).toBe(0);
    expect(screen.getByRole('region',{name:en.sim.magazine})).toHaveTextContent('In spindle: T1');
  });
  it('reports localized safety alarms in preview and MEMORY without removing stock', async () => {
    useAppStore.setState({program:source.replace('G1 Z-2. F600','G0 Z-2.')});
    const user = userEvent.setup(); render(<App />); await user.click(tab('SHAPE CHECK')); await user.click(button(en.run));
    expect(screen.getByRole('alert')).toHaveTextContent(en.alarms.rapidStock);
    await user.click(button('MEMORY')); await user.click(button('CYCLE START')); advance(10000);
    await user.click(tab('ALARM')); expect(screen.getByRole('alert')).toHaveTextContent(en.alarms.rapidStock);
    await user.click(button('日本語')); expect(screen.getByRole('alert')).toHaveTextContent(ja.alarms.rapidStock);
    await user.click(button('RESET')); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('persists a pocket width and validates a tool against it', async () => {
    const user = userEvent.setup(); render(<App />); await user.click(tab('TOOL DATA'));
    const width = screen.getByRole('spinbutton',{name:en.sim.pocketWidth});
    fireEvent.change(width,{target:{value:'4'}}); fireEvent.blur(width);
    expect(useAppStore.getState().pocketWidth).toBe(4);
    await user.click(button('MEMORY')); await user.click(button('CYCLE START')); advance(10000);
    await user.click(tab('ALARM')); expect(screen.getByRole('alert')).toHaveTextContent(en.alarms.pocketDiameter);
  });
  it('previews removal on a copy without altering the live stock', async () => {
    const user = userEvent.setup(); render(<App />); await user.click(tab('SHAPE CHECK')); await user.click(button(en.run));
    const preview = await screen.findByRole('region',{name:en.sim.title});
    expect(within(preview).getByText(/Removed volume:/)).not.toHaveTextContent('0.0 mm³');
    await user.click(tab('POSITION')); const live = await screen.findByRole('region',{name:en.sim.title});
    expect(within(live).getByText(/Removed volume:/)).toHaveTextContent('0.0 mm³');
  });
});
