import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { RequireAuth } from '@/features/auth/require-auth'

const LoginPage = lazy(() =>
  import('@/pages/login-page').then((module) => ({ default: module.LoginPage }))
)
const DashboardPage = lazy(() =>
  import('@/pages/dashboard-page').then((module) => ({ default: module.DashboardPage }))
)
const HoldingsPage = lazy(() =>
  import('@/pages/holdings-page').then((module) => ({ default: module.HoldingsPage }))
)
const HoldingProfilePage = lazy(() =>
  import('@/pages/holding-profile-page').then((module) => ({ default: module.HoldingProfilePage }))
)
const MembersPage = lazy(() =>
  import('@/pages/members-page').then((module) => ({ default: module.MembersPage }))
)
const MemberProfilePage = lazy(() =>
  import('@/pages/member-profile-page').then((module) => ({ default: module.MemberProfilePage }))
)
const TransactionsPage = lazy(() =>
  import('@/pages/transactions-page').then((module) => ({ default: module.TransactionsPage }))
)
const SnapshotsPage = lazy(() =>
  import('@/pages/snapshots-page').then((module) => ({ default: module.SnapshotsPage }))
)
const AdminPage = lazy(() =>
  import('@/pages/admin-page').then((module) => ({ default: module.AdminPage }))
)
const NotFoundPage = lazy(() =>
  import('@/pages/not-found-page').then((module) => ({ default: module.NotFoundPage }))
)

function RouteLoader() {
  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="panel-surface animate-pulse rounded-3xl px-6 py-10">
          <div className="h-5 w-40 rounded-full bg-secondary/60" />
          <div className="mt-4 h-12 w-72 rounded-3xl bg-secondary/50" />
          <div className="mt-6 h-4 w-full max-w-2xl rounded-full bg-secondary/40" />
          <div className="mt-2 h-4 w-full max-w-xl rounded-full bg-secondary/30" />
        </div>
      </div>
    </div>
  )
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoader />}>
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
      </Suspense>
    </BrowserRouter>
  )
}
