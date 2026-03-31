import type { FundTransactionRecord, UnitTransferRecord } from '@/types/app'

export function isTransferTransaction(transaction: FundTransactionRecord) {
  return transaction.type === 'TRANSFER_IN' || transaction.type === 'TRANSFER_OUT'
}

export function buildTransferRecordMap(transactions: FundTransactionRecord[]) {
  const groups = new Map<string, Partial<UnitTransferRecord>>()

  transactions.forEach((transaction) => {
    if (!transaction.transfer_group_id) {
      return
    }

    const existing = groups.get(transaction.transfer_group_id) ?? {
      transferGroupId: transaction.transfer_group_id,
    }

    if (transaction.type === 'TRANSFER_OUT') {
      existing.fromTransaction = transaction
    }

    if (transaction.type === 'TRANSFER_IN') {
      existing.toTransaction = transaction
    }

    groups.set(transaction.transfer_group_id, existing)
  })

  return new Map(
    [...groups.entries()]
      .filter(([, record]) => record.fromTransaction && record.toTransaction)
      .map(([groupId, record]) => [
        groupId,
        {
          transferGroupId: groupId,
          fromTransaction: record.fromTransaction!,
          toTransaction: record.toTransaction!,
        } satisfies UnitTransferRecord,
      ])
  )
}

export function getTransferCounterpartyName(
  transaction: FundTransactionRecord,
  memberNameById: Map<string, string>
) {
  if (!transaction.counterparty_member_id) {
    return null
  }

  return memberNameById.get(transaction.counterparty_member_id) ?? 'Unknown member'
}
