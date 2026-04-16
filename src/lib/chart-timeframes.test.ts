import { describe, expect, it } from 'vitest'
import { getTimeframeChangeSummary } from './chart-timeframes'

describe('getTimeframeChangeSummary', () => {
  it('uses unit price so deposits do not appear as performance', () => {
    const summary = getTimeframeChangeSummary(
      [
        {
          capturedAt: '2026-04-15T12:00:00.000Z',
          totalAccountValue: 100,
          unitPrice: 1,
        },
        {
          capturedAt: '2026-04-16T12:00:00.000Z',
          totalAccountValue: 200,
          unitPrice: 1,
        },
      ],
      'week'
    )

    expect(summary).toMatchObject({
      changeAmount: 0,
      changePct: 0,
      baselineAt: '2026-04-15T12:00:00.000Z',
      latestAt: '2026-04-16T12:00:00.000Z',
    })
  })

  it('reports genuine performance when unit price changes', () => {
    const summary = getTimeframeChangeSummary(
      [
        {
          capturedAt: '2026-04-15T12:00:00.000Z',
          totalAccountValue: 100,
          unitPrice: 1,
        },
        {
          capturedAt: '2026-04-16T12:00:00.000Z',
          totalAccountValue: 105,
          unitPrice: 1.05,
        },
      ],
      'week'
    )

    expect(summary?.changeAmount).toBeCloseTo(0.05, 10)
    expect(summary?.changePct).toBeCloseTo(0.05, 10)
  })
})
