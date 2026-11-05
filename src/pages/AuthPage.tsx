import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound, Shield, Link2, Building2, LineChart, LifeBuoy } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { oauthReturnPath } from '@/lib/oauth-return-path';

const supportSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Enter a valid email').max(255),
  subject: z.string().trim().min(1, 'Subject is required').max(150),
  message: z.string().trim().min(1, 'Message is required').max(2000),
});
type SupportValues = z.infer<typeof supportSchema>;

export default function AuthPage() {
  const { signIn, signUp, loginAsGuest } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const nextPath = oauthReturnPath(new URLSearchParams(window.location.search).get('next'));

  const [mode, setMode] = useState<'login' | 'signup' | 'guest'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [busy, setBusy] = useState(false);

  const [guestEmail, setGuestEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [guestBusy, setGuestBusy] = useState(false);

  const [supportOpen, setSupportOpen] = useState(false);
  const supportForm = useForm<SupportValues>({
    resolver: zodResolver(supportSchema),
    defaultValues: { name: '', email: '', subject: '', message: '' },
  });

  const submitSupport = async (values: SupportValues) => {
    try {
      const { error } = await supabase.functions.invoke('submit-support-request', {
        body: {
          name: values.name,
          email: values.email,
          subject: values.subject,
          message: values.message,
        },
      });
      if (error) throw error;
      toast({
        title: 'Message sent',
        description: 'Thanks — our team will get back to you shortly.',
      });
      supportForm.reset();
      setSupportOpen(false);
    } catch (err: any) {
      toast({
        title: 'Could not send message',
        description: err?.message ?? 'Please try again in a moment.',
        variant: 'destructive',
      });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === 'login') {
      const { error } = await signIn(email, password);
      setBusy(false);
      if (error) return toast({ title: 'Login failed', description: error, variant: 'destructive' });
      navigate(nextPath);
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
      const { error } = await signUp(email, password, name, organization, new URL(nextPath, window.location.origin).href);
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
    navigate('/messages');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">BondVDR</h1>
          <p className="text-sm text-muted-foreground">Digital Deal Room — secure access</p>
        </div>

        <Card className="card-elevated">
          <CardContent className="p-6 space-y-6">
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'login' | 'signup' | 'guest')}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="login"><Shield className="h-4 w-4 mr-2" />Log in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
                <TabsTrigger value="guest"><KeyRound className="h-4 w-4 mr-2" />Guest</TabsTrigger>
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

              <TabsContent value="guest" className="mt-5">
                <div className="space-y-4">
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
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSupportOpen(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <LifeBuoy className="h-4 w-4 mr-2" />
            Contact support via email
          </Button>
        </div>

        <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Contact support</DialogTitle>
              <DialogDescription>
                Send a message to the BondVDR team. We'll reply to the email address you provide.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={supportForm.handleSubmit(submitSupport)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="support-name">Your name</Label>
                  <Input id="support-name" {...supportForm.register('name')} maxLength={100} />
                  {supportForm.formState.errors.name && (
                    <p className="text-xs text-destructive mt-1">{supportForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="support-email">Your email</Label>
                  <Input id="support-email" type="email" {...supportForm.register('email')} maxLength={255} />
                  {supportForm.formState.errors.email && (
                    <p className="text-xs text-destructive mt-1">{supportForm.formState.errors.email.message}</p>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="support-subject">Subject</Label>
                <Input id="support-subject" {...supportForm.register('subject')} maxLength={150} />
                {supportForm.formState.errors.subject && (
                  <p className="text-xs text-destructive mt-1">{supportForm.formState.errors.subject.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="support-message">Message</Label>
                <Textarea
                  id="support-message"
                  rows={6}
                  {...supportForm.register('message')}
                  maxLength={2000}
                />
                {supportForm.formState.errors.message && (
                  <p className="text-xs text-destructive mt-1">{supportForm.formState.errors.message.message}</p>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSupportOpen(false)}
                  disabled={supportForm.formState.isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={supportForm.formState.isSubmitting}>
                  {supportForm.formState.isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Send message
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}