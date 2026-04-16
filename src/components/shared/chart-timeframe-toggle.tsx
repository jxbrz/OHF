import { Button } from '@/components/ui/button'
import { TIMEFRAME_WINDOWS, type ChartTimeframe } from '@/lib/chart-timeframes'
import { cn } from '@/lib/utils'

interface ChartTimeframeToggleProps {
  value: ChartTimeframe
  onChange: (value: ChartTimeframe) => void
  className?: string
}

export function ChartTimeframeToggle({
  value,
  onChange,
  className,
}: ChartTimeframeToggleProps) {
  return (
    <div className={cn('inline-flex items-center gap-1 rounded-2xl border border-border/70 bg-secondary/30 p-1', className)}>
      {(Object.keys(TIMEFRAME_WINDOWS) as ChartTimeframe[]).map((timeframe) => {
        const option = TIMEFRAME_WINDOWS[timeframe]

        return (
          <Button
            key={timeframe}
            size="sm"
            variant={value === timeframe ? 'secondary' : 'ghost'}
            className={cn(
              'rounded-xl px-3 text-xs font-semibold tracking-[0.12em]',
              value === timeframe ? 'bg-background/95 text-foreground shadow-sm' : 'text-muted-foreground'
            )}
            onClick={() => onChange(timeframe)}
            type="button"
          >
            {option.shortLabel}
          </Button>
        )
      })}
    </div>
  )
}
