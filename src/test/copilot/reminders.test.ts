import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { isDue } from "@/lib/copilot/reminders";

const now = new Date("2026-10-20T10:00:00Z");
const deals = [{ id: "d1", stage: "Priced" as const }];

describe("Co-Pilot reminders", () => {
  it("stage reminder fires once the deal reaches the stage", () => {
    expect(isDue({ status: "active", trigger_kind: "stage_reached", trigger_stage: "Priced", due_at: null, deal_id: "d1" }, deals, now)).toBe(true);
  });
  it("Free to Trade (Settled) does not fire while the deal is only Priced", () => {
    expect(isDue({ status: "active", trigger_kind: "stage_reached", trigger_stage: "Settled", due_at: null, deal_id: "d1" }, deals, now)).toBe(false);
  });
  it("date reminder fires when due, not before", () => {
    expect(isDue({ status: "active", trigger_kind: "date", trigger_stage: null, due_at: "2026-10-20T09:00:00Z", deal_id: null }, deals, now)).toBe(true);
    expect(isDue({ status: "active", trigger_kind: "date", trigger_stage: null, due_at: "2026-10-21T09:00:00Z", deal_id: null }, deals, now)).toBe(false);
  });
  it("fired or cancelled reminders never fire again", () => {
    expect(isDue({ status: "fired", trigger_kind: "date", trigger_stage: null, due_at: "2026-10-01T00:00:00Z", deal_id: null }, deals, now)).toBe(false);
    expect(isDue({ status: "cancelled", trigger_kind: "date", trigger_stage: null, due_at: "2026-10-01T00:00:00Z", deal_id: null }, deals, now)).toBe(false);
  });
});
