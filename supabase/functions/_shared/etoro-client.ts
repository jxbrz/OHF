import { getMockEtoroResponses } from './mock-data.ts'

interface EtoroIdentityResponse {
  gcid?: number
  realCid?: number
  demoCid?: number
  [key: string]: unknown
}

interface EtoroInstrumentLookupItem {
  internalInstrumentId?: number
  internalSymbolFull?: string
  internalInstrumentDisplayName?: string
  logo35x35?: string
  logo50x50?: string
  logo150x150?: string
  [key: string]: unknown
}

interface EtoroResponseBundle {
  usedMock: boolean
  identity: EtoroIdentityResponse
  pnl: Record<string, unknown>
  instrumentMetadata: EtoroInstrumentLookupItem[]
}

function shouldUseMock(configuredMock: boolean): boolean {
  const envPrefersMock = Deno.env.get('ETORO_USE_MOCK')?.toLowerCase() === 'true'
  const apiKey = Deno.env.get('ETORO_API_KEY')
  const userKey = Deno.env.get('ETORO_USER_KEY')
  const baseUrl = Deno.env.get('ETORO_BASE_URL')

  return envPrefersMock || configuredMock || !apiKey || !userKey || !baseUrl
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl
    .replace(/\/+$/, '')
    .replace(/\/api\/v1$/i, '')
}

function sanitizeErrorText(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 250)
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(
  url: string,
  headers: HeadersInit,
  attempts = 4
): Promise<Record<string, unknown>> {
  let delayMs = 600

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url, { headers })

    if (response.ok) {
      return await response.json()
    }

    if (response.status === 429 && attempt < attempts) {
      const retryAfterHeader = response.headers.get('retry-after')
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN
      await sleep(Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : delayMs)
      delayMs *= 2
      continue
    }

    const safeBody = sanitizeErrorText(await response.text())
    throw new Error(`eToro request failed (${response.status}): ${safeBody}`)
  }

  throw new Error(`eToro request failed after ${attempts} attempts.`)
}

function collectInstrumentIds(payload: Record<string, unknown>) {
  const clientPortfolio =
    payload.clientPortfolio &&
    typeof payload.clientPortfolio === 'object' &&
    !Array.isArray(payload.clientPortfolio)
      ? payload.clientPortfolio as { positions?: Array<Record<string, unknown>> }
      : null
  const positions = Array.isArray(clientPortfolio?.positions) ? clientPortfolio.positions : []

  return [...new Set(
    positions
      .map((position) => {
        const rawId = position.instrumentId ?? position.instrumentID
        const instrumentId =
          typeof rawId === 'number'
            ? rawId
            : typeof rawId === 'string' && rawId.trim() !== ''
              ? Number(rawId)
              : NaN

        return Number.isFinite(instrumentId) && instrumentId > 0 ? instrumentId : null
      })
      .filter((instrumentId): instrumentId is number => instrumentId !== null)
  )]
}

async function fetchInstrumentMetadata(
  baseUrl: string,
  createHeaders: () => HeadersInit,
  instrumentIds: number[]
) {
  if (instrumentIds.length === 0) {
    return [] as EtoroInstrumentLookupItem[]
  }

  const chunkSize = 25
  const metadata: EtoroInstrumentLookupItem[] = []

  for (let start = 0; start < instrumentIds.length; start += chunkSize) {
    const chunk = instrumentIds.slice(start, start + chunkSize)
    const query = chunk.join(',')
    const response = await fetchWithRetry(
      `${baseUrl}/api/v1/market-data/search?instrumentIds=${query}`,
      createHeaders()
    )
    const items = Array.isArray(response.items) ? response.items : []

    metadata.push(
      ...items.filter(
        (item): item is EtoroInstrumentLookupItem =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    )
  }

  return metadata
}

export async function fetchEtoroData(configuredMock: boolean): Promise<EtoroResponseBundle> {
  if (shouldUseMock(configuredMock)) {
    const mockResponses = getMockEtoroResponses()

    return {
      usedMock: true,
      identity: mockResponses.identity,
      pnl: mockResponses.pnl,
      instrumentMetadata: [],
    }
  }

  const baseUrl = normalizeBaseUrl(Deno.env.get('ETORO_BASE_URL')!)
  const apiKey = Deno.env.get('ETORO_API_KEY')!
  const userKey = Deno.env.get('ETORO_USER_KEY')!

  const createHeaders = () => ({
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'x-user-key': userKey,
    'x-request-id': crypto.randomUUID(),
  })

  const [identity, pnl] = await Promise.all([
    fetchWithRetry(`${baseUrl}/api/v1/me`, createHeaders()),
    fetchWithRetry(`${baseUrl}/api/v1/trading/info/real/pnl`, createHeaders()),
  ])
  const instrumentIds = collectInstrumentIds(pnl)
  const instrumentMetadata = await fetchInstrumentMetadata(baseUrl, createHeaders, instrumentIds)

  return {
    usedMock: false,
    identity: identity as EtoroIdentityResponse,
    pnl,
    instrumentMetadata,
  }
}
