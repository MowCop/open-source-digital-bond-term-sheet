import { useLocation } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import DealCopilot from "@/components/DealCopilot";
import { useCopilotFocus } from "@/lib/copilot/focus";

/** Top-bar Co-Pilot for the New Issue Board and My Deal Chats: follows the last
 *  update or chat clicked. The Digital Term Sheet mounts its own Co-Pilot. */
export default function CopilotFocusHost() {
  const { pathname } = useLocation();
  const focus = useCopilotFocus();
  const { deals } = useApp();
  if (!focus || (pathname !== "/messages" && pathname !== "/inbox")) return null;
  if ((focus.kind === "update") !== (pathname === "/messages")) return null;
  const deal = deals.find((d) => d.id === focus.dealId);
  if (!deal) return null;
  return <DealCopilot key={deal.id} deal={deal} hasUnsavedTerms={false} focus={focus} />;
}
