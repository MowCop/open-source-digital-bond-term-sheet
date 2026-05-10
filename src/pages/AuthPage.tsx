import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound, Shield, Link2, Building2, LineChart } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function AuthPage() {
  const { signIn, signUp, loginAsGuest } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [busy, setBusy] = useState(false);

  const [guestEmail, setGuestEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [guestBusy, setGuestBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === 'login') {
      const { error } = await signIn(email, password);
      setBusy(false);
      if (error) return toast({ title: 'Login failed', description: error, variant: 'destructive' });
      navigate('/');
    } else {
      if (!name || !organization) {
        setBusy(false);
        return toast({ title: 'Missing fields', description: 'Name and organization are required.', variant: 'destructive' });
      }
      if (password.length < 8 || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        setBusy(false);
        return toast({
          title: 'Password does not meet requirements',
          description: 'Create a password with at least 8 characters, one number, and one symbol (e.g. !@#$%).',
          variant: 'destructive',
        });
      }
      const { error } = await signUp(email, password, name, organization);
      setBusy(false);
      if (error) return toast({ title: 'Signup failed', description: error, variant: 'destructive' });
      toast({ title: 'Account created', description: 'Your account is pending approval. The project author has been notified.' });
      navigate('/');
    }
  };

  const submitGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuestBusy(true);
    const { error } = await loginAsGuest(guestEmail, passcode);
    setGuestBusy(false);
    if (error) return toast({ title: 'Guest access failed', description: error, variant: 'destructive' });
    toast({ title: 'Welcome', description: 'Read-only guest access granted.' });
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">BondVDR</h1>
          <p className="text-sm text-muted-foreground">Virtual Deal Room — secure access</p>
        </div>

        <Card className="card-elevated">
          <CardContent className="p-6 space-y-6">
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'login' | 'signup')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login"><Shield className="h-4 w-4 mr-2" />Syndicate Log in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-5">
                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Log in
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-5">
                <form onSubmit={submit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Full name</Label>
                      <Input value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    <div>
                      <Label>Organization</Label>
                      <Input value={organization} onChange={e => setOrganization(e.target.value)} required />
                    </div>
                  </div>
                  <div>
                    <Label>Work email</Label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                  </div>
                  <div>
                    <Label>Create password</Label>
                    <Input
                      type="password"
                      minLength={8}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="Choose your own secure password"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Choose your own password. Must be at least <strong>8 characters</strong> and include at least <strong>one number</strong> and <strong>one symbol</strong> (e.g. ! @ # $ %).
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your account will require admin approval before access is granted.
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create account
                  </Button>

                  <div className="pt-2">
                    <Separator />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">Link accounts</h3>
                      <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded px-1.5 py-0.5">
                        Preview
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Optionally link your corporate identity for single sign-on and richer market data. These integrations are display-only in this prototype.
                    </p>
                    <div className="grid gap-2">
                      <Button type="button" variant="outline" className="w-full justify-start" disabled aria-disabled="true">
                        <Building2 className="h-4 w-4 mr-2" />
                        Link Microsoft corporate account
                      </Button>
                      <Button type="button" variant="outline" className="w-full justify-start" disabled aria-disabled="true">
                        <LineChart className="h-4 w-4 mr-2" />
                        Link Bloomberg account
                      </Button>
                      <Button type="button" variant="outline" className="w-full justify-start" disabled aria-disabled="true">
                        <Shield className="h-4 w-4 mr-2" />
                        Internal corporate authentication (SSO / SAML)
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground italic">
                      Coming soon — not active in this demo.
                    </p>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Guest access</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Use the email and passcode provided by your syndicate administrator to view specific deals (read-only).
            </p>
            <form onSubmit={submitGuest} className="space-y-3">
              <div>
                <Label>Email</Label>
                <Input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} required />
              </div>
              <div>
                <Label>Passcode</Label>
                <Input value={passcode} onChange={e => setPasscode(e.target.value.toUpperCase())} required placeholder="e.g. K7XP-9QM2" />
              </div>
              <Button type="submit" variant="outline" className="w-full" disabled={guestBusy}>
                {guestBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enter as guest
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}