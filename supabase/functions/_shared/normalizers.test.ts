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
      instrument_name: 'Mirror: QuantumComputing',
      market_value: 720,
      pnl: 220,
      allocation_pct: 0.878049,
    })
  })

  it('resolves Smart Portfolio PnL from explicit current value minus initial investment', () => {
    const normalized = normalizeEtoroData({
      pnl: {
        clientPortfolio: {
          mirrors: [
            {
              mirrorId: 42,
              parentUsername: 'QuantumComputing',
              currentValue: 494.4,
              initialInvestment: 500,
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

    expect(normalized.holdings).toHaveLength(1)
    expect(normalized.holdings[0]).toMatchObject({
      symbol: 'QuantumComputing',
      market_value: 494.4,
      pnl: -5.6,
    })
    expect(normalized.rawJson.valuation).toMatchObject({
      smartPortfolioActualValueUsd: 494.4,
      smartPortfolioValueSource: 'explicit_currentValue',
      smartPortfolioPnlUsd: -5.6,
      smartPortfolioPnlSource: 'resolvedValue_minus_invested',
      smartPortfolioInvestedUsd: 500,
      smartPortfolioInvestedSource: 'initialInvestment',
      smartPortfolioValueMinusInvestedUsd: -5.6,
      smartPortfolioMirrors: [
        expect.objectContaining({
          symbol: 'QuantumComputing',
          resolvedValueUsd: 494.4,
          resolvedValueSource: 'explicit_currentValue',
          resolvedPnlUsd: -5.6,
          resolvedPnlSource: 'resolvedValue_minus_invested',
          investedUsd: 500,
          investedSource: 'initialInvestment',
        }),
      ],
    })
  })

  it('resolves Smart Portfolio value from initial investment plus explicit PnL', () => {
    const normalized = normalizeEtoroData({
      pnl: {
        clientPortfolio: {
          mirrors: [
            {
              mirrorId: 42,
              parentUsername: 'QuantumComputing',
              initialInvestment: 500,
              pnl: -5.6,
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

    expect(normalized.holdings[0]).toMatchObject({
      market_value: 494.4,
      pnl: -5.6,
    })
    expect(normalized.rawJson.valuation).toMatchObject({
      smartPortfolioActualValueUsd: 494.4,
      smartPortfolioValueSource: 'initialInvestment_plus_explicit_pnl',
      smartPortfolioPnlUsd: -5.6,
      smartPortfolioPnlSource: 'explicit_pnl',
      smartPortfolioInvestedUsd: 500,
      smartPortfolioInvestedSource: 'initialInvestment',
    })
  })

  it('prefers nested Smart Portfolio actual value over available cash', () => {
    const normalized = normalizeEtoroData({
      pnl: {
        clientPortfolio: {
          mirrors: [
            {
              mirrorId: 42,
              parentUsername: 'QuantumComputing',
              mirrorType: 'SmartPortfolio',
              availableAmount: 1.05,
              initialInvestment: 500,
              positions: [
                { amount: 250, pnL: 2.79 },
                { amount: 250, pnL: 0 },
              ],
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

    expect(normalized.totalAccountValue).toBe(502.79)
    expect(normalized.holdings[0]).toMatchObject({
      instrument_name: 'Smart Portfolio: QuantumComputing',
      market_value: 502.79,
    })
    expect(normalized.rawJson.valuation).toMatchObject({
      mirrorDiagnostics: [
        expect.objectContaining({
          symbol: 'QuantumComputing',
          mirrorId: 42,
          resolvedValueUsd: 502.79,
          resolvedValueSource: 'nested_actual_values',
          nestedActualValueUsd: 502.79,
          nestedPositionCount: 2,
          investedUsd: 500,
          availableAmountUsd: 1.05,
          rawParentUsername: 'QuantumComputing',
        }),
      ],
    })
  })

  it('values a copied trader from nested leveraged equity before invested plus PnL', () => {
    const normalized = normalizeEtoroData({
      pnl: {
        clientPortfolio: {
          mirrors: [
            {
              mirrorId: 77,
              parentUsername: 'CopiedTrader',
              type: 'CopyTrader',
              initialInvestment: 200,
              pnl: 10,
              positions: [
                {
                  unrealizedPnL: {
                    marginInAccountCurrency: 90,
                    pnL: 5,
                    exposureInAccountCurrency: 150,
                  },
                },
                {
                  unrealizedPnL: {
                    marginInAccountCurrency: 95,
                    pnL: -5,
                    exposureInAccountCurrency: 150,
                  },
                },
              ],
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

    expect(normalized.totalAccountValue).toBe(185)
    expect(normalized.holdings[0]).toMatchObject({
      instrument_name: 'Copy Trader: CopiedTrader',
      market_value: 185,
      notional_exposure: 300,
    })
    expect(normalized.holdings[0]?.market_value).not.toBe(210)
    expect(normalized.rawJson.valuation).toMatchObject({
      mirrorDiagnostics: [
        expect.objectContaining({
          resolvedValueUsd: 185,
          resolvedValueSource: 'nested_actual_values',
          nestedActualValueUsd: 185,
          nestedNotionalExposureUsd: 300,
          resolvedPnlUsd: 10,
          valueMinusInvestedUsd: -15,
        }),
      ],
    })
  })

  it('resolves Smart Portfolio PnL from nested actual fallback minus initial investment', () => {
    const normalized = normalizeEtoroData({
      pnl: {
        clientPortfolio: {
          mirrors: [
            {
              mirrorId: 42,
              parentUsername: 'QuantumComputing',
              initialInvestment: 500,
              positions: [
                {
                  amount: 500,
                  unrealizedPnL: {
                    pnL: -5.6,
                    exposureInAccountCurrency: 900,
                  },
                },
              ],
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

    expect(normalized.holdings[0]).toMatchObject({
      market_value: 494.4,
      notional_exposure: 900,
      pnl: -5.6,
    })
    expect(normalized.rawJson.valuation).toMatchObject({
      smartPortfolioActualValueUsd: 494.4,
      smartPortfolioValueSource: 'nested_actual_values',
      smartPortfolioPnlUsd: -5.6,
      smartPortfolioPnlSource: 'nestedActualValue_minus_invested',
      smartPortfolioInvestedUsd: 500,
      smartPortfolioNestedActualValueUsd: 494.4,
      smartPortfolioNestedNotionalExposureUsd: 900,
    })
  })

  it('keeps explicit zero Smart Portfolio PnL as explicit rather than defaulted', () => {
    const normalized = normalizeEtoroData({
      pnl: {
        clientPortfolio: {
          mirrors: [
            {
              mirrorId: 42,
              parentUsername: 'QuantumComputing',
              initialInvestment: 500,
              pnl: 0,
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

    expect(normalized.holdings[0]).toMatchObject({
      market_value: 500,
      pnl: 0,
    })
    expect(normalized.rawJson.valuation).toMatchObject({
      smartPortfolioPnlUsd: 0,
      smartPortfolioPnlSource: 'explicit_pnl',
      smartPortfolioMirrors: [
        expect.objectContaining({
          resolvedPnlUsd: 0,
          resolvedPnlSource: 'explicit_pnl',
          pnlDefaulted: false,
        }),
      ],
    })
  })

  it('values a flat leveraged position from stake plus zero PnL, not notional exposure', () => {
    const normalized = normalizeEtoroData({
      pnl: {
        clientPortfolio: {
          positions: [
            {
              instrumentID: 1001,
              amount: 100,
              unrealizedPnL: {
                pnL: 0,
                exposureInAccountCurrency: 500,
              },
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

    expect(normalized.holdings[0]).toMatchObject({
      market_value: 100,
      notional_exposure: 500,
      leverage_multiple: 5,
    })
    expect(normalized.holdings[0]?.market_value).not.toBe(500)
    expect(normalized.rawJson.valuation).toMatchObject({
      directActualValueUsd: 100,
      directNotionalExposureUsd: 500,
      directPositionsUsd: 100,
      reconstructedTotalUsd: 100,
      finalTotalAccountValue: 100,
    })
  })

  it('values a profitable leveraged position from stake plus PnL, not notional exposure', () => {
    const normalized = normalizeEtoroData({
      pnl: {
        clientPortfolio: {
          positions: [
            {
              instrumentID: 1001,
              amount: 100,
              unrealizedPnL: {
                pnL: 10,
                exposureInAccountCurrency: 550,
              },
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

    expect(normalized.holdings[0]).toMatchObject({
      market_value: 110,
      notional_exposure: 550,
      pnl: 10,
    })
    expect(normalized.holdings[0]?.market_value).not.toBe(550)
    expect(normalized.rawJson.valuation).toMatchObject({
      directActualValueUsd: 110,
      directNotionalExposureUsd: 550,
      reconstructedTotalUsd: 110,
      finalTotalAccountValue: 110,
    })
  })

  it('prefers position margin for actual value and derives notional from units as fallback', () => {
    const normalized = normalizeEtoroData({
      pnl: {
        clientPortfolio: {
          positions: [
            {
              instrumentID: 1001,
              amount: 200,
              units: 3,
              closeRate: 100,
              closeConversionRate: 1,
              unrealizedPnL: {
                marginInAccountCurrency: 80,
                pnL: 5,
              },
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

    expect(normalized.totalAccountValue).toBe(85)
    expect(normalized.holdings[0]).toMatchObject({
      market_value: 85,
      notional_exposure: 300,
      leverage_multiple: 3.529412,
    })
    expect(normalized.rawJson.valuation).toMatchObject({
      directActualValueUsd: 85,
      directNotionalExposureUsd: 300,
    })
  })

  it('reconstructs total account value from cash plus actual leveraged position value', () => {
    const normalized = normalizeEtoroData({
      pnl: {
        clientPortfolio: {
          credit: 50,
          positions: [
            {
              instrumentID: 1001,
              amount: 100,
              unrealizedPnL: {
                pnL: 0,
                exposureInAccountCurrency: 500,
              },
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

    expect(normalized.totalAccountValue).toBe(150)
    expect(normalized.totalAccountValue).not.toBe(550)
    expect(normalized.rawJson.valuation).toMatchObject({
      creditUsd: 50,
      directActualValueUsd: 100,
      directNotionalExposureUsd: 500,
      reconstructedTotalUsd: 150,
      finalTotalAccountValue: 150,
    })
  })

  it('keeps explicit Smart Portfolio value as one accounting holding with nested exposure in look-through only', () => {
    const normalized = normalizeEtoroData({
      pnl: {
        clientPortfolio: {
          mirrors: [
            {
              mirrorId: 42,
              parentUsername: 'QuantumComputing',
              currentValue: 500,
              positions: [
                {
                  instrumentID: 1001,
                  symbol: 'AAA',
                  amount: 100,
                  unrealizedPnL: {
                    pnL: 10,
                    exposureInAccountCurrency: 400,
                  },
                },
                {
                  instrumentID: 1002,
                  symbol: 'BBB',
                  amount: 150,
                  unrealizedPnL: {
                    pnL: -5,
                    exposureInAccountCurrency: 500,
                  },
                },
              ],
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

    const lookthrough = (
      normalized.rawJson.valuation as {
        smartPortfolioLookthrough: Array<Record<string, unknown>>
      }
    ).smartPortfolioLookthrough

    expect(normalized.holdings).toHaveLength(1)
    expect(normalized.totalAccountValue).toBe(500)
    expect(calculateCurrentUnitPrice(normalized.totalAccountValue, 100, 1)).toBe(5)
    expect(calculateCurrentUnitPrice(900, 100, 1)).toBe(9)
    expect(normalized.holdings[0]).toMatchObject({
      symbol: 'QuantumComputing',
      market_value: 500,
      notional_exposure: 900,
      allocation_pct: 1,
    })
    expect(normalized.holdings[0]?.market_value).not.toBe(900)
    expect(lookthrough).toHaveLength(2)
    expect(lookthrough).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: 'AAA',
          actualValueUsd: 110,
          notionalExposureUsd: 400,
          affectsNav: false,
          synthetic: true,
        }),
        expect.objectContaining({
          symbol: 'BBB',
          actualValueUsd: 145,
          notionalExposureUsd: 500,
          affectsNav: false,
          synthetic: true,
        }),
      ])
    )
    expect(normalized.rawJson.valuation).toMatchObject({
      mirrorActualValueUsd: 500,
      mirrorNotionalExposureUsd: 900,
      mirrorNestedActualValueUsd: 255,
      smartPortfolioActualValueUsd: 500,
      smartPortfolioValueSource: 'explicit_currentValue',
      smartPortfolioNestedActualValueUsd: 255,
      smartPortfolioNestedNotionalExposureUsd: 900,
      reconstructedTotalUsd: 500,
    })
  })

  it('falls back to nested Smart Portfolio actual values, not nested notional exposure', () => {
    const normalized = normalizeEtoroData({
      pnl: {
        clientPortfolio: {
          mirrors: [
            {
              mirrorId: 42,
              parentUsername: 'QuantumComputing',
              positions: [
                {
                  amount: 100,
                  unrealizedPnL: {
                    pnL: 10,
                    exposureInAccountCurrency: 550,
                  },
                },
              ],
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

    expect(normalized.totalAccountValue).toBe(110)
    expect(normalized.holdings[0]).toMatchObject({
      market_value: 110,
      notional_exposure: 550,
    })
    expect(normalized.holdings[0]?.market_value).not.toBe(550)
    expect(normalized.rawJson.valuation).toMatchObject({
      mirrorActualValueUsd: 110,
      mirrorNotionalExposureUsd: 550,
      mirrorNestedActualValueUsd: 110,
      reconstructedTotalUsd: 110,
    })
  })

  it('uses broker total residual for an unresolved Smart Portfolio when it is safe', () => {
    const normalized = normalizeEtoroData({
      pnl: {
        clientPortfolio: {
          totalAccountValue: 750,
          credit: 50,
          positions: [
            {
              instrumentID: 1001,
              symbol: 'DIRECT',
              amount: 200,
              unrealizedPnL: {
                pnL: 0,
                exposureInAccountCurrency: 1000,
              },
            },
          ],
          mirrors: [
            {
              mirrorId: 42,
              parentUsername: 'QuantumComputing',
              positions: [
                {
                  instrumentID: 1002,
                  symbol: 'INNER',
                  unrealizedPnL: {
                    exposureInAccountCurrency: 900,
                  },
                },
              ],
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

    expect(normalized.totalAccountValue).toBe(750)
    expect(normalized.holdings).toHaveLength(2)
    expect(normalized.holdings.find((holding) => holding.symbol === 'DIRECT')).toMatchObject({
      market_value: 200,
    })
    expect(
      normalized.holdings.find((holding) => holding.symbol === 'QuantumComputing')
    ).toMatchObject({
      market_value: 500,
      notional_exposure: 900,
      allocation_pct: 0.666667,
    })
    expect(normalized.rawJson.valuation).toMatchObject({
      creditUsd: 50,
      directActualValueUsd: 200,
      smartPortfolioActualValueUsd: 500,
      smartPortfolioValueSource: 'broker_total_residual',
      smartPortfolioResidualValueUsd: 500,
      smartPortfolioNestedActualValueUsd: 0,
      smartPortfolioNestedNotionalExposureUsd: 900,
      reconstructedTotalUsd: 750,
      finalTotalAccountValue: 750,
    })
  })

  it('does not treat top-level mirror-linked positions as direct accounting holdings', () => {
    const normalized = normalizeEtoroData({
      pnl: {
        clientPortfolio: {
          positions: [
            {
              instrumentID: 1001,
              symbol: 'DIRECT',
              amount: 200,
              unrealizedPnL: {
                pnL: 0,
                exposureInAccountCurrency: 1000,
              },
            },
            {
              instrumentID: 1002,
              symbol: 'INNER',
              mirrorID: 42,
              amount: 100,
              unrealizedPnL: {
                pnL: 0,
                exposureInAccountCurrency: 500,
              },
            },
          ],
          mirrors: [
            {
              mirrorId: 42,
              parentUsername: 'QuantumComputing',
              currentValue: 300,
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

    expect(normalized.holdings.map((holding) => holding.symbol)).toEqual([
      'DIRECT',
      'QuantumComputing',
    ])
    expect(normalized.holdings.find((holding) => holding.symbol === 'INNER')).toBeUndefined()
    expect(normalized.totalAccountValue).toBe(500)
    expect(normalized.rawJson.valuation).toMatchObject({
      directActualValueUsd: 200,
      directNotionalExposureUsd: 1000,
      smartPortfolioActualValueUsd: 300,
      smartPortfolioNestedActualValueUsd: 100,
      smartPortfolioNestedNotionalExposureUsd: 500,
      directPositionCount: 1,
      mirrorLinkedTopLevelPositionCount: 1,
    })
    expect(
      (
        normalized.rawJson.valuation as {
          smartPortfolioLookthrough: Array<Record<string, unknown>>
        }
      ).smartPortfolioLookthrough
    ).toEqual([
      expect.objectContaining({
        symbol: 'INNER',
        actualValueUsd: 100,
        notionalExposureUsd: 500,
        affectsNav: false,
        synthetic: true,
      }),
    ])
  })

  it('uses actual reconstructed account value for unit price regression', () => {
    const normalized = normalizeEtoroData({
      pnl: {
        clientPortfolio: {
          credit: 50,
          positions: [
            {
              instrumentID: 1001,
              amount: 100,
              unrealizedPnL: {
                pnL: 0,
                exposureInAccountCurrency: 500,
              },
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

    expect(calculateCurrentUnitPrice(normalized.totalAccountValue, 100, 1)).toBe(1.5)
    expect(calculateCurrentUnitPrice(normalized.totalAccountValue, 100, 1)).not.toBe(5.5)
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
      reconstructedHoldingsValue: 1160,
      smartPortfolioActualValueUsd: 950,
      smartPortfolioValueSource: 'broker_total_residual',
      smartPortfolioResidualValueUsd: 950,
      reconstructedTotalAccountValue: 1200,
      finalValuationSource: 'broker_reported',
      mirrorCount: 1,
      positionCount: 1,
    })
    expect(normalized.holdings.map((holding) => holding.market_value)).toEqual([400, 760])
  })

  it('keeps nested mirror notional exposure out of Smart Portfolio actual value', () => {
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
              currentValue: 500,
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
      instrument_name: 'Mirror: QuantumComputing',
      market_value: 375,
      notional_exposure: 377.0925,
    })
    expect(quantumHolding?.market_value).not.toBe(377.0925)
    expect(normalized.totalAccountValue).toBe(499.62)
    expect(calculateCurrentUnitPrice(normalized.totalAccountValue, 250, 1)).toBe(1.99848)
    expect(normalized.rawJson.debugVersion).toBe(ETORO_NORMALIZER_VERSION)
    expect(normalized.rawJson.valuation).toMatchObject({
      debugVersion: ETORO_NORMALIZER_VERSION,
      creditUsd: 67.6,
      directActualValueUsd: 98.56,
      directNotionalExposureUsd: 98.56,
      directPositionsUsd: 98.56,
      mirrorActualValueUsd: 500,
      mirrorNotionalExposureUsd: 502.79,
      mirrorValuesUsd: 500,
      mirrorNestedActualValueUsd: 0,
      reconstructedTotalUsd: 666.16,
      reconstructedTotalGbp: 499.62,
      finalTotalAccountValue: 499.62,
      finalValuationSource: 'reconstructed_from_positions_and_mirrors',
      mirrorCount: 1,
      positionCount: 2,
      directPositionCount: 2,
      nestedMirrorPositionCount: 4,
    })
  })
})
