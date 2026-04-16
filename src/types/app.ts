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

export interface DailyReviewRecord extends Tables<'daily_reviews'> {
  raw_json: (Tables<'daily_reviews'>['raw_json'] & {
    bulletPoints?: string[]
    outlookPoints?: string[]
    dailyNarrative?: string
    outlookNarrative?: string
    scheduled?: boolean
    openAiError?: string | null
  }) | null
}

export interface UnitTransferRecord {
  transferGroupId: string
  fromTransaction: FundTransactionRecord
  toTransaction: FundTransactionRecord
}
