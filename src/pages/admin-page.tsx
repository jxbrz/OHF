import { calculateCurrentUnitPrice } from '@shared/calculations'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Bolt, Pencil, Plus, RefreshCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { Field } from '@/components/shared/field'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MemberFormDialog } from '@/features/admin/member-form-dialog'
import {
  createManualPortfolioSnapshot,
  deleteMember,
  fetchClubData,
  fetchAdminData,
  readOptionalSettingNumber,
  readOptionalSettingString,
  readSettingBoolean,
  readSettingNumber,
  readSettingString,
  triggerPortfolioSync,
  updateAppSetting,
  updateMember,
} from '@/lib/api'
import { formatCurrency, formatDateTime, formatNumber, toDateTimeLocalValue } from '@/lib/formatters'
import type { Tables } from '@/types/database'

export function AdminPage() {
  const queryClient = useQueryClient()
  const [startingUnitPrice, setStartingUnitPrice] = useState('1')
  const [mockMode, setMockMode] = useState('false')
  const [fundCurrency, setFundCurrency] = useState('GBP')
  const [brokerCurrency, setBrokerCurrency] = useState('USD')
  const [brokerToFundFxRate, setBrokerToFundFxRate] = useState('')
  const [performanceBaselineAt, setPerformanceBaselineAt] = useState('')
  const [manualSnapshotValue, setManualSnapshotValue] = useState('')
  const [manualSnapshotCash, setManualSnapshotCash] = useState('')
  const [manualSnapshotUnrealizedPnl, setManualSnapshotUnrealizedPnl] = useState('')
  const [manualSnapshotRealizedPnl, setManualSnapshotRealizedPnl] = useState('')
  const [manualSnapshotCapturedAt, setManualSnapshotCapturedAt] = useState('')
  const [memberDialogOpen, setMemberDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Tables<'members'> | null>(null)
  const [deletingMember, setDeletingMember] = useState<Tables<'members'> | null>(null)
  const adminQuery = useQuery({
    queryKey: ['admin-data'],
    queryFn: fetchAdminData,
  })
  const clubQuery = useQuery({
    queryKey: ['club-data'],
    queryFn: fetchClubData,
  })

  const settingMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([
        updateAppSetting('starting_unit_price', { value: Number(resolvedStartingUnitPrice) }),
        updateAppSetting('etoro_use_mock', { value: resolvedMockMode === 'true' }),
        updateAppSetting('fund_base_currency', { value: resolvedFundCurrency }),
        updateAppSetting('broker_account_currency', { value: resolvedBrokerCurrency }),
        updateAppSetting(
          'broker_to_fund_fx_rate',
          resolvedBrokerToFundFxRate === '' ? { value: null } : { value: Number(resolvedBrokerToFundFxRate) }
        ),
        updateAppSetting(
          'performance_baseline_at',
          resolvedPerformanceBaselineAt === '' ? { value: null } : { value: new Date(resolvedPerformanceBaselineAt).toISOString() }
        ),
      ])
    },
    onSuccess: () => {
      toast.success('Settings updated.')
      setStartingUnitPrice('')
      setMockMode('')
      setFundCurrency('')
      setBrokerCurrency('')
      setBrokerToFundFxRate('')
      setPerformanceBaselineAt('')
      void queryClient.invalidateQueries({ queryKey: ['admin-data'] })
      void queryClient.invalidateQueries({ queryKey: ['club-data'] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to update settings.')
    },
  })

  const syncMutation = useMutation({
    mutationFn: triggerPortfolioSync,
    onSuccess: (result) => {
      toast.success(
        result.usedMock
          ? 'Mock sync completed and snapshot captured.'
          : 'eToro sync completed and snapshot captured.'
      )
      void queryClient.invalidateQueries({ queryKey: ['admin-data'] })
      void queryClient.invalidateQueries({ queryKey: ['club-data'] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to run sync.')
    },
  })

  const manualSnapshotMutation = useMutation({
    mutationFn: async () => {
      const totalUnits = clubQuery.data?.dashboardSummary.totalUnits ?? 0
      const startingPrice = readSettingNumber(adminQuery.data?.settingsRows ?? [], 'starting_unit_price', 1)
      const totalAccountValue = Number(manualSnapshotValue)
      const capturedAt = manualSnapshotCapturedAt
        ? new Date(manualSnapshotCapturedAt).toISOString()
        : new Date().toISOString()

      return createManualPortfolioSnapshot({
        captured_at: capturedAt,
        total_account_value: totalAccountValue,
        available_cash: manualSnapshotCash ? Number(manualSnapshotCash) : null,
        unrealized_pnl: manualSnapshotUnrealizedPnl ? Number(manualSnapshotUnrealizedPnl) : null,
        realized_pnl: manualSnapshotRealizedPnl ? Number(manualSnapshotRealizedPnl) : null,
        total_units: Number(totalUnits.toFixed(8)),
        unit_price: calculateCurrentUnitPrice(totalAccountValue, totalUnits, startingPrice),
        raw_json: {
          source: 'manual_admin_snapshot',
        },
      })
    },
    onSuccess: () => {
      toast.success('Manual valuation snapshot captured.')
      setManualSnapshotValue('')
      setManualSnapshotCash('')
      setManualSnapshotUnrealizedPnl('')
      setManualSnapshotRealizedPnl('')
      setManualSnapshotCapturedAt('')
      void queryClient.invalidateQueries({ queryKey: ['admin-data'] })
      void queryClient.invalidateQueries({ queryKey: ['club-data'] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to capture manual snapshot.')
    },
  })

  const toggleMemberMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateMember(id, { is_active: isActive }),
    onSuccess: () => {
      toast.success('Member status updated.')
      void queryClient.invalidateQueries({ queryKey: ['admin-data'] })
      void queryClient.invalidateQueries({ queryKey: ['club-data'] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to update member status.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteMember,
    onSuccess: () => {
      toast.success('Member deleted.')
      void queryClient.invalidateQueries({ queryKey: ['admin-data'] })
      void queryClient.invalidateQueries({ queryKey: ['club-data'] })
      setDeletingMember(null)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to delete member.')
    },
  })

  if (adminQuery.isError) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Unable to load admin controls"
        description={adminQuery.error instanceof Error ? adminQuery.error.message : 'Unknown admin error.'}
      />
    )
  }

  const data = adminQuery.data
  const resolvedStartingUnitPrice =
    startingUnitPrice || String(readSettingNumber(data?.settingsRows ?? [], 'starting_unit_price', 1))
  const resolvedMockMode =
    mockMode || String(readSettingBoolean(data?.settingsRows ?? [], 'etoro_use_mock', false))
  const resolvedFundCurrency = fundCurrency || readSettingString(data?.settingsRows ?? [], 'fund_base_currency', 'GBP')
  const resolvedBrokerCurrency =
    brokerCurrency || readSettingString(data?.settingsRows ?? [], 'broker_account_currency', 'USD')
  const existingBrokerToFundFxRate = readOptionalSettingNumber(data?.settingsRows ?? [], 'broker_to_fund_fx_rate')
  const resolvedBrokerToFundFxRate =
    brokerToFundFxRate || (existingBrokerToFundFxRate !== null ? String(existingBrokerToFundFxRate) : '')
  const existingPerformanceBaselineAt = readOptionalSettingString(data?.settingsRows ?? [], 'performance_baseline_at')
  const resolvedPerformanceBaselineAt =
    performanceBaselineAt ||
    (existingPerformanceBaselineAt
      ? toDateTimeLocalValue(existingPerformanceBaselineAt)
      : '')
  const totalUnits = clubQuery.data?.dashboardSummary.totalUnits ?? 0
  const latestSnapshotFx = clubQuery.data?.latestSnapshotFx
  const manualSnapshotUnitPrice =
    manualSnapshotValue && totalUnits > 0
      ? calculateCurrentUnitPrice(Number(manualSnapshotValue), totalUnits, resolvedStartingUnitPrice)
      : null

  return (
    <div className="space-y-8">
      <PageHeader
        title="Admin"
        description="Manage members, currency settings, and secure sync operations for the GBP fund ledger with USD broker pricing."
        actions={
          <Button disabled={syncMutation.isPending} onClick={() => syncMutation.mutate()}>
            {syncMutation.isPending ? <RefreshCcw className="size-4 animate-spin" /> : <Bolt className="size-4" />}
            {syncMutation.isPending ? 'Syncing...' : 'Run sync'}
          </Button>
        }
      />
      {!data ? (
        <EmptyState
          icon={ShieldCheck}
          title="No admin data available"
          description="Once the database is ready, admin settings and member controls will appear here."
        />
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="panel-surface p-5">
              <div className="mb-5 space-y-1">
                <h2 className="text-lg font-semibold">Fund settings</h2>
                <p className="text-sm text-muted-foreground">
                  Configure the base currency, broker currency, and optional FX override used when live broker totals are converted into the GBP ledger.
                </p>
              </div>
              <div className="space-y-4">
                <Field id="starting-unit-price" label="Starting unit price">
                  <Input
                    id="starting-unit-price"
                    step="0.00000001"
                    type="number"
                    value={resolvedStartingUnitPrice}
                    onChange={(event) => setStartingUnitPrice(event.target.value)}
                  />
                </Field>
                <Field id="mock-mode" label="Mock sync mode">
                  <Select value={resolvedMockMode} onValueChange={setMockMode}>
                    <SelectTrigger id="mock-mode" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">Use live credentials when available</SelectItem>
                      <SelectItem value="true">Force deterministic mock sync data</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field id="fund-currency" label="Fund currency">
                    <Select value={resolvedFundCurrency} onValueChange={setFundCurrency}>
                      <SelectTrigger id="fund-currency" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field id="broker-currency" label="Broker summary currency">
                    <Select value={resolvedBrokerCurrency} onValueChange={setBrokerCurrency}>
                      <SelectTrigger id="broker-currency" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field
                  id="broker-to-fund-fx-rate"
                  label={`Manual ${resolvedBrokerCurrency} -> ${resolvedFundCurrency} FX rate`}
                  hint="Leave blank to use the latest official ECB reference rate on each live sync."
                >
                  <Input
                    id="broker-to-fund-fx-rate"
                    step="0.0000000001"
                    type="number"
                    value={resolvedBrokerToFundFxRate}
                    onChange={(event) => setBrokerToFundFxRate(event.target.value)}
                  />
                </Field>
                <Field
                  id="performance-baseline-at"
                  label="Performance tracking baseline"
                  hint="Performance uses the first snapshot captured on or after this timestamp, rather than the original November starting unit price."
                >
                  <Input
                    id="performance-baseline-at"
                    type="datetime-local"
                    value={resolvedPerformanceBaselineAt}
                    onChange={(event) => setPerformanceBaselineAt(event.target.value)}
                  />
                </Field>
                {existingBrokerToFundFxRate !== null ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await updateAppSetting('broker_to_fund_fx_rate', { value: null })
                        setBrokerToFundFxRate('')
                        toast.success('Manual FX override cleared. Future syncs will use the ECB reference rate.')
                        void queryClient.invalidateQueries({ queryKey: ['admin-data'] })
                        void queryClient.invalidateQueries({ queryKey: ['club-data'] })
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : 'Unable to clear manual FX override.')
                      }
                    }}
                  >
                    Use automatic ECB FX
                  </Button>
                ) : null}
                <Button className="w-full" disabled={settingMutation.isPending} onClick={() => settingMutation.mutate()}>
                  {settingMutation.isPending ? 'Saving...' : 'Save settings'}
                </Button>
              </div>
            </div>
            <div className="panel-surface p-5">
              <div className="mb-5 space-y-1">
                <h2 className="text-lg font-semibold">Sync status</h2>
                <p className="text-sm text-muted-foreground">
                  Run a secure manual sync at any time. The backend also captures an automatic snapshot every hour so the overview stays fresh without exposing broker secrets.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Latest snapshot</div>
                  <div className="mt-2 text-sm font-medium text-foreground">
                    {data.latestSnapshot ? formatDateTime(data.latestSnapshot.captured_at) : 'Not captured yet'}
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Latest value</div>
                  <div className="mt-2 text-sm font-medium text-foreground">
                    {data.latestSnapshot ? formatCurrency(data.latestSnapshot.total_account_value) : 'N/A'}
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Mode</div>
                  <div className="mt-2 text-sm font-medium text-foreground">
                    {resolvedMockMode === 'true' ? 'Mock data enabled' : 'Live-first mode'}
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Latest FX</div>
                  <div className="mt-2 text-sm font-medium text-foreground">
                    {latestSnapshotFx
                      ? `1 ${latestSnapshotFx.brokerCurrency} = ${formatCurrency(
                          latestSnapshotFx.brokerToFundRate,
                          latestSnapshotFx.fundCurrency as 'GBP' | 'USD'
                        )}`
                      : resolvedBrokerCurrency === resolvedFundCurrency
                        ? 'Same currency'
                        : existingBrokerToFundFxRate !== null
                          ? `Manual ${formatNumber(existingBrokerToFundFxRate, 6)}`
                          : 'ECB auto'}
                  </div>
                  {latestSnapshotFx?.referenceDate ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {latestSnapshotFx.source === 'manual_override' ? 'Manual override' : `ECB ${latestSnapshotFx.referenceDate}`}
                    </div>
                  ) : latestSnapshotFx ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {latestSnapshotFx.source === 'same_currency' ? 'No conversion needed' : 'Manual override'}
                    </div>
                  ) : null}
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                The sync function runs entirely on the backend, never exposes eToro credentials to the browser, stores the FX metadata with each snapshot, and deduplicates scheduled captures inside the same hour.
              </p>
            </div>
          </div>
          <div className="panel-surface p-5">
            <div className="mb-5 space-y-1">
              <h2 className="text-lg font-semibold">Manual valuation snapshot</h2>
              <p className="text-sm text-muted-foreground">
                Capture the current fund value directly when you know the account value but do not have a fresh broker sync yet.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Field id="manual-snapshot-value" label="Fund value">
                <Input
                  id="manual-snapshot-value"
                  step="0.01"
                  type="number"
                  value={manualSnapshotValue}
                  onChange={(event) => setManualSnapshotValue(event.target.value)}
                />
              </Field>
              <Field id="manual-snapshot-cash" label="Available cash">
                <Input
                  id="manual-snapshot-cash"
                  step="0.01"
                  type="number"
                  value={manualSnapshotCash}
                  onChange={(event) => setManualSnapshotCash(event.target.value)}
                />
              </Field>
              <Field id="manual-snapshot-unrealized" label="Unrealized P&L">
                <Input
                  id="manual-snapshot-unrealized"
                  step="0.01"
                  type="number"
                  value={manualSnapshotUnrealizedPnl}
                  onChange={(event) => setManualSnapshotUnrealizedPnl(event.target.value)}
                />
              </Field>
              <Field id="manual-snapshot-realized" label="Realized P&L">
                <Input
                  id="manual-snapshot-realized"
                  step="0.01"
                  type="number"
                  value={manualSnapshotRealizedPnl}
                  onChange={(event) => setManualSnapshotRealizedPnl(event.target.value)}
                />
              </Field>
              <Field id="manual-snapshot-captured-at" label="Captured at">
                <Input
                  id="manual-snapshot-captured-at"
                  type="datetime-local"
                  value={manualSnapshotCapturedAt}
                  onChange={(event) => setManualSnapshotCapturedAt(event.target.value)}
                />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span>
                Current ledger units: <strong className="text-foreground">{totalUnits.toFixed(8)}</strong>
              </span>
              <span>
                Derived unit price:{' '}
                <strong className="text-foreground">
                  {manualSnapshotUnitPrice !== null ? formatCurrency(manualSnapshotUnitPrice) : 'Enter a fund value'}
                </strong>
              </span>
            </div>
            <Button
              className="mt-4"
              disabled={manualSnapshotMutation.isPending || !manualSnapshotValue}
              onClick={() => manualSnapshotMutation.mutate()}
            >
              {manualSnapshotMutation.isPending ? 'Capturing...' : 'Capture manual snapshot'}
            </Button>
          </div>
          <div className="panel-surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-4">
              <div>
                <h2 className="text-lg font-semibold">Members</h2>
                <p className="text-sm text-muted-foreground">
                  Add, rename, activate, deactivate, or remove member records.
                </p>
              </div>
              <Button
                onClick={() => {
                  setEditingMember(null)
                  setMemberDialogOpen(true)
                }}
              >
                <Plus className="size-4" />
                Add member
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium text-foreground">{member.name}</TableCell>
                    <TableCell>{member.is_active ? 'Active' : 'Inactive'}</TableCell>
                    <TableCell>{formatDateTime(member.created_at)}</TableCell>
                    <TableCell>{formatDateTime(member.updated_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingMember(member)
                            setMemberDialogOpen(true)
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            toggleMemberMutation.mutate({
                              id: member.id,
                              isActive: !member.is_active,
                            })
                          }
                        >
                          {member.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => setDeletingMember(member)}>
                          <Trash2 className="size-4 text-loss" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <MemberFormDialog
            member={editingMember}
            open={memberDialogOpen}
            onOpenChange={(open) => {
              setMemberDialogOpen(open)
              if (!open) {
                setEditingMember(null)
              }
            }}
          />
          <AlertDialog open={Boolean(deletingMember)} onOpenChange={(open) => !open && setDeletingMember(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete member?</AlertDialogTitle>
                <AlertDialogDescription>
                  Deleting a member also deletes every linked fund transaction because of the database cascade rule.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    if (deletingMember) {
                      deleteMutation.mutate(deletingMember.id)
                    }
                  }}
                >
                  Delete member
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  )
}
