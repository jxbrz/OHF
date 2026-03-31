import { getMockEtoroResponses } from './mock-data.ts'

interface EtoroIdentityResponse {
  gcid?: number
  realCid?: number
  demoCid?: number
  [key: string]: unknown
}

interface EtoroResponseBundle {
  usedMock: boolean
  identity: EtoroIdentityResponse
  pnl: Record<string, unknown>
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

export async function fetchEtoroData(configuredMock: boolean): Promise<EtoroResponseBundle> {
  if (shouldUseMock(configuredMock)) {
    const mockResponses = getMockEtoroResponses()

    return {
      usedMock: true,
      identity: mockResponses.identity,
      pnl: mockResponses.pnl,
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

  return {
    usedMock: false,
    identity: identity as EtoroIdentityResponse,
    pnl,
  }
}
