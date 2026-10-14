// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { HashRouter } from "react-router-dom";
import { AppContext } from "../components/Context";
import { initial } from "../storage/db";
import Settings from "../pages/Settings";
import TestRunner from "../components/TestRunner";
import Research from "../pages/Research";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function mount(
  child: React.ReactNode,
  update = vi.fn().mockResolvedValue(undefined),
) {
  return render(
    <HashRouter>
      <AppContext.Provider
        value={{ data: initial(), update, lang: "en", t: (_, en) => en }}
      >
        {child}
      </AppContext.Provider>
    </HashRouter>,
  );
}
describe("user flows", () => {
  it("requires explicit confirmation before deleting history", () => {
    const update = vi.fn().mockResolvedValue(undefined);
    mount(<Settings />, update);
    fireEvent.click(screen.getByText("Clear history"));
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Confirm deletion"));
    expect(update).toHaveBeenCalledTimes(1);
  });
  it("allows stopping a test without creating a result", () => {
    const done = vi.fn(),
      stop = vi.fn();
    mount(<TestRunner kind="reaction" onComplete={done} onStop={stop} />);
    fireEvent.click(screen.getByText("Start"));
    fireEvent.click(screen.getByText("Stop"));
    expect(stop).toHaveBeenCalledOnce();
    expect(done).not.toHaveBeenCalled();
  });
  it("records premature reaction responses before the stimulus", () => {
    vi.useFakeTimers();
    mount(<TestRunner kind="reaction" onComplete={vi.fn()} onStop={vi.fn()} />);
    fireEvent.click(screen.getByText("Start"));
    fireEvent.click(screen.getByText("Wait…"));
    expect(
      screen.getByText("Too early. Wait for the signal."),
    ).toBeInTheDocument();
  });
  it("requires participant and guardian consent before a minor starts research", async () => {
    mount(<Research />);
    fireEvent.click(screen.getByText("Create and start"));
    await screen.findByText("How do you feel?");
    const begin = screen.getByText("Begin series");
    expect(begin).toBeDisabled();
    fireEvent.click(screen.getByText(/I consent to local storage/));
    expect(begin).toBeEnabled();
    fireEvent.click(screen.getByText("Participant is a minor"));
    expect(begin).toBeDisabled();
    fireEvent.click(screen.getByText(/Informed guardian consent/));
    expect(begin).toBeEnabled();
  });
});
