import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

type State = 'loading' | 'valid' | 'invalid' | 'already' | 'success' | 'error';

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
    fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } })
      .then(r => r.json())
      .then(d => {
        if (d.valid) setState('valid');
        else if (d.reason === 'already_unsubscribed') setState('already');
        else setState('invalid');
      })
      .catch(() => setState('error'));
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('handle-email-unsubscribe', { body: { token } });
    setBusy(false);
    if (error) return setState('error');
    if (data?.success) setState('success');
    else if (data?.reason === 'already_unsubscribed') setState('already');
    else setState('error');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-4 text-center">
          <h1 className="text-xl font-semibold">Unsubscribe</h1>
          {state === 'loading' && <Loader2 className="h-5 w-5 animate-spin mx-auto" />}
          {state === 'valid' && (
            <>
              <p className="text-sm text-muted-foreground">Click below to stop receiving emails from Digital Deal Room.</p>
              <Button onClick={confirm} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirm Unsubscribe
              </Button>
            </>
          )}
          {state === 'success' && <p className="text-sm">You have been unsubscribed.</p>}
          {state === 'already' && <p className="text-sm">This email is already unsubscribed.</p>}
          {state === 'invalid' && <p className="text-sm text-destructive">Invalid or expired unsubscribe link.</p>}
          {state === 'error' && <p className="text-sm text-destructive">Something went wrong. Please try again later.</p>}
        </CardContent>
      </Card>
    </div>
  );
}