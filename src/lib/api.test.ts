import { beforeEach, describe, expect, it, vi } from 'vitest'

const insertMock = vi.fn()
const selectMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      insert: insertMock,
    }),
  }),
}))

describe('createUnitTransfer', () => {
  beforeEach(() => {
    insertMock.mockReset()
    selectMock.mockReset()
    insertMock.mockReturnValue({ select: selectMock })
    selectMock.mockResolvedValue({ data: [], error: null })
  })

  it('omits id columns when creating a new transfer', async () => {
    const { createUnitTransfer } = await import('./api')

    await createUnitTransfer({
      from_member_id: 'seller-id',
      to_member_id: 'buyer-id',
      date: '2026-06-01T12:00:00.000Z',
      amount: 100,
      unit_price_at_time: 2,
      units_amount: 50,
      notes: null,
      created_by: 'profile-id',
    })

    const rows = insertMock.mock.calls[0]?.[0]

    expect(rows).toHaveLength(2)
    expect(rows[0]).not.toHaveProperty('id')
    expect(rows[1]).not.toHaveProperty('id')
  })
})
