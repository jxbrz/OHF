import { createClient } from 'npm:@supabase/supabase-js@2'
import { calculateCurrentUnitPrice, calculateTotalUnitsOutstanding } from '../../../shared/calculations/index.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { fetchEtoroData } from '../_shared/etoro-client.ts'
import { resolveFxConversion } from '../_shared/fx-rates.ts'
import { normalizeEtoroData } from '../_shared/normalizers.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const syncCronSecret = Deno.env.get('SYNC_CRON_SECRET')

interface SyncRequestBody {
  trigger?: string
  market?: string
  scheduleKey?: string
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function unwrapSettingValue(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
    return (value as { value?: unknown }).value
  }

  return value
}

function readSettingNumber(
  settingsMap: Map<string, unknown>,
  key: string
): number | null {
  const value = unwrapSettingValue(settingsMap.get(key))

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function readSettingString(
  settingsMap: Map<string, unknown>,
  key: string,
  fallback: string,
  options?: { uppercase?: boolean }
) {
  const value = unwrapSettingValue(settingsMap.get(key))

  if (typeof value === 'string' && value.trim() !== '') {
    return options?.uppercase === false ? value.trim() : value.trim().toUpperCase()
  }

  return fallback
}

function readSettingBoolean(
  settingsMap: Map<string, unknown>,
  key: string,
  fallback: boolean
) {
  const value = unwrapSettingValue(settingsMap.get(key))

  if (typeof value === 'boolean') {
    return value
  }

  return fallback
}

function getDateInTimeZone(timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(new Date())
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) {
    throw new Error(`Unable to resolve the current date for timezone ${timeZone}.`)
  }

  return `${year}-${month}-${day}`
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Supabase function environment is not configured.' }, 500)
  }

  let requestBody: SyncRequestBody = {}
  try {
    requestBody = (await request.clone().json()) as SyncRequestBody
  } catch {
    requestBody = {}
  }

  const cronHeaderSecret = request.headers.get('x-sync-cron-secret')
  const isScheduledRequest =
    Boolean(syncCronSecret) &&
    Boolean(cronHeaderSecret) &&
    cronHeaderSecret === syncCronSecret

  const authorization = request.headers.get('Authorization')
  if (!authorization && !isScheduledRequest) {
    return jsonResponse({ error: 'Missing authorization header.' }, 401)
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  let actorProfileId: string | null = null
  const auditAction = isScheduledRequest ? 'sync_etoro_portfolio_scheduled' : 'sync_etoro_portfolio'

  if (!isScheduledRequest) {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authorization!,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return jsonResponse({ error: 'Unable to validate the user session.' }, 401)
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return jsonResponse({ error: 'Unable to load the user profile.' }, 403)
    }

    if (profile.role !== 'admin') {
      return jsonResponse({ error: 'Admin access is required.' }, 403)
    }

    actorProfileId = profile.id
  }

  let auditPayload: Record<string, unknown> = {
    actorProfileId,
    executedAt: new Date().toISOString(),
    trigger: requestBody.trigger ?? (isScheduledRequest ? 'scheduled_market_close' : 'manual'),
    scheduleKey: requestBody.scheduleKey ?? null,
  }

  try {
    const [{ data: transactions, error: transactionsError }, { data: settings, error: settingsError }] =
      await Promise.all([
        adminClient
          .from('fund_transactions')
          .select('member_id, type, date, amount, unit_price_at_time, units_amount'),
        adminClient.from('app_settings').select('key, value'),
      ])

    if (transactionsError) {
      throw transactionsError
    }

    if (settingsError) {
      throw settingsError
    }

    const settingsMap = new Map(settings.map((setting) => [setting.key, setting.value]))
    const startingUnitPrice = readSettingNumber(settingsMap, 'starting_unit_price') ?? 1
    const configuredMock = readSettingBoolean(settingsMap, 'etoro_use_mock', false)
    const brokerCurrency = readSettingString(settingsMap, 'broker_account_currency', 'USD')
    const fundCurrency = readSettingString(settingsMap, 'fund_base_currency', 'GBP')
    const manualBrokerToFundRate = readSettingNumber(settingsMap, 'broker_to_fund_fx_rate')
    const autoMarketCloseSyncEnabled = readSettingBoolean(settingsMap, 'auto_market_close_sync_enabled', true)
    const marketCloseTimezone = readSettingString(
      settingsMap,
      'market_close_sync_timezone',
      'America/New_York',
      { uppercase: false }
    )
    const marketCloseLabel = readSettingString(settingsMap, 'market_close_sync_market', 'US')
    const currentMarketDate = getDateInTimeZone(marketCloseTimezone)
    const lastScheduledMarketDate = readSettingString(
      settingsMap,
      'last_market_close_sync_date',
      ''
    )

    if (isScheduledRequest && !autoMarketCloseSyncEnabled) {
      return jsonResponse({
        success: true,
        skipped: true,
        reason: 'Auto market-close sync is disabled.',
      })
    }

    if (isScheduledRequest && lastScheduledMarketDate === currentMarketDate) {
      return jsonResponse({
        success: true,
        skipped: true,
        reason: `Market-close sync already captured for ${currentMarketDate}.`,
        marketDate: currentMarketDate,
      })
    }

    const etoroBundle = await fetchEtoroData(configuredMock)
    const fxConversion = await resolveFxConversion({
      brokerCurrency,
      fundCurrency,
      manualRate: manualBrokerToFundRate,
    })
    const normalized = normalizeEtoroData({
      pnl: etoroBundle.pnl as { clientPortfolio?: Record<string, unknown> },
      identity: etoroBundle.identity as Record<string, unknown>,
      fxContext: fxConversion,
    })
    const totalUnits = calculateTotalUnitsOutstanding(transactions)
    const unitPrice = calculateCurrentUnitPrice(
      normalized.totalAccountValue,
      totalUnits,
      startingUnitPrice
    )

    auditPayload = {
      ...auditPayload,
      usedMock: etoroBundle.usedMock,
      identity: etoroBundle.identity,
      totalUnits,
      totalAccountValue: normalized.totalAccountValue,
      fx: fxConversion,
      scheduled: isScheduledRequest,
      marketDate: currentMarketDate,
      marketCloseTimezone,
    }

    const rawJson = {
      ...normalized.rawJson,
      scheduler: isScheduledRequest
        ? {
            market: requestBody.market ?? marketCloseLabel,
            marketDate: currentMarketDate,
            timezone: marketCloseTimezone,
            scheduleKey: requestBody.scheduleKey ?? null,
            trigger: requestBody.trigger ?? 'scheduled_market_close',
          }
        : null,
    }

    const { data: snapshot, error: snapshotError } = await adminClient
      .from('portfolio_snapshots')
      .insert({
        total_account_value: normalized.totalAccountValue,
        available_cash: normalized.availableCash,
        unrealized_pnl: normalized.unrealizedPnl,
        realized_pnl: normalized.realizedPnl,
        total_units: totalUnits,
        unit_price: unitPrice,
        raw_json: rawJson,
      })
      .select('id, captured_at')
      .single()

    if (snapshotError || !snapshot) {
      throw snapshotError ?? new Error('Snapshot insert failed.')
    }

    if (normalized.holdings.length > 0) {
      const holdingRows = normalized.holdings.map((holding) => ({
        portfolio_snapshot_id: snapshot.id,
        symbol: holding.symbol,
        instrument_name: holding.instrument_name,
        quantity: holding.quantity,
        average_open: holding.average_open,
        current_price: holding.current_price,
        market_value: holding.market_value,
        pnl: holding.pnl,
        allocation_pct: holding.allocation_pct,
      }))

      const { error: holdingsError } = await adminClient.from('holding_snapshots').insert(holdingRows)

      if (holdingsError) {
        throw holdingsError
      }
    }

    if (isScheduledRequest) {
      await adminClient.from('app_settings').upsert([
        {
          key: 'last_market_close_sync_date',
          value: { value: currentMarketDate },
        },
        {
          key: 'last_market_close_sync_snapshot_id',
          value: { value: snapshot.id },
        },
      ])
    }

    await adminClient.from('audit_logs').insert({
      actor_profile_id: actorProfileId,
      action: auditAction,
      entity_type: 'portfolio_snapshot',
      entity_id: snapshot.id,
      payload: {
        ...auditPayload,
        snapshotId: snapshot.id,
        holdingsCount: normalized.holdings.length,
      },
    })

    return jsonResponse({
      success: true,
      snapshotId: snapshot.id,
      capturedAt: snapshot.captured_at,
      holdingsCount: normalized.holdings.length,
      usedMock: etoroBundle.usedMock,
      scheduled: isScheduledRequest,
      marketDate: isScheduledRequest ? currentMarketDate : null,
      brokerCurrency: fxConversion.brokerCurrency,
      fundCurrency: fxConversion.fundCurrency,
      fxRate: fxConversion.rate,
      fxSource: fxConversion.source,
      fxReferenceDate: fxConversion.referenceDate,
    })
  } catch (error) {
    await adminClient.from('audit_logs').insert({
      actor_profile_id: actorProfileId,
      action: `${auditAction}_failed`,
      entity_type: 'portfolio_snapshot',
      payload: {
        ...auditPayload,
        error: error instanceof Error ? error.message : 'Unknown sync error',
      },
    })

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unknown sync error',
      },
      500
    )
  }
})
