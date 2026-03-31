import { Loader2 } from 'lucide-react'

export function LoadingScreen({ label = 'Loading dashboard' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 rounded-full border border-border/80 bg-card px-5 py-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span>{label}</span>
      </div>
    </div>
  )
}
