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
import { formatCurrency, formatNumber } from '@/lib/formatters'
import { sortItems, type SortConfig } from '@/lib/sorting'
import type { MemberSummaryRow } from '@/types/app'

type MembersSortKey =
  | 'name'
  | 'totalInvested'
  | 'totalReturned'
  | 'remainingCostBasis'
  | 'netUnits'
  | 'ownershipPct'
  | 'currentValue'
  | 'totalReturn'

export function MembersPage() {
  const [sortConfig, setSortConfig] = useState<SortConfig<MembersSortKey>>({
    key: 'totalReturn',
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
        totalInvested: (item) => item.totalInvested,
        totalReturned: (item) => item.totalReturned,
        remainingCostBasis: (item) => item.remainingCostBasis,
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
        description="Member capital accounts, ownership, remaining cost basis, and total return with FIFO lot support behind the scenes."
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
                  <TableHead className="text-right">Units bought</TableHead>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'totalInvested'}
                      direction={sortConfig.direction}
                      label="Cash paid in"
                      onClick={() => toggleSort('totalInvested')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'totalReturned'}
                      direction={sortConfig.direction}
                      label="Cash received"
                      onClick={() => toggleSort('totalReturned')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'remainingCostBasis'}
                      direction={sortConfig.direction}
                      label="Remaining cost basis"
                      onClick={() => toggleSort('remainingCostBasis')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'netUnits'}
                      direction={sortConfig.direction}
                      label="Net units"
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
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{member.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {member.isActive ? 'Active member' : 'Inactive member'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(member.unitsBought, 6)}</TableCell>
                    <TableCell>{formatCurrency(member.totalInvested)}</TableCell>
                    <TableCell>{formatCurrency(member.totalReturned)}</TableCell>
                    <TableCell>{formatCurrency(member.remainingCostBasis)}</TableCell>
                    <TableCell>{formatNumber(member.netUnits, 6)}</TableCell>
                    <TableCell>{(member.ownershipPct * 100).toFixed(2)}%</TableCell>
                    <TableCell>{formatCurrency(member.currentValue)}</TableCell>
                    <TableCell>
                      <PnlValue value={member.totalReturn} />
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                        onClick={() => setSelectedMember(member)}
                        type="button"
                      >
                        Drill down
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <MemberDetailDialog
            member={selectedMember}
            members={data.members}
            currentUnitPrice={data.latestSnapshot?.unit_price ?? data.startingUnitPrice}
            open={Boolean(selectedMember)}
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
