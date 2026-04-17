import {
  buildHoldingsAllocation,
  buildHoldingsRows,
  buildMemberSummaries,
  buildOwnershipAllocation,
  buildSnapshotSeries,
  computeDashboardSummary,
  filterSnapshotsFromDate,
  resolveEffectiveValuation,
} from '@shared/calculations'
import { getSupabaseClient } from '@/lib/supabase'
import type {
  DashboardSummary,
  EffectiveValuation,
  FundTransactionRecord,
  HoldingRow,
  MemberSummaryRow,
  SnapshotFxMeta,
  SnapshotChartPoint,
  UnitTransferRecord,
} from '@/types/app'
import type { Json, Tables, TablesInsert, TablesUpdate } from '@/types/database'

export interface ClubData {
  members: Tables<'members'>[]
  transactions: FundTransactionRecord[]
  allSnapshots: Tables<'portfolio_snapshots'>[]
  snapshots: Tables<'portfolio_snapshots'>[]
  latestSnapshot: Tables<'portfolio_snapshots'> | null
  latestHoldings: Tables<'holding_snapshots'>[]
  settingsRows: Tables<'app_settings'>[]
  settingsMap: Record<string, Json>
  memberSummaries: MemberSummaryRow[]
  dashboardSummary: DashboardSummary
  effectiveValuation: EffectiveValuation
  snapshotSeries: SnapshotChartPoint[]
  holdingsRows: HoldingRow[]
  ownershipAllocation: Array<{ name: string; value: number }>
  holdingsAllocation: Array<{ name: string; value: number }>
  startingUnitPrice: number
  useMockData: boolean
  fundCurrency: string
  brokerCurrency: string
  brokerToFundFxRate: number | null
  latestSnapshotFx: SnapshotFxMeta | null
}

export interface ManagedUserRecord {
  id: string
  email: string | null
  createdAt: string | null
  lastSignInAt: string | null
  emailConfirmedAt: string | null
  username: string | null
  role: 'admin' | 'viewer'
}

export interface CreateClubUserInput {
  email: string
  password: string
  username: string
  role: 'admin' | 'viewer'
}

function unwrapSettingValue<T>(value: Json | null | undefined): T | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
    return value.value as T
  }

  return value as T | undefined
}

export function readSettingNumber(settings: Tables<'app_settings'>[], key: string, fallback: number) {
  const row = settings.find((setting) => setting.key === key)
  const value = unwrapSettingValue<number>(row?.value)
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function readSettingBoolean(settings: Tables<'app_settings'>[], key: string, fallback = false) {
  const row = settings.find((setting) => setting.key === key)
  const value = unwrapSettingValue<boolean>(row?.value)
  return typeof value === 'boolean' ? value : fallback
}

export function readSettingString(settings: Tables<'app_settings'>[], key: string, fallback: string) {
  const row = settings.find((setting) => setting.key === key)
  const value = unwrapSettingValue<string>(row?.value)
  return typeof value === 'string' && value.trim() !== '' ? value.trim().toUpperCase() : fallback
}

export function readOptionalSettingNumber(settings: Tables<'app_settings'>[], key: string) {
  const row = settings.find((setting) => setting.key === key)
  const value = unwrapSettingValue<number | null>(row?.value)
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function readOptionalSettingString(
  settings: Tables<'app_settings'>[],
  key: string
) {
  const row = settings.find((setting) => setting.key === key)
  const value = unwrapSettingValue<string | null>(row?.value)
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function toSettingsMap(settings: Tables<'app_settings'>[]) {
  return Object.fromEntries(settings.map((setting) => [setting.key, setting.value]))
}

function extractSnapshotFx(snapshot: Tables<'portfolio_snapshots'> | null): SnapshotFxMeta | null {
  const currencies =
    snapshot?.raw_json &&
    typeof snapshot.raw_json === 'object' &&
    !Array.isArray(snapshot.raw_json) &&
    'currencies' in snapshot.raw_json &&
    snapshot.raw_json.currencies &&
    typeof snapshot.raw_json.currencies === 'object' &&
    !Array.isArray(snapshot.raw_json.currencies)
      ? snapshot.raw_json.currencies
      : null

  if (!currencies) {
    return null
  }

  const brokerCurrency =
    typeof currencies.brokerCurrency === 'string' ? currencies.brokerCurrency : null
  const fundCurrency =
    typeof currencies.fundCurrency === 'string' ? currencies.fundCurrency : null
  const source = typeof currencies.source === 'string' ? currencies.source : null
  const referenceDate =
    typeof currencies.referenceDate === 'string' ? currencies.referenceDate : null
  const brokerToFundRate =
    typeof currencies.brokerToFundRate === 'number' && Number.isFinite(currencies.brokerToFundRate)
      ? currencies.brokerToFundRate
      : null

  if (!brokerCurrency || !fundCurrency || !source || brokerToFundRate === null) {
    return null
  }

  return {
    brokerCurrency,
    fundCurrency,
    brokerToFundRate,
    source,
    referenceDate,
  }
}

function normalizeTransaction(
  transaction: Tables<'fund_transactions'>
): FundTransactionRecord {
  return {
    ...transaction,
    type: transaction.type as FundTransactionRecord['type'],
  }
}

function normalizeTransactions(
  transactions: Tables<'fund_transactions'>[] | null
): FundTransactionRecord[] {
  return (transactions ?? []).map(normalizeTransaction)
}

async function fetchLatestHoldings(snapshotId: string | null) {
  if (!snapshotId) {
    return [] as Tables<'holding_snapshots'>[]
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('holding_snapshots')
    .select('*')
    .eq('portfolio_snapshot_id', snapshotId)
    .order('market_value', { ascending: false })

  if (error) {
    throw error
  }

  return data ?? []
}

export async function fetchClubData(): Promise<ClubData> {
  const supabase = getSupabaseClient()
  const [membersResponse, transactionsResponse, snapshotsResponse, settingsResponse] = await Promise.all([
    supabase.from('members').select('*').order('name'),
    supabase.from('fund_transactions').select('*').order('date', { ascending: false }),
    supabase.from('portfolio_snapshots').select('*').order('captured_at', { ascending: false }).limit(250),
    supabase.from('app_settings').select('*'),
  ])

  if (membersResponse.error) throw membersResponse.error
  if (transactionsResponse.error) throw transactionsResponse.error
  if (snapshotsResponse.error) throw snapshotsResponse.error
  if (settingsResponse.error) throw settingsResponse.error

  const members = membersResponse.data ?? []
  const transactions = normalizeTransactions(transactionsResponse.data)
  const snapshots = snapshotsResponse.data ?? []
  const settingsRows = settingsResponse.data ?? []
  const latestSnapshot = snapshots[0] ?? null
  const latestHoldings = await fetchLatestHoldings(latestSnapshot?.id ?? null)
  const startingUnitPrice = readSettingNumber(settingsRows, 'starting_unit_price', 1)
  const fundCurrency = readSettingString(settingsRows, 'fund_base_currency', 'GBP')
  const brokerCurrency = readSettingString(settingsRows, 'broker_account_currency', 'USD')
  const brokerToFundFxRate = readOptionalSettingNumber(settingsRows, 'broker_to_fund_fx_rate')
  const performanceBaselineAt = readOptionalSettingString(settingsRows, 'performance_baseline_at')
  const effectiveValuation = resolveEffectiveValuation({
    transactions,
    latestSnapshot,
    startingUnitPrice,
  })
  const memberSummaries = buildMemberSummaries({
    members,
    transactions,
    currentUnitPrice: effectiveValuation.effectiveCurrentUnitPrice,
  })
  const dashboardSummary = computeDashboardSummary({
    members,
    transactions,
    snapshots,
    latestSnapshot,
    latestHoldings,
    startingUnitPrice,
    performanceBaselineAt,
    effectiveValuation,
  })
  const visibleSnapshots = filterSnapshotsFromDate(
    snapshots,
    dashboardSummary.performanceBaselineCapturedAt
  )

  return {
    members,
    transactions,
    allSnapshots: snapshots,
    snapshots: visibleSnapshots,
    latestSnapshot,
    latestHoldings,
    settingsRows,
    settingsMap: toSettingsMap(settingsRows),
    memberSummaries,
    dashboardSummary,
    effectiveValuation,
    snapshotSeries: buildSnapshotSeries(visibleSnapshots),
    holdingsRows: buildHoldingsRows(latestHoldings),
    ownershipAllocation: buildOwnershipAllocation(memberSummaries),
    holdingsAllocation: buildHoldingsAllocation(latestHoldings),
    startingUnitPrice,
    useMockData: readSettingBoolean(settingsRows, 'etoro_use_mock', false),
    fundCurrency,
    brokerCurrency,
    brokerToFundFxRate,
    latestSnapshotFx: extractSnapshotFx(latestSnapshot),
  }
}

export async function fetchMembersAndTransactions() {
  const supabase = getSupabaseClient()
  const [membersResponse, transactionsResponse] = await Promise.all([
    supabase.from('members').select('*').order('name'),
    supabase.from('fund_transactions').select('*').order('date', { ascending: false }),
  ])

  if (membersResponse.error) throw membersResponse.error
  if (transactionsResponse.error) throw transactionsResponse.error

  return {
    members: membersResponse.data ?? [],
    transactions: normalizeTransactions(transactionsResponse.data),
  }
}

export async function fetchAdminData() {
  const supabase = getSupabaseClient()
  const [membersResponse, settingsResponse, latestSnapshotResponse, profilesResponse] = await Promise.all([
    supabase.from('members').select('*').order('name'),
    supabase.from('app_settings').select('*'),
    supabase
      .from('portfolio_snapshots')
      .select('*')
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
  ])

  if (membersResponse.error) throw membersResponse.error
  if (settingsResponse.error) throw settingsResponse.error
  if (latestSnapshotResponse.error) throw latestSnapshotResponse.error
  if (profilesResponse.error) throw profilesResponse.error

  return {
    members: membersResponse.data ?? [],
    profiles: profilesResponse.data ?? [],
    settingsRows: settingsResponse.data ?? [],
    latestSnapshot: latestSnapshotResponse.data,
  }
}

export async function createMember(payload: TablesInsert<'members'>) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from('members').insert(payload).select('*').single()
  if (error) throw error
  return data
}

export async function updateMember(id: string, payload: TablesUpdate<'members'>) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from('members').update(payload).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function updateProfile(id: string, payload: TablesUpdate<'profiles'>) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from('profiles').update(payload).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function deleteMember(id: string) {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('members').delete().eq('id', id)
  if (error) throw error
}

export async function createTransaction(payload: TablesInsert<'fund_transactions'>) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('fund_transactions')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export interface UnitTransferInput {
  from_member_id: string
  to_member_id: string
  date: string
  amount: number
  unit_price_at_time: number
  units_amount: number
  notes?: string | null
  created_by?: string | null
}

function buildTransferRows(
  payload: UnitTransferInput,
  options?: {
    transferGroupId?: string
    fromTransactionId?: string
    toTransactionId?: string
  }
): Array<TablesInsert<'fund_transactions'>> {
  const transferGroupId = options?.transferGroupId ?? crypto.randomUUID()
  const amount = Math.abs(payload.amount)
  const unitsAmount = Math.abs(payload.units_amount)
  const unitPrice = Math.abs(payload.unit_price_at_time)
  const notes = payload.notes?.trim() ? payload.notes.trim() : null

  return [
    {
      id: options?.fromTransactionId,
      member_id: payload.from_member_id,
      counterparty_member_id: payload.to_member_id,
      transfer_group_id: transferGroupId,
      type: 'TRANSFER_OUT',
      date: payload.date,
      amount,
      unit_price_at_time: unitPrice,
      units_amount: unitsAmount,
      notes,
      created_by: payload.created_by ?? null,
    },
    {
      id: options?.toTransactionId,
      member_id: payload.to_member_id,
      counterparty_member_id: payload.from_member_id,
      transfer_group_id: transferGroupId,
      type: 'TRANSFER_IN',
      date: payload.date,
      amount,
      unit_price_at_time: unitPrice,
      units_amount: unitsAmount,
      notes,
      created_by: payload.created_by ?? null,
    },
  ]
}

export async function createUnitTransfer(payload: UnitTransferInput) {
  const supabase = getSupabaseClient()
  const rows = buildTransferRows(payload)
  const { data, error } = await supabase
    .from('fund_transactions')
    .insert(rows)
    .select('*')

  if (error) throw error

  return normalizeTransactions(data)
}

export async function reverseUnitTransfer(args: {
  transfer: UnitTransferRecord
  profileId: string | null
}) {
  const { transfer, profileId } = args

  return createUnitTransfer({
    from_member_id: transfer.toTransaction.member_id,
    to_member_id: transfer.fromTransaction.member_id,
    date: new Date().toISOString(),
    amount: Number(transfer.fromTransaction.amount),
    unit_price_at_time: Number(transfer.fromTransaction.unit_price_at_time),
    units_amount: Number(transfer.fromTransaction.units_amount),
    notes: `Reversal of transfer ${transfer.transferGroupId} recorded on ${transfer.fromTransaction.date}.`,
    created_by: profileId,
  })
}

export async function updateUnitTransfer(
  transfer: UnitTransferRecord,
  payload: UnitTransferInput
) {
  const supabase = getSupabaseClient()
  const rows = buildTransferRows(payload, {
    transferGroupId: transfer.transferGroupId,
    fromTransactionId: transfer.fromTransaction.id,
    toTransactionId: transfer.toTransaction.id,
  }).map((row, index) => ({
    ...row,
    created_by:
      index === 0 ? transfer.fromTransaction.created_by : transfer.toTransaction.created_by,
  }))
  const { data, error } = await supabase
    .from('fund_transactions')
    .upsert(rows, { onConflict: 'id' })
    .select('*')

  if (error) throw error

  return normalizeTransactions(data)
}

export async function updateTransaction(id: string, payload: TablesUpdate<'fund_transactions'>) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('fund_transactions')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function reverseTransaction(args: {
  transaction: FundTransactionRecord
  profileId: string | null
}) {
  const { transaction, profileId } = args

  const reversedType =
    transaction.type === 'DEPOSIT'
      ? 'WITHDRAWAL'
      : transaction.type === 'WITHDRAWAL'
        ? 'DEPOSIT'
        : 'MANUAL_ADJUSTMENT'

  const reversedUnits =
    transaction.type === 'MANUAL_ADJUSTMENT'
      ? Number((-Number(transaction.units_amount)).toFixed(8))
      : Number(transaction.units_amount)

  const reversedAmount =
    transaction.type === 'MANUAL_ADJUSTMENT'
      ? Number((-Number(transaction.amount)).toFixed(6))
      : Number(transaction.amount)

  return createTransaction({
    member_id: transaction.member_id,
    type: reversedType,
    date: new Date().toISOString(),
    amount: reversedAmount,
    unit_price_at_time: Number(transaction.unit_price_at_time),
    units_amount: reversedUnits,
    notes: `Reversal of ${transaction.type} ${transaction.id ? `(${transaction.id}) ` : ''}from ${transaction.date}.${transaction.notes ? ` Original notes: ${transaction.notes}` : ''}`,
    created_by: profileId,
    counterparty_member_id: transaction.counterparty_member_id ?? null,
    transfer_group_id: null,
  })
}

export async function deleteTransaction(id: string) {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('fund_transactions').delete().eq('id', id)
  if (error) throw error
}

export async function deleteTransferGroup(transferGroupId: string) {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('fund_transactions')
    .delete()
    .eq('transfer_group_id', transferGroupId)

  if (error) throw error
}

export async function fetchManagedUsers() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.functions.invoke('manage-club-users', {
    method: 'POST',
    body: {
      action: 'list_users',
    },
  })

  if (error) {
    throw error
  }

  return (data?.users ?? []) as ManagedUserRecord[]
}

export async function createClubUser(payload: CreateClubUserInput) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.functions.invoke('manage-club-users', {
    method: 'POST',
    body: {
      action: 'create_user',
      ...payload,
    },
  })

  if (error) {
    throw error
  }

  return data as {
    success: boolean
    user: ManagedUserRecord
  }
}

export async function updateAppSetting(key: string, value: Json) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('app_settings')
    .upsert({ key, value })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function createManualPortfolioSnapshot(payload: TablesInsert<'portfolio_snapshots'>) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('portfolio_snapshots')
    .insert(payload)
    .select('*')
    .single()

  if (error) throw error

  return data
}

export async function triggerPortfolioSync() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.functions.invoke('sync-etoro-portfolio', {
    method: 'POST',
  })

  if (error) {
    throw error
  }

  return data as {
    success: boolean
    snapshotId: string
    capturedAt: string
    holdingsCount: number
    usedMock: boolean
    brokerCurrency: string
    fundCurrency: string
    fxRate: number
    fxSource: string
    fxReferenceDate: string | null
  }
}
