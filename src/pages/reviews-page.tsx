import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BookText, RefreshCcw, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { deleteDailyReview, fetchDailyReviews, triggerDailyReviewGeneration } from '@/lib/api'
import { formatCurrency, formatDate, formatDateTime, formatSignedCurrency } from '@/lib/formatters'
import { useAuth } from '@/features/auth/auth-provider'
import type { DailyReviewRecord } from '@/types/app'

interface ReviewContext {
  totalAccountValueClose?: number
  totalAccountValueChange?: number
  unitPriceClose?: number
  unitPriceChange?: number
}

function extractDailyNarrative(rawJson: unknown, body: string) {
  if (
    rawJson &&
    typeof rawJson === 'object' &&
    !Array.isArray(rawJson) &&
    typeof (rawJson as { dailyNarrative?: unknown }).dailyNarrative === 'string' &&
    (rawJson as { dailyNarrative: string }).dailyNarrative.trim() !== ''
  ) {
    return (rawJson as { dailyNarrative: string }).dailyNarrative.trim()
  }

  if (
    rawJson &&
    typeof rawJson === 'object' &&
    !Array.isArray(rawJson) &&
    Array.isArray((rawJson as { bulletPoints?: unknown[] }).bulletPoints)
  ) {
    return (rawJson as { bulletPoints: unknown[] }).bulletPoints
      .filter(
      (entry): entry is string => typeof entry === 'string' && entry.trim() !== ''
      )
      .join(' ')
  }

  const marker = 'Looking ahead:'
  const trimmedBody = body.includes(marker) ? body.slice(0, body.indexOf(marker)) : body

  return trimmedBody
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
}

function extractOutlookNarrative(rawJson: unknown, body: string) {
  if (
    rawJson &&
    typeof rawJson === 'object' &&
    !Array.isArray(rawJson) &&
    typeof (rawJson as { outlookNarrative?: unknown }).outlookNarrative === 'string' &&
    (rawJson as { outlookNarrative: string }).outlookNarrative.trim() !== ''
  ) {
    return (rawJson as { outlookNarrative: string }).outlookNarrative.trim()
  }

  if (
    rawJson &&
    typeof rawJson === 'object' &&
    !Array.isArray(rawJson) &&
    Array.isArray((rawJson as { outlookPoints?: unknown[] }).outlookPoints)
  ) {
    return (rawJson as { outlookPoints: unknown[] }).outlookPoints
      .filter(
      (entry): entry is string => typeof entry === 'string' && entry.trim() !== ''
      )
      .join(' ')
  }

  const marker = 'Looking ahead:'
  const markerIndex = body.indexOf(marker)
  if (markerIndex === -1) {
    return ''
  }

  return body
    .slice(markerIndex + marker.length)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
}

function extractReviewContext(rawJson: unknown): ReviewContext | null {
  if (
    rawJson &&
    typeof rawJson === 'object' &&
    !Array.isArray(rawJson) &&
    'context' in rawJson &&
    rawJson.context &&
    typeof rawJson.context === 'object' &&
    !Array.isArray(rawJson.context)
  ) {
    return rawJson.context as ReviewContext
  }

  return null
}

function extractReviewMeta(rawJson: unknown) {
  const context = extractReviewContext(rawJson)
  const scheduled =
    Boolean(rawJson) &&
    typeof rawJson === 'object' &&
    !Array.isArray(rawJson) &&
    (rawJson as { scheduled?: unknown }).scheduled === true
  const openAiError =
    Boolean(rawJson) &&
    typeof rawJson === 'object' &&
    !Array.isArray(rawJson) &&
    typeof (rawJson as { openAiError?: unknown }).openAiError === 'string'

  return {
    context,
    scheduled,
    openAiError,
  }
}

function formatReviewMonth(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

function groupReviewsByMonth<T extends { review_date: string }>(reviews: T[]) {
  return reviews.reduce<Array<{ label: string; reviews: T[] }>>((groups, review) => {
    const label = formatReviewMonth(review.review_date)
    const existing = groups.find((group) => group.label === label)

    if (existing) {
      existing.reviews.push(review)
      return groups
    }

    groups.push({ label, reviews: [review] })
    return groups
  }, [])
}

export function ReviewsPage() {
  const { role } = useAuth()
  const [deletingReview, setDeletingReview] = useState<DailyReviewRecord | null>(null)
  const queryClient = useQueryClient()
  const reviewsQuery = useQuery({
    queryKey: ['daily-reviews'],
    queryFn: () => fetchDailyReviews(),
  })

  const generateMutation = useMutation({
    mutationFn: () => triggerDailyReviewGeneration(),
    onSuccess: () => {
      toast.success('Daily review generated.')
      void queryClient.invalidateQueries({ queryKey: ['daily-reviews'] })
      void queryClient.invalidateQueries({ queryKey: ['club-data'] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to generate the daily review.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDailyReview(id),
    onSuccess: () => {
      toast.success('Review deleted.')
      setDeletingReview(null)
      void queryClient.invalidateQueries({ queryKey: ['daily-reviews'] })
      void queryClient.invalidateQueries({ queryKey: ['club-data'] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to delete the review.')
    },
  })

  if (reviewsQuery.isError) {
    return (
      <EmptyState
        icon={BookText}
        title="Unable to load daily reviews"
        description={reviewsQuery.error instanceof Error ? reviewsQuery.error.message : 'Unknown review error.'}
      />
    )
  }

  const reviews = reviewsQuery.data ?? []
  const featuredReview = reviews[0] ?? null
  const archiveGroups = groupReviewsByMonth(reviews.slice(1))

  return (
    <div className="space-y-8">
      <PageHeader
        title="Daily reviews"
        description="Short internal posts generated from snapshot history and holdings changes, with a brief watchlist for the next couple of days."
        actions={
          role === 'admin' ? (
            <Button disabled={generateMutation.isPending} onClick={() => generateMutation.mutate()}>
              {generateMutation.isPending ? <RefreshCcw className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {generateMutation.isPending ? 'Generating...' : 'Generate latest review'}
            </Button>
          ) : undefined
        }
      />

      {reviewsQuery.isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((index) => (
            <div key={index} className="panel-surface h-52 animate-pulse bg-secondary/20" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={BookText}
          title="No daily reviews yet"
          description={
            role === 'admin'
              ? 'Generate the first one from the latest snapshot and it will appear here for the whole group.'
              : 'An admin can generate the first review from the latest snapshot history.'
          }
        />
      ) : (
        <div className="space-y-8">
          {featuredReview ? (
            <section className="panel-surface p-6 sm:p-7">
              {(() => {
                const dailyNarrative = extractDailyNarrative(featuredReview.raw_json, featuredReview.body)
                const outlookNarrative = extractOutlookNarrative(featuredReview.raw_json, featuredReview.body)
                const meta = extractReviewMeta(featuredReview.raw_json)

                return (
                  <div className="space-y-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Latest post | {formatDate(featuredReview.review_date)}
                        </div>
                        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                          {featuredReview.title}
                        </h2>
                        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                          {featuredReview.summary}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-border/70 bg-secondary/20 px-3 py-1 text-xs text-foreground">
                            {meta.scheduled ? 'Auto post' : 'Manual post'}
                          </span>
                          <span className="rounded-full border border-border/70 bg-secondary/20 px-3 py-1 text-xs text-foreground">
                            {meta.openAiError ? 'System summary' : 'AI review'}
                          </span>
                        </div>
                      </div>

                      <div className="grid min-w-[240px] gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Day move
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-foreground">
                            {formatSignedCurrency(meta.context?.totalAccountValueChange ?? 0)}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            Close {formatCurrency(meta.context?.totalAccountValueClose ?? 0)}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Unit move
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-foreground">
                            {formatSignedCurrency(meta.context?.unitPriceChange ?? 0)}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            Close {formatCurrency(meta.context?.unitPriceClose ?? 0)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {role === 'admin' ? (
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeletingReview(featuredReview)}
                        >
                          <Trash2 className="size-4" />
                          Delete post
                        </Button>
                      </div>
                    ) : null}

                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                      <div>
                        <div className="mb-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Trading day
                        </div>
                        <p className="max-w-3xl text-sm leading-7 text-foreground">
                          {dailyNarrative}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-border/70 bg-secondary/15 p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Looking ahead
                        </div>
                        <p className="mt-3 text-sm leading-7 text-foreground">
                          {outlookNarrative}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4 text-xs text-muted-foreground">
                      <span>Generated {formatDateTime(featuredReview.generated_at)}</span>
                      {featuredReview.model ? <span>{featuredReview.model}</span> : null}
                    </div>
                  </div>
                )
              })()}
            </section>
          ) : null}

          {archiveGroups.length > 0 ? (
            <section className="space-y-6">
              {archiveGroups.map((group) => (
                <div key={group.label} className="space-y-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {group.label}
                  </div>

                  <div className="space-y-4">
                    {group.reviews.map((review) => {
                      const dailyNarrative = extractDailyNarrative(review.raw_json, review.body)
                      const outlookNarrative = extractOutlookNarrative(review.raw_json, review.body)
                      const meta = extractReviewMeta(review.raw_json)

                      return (
                        <article key={review.id} className="panel-surface p-5">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="space-y-2">
                              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                {formatDate(review.review_date)}
                              </div>
                              <h3 className="text-xl font-semibold tracking-tight text-foreground">
                                {review.title}
                              </h3>
                              <p className="max-w-3xl text-sm text-muted-foreground">{review.summary}</p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full border border-border/70 bg-secondary/20 px-3 py-1 text-xs text-foreground">
                                {meta.scheduled ? 'Auto' : 'Manual'}
                              </span>
                              <span className="rounded-full border border-border/70 bg-secondary/20 px-3 py-1 text-xs text-foreground">
                                {meta.openAiError ? 'System summary' : 'AI'}
                              </span>
                              {role === 'admin' ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                                  onClick={() => setDeletingReview(review)}
                                >
                                  <Trash2 className="size-3.5" />
                                  Delete
                                </Button>
                              ) : null}
                            </div>
                          </div>

                          <p className="mt-4 max-w-3xl text-sm leading-7 text-foreground">
                            {dailyNarrative}
                          </p>

                          {outlookNarrative ? (
                            <div className="mt-4 rounded-2xl border border-border/70 bg-secondary/15 p-4">
                              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                Looking ahead
                              </div>
                              <div className="mt-2 text-sm leading-7 text-foreground">
                                {outlookNarrative}
                              </div>
                            </div>
                          ) : null}

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4 text-xs text-muted-foreground">
                            <span>Generated {formatDateTime(review.generated_at)}</span>
                            {review.model ? <span>{review.model}</span> : null}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          <div className="border-t border-border/70 pt-4 text-xs text-muted-foreground">
            Shared with the group as part of the internal review log. Read the live fund context on the{' '}
            <Link className="text-foreground underline decoration-border/80 underline-offset-4" to="/">
              overview
            </Link>
            .
          </div>

          <AlertDialog open={Boolean(deletingReview)} onOpenChange={(open) => !open && setDeletingReview(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this review?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the selected post from the shared log. It does not change snapshots, holdings, or fund history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    if (deletingReview) {
                      deleteMutation.mutate(deletingReview.id)
                    }
                  }}
                >
                  Delete review
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  )
}
