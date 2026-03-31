import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { LockKeyhole, Shield } from 'lucide-react'
import { ConfigRequiredState } from '@/components/shared/config-required-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-provider'

export function LoginPage() {
  const { isConfigured, session, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (session) {
      const nextPath = (location.state as { from?: string } | null)?.from ?? '/'
      navigate(nextPath, { replace: true })
    }
  }, [location.state, navigate, session])

  if (!isConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-xl">
          <ConfigRequiredState />
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.18),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_20%)]" />
      <div className="relative grid w-full max-w-6xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="panel-surface hidden min-h-[32rem] flex-col justify-between border-none bg-panel/80 p-10 lg:flex">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-secondary/60 px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <Shield className="size-3.5" />
              Private Capital Workspace
            </div>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-5xl font-semibold leading-tight tracking-tight text-foreground">
                Serious pooled-account reporting without the Excel drift.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground">
                Secure eToro syncing, deterministic member ownership accounting, and historical
                performance snapshots for the club.
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['NAV snapshots', 'Track value, cash, and P&L over time.'],
              ['Unit ledger', 'Treat contributions and withdrawals as immutable unit events.'],
              ['Role controls', 'Keep operations admin-only with explicit RLS.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-border/70 bg-card/60 p-5">
                <div className="text-sm font-semibold text-foreground">{title}</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>
        <Card className="panel-surface border-none bg-card/90 shadow-panel">
          <CardHeader className="space-y-3">
            <div className="inline-flex size-11 items-center justify-center rounded-2xl border border-border/80 bg-secondary/70">
              <LockKeyhole className="size-5 text-foreground" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl">Sign in</CardTitle>
              <CardDescription>
                Use the seeded admin or invited club credentials to access the dashboard.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault()
                setIsSubmitting(true)
                try {
                  await signIn(email, password)
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Unable to sign in.')
                } finally {
                  setIsSubmitting(false)
                }
              }}
            >
              <label className="grid gap-2.5 text-sm">
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Email
                </span>
                <Input
                  autoComplete="email"
                  placeholder="admin@ohf.local"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label className="grid gap-2.5 text-sm">
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Password
                </span>
                <Input
                  autoComplete="current-password"
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
                {isSubmitting ? 'Signing in...' : 'Access dashboard'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
