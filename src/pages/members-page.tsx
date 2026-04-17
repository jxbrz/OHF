import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
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
import { fetchClubData } from '@/lib/api'
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/formatters'
import { sortItems, type SortConfig } from '@/lib/sorting'

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
  const fundCurrency = data?.fundCurrency === 'USD' ? 'USD' : 'GBP'
  const members = data
    ? sortItems(data.memberSummaries, sortConfig, {
        netUnits: (item) => item.netUnits,
        ownershipPct: (item) => item.ownershipPct,
        currentValue: (item) => item.currentValue,
        totalReturn: (item) => item.totalReturn,
      }).filter((member) => member.netUnits > 0)
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
          title="No active holders yet"
          description="Members appear here once they hold units in the fund."
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
                      <Link
                        className="-ml-2 inline-flex items-center rounded-lg px-2 py-1 text-left font-medium text-foreground transition hover:bg-secondary/60 hover:text-foreground"
                        to={`/members/${member.id}`}
                      >
                        {member.name}
                      </Link>
                      {member.lastActivityAt ? (
                        <div className="text-xs text-muted-foreground">
                          Last activity {formatDateTime(member.lastActivityAt)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{formatNumber(member.netUnits, 6)}</TableCell>
                    <TableCell>{(member.ownershipPct * 100).toFixed(2)}%</TableCell>
                    <TableCell>{formatCurrency(member.currentValue, fundCurrency)}</TableCell>
                    <TableCell>
                      <PnlValue value={member.totalReturn} currency={fundCurrency} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
