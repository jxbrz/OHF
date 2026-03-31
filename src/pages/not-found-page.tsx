import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="panel-surface max-w-lg space-y-4 p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-border/70 bg-secondary/70">
          <Compass className="size-5 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The route you requested does not exist in the private dashboard.
        </p>
        <Button asChild>
          <Link to="/">Return to dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
