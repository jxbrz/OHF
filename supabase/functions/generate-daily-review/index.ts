import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildDailyReviewContext } from '../_shared/daily-review-context.ts'
import { corsHeaders } from '../_shared/cors.ts'
import {
  buildFallbackDailyReview,
  generateOpenAiDailyReview,
  type GeneratedDailyReview,
} from '../_shared/openai-review.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const syncCronSecret = Deno.env.get('SYNC_CRON_SECRET')

interface GenerateDailyReviewRequestBody {
  reviewDate?: string
  trigger?: string
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

function isValidReviewDate(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
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

  let requestBody: GenerateDailyReviewRequestBody = {}
  try {
    requestBody = (await request.json()) as GenerateDailyReviewRequestBody
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

  if (requestBody.reviewDate && !isValidReviewDate(requestBody.reviewDate)) {
    return jsonResponse({ error: 'reviewDate must be in YYYY-MM-DD format.' }, 400)
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  let actorProfileId: string | null = null

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

    if (profileError || !profile || profile.role !== 'admin') {
      return jsonResponse({ error: 'Admin access is required.' }, 403)
    }

    actorProfileId = profile.id
  }

  const auditAction = isScheduledRequest ? 'generate_daily_review_scheduled' : 'generate_daily_review'

  try {
    const { data: allSnapshots, error: snapshotsError } = await adminClient
      .from('portfolio_snapshots')
      .select('*')
      .order('captured_at', { ascending: true })
      .limit(400)

    if (snapshotsError) {
      throw snapshotsError
    }

    if (!allSnapshots || allSnapshots.length === 0) {
      return jsonResponse({ error: 'No snapshots are available to review yet.' }, 400)
    }

    const derivedReviewDate =
      requestBody.reviewDate ?? allSnapshots.at(-1)?.captured_at.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
    const nextReviewDate = addDays(derivedReviewDate, 1)
    const snapshotsOnDate = allSnapshots.filter(
      (snapshot) =>
        snapshot.captured_at >= `${derivedReviewDate}T00:00:00.000Z` &&
        snapshot.captured_at < `${nextReviewDate}T00:00:00.000Z`
    )

    if (snapshotsOnDate.length === 0) {
      return jsonResponse(
        { error: `No snapshots were captured for ${derivedReviewDate}.` },
        400
      )
    }

    const firstSnapshotOfDate = snapshotsOnDate[0]
    const comparisonSnapshot =
      allSnapshots.filter((snapshot) => snapshot.captured_at < firstSnapshotOfDate.captured_at).at(-1) ??
      firstSnapshotOfDate
    const closingSnapshot = snapshotsOnDate.at(-1) ?? firstSnapshotOfDate

    const [openingHoldingsResponse, closingHoldingsResponse] = await Promise.all([
      adminClient
        .from('holding_snapshots')
        .select('symbol, instrument_name, quantity, market_value, allocation_pct')
        .eq('portfolio_snapshot_id', comparisonSnapshot.id),
      adminClient
        .from('holding_snapshots')
        .select('symbol, instrument_name, quantity, market_value, allocation_pct')
        .eq('portfolio_snapshot_id', closingSnapshot.id),
    ])

    if (openingHoldingsResponse.error) {
      throw openingHoldingsResponse.error
    }

    if (closingHoldingsResponse.error) {
      throw closingHoldingsResponse.error
    }

    const context = buildDailyReviewContext({
      reviewDate: derivedReviewDate,
      snapshots: [comparisonSnapshot, ...snapshotsOnDate],
      openingHoldings: openingHoldingsResponse.data ?? [],
      closingHoldings: closingHoldingsResponse.data ?? [],
    })

    if (!context) {
      throw new Error('Unable to build daily review context from snapshot history.')
    }

    let generatedReview: GeneratedDailyReview
    let openAiErrorMessage: string | null = null

    try {
      generatedReview = await generateOpenAiDailyReview(context)
    } catch (error) {
      openAiErrorMessage =
        error instanceof Error ? error.message : 'Unknown OpenAI generation error'
      generatedReview = buildFallbackDailyReview(context, 'openai-unavailable')
    }

    const { data: review, error: reviewError } = await adminClient
      .from('daily_reviews')
      .upsert(
        {
          review_date: derivedReviewDate,
          title: generatedReview.title,
          summary: generatedReview.summary,
          body: generatedReview.body,
          snapshot_id: closingSnapshot.id,
          created_by: actorProfileId,
          model: generatedReview.model,
          generated_at: new Date().toISOString(),
          raw_json: {
            dailyNarrative: generatedReview.dailyNarrative,
            outlookNarrative: generatedReview.outlookNarrative,
            context,
            openAiError: openAiErrorMessage,
            scheduled: isScheduledRequest,
            trigger: requestBody.trigger ?? (isScheduledRequest ? 'scheduled_daily_review' : 'manual'),
            scheduleKey: requestBody.scheduleKey ?? null,
          },
        },
        { onConflict: 'review_date' }
      )
      .select('*')
      .single()

    if (reviewError || !review) {
      throw reviewError ?? new Error('Unable to save generated daily review.')
    }

    await adminClient.from('audit_logs').insert({
      actor_profile_id: actorProfileId,
      action: auditAction,
      entity_type: 'daily_review',
      entity_id: review.id,
      payload: {
        reviewDate: derivedReviewDate,
        snapshotId: closingSnapshot.id,
        model: generatedReview.model,
        openAiError: openAiErrorMessage,
        scheduled: isScheduledRequest,
        trigger: requestBody.trigger ?? (isScheduledRequest ? 'scheduled_daily_review' : 'manual'),
        scheduleKey: requestBody.scheduleKey ?? null,
      },
    })

    return jsonResponse({
      success: true,
      review,
    })
  } catch (error) {
    await adminClient.from('audit_logs').insert({
      actor_profile_id: actorProfileId,
      action: `${auditAction}_failed`,
      entity_type: 'daily_review',
      payload: {
        reviewDate: requestBody.reviewDate ?? null,
        scheduled: isScheduledRequest,
        trigger: requestBody.trigger ?? (isScheduledRequest ? 'scheduled_daily_review' : 'manual'),
        scheduleKey: requestBody.scheduleKey ?? null,
        error: error instanceof Error ? error.message : 'Unknown daily review generation error',
      },
    })

    return jsonResponse(
      {
        error:
          error instanceof Error ? error.message : 'Unknown daily review generation error',
      },
      500
    )
  }
})
