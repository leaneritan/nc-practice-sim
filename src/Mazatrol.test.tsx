import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { useAppStore } from "./store";
import { usePrograms } from "./programs";
import { defaultOffsets, defaultTools } from "./setup";
import { en } from "./i18n/en";
import { ja } from "./i18n/ja";
const button = (name: string) => screen.getByRole("button", { name });
const tab = (name: string) => screen.getByRole("tab", { name });
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  localStorage.clear();
  usePrograms.setState({ documents: [], activeId: null });
  useAppStore.setState({
    language: "en",
    program: "M30",
    workOffsets: defaultOffsets(),
    tools: defaultTools(),
    strictDecimals: false,
    optionalStop: false,
    pocketWidth: 0,
  });
});
afterEach(() => vi.useRealTimers());
async function sample() {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByText(en.maz.library));
  await user.click(button(en.maz.loadSample));
  return user;
}
describe("conversational program workflow", () => {
  it("creates both formats, selects programs, and keeps the original EIA text", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText(en.maz.library));
    await user.type(
      screen.getByRole("textbox", { name: en.maz.name }),
      "Part A",
    );
    await user.click(button(en.maz.create));
    expect(button("1 · COMMON")).toBeVisible();
    expect(
      screen.queryByRole("textbox", { name: en.programLabel }),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: en.maz.format }),
      "eia",
    );
    await user.type(
      screen.getByRole("textbox", { name: en.maz.name }),
      "Code B",
    );
    await user.click(button(en.maz.create));
    const editor = screen.getByRole("textbox", { name: en.programLabel });
    await user.type(editor, "G91 G0 X-1.");
    await user.selectOptions(
      screen.getByRole("combobox", { name: en.maz.program }),
      "",
    );
    expect(screen.getByRole("textbox", { name: en.programLabel })).toHaveValue(
      "M30",
    );
    expect(usePrograms.getState().documents).toHaveLength(2);
    await act(() => usePrograms.persist.rehydrate());
    expect(usePrograms.getState().documents[1]).toMatchObject({
      source: "G91 G0 X-1.",
    });
  });
  it("offers editable automatic rows, regenerates them, and shows equivalent read-only EIA", async () => {
    const user = await sample();
    await user.click(button("4 · TAPPING"));
    const unitHeading = screen.getByRole("heading", { name: "4 · TAPPING" });
    await user.hover(within(unitHeading).getByRole("button"));
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "feed per minute equals spindle rpm times thread pitch",
    );
    await user.unhover(within(unitHeading).getByRole("button"));
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    const feed = screen.getByRole("spinbutton", {
      name: `${en.maz.fields.feed} 3`,
    });
    fireEvent.change(feed, { target: { value: "1" } });
    fireEvent.blur(feed);
    expect(screen.getByRole("alert")).toHaveTextContent(en.maz.errors.sequence);
    await user.click(button(en.maz.regenerate));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByText(en.maz.viewCode));
    const code = screen.getByRole("textbox", { name: en.maz.viewCode });
    expect(code).toHaveAttribute("readonly");
    expect((code as HTMLTextAreaElement).value).toContain("G98 G84");
    await user.click(button("日本語"));
    expect(screen.getByRole("heading", { name: ja.maz.auto })).toBeVisible();
    expect(button("4 · TAPPING")).toBeVisible();
  });
  it("draws unit shapes before execution and previews 3D removal without moving the machine", async () => {
    const user = await sample();
    await user.click(tab("SHAPE CHECK"));
    expect(screen.getByRole("img", { name: en.maz.shapeCheck })).toBeVisible();
    await user.click(button(en.run));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const view = await screen.findByRole("region", { name: en.sim.title });
    expect(within(view).getByText(/Removed volume:/)).not.toHaveTextContent(
      "0.0 mm³",
    );
    await user.click(tab("POSITION"));
    expect(screen.getByLabelText("Machine position Z")).toHaveTextContent(
      "0.000",
    );
  });
  it("shows source unit in SINGLE BLOCK and locks editing/program selection while active", async () => {
    const user = await sample();
    await user.click(screen.getByRole("checkbox", { name: "SINGLE BLOCK" }));
    await user.click(button("MEMORY"));
    await user.click(button("CYCLE START"));
    act(() => vi.advanceTimersByTime(500));
    expect(
      screen.getByRole("status", { name: en.panel.statusLabel }),
    ).toHaveTextContent("Unit 1 · COMMON");
    expect(
      screen.getByRole("status", { name: en.panel.statusLabel }),
    ).toHaveTextContent(en.panel.status.singleBlock);
    await user.click(tab("PROGRAM"));
    expect(
      screen.getByRole("combobox", { name: en.maz.program }),
    ).toBeDisabled();
    expect(
      screen.getByRole("spinbutton", { name: en.maz.fields.initialZ }),
    ).toBeDisabled();
    await user.click(button("RESET"));
    await user.click(button("EDIT"));
    expect(
      screen.getByRole("spinbutton", { name: en.maz.fields.initialZ }),
    ).toBeEnabled();
  });
  it("adds/removes/reorders units and edits shape patterns through forms", async () => {
    const user = await sample();
    await user.selectOptions(
      screen.getByRole("combobox", { name: en.maz.unitType }),
      "DRILLING",
    );
    await user.click(button(en.maz.addUnit));
    expect(screen.getByRole("heading", { name: "6 · DRILLING" })).toBeVisible();
    await user.selectOptions(
      screen.getByRole("combobox", { name: en.maz.shapeType }),
      "GRD",
    );
    await user.click(button(en.maz.addShape));
    expect(
      screen.getByRole("spinbutton", { name: en.maz.fields.nx }),
    ).toHaveValue(3);
    await user.click(button(en.maz.up));
    expect(screen.getByRole("heading", { name: "5 · DRILLING" })).toBeVisible();
    await user.click(button(en.maz.down));
    await user.click(button(en.maz.removeUnit));
    expect(
      screen.queryByRole("button", { name: "6 · DRILLING" }),
    ).not.toBeInTheDocument();
  });
});
