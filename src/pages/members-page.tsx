import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { PnlValue } from '@/components/shared/pnl-value'
import { SortableHeader } from '@/components/shared/sortable-header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MemberDetailDialog } from '@/features/members/member-detail-dialog'
import { fetchClubData } from '@/lib/api'
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/formatters'
import { sortItems, type SortConfig } from '@/lib/sorting'
import type { MemberSummaryRow } from '@/types/app'

type MembersSortKey =
  | 'name'
  | 'netUnits'
  | 'ownershipPct'
  | 'currentValue'
  | 'totalReturn'

export function MembersPage() {
  const [sortConfig, setSortConfig] = useState<SortConfig<MembersSortKey>>({
    key: 'currentValue',
    direction: 'desc',
  })
  const [selectedMember, setSelectedMember] = useState<MemberSummaryRow | null>(null)
  const clubQuery = useQuery({
    queryKey: ['club-data'],
    queryFn: fetchClubData,
  })

  if (clubQuery.isError) {
    return (
      <EmptyState
        icon={Users}
        title="Unable to load member summaries"
        description={clubQuery.error instanceof Error ? clubQuery.error.message : 'Unknown member error.'}
      />
    )
  }

  const data = clubQuery.data
  const members = data
    ? sortItems(data.memberSummaries, sortConfig, {
        netUnits: (item) => item.netUnits,
        ownershipPct: (item) => item.ownershipPct,
        currentValue: (item) => item.currentValue,
        totalReturn: (item) => item.totalReturn,
      })
    : []

  const toggleSort = (key: MembersSortKey) =>
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }))

  return (
    <div className="space-y-8">
      <PageHeader
        title="Members"
        description="The main list focuses on ownership only: who holds units, what share of the fund they own, what it is worth, and how they are doing. Cash-flow and ledger detail live inside each member view."
      />
      {!data || members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members found"
          description="Import the workbook or create members in the admin area to populate this page."
        />
      ) : (
        <>
          <div className="panel-surface overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'name'}
                      direction={sortConfig.direction}
                      label="Member"
                      onClick={() => toggleSort('name')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'netUnits'}
                      direction={sortConfig.direction}
                      label="Units"
                      onClick={() => toggleSort('netUnits')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'ownershipPct'}
                      direction={sortConfig.direction}
                      label="Ownership"
                      onClick={() => toggleSort('ownershipPct')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'currentValue'}
                      direction={sortConfig.direction}
                      label="Current value"
                      onClick={() => toggleSort('currentValue')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'totalReturn'}
                      direction={sortConfig.direction}
                      label="Total return"
                      onClick={() => toggleSort('totalReturn')}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <button
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                        onClick={() => setSelectedMember(member)}
                        type="button"
                      >
                        {member.name}
                      </button>
                      {member.lastActivityAt ? (
                        <div className="text-xs text-muted-foreground">
                          Last activity {formatDateTime(member.lastActivityAt)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{formatNumber(member.netUnits, 6)}</TableCell>
                    <TableCell>{(member.ownershipPct * 100).toFixed(2)}%</TableCell>
                    <TableCell>{formatCurrency(member.currentValue)}</TableCell>
                    <TableCell>
                      <PnlValue value={member.totalReturn} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <MemberDetailDialog
            member={selectedMember}
            members={data.members}
            open={Boolean(selectedMember)}
            fundCurrency={data.fundCurrency === 'USD' ? 'USD' : 'GBP'}
            snapshots={data.snapshots}
            transactions={data.transactions}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedMember(null)
              }
            }}
          />
        </>
      )}
    </div>
  )
}
