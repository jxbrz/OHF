import type { PropsWithChildren } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfigRequiredState } from '@/components/shared/config-required-state'
import { LoadingScreen } from '@/components/shared/loading-screen'
import { useAuth } from '@/features/auth/auth-provider'

export function RequireAuth({
  requireAdmin = false,
  children,
}: PropsWithChildren<{ requireAdmin?: boolean }>) {
  const { isConfigured, isLoading, session, role } = useAuth()
  const location = useLocation()

  if (!isConfigured) {
    return <ConfigRequiredState />
  }

  if (isLoading) {
    return <LoadingScreen label="Loading secure workspace" />
  }

  if (!session) {
    return <Navigate replace to="/login" state={{ from: location.pathname }} />
  }

  if (requireAdmin && role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Admin access required</CardTitle>
            <CardDescription>
              Your account can view the club dashboard, but this page is restricted to admins.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Ask the current administrator to promote your profile if you need operational access.
          </CardContent>
        </Card>
      </div>
    )
  }

  return children ? <>{children}</> : <Outlet />
}
