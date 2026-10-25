/**
 * /admin/login – email/password, password reset, and a TOTP step for admins.
 * Demo mode: the two demo accounts are one-click fills; the admin TOTP step accepts any 6 digits.
 * Firebase mode: if sign-in reports `auth/multi-factor-auth-required`, the TOTP step is shown but needs
 * the MFA resolver from lib/auth (logged in docs/DECISIONS.md – Foundation to expose it).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from '@/lib/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zEmail } from '@sda/shared';
import { DEMO_ACCOUNTS } from '@sda/shared/demo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useAuth } from '@/lib/auth';
import { BrandMark } from '../shell/brand-mark';

const signInSchema = z.object({ email: zEmail, password: z.string().min(1, 'Enter your password') });
const resetSchema = z.object({ email: zEmail });
type Mode = 'signin' | 'reset' | 'reset-sent' | 'mfa';

function authMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found')
    return 'Email or password is incorrect.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a minute, then try again.';
  if (code === 'auth/network-request-failed') return 'No connection. Check your internet and try again.';
  if (code === 'auth/user-disabled') return 'This account has been deactivated. Ask an admin to restore it.';
  return err instanceof Error ? err.message : 'Sign-in failed. Try again.';
}

export function LoginScreen() {
  const { user, role, loading, demo, signIn, sendPasswordReset } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next')?.startsWith('/admin') ? params.get('next')! : '/admin';
  const [mode, setMode] = useState<Mode>('signin');
  const [error, setError] = useState<string | null>(params.get('reason') === 'no-access' ? 'This account has no dashboard access.' : null);
  const [pending, setPending] = useState<{ email: string; password: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const form = useForm<z.infer<typeof signInSchema>>({ resolver: zodResolver(signInSchema), defaultValues: { email: '', password: '' } });
  const resetForm = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { email: '' } });

  useEffect(() => {
    if (!loading && user && role) router.replace(next);
  }, [loading, user, role, next, router]);

  async function onSignIn(values: z.infer<typeof signInSchema>) {
    setError(null);
    setBusy(true);
    try {
      const demoAcct = demo
        ? Object.values(DEMO_ACCOUNTS).find((a) => a.email === values.email.trim().toLowerCase() && a.password === values.password)
        : null;
      if (demo && !demoAcct) throw new Error('Use one of the demo accounts below.');
      if (demoAcct?.role === 'admin') {
        // Admins must pass the TOTP step (plan: 2FA required for admin).
        setPending(values);
        setMode('mfa');
        return;
      }
      await signIn(values.email, values.password);
    } catch (e) {
      if ((e as { code?: string })?.code === 'auth/multi-factor-auth-required') {
        setPending(values);
        setMode('mfa');
      } else setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    if (!pending || code.length !== 6) return;
    setError(null);
    setBusy(true);
    try {
      if (!demo) throw new Error('Two-factor sign-in needs the MFA resolver from lib/auth (not wired yet).');
      await signIn(pending.email, pending.password);
    } catch (e) {
      setError(authMessage(e));
      setBusy(false);
    }
  }

  async function onReset(values: z.infer<typeof resetSchema>) {
    setError(null);
    setBusy(true);
    try {
      await sendPasswordReset(values.email);
      setMode('reset-sent');
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bg-background grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="dark bg-brand-black text-foreground relative flex flex-col justify-between overflow-hidden px-6 py-6 lg:px-12 lg:py-10">
        <div className="flex items-center gap-3">
          <BrandMark className="h-10 w-16" />
          <span className="text-sm text-white/60">Dealer admin</span>
        </div>
        <div className="hidden max-w-md lg:block">
          <p className="page-title text-4xl leading-[1.05] font-extrabold text-white">Stock, bookings and sales in one place.</p>
          <p className="mt-4 text-sm leading-relaxed text-white/55">
            Solid Drive Auto WA staff and admin sign in here. Customers don&apos;t need an account.
          </p>
        </div>
        <p className="hidden text-xs text-white/35 lg:block">Solid Drive Auto WA · Perth</p>
      </section>

      <section className="flex items-start justify-center px-5 py-8 sm:items-center lg:px-12">
        <div className="w-full max-w-sm">
          {mode === 'signin' && (
            <>
              <h1 className="page-title text-2xl font-bold">Sign in</h1>
              <p className="text-muted-foreground mt-1 text-sm">Use your dealership email.</p>
              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSignIn)} className="mt-6 space-y-4" noValidate>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" autoComplete="username" inputMode="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Password</FormLabel>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
                            onClick={() => {
                              resetForm.setValue('email', form.getValues('email'));
                              setError(null);
                              setMode('reset');
                            }}
                          >
                            Forgot password?
                          </button>
                        </div>
                        <FormControl>
                          <Input type="password" autoComplete="current-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="animate-spin" />}
                    Sign in
                  </Button>
                </form>
              </Form>

              {demo && (
                <div className="mt-8 rounded-lg border p-4">
                  <p className="text-sm font-medium">Preview accounts</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">Tap one to fill the form, then sign in.</p>
                  <div className="mt-3 grid gap-2">
                    {Object.values(DEMO_ACCOUNTS).map((a) => (
                      <button
                        key={a.role}
                        type="button"
                        onClick={() => {
                          form.setValue('email', a.email, { shouldValidate: true });
                          form.setValue('password', a.password, { shouldValidate: true });
                        }}
                        className="hover:bg-accent flex items-center justify-between rounded-md border px-3 py-2.5 text-left text-sm transition-colors"
                      >
                        <span>
                          <span className="block font-medium capitalize">{a.role}</span>
                          <span className="text-muted-foreground block font-mono text-xs">{a.email}</span>
                        </span>
                        <span className="text-muted-foreground text-xs">Fill</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {mode === 'mfa' && (
            <>
              <button type="button" onClick={() => { setMode('signin'); setCode(''); setError(null); }} className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-xs">
                <ArrowLeft className="size-3.5" /> Back
              </button>
              <ShieldCheck className="text-primary mb-3 size-8" strokeWidth={1.5} />
              <h1 className="page-title text-2xl font-bold">Two-step verification</h1>
              <p className="text-muted-foreground mt-1 text-sm">Enter the 6-digit code from your authenticator app.</p>
              {demo && <p className="text-muted-foreground mt-2 text-xs">Preview: any 6 digits will work.</p>}
              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void onVerify();
                }}
              >
                <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus inputMode="numeric" autoComplete="one-time-code" onComplete={() => void onVerify()}>
                  <InputOTPGroup className="w-full justify-between">
                    {Array.from({ length: 6 }, (_, i) => (
                      <InputOTPSlot key={i} index={i} className="size-12 text-lg" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
                  {busy && <Loader2 className="animate-spin" />}
                  Verify
                </Button>
              </form>
            </>
          )}

          {(mode === 'reset' || mode === 'reset-sent') && (
            <>
              <button type="button" onClick={() => { setMode('signin'); setError(null); }} className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-xs">
                <ArrowLeft className="size-3.5" /> Back to sign in
              </button>
              <h1 className="page-title text-2xl font-bold">Reset password</h1>
              {mode === 'reset-sent' ? (
                <p className="text-muted-foreground mt-2 text-sm">
                  If an account exists for <strong className="text-foreground">{resetForm.getValues('email')}</strong>, a reset link is on its way.
                  {demo && ' (Preview: no email is sent.)'}
                </p>
              ) : (
                <>
                  <p className="text-muted-foreground mt-1 text-sm">We&apos;ll email you a link to choose a new password.</p>
                  {error && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <Form {...resetForm}>
                    <form onSubmit={resetForm.handleSubmit(onReset)} className="mt-6 space-y-4" noValidate>
                      <FormField
                        control={resetForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" autoComplete="username" inputMode="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={busy}>
                        {busy && <Loader2 className="animate-spin" />}
                        Send reset link
                      </Button>
                    </form>
                  </Form>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
