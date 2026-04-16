import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LogOut, Menu } from 'lucide-react'
import { NAV_ITEMS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/auth-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useAuth()
  const location = useLocation()
  const visibleItems =
    role === 'admin'
      ? NAV_ITEMS
      : NAV_ITEMS.filter((item) => item.to !== '/admin' && item.to !== '/reconciliation')

  return (
    <nav className="flex flex-col gap-1">
      {visibleItems.map((item) => {
        const Icon = item.icon
        const isActive = item.to === '/'
          ? location.pathname === item.to
          : location.pathname.startsWith(item.to)

        return (
          <NavLink
            key={item.to}
            className={cn(
              'group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition',
              isActive
                ? 'border-primary/30 bg-primary/14 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_22px_rgba(9,18,33,0.18)]'
                : 'border-transparent text-muted-foreground hover:border-border/60 hover:bg-secondary/72 hover:text-foreground'
            )}
            to={item.to}
            onClick={onNavigate}
          >
            <Icon
              className={cn(
                'size-4 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
              )}
            />
            {item.label}
          </NavLink>
        )
      })}
    </nav>
  )
}

export function AppShell() {
  const { profile, role, signOut } = useAuth()
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-72 flex-col border-r border-border/70 bg-panel/90 px-5 py-6 shadow-[16px_0_36px_rgba(5,10,22,0.16)] backdrop-blur lg:flex">
          <div className="space-y-1 border-b border-border/70 pb-6">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">OHF</div>
            <div className="text-xl font-semibold tracking-tight text-foreground">Orchard Hedge Fund</div>
          </div>
          <div className="flex-1 py-6">
            <NavContent />
          </div>
          <div className="space-y-3 border-t border-border/70 pt-5 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">{profile?.username ?? 'Authenticated user'}</div>
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="capitalize">
                {role ?? 'viewer'}
              </Badge>
              <Button size="sm" variant="ghost" onClick={() => void signOut()}>
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
          </div>
        </aside>
        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border/70 bg-background/88 backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                  <SheetTrigger asChild className="lg:hidden">
                    <Button size="icon-sm" variant="outline">
                      <Menu className="size-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80 bg-panel/95">
                    <SheetHeader>
                      <SheetTitle>OHF</SheetTitle>
                      <SheetDescription>Navigate the workspace.</SheetDescription>
                    </SheetHeader>
                    <div className="mt-6">
                      <NavContent onNavigate={() => setIsSheetOpen(false)} />
                    </div>
                  </SheetContent>
                </Sheet>
                <div>
                  <div className="text-sm font-semibold tracking-tight text-foreground">Orchard Hedge Fund</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button className="lg:hidden" size="sm" variant="ghost" onClick={() => void signOut()}>
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </div>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
