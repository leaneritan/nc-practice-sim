import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { defaultOffsets, defaultTools } from './setup';
import { useAppStore } from './store';
import { usePrograms } from './programs';
import { sampleMazatrol } from './nc/mazatrol/model';
import { en } from './i18n/en';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  localStorage.clear();
  usePrograms.setState({ documents: [], activeId: null });
  useAppStore.setState({ language: 'en', program: 'M30', workOffsets: defaultOffsets(), tools: defaultTools(), strictDecimals: false, optionalStop: false, pocketWidth: 0 });
});
afterEach(() => vi.useRealTimers());
const button = (name: string) => screen.getByRole('button', { name });
const tab = (name: string) => screen.getByRole('tab', { name });

describe('WPC in the program editor and machine screens', { timeout: 15000 }, () => {
  it('persists the one-time legacy conversion using the current saved G54, even after rehydration', async () => {
    const offsets = defaultOffsets(); offsets[54] = { x: -650, y: -310, z: -380 };
    useAppStore.setState({ workOffsets: offsets });
    const legacy = { ...sampleMazatrol(defaultTools()), version: 1 };
    legacy.units[1] = { id: 'wpc', kind: 'WPC', x: 20, y: -5, z: -1, theta: 30 };
    localStorage.setItem('nc-practice-programs-v1', JSON.stringify({ version: 0, state: { activeId: 'old', documents: [{ id: 'old', name: 'Old part', kind: 'mazatrol', data: legacy }] } }));
    await usePrograms.persist.rehydrate();
    const saved = JSON.parse(localStorage.getItem('nc-practice-programs-v1')!);
    expect(saved.version).toBe(2);
    expect(saved.state.documents[0].data).toMatchObject({ version: 2, units: [expect.anything(), { id: 'wpc', kind: 'WPC', x: -630, y: -315, z: -381, theta: 30 }, ...legacy.units.slice(2)] });
    useAppStore.getState().setWorkOffset(54, 'x', -800);
    await usePrograms.persist.rehydrate();
    expect(usePrograms.getState().documents).toEqual(saved.state.documents);
    const user = userEvent.setup(); render(<App />);
    await user.click(button('2 · WPC'));
    expect(screen.getByRole('spinbutton', { name: en.maz.fields.x })).toHaveValue(-630);
  });
  it('new programs use the specified defaults even when the current EIA G54 is different', async () => {
    useAppStore.getState().setWorkOffset(54, 'x', -800);
    usePrograms.getState().add('New part', 'mazatrol');
    const user = userEvent.setup(); render(<App />);
    await user.click(button('2 · WPC'));
    for (const [axis, value] of Object.entries({ x: -500, y: -250, z: -400, theta: 0 })) {
      expect(screen.getByRole('spinbutton', { name: en.maz.fields[axis as 'x' | 'y' | 'z' | 'theta'] })).toHaveValue(value);
    }
    expect(useAppStore.getState().workOffsets[54].x).toBe(-800);
  });
  it('uses edited WPC for SHAPE CHECK, the 3D preview and MEMORY, while MDI retains EIA offsets', async () => {
    const offsets = defaultOffsets(); offsets[54] = { x: -700, y: -350, z: -360 };
    useAppStore.setState({ workOffsets: offsets });
    usePrograms.getState().add('Rotated sample', 'mazatrol', sampleMazatrol(defaultTools()));
    const user = userEvent.setup(); render(<App />);
    await user.click(button('2 · WPC'));
    for (const [axis, value] of Object.entries({ x: -600, y: -300, z: -390, theta: 90 })) {
      const field = screen.getByRole('spinbutton', { name: en.maz.fields[axis as 'x' | 'y' | 'z' | 'theta'] });
      fireEvent.change(field, { target: { value: String(value) } }); fireEvent.blur(field);
    }
    await user.click(screen.getByText(en.maz.viewCode));
    expect((screen.getByRole('textbox', { name: en.maz.viewCode }) as HTMLTextAreaElement).value).toContain('(G10 L2 P1 X-600.0000 Y-300.0000 Z-390.0000)');
    await user.click(tab('SHAPE CHECK'));
    expect(screen.getByLabelText(en.maz.wpcMachine)).toHaveTextContent('X -600.000 · Y -300.000 · Z -390.000 · θ 90.000°');
    await user.click(button(en.run));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(within(await screen.findByRole('region', { name: en.sim.title })).getByText(/Removed volume:/)).not.toHaveTextContent('0.0 mm³');
    await user.click(button('MEMORY')); await user.click(button('CYCLE START'));
    act(() => vi.advanceTimersByTime(7000));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Machine position Z')).toHaveTextContent('-275.000');
    expect(screen.getByLabelText('Work position Z')).toHaveTextContent('15.000');
    expect(screen.getByText(/WPC · H4/)).toBeVisible();
    await user.click(button('RESET')); await user.click(button('MDI')); await user.click(tab('POSITION'));
    expect(screen.getByText(/G54 · H4/)).toBeVisible();
    expect(screen.getByLabelText('Work position Z')).toHaveTextContent('-15.000'); // -275 - (-360 + H4 100)
    expect(useAppStore.getState().workOffsets[54]).toEqual(offsets[54]);
  });
});
