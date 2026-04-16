import type { Tables } from '@/types/database'

export type {
  AllocationPoint,
  DashboardSummary,
  FundTransactionLike,
  FundTransactionType,
  MemberHistoryPoint,
  MemberLotDisposition,
  MemberReconciliationRow,
  MemberReconciliationTargetLike,
  HoldingRow,
  HoldingSnapshotLike,
  MemberLike,
  MemberLotSummary,
  MemberOpenLot,
  MemberSummaryRow,
  NumericLike,
  PortfolioSnapshotLike,
  ReconciliationSummary,
  ReconciliationTransferSuggestion,
  Role,
  SnapshotChartPoint,
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
