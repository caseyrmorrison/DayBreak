import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useDaybreak } from "@/lib/store";
import { resetStores } from "@/lib/test-helpers";
import { useUi } from "@/lib/ui-store";
import HistorySheet from "./HistorySheet";
import Kickoff from "./Kickoff";
import TodayView from "./TodayView";

const TODAY = "2026-07-04";

beforeEach(resetStores);

describe("Kickoff", () => {
  it("starts the day with the big thing", async () => {
    const user = userEvent.setup();
    render(<Kickoff today={TODAY} />);
    await user.type(
      screen.getByLabelText(/one thing that would make today a win/i),
      "Ship the login flow",
    );
    await user.click(screen.getByRole("button", { name: /start the day/i }));
    const plan = useDaybreak.getState().plans[TODAY];
    expect(plan).toBeDefined();
    expect(plan.tasks[0].title).toBe("Ship the login flow");
  });

  it("does not start the day without a big thing", async () => {
    const user = userEvent.setup();
    render(<Kickoff today={TODAY} />);
    await user.click(screen.getByRole("button", { name: /start the day/i }));
    expect(useDaybreak.getState().plans[TODAY]).toBeUndefined();
  });

});

describe("TodayView", () => {
  it("renders the plan and toggles the big thing", async () => {
    useDaybreak.getState().startDay(TODAY, [{ title: "Ship the login flow" }]);
    const user = userEvent.setup();
    render(<TodayView today={TODAY} />);
    expect(screen.getByText("Ship the login flow")).toBeInTheDocument();
    await user.click(
      screen.getByRole("checkbox", {
        name: /mark "Ship the login flow" as done/i,
      }),
    );
    expect(useDaybreak.getState().plans[TODAY].tasks[0].done).toBe(true);
  });

  it("opens history from the streak button", async () => {
    useDaybreak.getState().startDay(TODAY, [{ title: "Big thing" }]);
    const user = userEvent.setup();
    render(<TodayView today={TODAY} />);
    await user.click(screen.getByRole("button", { name: /view history/i }));
    expect(useUi.getState().historyOpen).toBe(true);
  });

  it("adds a brain-dump thought to the inbox", async () => {
    useDaybreak.getState().startDay(TODAY, [{ title: "Big thing" }]);
    const user = userEvent.setup();
    render(<TodayView today={TODAY} />);
    await user.type(
      screen.getByLabelText(/brain dump/i),
      "research vector databases{Enter}",
    );
    expect(useDaybreak.getState().inbox[0].text).toBe(
      "research vector databases",
    );
  });
});

describe("HistorySheet", () => {
  it("shows past days with their win state", async () => {
    const s = useDaybreak.getState();
    s.startDay("2026-07-03", [{ title: "Won this one" }, { title: "Backup" }]);
    const wonId = useDaybreak.getState().plans["2026-07-03"].tasks[0].id;
    s.toggleTask("2026-07-03", wonId);
    s.startDay(TODAY, [{ title: "Current big thing" }]);
    useUi.setState({ historyOpen: true });
    render(<HistorySheet today={TODAY} />);
    expect(await screen.findByText("Friday, July 3")).toBeInTheDocument();
    expect(screen.getByText("Won")).toBeInTheDocument();
    expect(screen.getByText("Won this one")).toBeInTheDocument();
    expect(screen.getByText("Backup")).toBeInTheDocument();
    expect(screen.queryByText("Current big thing")).toBeNull();
    expect(screen.getByText(/1 of the last 1 day/)).toBeInTheDocument();
  });
});
