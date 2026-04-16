import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string
  secondary?: string
  tone?: 'neutral' | 'positive' | 'negative'
}

export function MetricCard({ label, value, secondary, tone = 'neutral' }: MetricCardProps) {
  const ToneIcon = tone === 'positive' ? ArrowUpRight : tone === 'negative' ? ArrowDownRight : Minus
  const toneClass =
    tone === 'positive'
      ? 'text-gain'
      : tone === 'negative'
        ? 'text-loss'
        : 'text-muted-foreground'
  const accentClass =
    tone === 'positive'
      ? 'before:bg-gain/35'
      : tone === 'negative'
        ? 'before:bg-loss/35'
        : 'before:bg-primary/30'

  return (
    <Card
      className={cn(
        'panel-surface relative gap-2 overflow-hidden border-none bg-card/80 before:absolute before:inset-x-0 before:top-0 before:h-px',
        accentClass
      )}
    >
      <CardHeader className="pb-0">
        <CardTitle className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="font-mono text-2xl font-semibold tracking-tight text-foreground">{value}</div>
        {secondary ? (
          <div className={`flex items-center gap-1 text-xs ${toneClass}`}>
            <ToneIcon className="size-3.5" />
            <span>{secondary}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
