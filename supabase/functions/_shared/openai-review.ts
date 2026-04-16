import type { DailyReviewContext } from './daily-review-context.ts'

const openAiApiKey = Deno.env.get('OPENAI_API_KEY')
const openAiModel = Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.4-mini'

export interface GeneratedDailyReview {
  title: string
  summary: string
  body: string
  dailyNarrative: string
  outlookNarrative: string
  model: string
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatSignedCurrency(value: number) {
  const formatted = formatCurrency(Math.abs(value))
  if (value === 0) {
    return formatted
  }

  return `${value > 0 ? '+' : '-'}${formatted}`
}

function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
}

function formatMoveDirection(value: number) {
  if (value > 0) {
    return 'up'
  }

  if (value < 0) {
    return 'down'
  }

  return 'flat'
}

function buildFallbackDailyNarrative(context: DailyReviewContext) {
  const topMove = context.topHoldingMoves[0]
  const topMoveLabel = topMove?.instrumentName?.trim() || topMove?.symbol || null
  const topMoveSentence = topMoveLabel
    ? `${topMoveLabel} was the main mover, ending ${formatMoveDirection(topMove.changeAmount)} ${formatCurrency(Math.abs(topMove.changeAmount))} at ${formatCurrency(topMove.closeMarketValue)}.`
    : `The book finished with ${context.holdingsCountClose} active positions.`

  const positioningSentence =
    context.openedPositions.length > 0
      ? `A new position was opened in ${context.openedPositions.join(', ')}, taking the fund into the close with ${context.holdingsCountClose} active holdings.`
      : context.closedPositions.length > 0
        ? `The fund fully exited ${context.closedPositions.join(', ')}, leaving ${context.holdingsCountClose} active holdings into the close.`
        : `The fund closed with ${context.holdingsCountClose} active holdings and cash at ${formatCurrency(context.availableCashClose ?? 0)}.`

  return [
    `The fund closed at ${formatCurrency(context.totalAccountValueClose)}, ${context.totalAccountValueChange >= 0 ? 'up' : 'down'} ${formatCurrency(Math.abs(context.totalAccountValueChange))} on the day, while unit price moved ${formatMoveDirection(context.unitPriceChange)} ${formatCurrency(Math.abs(context.unitPriceChange))} to ${formatCurrency(context.unitPriceClose)}.`,
    topMoveSentence,
    positioningSentence,
  ].join(' ')
}

function buildFallbackOutlookNarrative(context: DailyReviewContext) {
  const leaders = context.topAllocationsClose
    .slice(0, 2)
    .map((holding) => holding.instrumentName?.trim() || holding.symbol)
  const leaderSentence =
    leaders.length > 0
      ? `${leaders.join(leaders.length === 2 ? ' and ' : ', ')} remain the largest weights, so they are likely to drive most of the near-term movement.`
      : `The existing book is still the main thing to watch over the next couple of days.`

  const positioningSentence =
    context.openedPositions.length > 0 || context.closedPositions.length > 0
      ? `Recent position changes mean it is worth watching whether the new shape of the book settles or drifts further in the next few sessions.`
      : `With no fresh position turnover on the day, the next few sessions should mostly be about follow-through in the current holdings.`

  const cashSentence =
    (context.availableCashClose ?? 0) <= 1
      ? `Cash is still very tight, so any move in fund value is likely to come from mark-to-market changes rather than new deployment.`
      : `The cash balance of ${formatCurrency(context.availableCashClose ?? 0)} leaves some room for adjustment if the setup changes.`

  return [leaderSentence, positioningSentence, cashSentence].join(' ')
}

function buildFallbackTitle(context: DailyReviewContext) {
  if (Math.abs(context.totalAccountValueChange) < 0.01) {
    return 'Steady Session'
  }

  return context.totalAccountValueChange > 0 ? 'Fund Closed Higher' : 'Fund Closed Lower'
}

export function buildFallbackDailyReview(
  context: DailyReviewContext,
  reason?: string
): GeneratedDailyReview {
  const dailyNarrative = buildFallbackDailyNarrative(context)
  const outlookNarrative = buildFallbackOutlookNarrative(context)

  const summary = `Fund closed at ${formatCurrency(context.totalAccountValueClose)}, ${context.totalAccountValueChange >= 0 ? 'up' : 'down'} ${formatCurrency(Math.abs(context.totalAccountValueChange))} (${formatPercent(context.totalAccountValueChangePct)}) with unit price ${formatSignedCurrency(context.unitPriceChange)} to ${formatCurrency(context.unitPriceClose)}.`

  return {
    title: buildFallbackTitle(context),
    summary,
    dailyNarrative,
    outlookNarrative,
    body: [
      dailyNarrative,
      '',
      'Looking ahead:',
      outlookNarrative,
    ].join('\n'),
    model: reason ? `fallback-summary (${reason})` : 'fallback-summary',
  }
}

function extractOutputText(responseBody: Record<string, unknown>) {
  if (typeof responseBody.output_text === 'string' && responseBody.output_text.trim() !== '') {
    return responseBody.output_text
  }

  const output = Array.isArray(responseBody.output) ? responseBody.output : []
  const parts: string[] = []

  for (const item of output) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? (item as { content: unknown[] }).content
      : []

    for (const contentItem of content) {
      if (
        contentItem &&
        typeof contentItem === 'object' &&
        (contentItem as { type?: string }).type === 'output_text' &&
        typeof (contentItem as { text?: string }).text === 'string'
      ) {
        parts.push((contentItem as { text: string }).text)
      }
    }
  }

  return parts.join('\n').trim()
}

export async function generateOpenAiDailyReview(
  context: DailyReviewContext
): Promise<GeneratedDailyReview> {
  if (!openAiApiKey) {
    throw new Error('OPENAI_API_KEY is not configured for daily review generation.')
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: openAiModel,
      temperature: 0.3,
      max_output_tokens: 500,
      instructions:
        "You write concise internal daily fund reviews for Orchard Hedge Fund. Use British English. Be calm, factual, and natural. Avoid hype, emojis, disclaimers, price targets, marketing language, and obvious AI phrasing. Write like a sensible human note to the group. Use full sentences and short paragraphs, not clipped bullet fragments unless absolutely necessary. Mention numbers exactly when given. Keep the title under 8 words, the summary to one sentence, the daily narrative to one short paragraph, and the outlook narrative to one short paragraph focused on the next couple of days based only on the supplied positions and changes.",
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text:
                'Turn this structured market-day data into a short internal daily review. Focus on portfolio move, unit-price move, and the most meaningful holdings changes.\n\n' +
                JSON.stringify(context, null, 2),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'daily_review_post',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              summary: { type: 'string' },
              dailyNarrative: { type: 'string' },
              outlookNarrative: { type: 'string' },
            },
            required: ['title', 'summary', 'dailyNarrative', 'outlookNarrative'],
          },
        },
      },
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OpenAI review generation failed: ${response.status} ${errorBody}`)
  }

  const responseBody = (await response.json()) as Record<string, unknown>
  const outputText = extractOutputText(responseBody)

  if (!outputText) {
    throw new Error('OpenAI review generation returned no text output.')
  }

  let parsed: {
    title?: string
    summary?: string
    dailyNarrative?: string
    outlookNarrative?: string
  }

  try {
    parsed = JSON.parse(outputText) as {
      title?: string
      summary?: string
      dailyNarrative?: string
      outlookNarrative?: string
    }
  } catch (error) {
    throw new Error(
      `Unable to parse OpenAI review JSON: ${error instanceof Error ? error.message : 'Unknown parse error'}`
    )
  }

  if (
    typeof parsed.title !== 'string' ||
    typeof parsed.summary !== 'string' ||
    typeof parsed.dailyNarrative !== 'string' ||
    typeof parsed.outlookNarrative !== 'string'
  ) {
    throw new Error('OpenAI review generation returned an invalid review payload.')
  }

  return {
    title: parsed.title.trim(),
    summary: parsed.summary.trim(),
    dailyNarrative: parsed.dailyNarrative.trim(),
    outlookNarrative: parsed.outlookNarrative.trim(),
    body: [
      parsed.dailyNarrative.trim(),
      '',
      'Looking ahead:',
      parsed.outlookNarrative.trim(),
    ].join('\n'),
    model: openAiModel,
  }
}
