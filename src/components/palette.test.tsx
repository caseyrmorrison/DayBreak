import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useDaybreak } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import CommandPalette from "./CommandPalette";

const TODAY = "2026-07-04";

beforeEach(() => {
  localStorage.clear();
  useDaybreak.setState({
    plans: {},
    inbox: [],
    streak: { count: 0, lastWinDate: null },
    settings: { name: null },
  });
  useUi.setState({ paletteOpen: false, focusTaskId: null });
});

describe("CommandPalette", () => {
  it("opens with ctrl+k and captures a thought to the inbox", async () => {
    const user = userEvent.setup();
    render(<CommandPalette today={TODAY} />);
    await user.keyboard("{Control>}k{/Control}");
    const input = await screen.findByRole("combobox");
    await user.type(input, "look into esp32 pricing");
    await user.keyboard("{Enter}");
    expect(useDaybreak.getState().inbox[0].text).toBe(
      "look into esp32 pricing",
    );
    expect(useUi.getState().paletteOpen).toBe(false);
  });

  it("marks a task done from a contextual action", async () => {
    useDaybreak.getState().startDay(TODAY, [{ title: "Big thing" }]);
    useUi.setState({ paletteOpen: true });
    const user = userEvent.setup();
    render(<CommandPalette today={TODAY} />);
    await user.click(await screen.findByText("Mark done: Big thing"));
    expect(useDaybreak.getState().plans[TODAY].tasks[0].done).toBe(true);
    expect(useUi.getState().paletteOpen).toBe(false);
  });

  it("starts a focus session from the palette", async () => {
    useDaybreak.getState().startDay(TODAY, [{ title: "Big thing" }]);
    useUi.setState({ paletteOpen: true });
    const user = userEvent.setup();
    render(<CommandPalette today={TODAY} />);
    await user.click(await screen.findByText("Start focus: Big thing"));
    expect(useUi.getState().focusTaskId).toBe(
      useDaybreak.getState().plans[TODAY].tasks[0].id,
    );
  });

  it("filters contextual actions by the query", async () => {
    useDaybreak.getState().startDay(TODAY, [{ title: "Big thing" }]);
    useUi.setState({ paletteOpen: true });
    const user = userEvent.setup();
    render(<CommandPalette today={TODAY} />);
    await user.type(await screen.findByRole("combobox"), "close");
    expect(screen.getByText("Close the day")).toBeInTheDocument();
    expect(screen.queryByText("Start focus: Big thing")).toBeNull();
    expect(screen.getByText('Add to inbox: "close"')).toBeInTheDocument();
  });
});
