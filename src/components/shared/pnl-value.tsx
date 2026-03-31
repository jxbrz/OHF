import { formatSignedCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export function PnlValue({
  value,
  className,
  currency = 'GBP',
}: {
  value: number
  className?: string
  currency?: 'GBP' | 'USD'
}) {
  return (
    <span
      className={cn(
        value > 0 ? 'table-stat-positive' : value < 0 ? 'table-stat-negative' : 'text-foreground',
        className
      )}
    >
      {formatSignedCurrency(value, currency)}
    </span>
  )
}
