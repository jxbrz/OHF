import { ETORO_NORMALIZER_VERSION, normalizeEtoroData } from './normalizers'
import { calculateCurrentUnitPrice } from '../../../shared/calculations/index'

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
    expect(normalized.rawJson.valuation).toMatchObject({
      brokerReportedTotalAccountValue: null,
      reconstructedHoldingsValue: 78.75,
      reconstructedTotalAccountValue: 86.25,
      valuationSource: 'reconstructed_from_positions_and_mirrors',
      mirrorCount: 0,
      positionCount: 1,
    })
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

  it('aggregates duplicate symbol positions into one holding row', () => {
    const normalized = normalizeEtoroData({
      identity: { realCid: 123 },
      pnl: {
        clientPortfolio: {
          credit: 0,
          positions: [
            {
              instrumentID: 5035,
              units: 1,
              openRate: 100,
              closeRate: 110,
              amount: 100,
              pnL: 10,
            },
            {
              instrumentID: 5035,
              units: 2,
              openRate: 120,
              closeRate: 110,
              amount: 240,
              pnL: -20,
            },
          ],
        },
      },
      instrumentMetadata: [
        {
          internalInstrumentId: 5035,
          internalSymbolFull: 'SOP.PA',
          internalInstrumentDisplayName: 'Sopra Steria Group',
        },
      ],
      fxContext: {
        brokerCurrency: 'USD',
        fundCurrency: 'GBP',
        rate: 1,
        source: 'same_currency',
        referenceDate: null,
      },
    })

    expect(normalized.holdings).toHaveLength(1)
    expect(normalized.holdings[0]).toMatchObject({
      symbol: 'SOP.PA',
      instrument_name: 'Sopra Steria Group',
      quantity: 3,
      average_open: 113.33333333,
      current_price: 110,
      market_value: 330,
      pnl: -10,
      allocation_pct: 1,
    })
  })

  it('uses explicit current value for Smart Portfolio mirror holdings', () => {
    const normalized = normalizeEtoroData({
      pnl: {
        clientPortfolio: {
          credit: 100,
          mirrors: [
            {
              mirrorId: 42,
              parentUsername: 'QuantumComputing',
              initialInvestment: 500,
              currentValue: 720,
              availableAmount: 25,
              closedPositionsNetProfit: 12,
            },
          ],
        },
      },
      fxContext: {
        brokerCurrency: 'USD',
        fundCurrency: 'USD',
        rate: 1,
        source: 'same_currency',
        referenceDate: null,
      },
    })

    expect(normalized.totalAccountValue).toBe(820)
    expect(normalized.holdings[0]).toMatchObject({
      symbol: 'QuantumComputing',
      instrument_name: 'Smart Portfolio: QuantumComputing',
      market_value: 720,
      pnl: 12,
      allocation_pct: 0.878049,
    })
  })

  it('does not treat mirror availableAmount as the market value when investment and pnl are present', () => {
    const normalized = normalizeEtoroData({
      pnl: {
        clientPortfolio: {
          credit: 0,
          mirrors: [
            {
              mirrorId: 77,
              parentUsername: 'QuantumComputing',
              initialInvestment: 1000,
              unrealizedPnL: 225,
              closedPositionsNetProfit: -50,
              availableAmount: 40,
            },
          ],
        },
      },
      fxContext: {
        brokerCurrency: 'USD',
        fundCurrency: 'USD',
        rate: 1,
        source: 'same_currency',
        referenceDate: null,
      },
    })

    expect(normalized.totalAccountValue).toBe(1175)
    expect(normalized.holdings[0]).toMatchObject({
      market_value: 1175,
      pnl: 175,
    })
  })

  it('prefers broker-reported total account equity over reconstructed holdings value', () => {
    const normalized = normalizeEtoroData({
      pnl: {
        clientPortfolio: {
          credit: 50,
          equity: 1500,
          positions: [
            {
              instrumentID: 1001,
              units: 1,
              openRate: 100,
              closeRate: 500,
              amount: 500,
              pnL: 0,
            },
          ],
          mirrors: [
            {
              mirrorId: 7,
              parentUsername: 'QuantumComputing',
              availableAmount: 10,
            },
          ],
        },
      },
      fxContext: {
        brokerCurrency: 'USD',
        fundCurrency: 'GBP',
        rate: 0.8,
        source: 'manual_override',
        referenceDate: null,
      },
    })

    expect(normalized.totalAccountValue).toBe(1200)
    expect(normalized.rawJson.valuation).toMatchObject({
      brokerReportedTotalAccountValue: 1200,
      brokerReportedTotalAccountValueSourceField: 'equity',
      reconstructedHoldingsValue: 408,
      reconstructedTotalAccountValue: 448,
      finalValuationSource: 'broker_reported',
      mirrorCount: 1,
      positionCount: 1,
    })
    expect(normalized.holdings.map((holding) => holding.market_value)).toEqual([400, 8])
  })

  it('reconstructs Smart Portfolio mirror value from nested mirror position exposure', () => {
    const normalized = normalizeEtoroData({
      pnl: {
        clientPortfolio: {
          credit: 67.6,
          bonusCredit: 0,
          positions: [
            {
              amount: 48,
              mirrorID: 0,
              unrealizedPnL: {
                pnL: 1.28,
                exposureInAccountCurrency: 49.28,
              },
            },
            {
              amount: 46.32,
              mirrorID: 0,
              unrealizedPnL: {
                pnL: 2.96,
                exposureInAccountCurrency: 49.28,
              },
            },
          ],
          mirrors: [
            {
              parentUsername: 'QuantumComputing',
              mirrorID: 11454557,
              availableAmount: 1.05,
              initialInvestment: 500,
              closedPositionsNetProfit: 0,
              positions: [
                {
                  unrealizedPnL: {
                    exposureInAccountCurrency: 100,
                  },
                },
                {
                  unrealizedPnL: {
                    exposureInAccountCurrency: 120,
                  },
                },
                {
                  unrealizedPnL: {
                    exposureInAccountCurrency: 140,
                  },
                },
                {
                  unrealizedPnL: {
                    exposureInAccountCurrency: 142.79,
                  },
                },
              ],
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

    const quantumHolding = normalized.holdings.find(
      (holding) => holding.symbol === 'QuantumComputing'
    )

    expect(quantumHolding).toMatchObject({
      instrument_name: 'Smart Portfolio: QuantumComputing',
      market_value: 377.0925,
    })
    expect(quantumHolding?.market_value).not.toBe(0.7875)
    expect(normalized.totalAccountValue).toBe(501.7125)
    expect(calculateCurrentUnitPrice(normalized.totalAccountValue, 250, 1)).toBe(2.00685)
    expect(normalized.rawJson.debugVersion).toBe(ETORO_NORMALIZER_VERSION)
    expect(normalized.rawJson.valuation).toMatchObject({
      debugVersion: ETORO_NORMALIZER_VERSION,
      creditUsd: 67.6,
      directPositionsUsd: 98.56,
      mirrorValuesUsd: 502.79,
      mirrorNestedExposureUsd: 502.79,
      reconstructedTotalUsd: 668.95,
      reconstructedTotalGbp: 501.7125,
      finalTotalAccountValue: 501.7125,
      finalValuationSource: 'reconstructed_from_positions_and_mirrors',
      mirrorCount: 1,
      positionCount: 2,
      directPositionCount: 2,
      nestedMirrorPositionCount: 4,
    })
  })
})
