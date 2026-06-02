type NumericValue = number | string | null | undefined

export interface PreviousSnapshotForValuationGuard {
  id?: string | null
  captured_at?: string | null
  total_account_value: NumericValue
}

export interface ValuationJumpDecision {
  shouldReject: boolean
  previousTotalAccountValue: number | null
  newTotalAccountValue: number
  changePct: number | null
  thresholdPct: number
  previousSnapshotId: string | null
  previousSnapshotCapturedAt: string | null
  forced: boolean
}

function toNumber(value: NumericValue, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

function round(value: number, decimals = 6): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function normalizeValuationJumpThresholdPct(value: NumericValue, fallbackPct = 35): number {
  const parsed = toNumber(value, fallbackPct)

  if (parsed <= 0) {
    return fallbackPct
  }

  return parsed <= 1 ? round(parsed * 100, 6) : round(parsed, 6)
}

export function evaluateValuationJump(args: {
  previousSnapshot?: PreviousSnapshotForValuationGuard | null
  newTotalAccountValue: NumericValue
  thresholdPct?: NumericValue
  trigger?: string | null
}): ValuationJumpDecision {
  const previousTotalAccountValue =
    args.previousSnapshot ? toNumber(args.previousSnapshot.total_account_value) : null
  const newTotalAccountValue = round(toNumber(args.newTotalAccountValue), 6)
  const thresholdPct = normalizeValuationJumpThresholdPct(args.thresholdPct)
  const forced = args.trigger === 'manual_force'

  if (
    forced ||
    previousTotalAccountValue === null ||
    previousTotalAccountValue <= 0
  ) {
    return {
      shouldReject: false,
      previousTotalAccountValue,
      newTotalAccountValue,
      changePct: null,
      thresholdPct,
      previousSnapshotId: args.previousSnapshot?.id ?? null,
      previousSnapshotCapturedAt: args.previousSnapshot?.captured_at ?? null,
      forced,
    }
  }

  const changePct = round(
    Math.abs(newTotalAccountValue - previousTotalAccountValue) / previousTotalAccountValue * 100,
    6
  )

  return {
    shouldReject: changePct > thresholdPct,
    previousTotalAccountValue: round(previousTotalAccountValue, 6),
    newTotalAccountValue,
    changePct,
    thresholdPct,
    previousSnapshotId: args.previousSnapshot?.id ?? null,
    previousSnapshotCapturedAt: args.previousSnapshot?.captured_at ?? null,
    forced,
  }
}
