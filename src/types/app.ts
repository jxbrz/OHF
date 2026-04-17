import type { Tables } from '@/types/database'

export type {
  AllocationPoint,
  DashboardSummary,
  EffectiveValuation,
  FundTransactionLike,
  FundTransactionType,
  MemberHistoryPoint,
  MemberLotDisposition,
  HoldingRow,
  HoldingSnapshotLike,
  MemberLike,
  MemberLotSummary,
  MemberOpenLot,
  MemberSummaryRow,
  NumericLike,
  PortfolioSnapshotLike,
  Role,
  SnapshotChartPoint,
  SuggestedUnitPrice,
} from '@shared/calculations'

export type FundTransactionRecord = Omit<Tables<'fund_transactions'>, 'type'> & {
  type: import('@shared/calculations').FundTransactionType
}

export interface SnapshotFxMeta {
  brokerCurrency: string
  fundCurrency: string
  brokerToFundRate: number
  source: string
  referenceDate: string | null
}

export interface UnitTransferRecord {
  transferGroupId: string
  fromTransaction: FundTransactionRecord
  toTransaction: FundTransactionRecord
}

export interface HoldingPositionDetail {
  id: string
  symbol: string
  instrumentId: number | null
  instrumentName: string
  logoUrl: string | null
  openedAt: string | null
  side: 'BUY' | 'SELL'
  quantity: number
  averageOpen: number
  currentPrice: number
  stopLoss: number | null
  takeProfit: number | null
  investedValueBroker: number
  marketValueBroker: number
  marketValueFund: number
  pnlBroker: number
  pnlFund: number
  pnlPct: number | null
  leverage: number | null
  isSettled: boolean | null
}

export interface HoldingDetailView {
  symbol: string
  instrumentName: string
  logoUrl: string | null
  quantity: number
  averageOpen: number
  currentPrice: number
  marketValue: number
  pnl: number
  allocationPct: number
  positions: HoldingPositionDetail[]
  brokerCurrency: 'GBP' | 'USD'
  fundCurrency: 'GBP' | 'USD'
  capturedAt: string | null
}
