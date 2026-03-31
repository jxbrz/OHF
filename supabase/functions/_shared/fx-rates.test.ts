import { calculateEcbCrossRate, parseEcbReferenceRates } from './fx-rates'

describe('ECB FX helpers', () => {
  it('parses the ECB daily XML payload', () => {
    const xml = `
      <gesmes:Envelope>
        <Cube>
          <Cube time="2026-03-30">
            <Cube currency="USD" rate="1.1484" />
            <Cube currency="GBP" rate="0.86803" />
          </Cube>
        </Cube>
      </gesmes:Envelope>
    `

    const parsed = parseEcbReferenceRates(xml)

    expect(parsed.referenceDate).toBe('2026-03-30')
    expect(parsed.rates.USD).toBe(1.1484)
    expect(parsed.rates.GBP).toBe(0.86803)
    expect(parsed.rates.EUR).toBe(1)
  })

  it('calculates USD to GBP cross rates from the ECB table', () => {
    const rate = calculateEcbCrossRate(
      {
        EUR: 1,
        USD: 1.1484,
        GBP: 0.86803,
      },
      'USD',
      'GBP'
    )

    expect(rate).toBeCloseTo(0.7556879136, 10)
  })
})
