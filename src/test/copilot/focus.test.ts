import { afterEach, describe, expect, it } from "vitest";
import { getCopilotFocus, setCopilotFocus } from "@/lib/copilot/focus";

afterEach(() => setCopilotFocus(null));

describe("active Co-Pilot focus", () => {
  it("switches from the board update to the specific open DTS deal", () => {
    setCopilotFocus({ kind: "update", dealId: "previous", label: "Previous update", context: "Board text" });
    setCopilotFocus({ kind: "deal", dealId: "meridian", label: "Meridian Gulf Bank", context: "" });
    expect(getCopilotFocus()).toEqual({ kind: "deal", dealId: "meridian", label: "Meridian Gulf Bank", context: "" });
  });

  it("clears the deal focus when returning to the list", () => {
    setCopilotFocus({ kind: "deal", dealId: "meridian", label: "Meridian Gulf Bank", context: "" });
    setCopilotFocus(null);
    expect(getCopilotFocus()).toBeNull();
  });
});