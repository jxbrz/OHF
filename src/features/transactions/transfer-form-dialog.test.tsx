import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TransferFormDialog } from './transfer-form-dialog'
import type { Tables } from '@/types/database'

const members: Tables<'members'>[] = [
  {
    id: 'member-alice',
    name: 'Alice Holder',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'member-bob',
    name: 'Bob Buyer',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
]

function renderTransferDialog() {
  const queryClient = new QueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <TransferFormDialog
        defaultUnitPrice={1}
        draftTransfer={{
          from_member_id: 'member-alice',
          to_member_id: 'member-bob',
          amount: 50,
          units_amount: 10,
        }}
        members={members}
        open
        profileId={null}
        transactions={[]}
        onOpenChange={vi.fn()}
      />
    </QueryClientProvider>
  )
}

describe('TransferFormDialog', () => {
  it('shows selected member names in the transfer select boxes', () => {
    renderTransferDialog()

    expect(screen.getByRole('combobox', { name: 'Selling member' })).toHaveTextContent('Alice Holder')
    expect(screen.getByRole('combobox', { name: 'Buying member' })).toHaveTextContent('Bob Buyer')
  })
})
