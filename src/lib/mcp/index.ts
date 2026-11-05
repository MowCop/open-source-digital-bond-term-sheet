import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listDealsTool from "./tools/list-deals";
import getDealTool from "./tools/get-deal";

// Vite inlines the stable ref; the published SUPABASE_URL may be a proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "virtual-deal-room",
  title: "Digital Deal Room",
  version: "0.1.0",
  instructions:
    "Read-only access to bond deals in Digital Deal Room for the signed-in user. List deals, then fetch a deal's term-sheet fields by id.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listDealsTool, getDealTool],
});
