import { useLocation } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import DealCopilot from "@/components/DealCopilot";
import { useCopilotFocus } from "@/lib/copilot/focus";

/** Top-bar Co-Pilot for the New Issue Board and My Deal Chats: follows the last
 *  update or chat clicked. The Digital Term Sheet mounts its own Co-Pilot. */
export default function CopilotFocusHost({ inDialog = false }: { inDialog?: boolean }) {
  const { pathname } = useLocation();
  const focus = useCopilotFocus();
  const { deals } = useApp();
  if (!focus || (pathname !== "/messages" && pathname !== "/inbox")) return null;
  if ((focus.kind === "update") !== (pathname === "/messages")) return null;
  if (inDialog && focus.kind !== "update") return null;
  const deal = deals.find((d) => d.id === focus.dealId);
  if (!deal) return null;
  const copilot = <DealCopilot key={deal.id} deal={deal} hasUnsavedTerms={false} focus={focus} />;
  // Full-screen update windows cover the top bar, so they show their own Co-Pilot row.
  return inDialog ? <div className="shrink-0 border-b border-border bg-card px-5 py-2">{copilot}</div> : copilot;
}
