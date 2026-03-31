export function getMockEtoroResponses() {
  return {
    identity: {
      gcid: 123456,
      realCid: 789012,
      demoCid: 345678,
    },
    portfolio: {
      clientPortfolio: {
        credit: 184.5,
        bonusCredit: 0,
        positions: [
          {
            positionID: 90001,
            instrumentID: 1001,
            openRate: 182.42,
            closeRate: 191.11,
            amount: 175,
            units: 0.9604,
            initialAmountInDollars: 175,
            pnL: 8.35,
          },
          {
            positionID: 90002,
            instrumentID: 2002,
            openRate: 494.6,
            closeRate: 478.2,
            amount: 150,
            units: 0.3032,
            initialAmountInDollars: 150,
            pnL: -4.98,
          },
        ],
        mirrors: [],
      },
    },
    pnl: {
      clientPortfolio: {
        credit: 184.5,
        bonusCredit: 0,
        unrealizedPnL: 3.37,
        positions: [
          {
            positionId: 90001,
            instrumentId: 1001,
            openRate: 182.42,
            closeRate: 191.11,
            amount: 175,
            units: 0.9604,
            initialAmountInDollars: 175,
            pnL: 8.35,
          },
          {
            positionId: 90002,
            instrumentId: 2002,
            openRate: 494.6,
            closeRate: 478.2,
            amount: 150,
            units: 0.3032,
            initialAmountInDollars: 150,
            pnL: -4.98,
          },
        ],
        mirrors: [],
      },
    },
  }
}
