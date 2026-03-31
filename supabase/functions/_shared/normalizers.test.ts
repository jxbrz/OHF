import { normalizeEtoroData } from './normalizers'

describe('eToro normalizer', () => {
  it('converts broker summary values into the fund currency while leaving quote prices untouched', () => {
    const normalized = normalizeEtoroData({
      identity: { realCid: 123 },
      pnl: {
        clientPortfolio: {
          credit: 10,
          unrealizedPnL: 5,
          positions: [
            {
              instrumentID: 1014,
              units: 2,
              openRate: 200,
              closeRate: 210,
              amount: 100,
              pnL: 5,
            },
          ],
        },
      },
      fxContext: {
        brokerCurrency: 'USD',
        fundCurrency: 'GBP',
        rate: 0.75,
        source: 'manual_override',
        referenceDate: null,
      },
    })

    expect(normalized.availableCash).toBe(7.5)
    expect(normalized.unrealizedPnl).toBe(3.75)
    expect(normalized.totalAccountValue).toBe(86.25)
    expect(normalized.holdings[0]).toMatchObject({
      average_open: 200,
      current_price: 210,
      market_value: 78.75,
      pnl: 3.75,
    })
    expect(normalized.rawJson.currencies).toMatchObject({
      brokerCurrency: 'USD',
      fundCurrency: 'GBP',
      brokerToFundRate: 0.75,
      source: 'manual_override',
    })
  })
})
