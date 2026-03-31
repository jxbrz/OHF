import path from 'node:path'
import { existsSync } from 'node:fs'
import * as XLSXModule from 'xlsx'
import { createAdminClient } from './_shared'
import type { TablesInsert } from '../src/types/database'

const XLSX = (XLSXModule as typeof XLSXModule & { default?: typeof XLSXModule }).default ?? XLSXModule
type WorkbookCell = unknown | null
type WorkbookRow = WorkbookCell[]

interface ParsedWorkbook {
  memberNames: string[]
  summaryRows: Array<{
    memberName: string
    unitsBought: number
    unitsSold: number
    netUnits: number
  }>
  transactions: Array<{
    memberName: string
    type: 'DEPOSIT' | 'WITHDRAWAL' | 'MANUAL_ADJUSTMENT' | 'FEE'
    date: string
    amount: number
    unit_price_at_time: number
    units_amount: number
    notes: string | null
  }>
  startingUnitPrice: number
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function resolveWorkbookPath(rawPath?: string): string {
  const candidates = [
    rawPath,
    process.env.WORKBOOK_PATH,
    path.resolve('..', 'OHF.xlsx'),
    path.resolve('OHF.xlsx'),
  ].filter((value): value is string => Boolean(value))

  const foundPath = candidates.find((candidate) => existsSync(candidate))
  if (!foundPath) {
    throw new Error('Could not locate OHF.xlsx. Pass a workbook path explicitly or set WORKBOOK_PATH.')
  }

  return foundPath
}

function coerceDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) {
      throw new Error(`Invalid Excel date serial: ${value}`)
    }

    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).toISOString()
  }

  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid workbook date string: ${value}`)
    }

    return parsed.toISOString()
  }

  throw new Error(`Unsupported workbook date value: ${String(value)}`)
}

function coerceNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

function hasMeaningfulCell(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false
  }

  if (typeof value === 'string') {
    return value.trim() !== ''
  }

  return true
}

function buildOpeningTransaction(args: {
  memberName: string
  unitsBought: number
  unitsSold: number
  netUnits: number
  openingDate: string
  unitPrice: number
}): ParsedWorkbook['transactions'][number] | null {
  const { memberName, unitsBought, unitsSold, netUnits, openingDate, unitPrice } = args

  if (Math.abs(netUnits) <= 0) {
    return null
  }

  const roundedUnitPrice = unitPrice > 0 ? unitPrice : 1
  const openingAmount = Number(Math.abs(netUnits * roundedUnitPrice).toFixed(8))

  if (netUnits > 0 && unitsBought > 0 && unitsSold === 0) {
    return {
      memberName,
      type: 'DEPOSIT',
      date: openingDate,
      amount: openingAmount,
      unit_price_at_time: roundedUnitPrice,
      units_amount: Number(netUnits.toFixed(8)),
      notes: 'Imported opening balance from Members Summary.',
    }
  }

  if (netUnits < 0 && unitsSold > 0 && unitsBought === 0) {
    return {
      memberName,
      type: 'WITHDRAWAL',
      date: openingDate,
      amount: openingAmount,
      unit_price_at_time: roundedUnitPrice,
      units_amount: Number(Math.abs(netUnits).toFixed(8)),
      notes: 'Imported opening balance from Members Summary.',
    }
  }

  return {
    memberName,
    type: 'MANUAL_ADJUSTMENT',
    date: openingDate,
    amount: Number((netUnits * roundedUnitPrice).toFixed(8)),
    unit_price_at_time: roundedUnitPrice,
    units_amount: Number(netUnits.toFixed(8)),
    notes: 'Imported opening balance from Members Summary.',
  }
}

function parseWorkbook(workbookPath: string): ParsedWorkbook {
  const workbook = XLSX.readFile(workbookPath, { cellDates: true })
  const membersSheet = workbook.Sheets['Members Summary']
  const transactionsSheet = workbook.Sheets['Transaction Log']

  if (!membersSheet || !transactionsSheet) {
    throw new Error('Workbook must contain "Members Summary" and "Transaction Log" sheets.')
  }

  const membersRows: WorkbookRow[] = XLSX.utils.sheet_to_json(membersSheet, {
    header: 1,
    raw: true,
    defval: null,
  })
  const transactionRows: WorkbookRow[] = XLSX.utils.sheet_to_json(transactionsSheet, {
    header: 1,
    raw: true,
    defval: null,
  })

  const summaryNames = membersRows
    .slice(1)
    .map((row) => normalizeName(row[0]))
    .filter((value): value is string => Boolean(value))
  const summaryRows = membersRows
    .slice(1)
    .map((row) => {
      const memberName = normalizeName(row[0])
      if (!memberName) {
        return null
      }

      return {
        memberName,
        unitsBought: coerceNumber(row[1]),
        unitsSold: coerceNumber(row[2]),
        netUnits: coerceNumber(row[3]),
      }
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)

  const transactionEntries = transactionRows
    .slice(1)
    .filter((row: WorkbookRow) => row.some((value: WorkbookCell) => hasMeaningfulCell(value)))
    .map((row: WorkbookRow): ParsedWorkbook['transactions'][number] => {
      const memberName = normalizeName(row[1])
      const type = normalizeName(row[2]) as ParsedWorkbook['transactions'][number]['type'] | null

      if (!memberName || !type) {
        throw new Error(`Transaction row is missing a member or type: ${JSON.stringify(row)}`)
      }

      return {
        memberName,
        type,
        date: coerceDate(row[0]),
        amount: coerceNumber(row[3]),
        unit_price_at_time: coerceNumber(row[4], 1),
        units_amount: coerceNumber(row[5]),
        notes: normalizeName(row[6]),
      }
    })

  const explicitStartingUnitPrice = coerceNumber(membersSheet.K7?.v, 1)
  const openingDate =
    transactionEntries
      .map((transaction) => transaction.date)
      .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0] ??
    new Date().toISOString()
  const transactionMembers = new Set(
    transactionEntries.map((transaction) => transaction.memberName.toUpperCase())
  )
  const synthesizedOpeningTransactions = summaryRows
    .filter(
      (summaryRow) =>
        Math.abs(summaryRow.netUnits) > 0 &&
        !transactionMembers.has(summaryRow.memberName.toUpperCase())
    )
    .map((summaryRow) =>
      buildOpeningTransaction({
        ...summaryRow,
        openingDate,
        unitPrice: explicitStartingUnitPrice > 0 ? explicitStartingUnitPrice : 1,
      })
    )
    .filter((value): value is ParsedWorkbook['transactions'][number] => value !== null)
  const memberNames = Array.from(
    new Set([
      ...summaryNames,
      ...transactionEntries.map((transaction) => transaction.memberName),
      ...synthesizedOpeningTransactions.map((transaction) => transaction.memberName),
    ])
  ).sort((left, right) => left.localeCompare(right))

  return {
    memberNames,
    summaryRows,
    transactions: [...transactionEntries, ...synthesizedOpeningTransactions],
    startingUnitPrice: explicitStartingUnitPrice > 0 ? explicitStartingUnitPrice : 1,
  }
}

async function main() {
  const supabase = createAdminClient()
  const workbookPath = resolveWorkbookPath(process.argv[2])
  const replaceExisting = process.argv.includes('--replace')
  const parsedWorkbook = parseWorkbook(workbookPath)

  const { count: existingTransactionsCount, error: existingTransactionsError } = await supabase
    .from('fund_transactions')
    .select('id', { count: 'exact', head: true })

  if (existingTransactionsError) {
    throw existingTransactionsError
  }

  if ((existingTransactionsCount ?? 0) > 0 && !replaceExisting) {
    throw new Error(
      'Existing fund transactions were found. Re-run with --replace if you want to clear and re-import.'
    )
  }

  if (replaceExisting) {
    const { error: deleteTransactionsError } = await supabase
      .from('fund_transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (deleteTransactionsError) {
      throw deleteTransactionsError
    }

    const { error: deleteMembersError } = await supabase
      .from('members')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (deleteMembersError) {
      throw deleteMembersError
    }
  }

  const memberUpserts: TablesInsert<'members'>[] = parsedWorkbook.memberNames.map((name) => ({
    name,
    is_active: true,
  }))

  const { error: memberUpsertError } = await supabase.from('members').upsert(memberUpserts, {
    onConflict: 'name',
  })

  if (memberUpsertError) {
    throw memberUpsertError
  }

  const { data: members, error: membersError } = await supabase.from('members').select('id, name')

  if (membersError) {
    throw membersError
  }

  const memberIdByName = new Map(members.map((member) => [member.name, member.id]))
  const transactionInserts: TablesInsert<'fund_transactions'>[] = parsedWorkbook.transactions.map(
    (transaction) => {
      const memberId = memberIdByName.get(transaction.memberName)
      if (!memberId) {
        throw new Error(`Missing member id for ${transaction.memberName}`)
      }

      return {
        member_id: memberId,
        type: transaction.type,
        date: transaction.date,
        amount: transaction.amount,
        unit_price_at_time: transaction.unit_price_at_time,
        units_amount: transaction.units_amount,
        notes: transaction.notes,
        created_by: null,
      }
    }
  )

  if (transactionInserts.length > 0) {
    const { error: transactionInsertError } = await supabase
      .from('fund_transactions')
      .insert(transactionInserts)

    if (transactionInsertError) {
      throw transactionInsertError
    }
  }

  const { error: settingError } = await supabase.from('app_settings').upsert({
    key: 'starting_unit_price',
    value: { value: parsedWorkbook.startingUnitPrice },
  })

  if (settingError) {
    throw settingError
  }

  console.log(
    `Imported ${parsedWorkbook.memberNames.length} members and ${parsedWorkbook.transactions.length} transactions from ${workbookPath}`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
