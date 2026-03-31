import { ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ConfigRequiredState() {
  return (
    <Card className="border border-amber-500/30 bg-amber-500/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-amber-300" />
          Supabase configuration required
        </CardTitle>
        <CardDescription>
          Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your local
          environment before using the dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        The UI is wired up, but authentication and data queries stay disabled until the local
        Supabase stack is configured.
      </CardContent>
    </Card>
  )
}
