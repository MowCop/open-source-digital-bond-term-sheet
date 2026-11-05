import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type OAuthResult = { data: any; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("This connection link is missing its authorization id.");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      setEmail(sess.session.user.email ?? null);
      try {
        const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) return setError(error.message);
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) { window.location.href = immediate; return; }
        setDetails(data);
      } catch (e: any) {
        if (active) setError(e?.message ?? "The request may have expired.");
      }
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const { data, error } = approve
        ? await oauth().approveAuthorization(authorizationId)
        : await oauth().denyAuthorization(authorizationId);
      if (error) { setBusy(false); return setError(error.message); }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) { setBusy(false); return setError("No redirect was returned. Please try connecting again."); }
      window.location.href = target;
    } catch (e: any) {
      setBusy(false);
      setError(e?.message ?? (approve ? "Approval failed." : "Cancel failed."));
    }
  }

  const client = details?.client?.name ?? "An app";
  const scopes: string[] = String(details?.scope ?? "").split(/\s+/).filter(Boolean);
  const label = (s: string) =>
    s === "openid" ? "Confirm your identity" : s === "email" ? "Share your email address" : s === "profile" ? "Share your basic profile" : `Additional permission requested: ${s}`;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 space-y-4">
          {error ? (
            <>
              <h1 className="text-xl font-semibold">Could not load this request</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
            </>
          ) : !details ? (
            <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <h1 className="text-xl font-semibold">Connect {client} to Digital Deal Room</h1>
              {email && <p className="text-sm text-muted-foreground">Signed in as {email}</p>}
              <p className="text-sm">{client} will be able to use this app as you, while you are signed in.</p>
              {details?.redirect_uri && <p className="text-xs text-muted-foreground break-all">Returns to: {details.redirect_uri}</p>}
              {scopes.length > 0 && (
                <ul className="text-sm list-disc pl-5 space-y-1">{scopes.map((s) => <li key={s}>{label(s)}</li>)}</ul>
              )}
              <p className="text-xs text-muted-foreground">This does not bypass this app's permissions — you only see deals you can already see.</p>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Approve
                </Button>
                <Button className="flex-1" variant="outline" disabled={busy} onClick={() => decide(false)}>Cancel connection</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
