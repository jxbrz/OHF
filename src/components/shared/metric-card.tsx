import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

  return (
    <Card className="panel-surface gap-2 border-none bg-card/80">
      <CardHeader className="pb-0">
        <CardTitle className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
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
