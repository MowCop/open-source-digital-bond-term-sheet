import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CopilotDraftDialog from "./CopilotDraftDialog";

afterEach(cleanup);

function Harness({ onSend = vi.fn(), busy = false }) {
  const [open, setOpen] = useState(true);
  const [text, setText] = useState("make Tranche A size 600m");
  return <>
    <textarea aria-label="Inline draft" value={text} onChange={event => setText(event.target.value)} />
    <CopilotDraftDialog open={open} onOpenChange={setOpen} text={text} onTextChange={setText}
      onSend={onSend} busy={busy} onContract={() => {}} />
  </>;
}

describe("expanded Co-Pilot draft", () => {
  it("preserves edits when Esc contracts the dialog without sending", async () => {
    const onSend = vi.fn();
    render(<Harness onSend={onSend} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Expanded message Deal Co-Pilot" }), { target: { value: "Review Tranche B\nand draft an update" } });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Inline draft")).toHaveValue("Review Tranche B\nand draft an update");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("sends the shared draft exactly once via the Send control", async () => {
    const onSend = vi.fn();
    render(<Harness onSend={onSend} />);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalledExactlyOnceWith("make Tranche A size 600m");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not send while a request is busy", () => {
    const onSend = vi.fn();
    render(<Harness onSend={onSend} busy />);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).not.toHaveBeenCalled();
  });
});