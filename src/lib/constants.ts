import type { LucideIcon } from 'lucide-react'
import {
  AreaChart,
  CandlestickChart,
  Coins,
  LayoutDashboard,
  Scale,
  Settings,
  Users,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Ownership', icon: LayoutDashboard },
  { to: '/holdings', label: 'Holdings', icon: CandlestickChart },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/transactions', label: 'Transactions', icon: Coins },
  { to: '/reconciliation', label: 'Reconcile', icon: Scale },
  { to: '/snapshots', label: 'Performance', icon: AreaChart },
  { to: '/admin', label: 'Admin', icon: Settings },
]

export const TRANSACTION_TYPE_OPTIONS = [
  { value: 'DEPOSIT', label: 'Deposit' },
  { value: 'WITHDRAWAL', label: 'Withdrawal' },
  { value: 'MANUAL_ADJUSTMENT', label: 'Manual Adjustment' },
  { value: 'TRANSFER_IN', label: 'Transfer In' },
  { value: 'TRANSFER_OUT', label: 'Transfer Out' },
  { value: 'FEE', label: 'Fee (Reserved)' },
] as const

export const DIRECT_TRANSACTION_TYPE_OPTIONS = TRANSACTION_TYPE_OPTIONS.filter(
  (option) => option.value !== 'TRANSFER_IN' && option.value !== 'TRANSFER_OUT'
)

export const TRANSACTION_TYPE_LABELS = Object.fromEntries(
  TRANSACTION_TYPE_OPTIONS.map((option) => [option.value, option.label])
) as Record<(typeof TRANSACTION_TYPE_OPTIONS)[number]['value'], string>
