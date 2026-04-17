import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { RequireAuth } from '@/features/auth/require-auth'
import { AdminPage } from '@/pages/admin-page'
import { DashboardPage } from '@/pages/dashboard-page'
import { HoldingProfilePage } from '@/pages/holding-profile-page'
import { HoldingsPage } from '@/pages/holdings-page'
import { LoginPage } from '@/pages/login-page'
import { MemberProfilePage } from '@/pages/member-profile-page'
import { MembersPage } from '@/pages/members-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { SnapshotsPage } from '@/pages/snapshots-page'
import { TransactionsPage } from '@/pages/transactions-page'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="/holdings" element={<HoldingsPage />} />
          <Route path="/holdings/:symbol" element={<HoldingProfilePage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/members/:memberId" element={<MemberProfilePage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/snapshots" element={<SnapshotsPage />} />
          <Route
            path="/admin"
            element={
              <RequireAuth requireAdmin>
                <AdminPage />
              </RequireAuth>
            }
          />
        </Route>
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate replace to="/404" />} />
      </Routes>
    </BrowserRouter>
  )
}
