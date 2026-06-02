import {
  evaluateValuationJump,
  normalizeValuationJumpThresholdPct,
} from './sync-valuation-guard'

describe('sync valuation jump guard', () => {
  it('rejects suspicious valuation jumps above the configured threshold', () => {
    const decision = evaluateValuationJump({
      previousSnapshot: {
        id: 'snapshot-1',
        captured_at: '2026-06-01T10:00:00.000Z',
        total_account_value: 1000,
      },
      newTotalAccountValue: 1500,
      thresholdPct: 35,
      trigger: 'scheduled_hourly_sync',
    })

    expect(decision).toMatchObject({
      shouldReject: true,
      previousTotalAccountValue: 1000,
      newTotalAccountValue: 1500,
      changePct: 50,
      thresholdPct: 35,
      previousSnapshotId: 'snapshot-1',
      previousSnapshotCapturedAt: '2026-06-01T10:00:00.000Z',
      forced: false,
    })
  })

  it('allows manual_force requests even when the valuation jump is suspicious', () => {
    const decision = evaluateValuationJump({
      previousSnapshot: {
        id: 'snapshot-1',
        captured_at: '2026-06-01T10:00:00.000Z',
        total_account_value: 1000,
      },
      newTotalAccountValue: 1500,
      thresholdPct: 35,
      trigger: 'manual_force',
    })

    expect(decision.shouldReject).toBe(false)
    expect(decision.forced).toBe(true)
  })

  it('rejects a collapse to zero when a previous valuation exists', () => {
    const decision = evaluateValuationJump({
      previousSnapshot: {
        id: 'snapshot-1',
        captured_at: '2026-06-01T10:00:00.000Z',
        total_account_value: 1000,
      },
      newTotalAccountValue: 0,
      thresholdPct: 35,
    })

    expect(decision).toMatchObject({
      shouldReject: true,
      changePct: 100,
    })
  })

  it('accepts both fractional and percentage threshold settings', () => {
    expect(normalizeValuationJumpThresholdPct(0.35)).toBe(35)
    expect(normalizeValuationJumpThresholdPct(35)).toBe(35)
  })
})
