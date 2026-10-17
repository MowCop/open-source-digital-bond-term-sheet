import { asDeal, validateProposal, type Deal } from "./deal";

/**
 * DealHost is the only contract the agent core needs from the app it lives in.
 * This workspace implements it on its own tables (host.cloud.server.ts); the
 * Virtual Deal Room implements it on real deals and its own permissions.
 * Hosts must enforce authorization themselves and must never apply a
 * proposed change without an explicit human decision.
 */
export type HostDocument = { id: string; name: string; report: unknown; createdAt: string };
export type ProposedChange = {
  field: string;
  before_value: string;
  after_value: string;
  reason: string;
};
export interface DealHost {
  readDeal(): Promise<{ deal: Deal; updatedAt: string }>;
  listDocuments(limit?: number): Promise<HostDocument[]>;
  proposeChange(change: ProposedChange): Promise<void>;
  decideChange(changeId: string, approve: boolean): Promise<"approved" | "rejected">;
}

/** Host-independent tool logic shared by every host. */
export async function proposeThroughHost(host: DealHost, input: ProposedChange) {
  const { deal } = await host.readDeal();
  const checked = validateProposal(deal, input.field, input.before_value, input.after_value);
  return { ...checked, reason: input.reason, status: "pending" as const };
}

/** In-memory host for tests and demos; applies changes only on approve. */
export function createMemoryHost(initial: Partial<Deal>, documents: HostDocument[] = []) {
  let deal = asDeal(initial);
  let updatedAt = new Date(0).toISOString();
  const changes = new Map<string, ProposedChange & { status: string }>();
  const host: DealHost & { changes: typeof changes } = {
    changes,
    async readDeal() {
      return { deal, updatedAt };
    },
    async listDocuments(limit = 5) {
      return documents.slice(0, limit);
    },
    async proposeChange(change) {
      changes.set(String(changes.size + 1), { ...change, status: "pending" });
    },
    async decideChange(id, approve) {
      const change = changes.get(id);
      if (!change || change.status !== "pending") throw new Error("Change already decided");
      if (approve) {
        if ((deal[change.field as keyof Deal] ?? "") !== change.before_value)
          throw new Error("Deal changed; request a new proposal");
        deal = { ...deal, [change.field]: change.after_value };
        updatedAt = new Date().toISOString();
      }
      change.status = approve ? "approved" : "rejected";
      return change.status as "approved" | "rejected";
    },
  };
  return host;
}
