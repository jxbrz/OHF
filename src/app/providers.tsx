import { useEffect, type PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/features/auth/auth-provider'

function getMsUntilNextHour() {
  const now = new Date()
  const nextHour = new Date(now)
  nextHour.setMinutes(0, 0, 0)
  nextHour.setHours(nextHour.getHours() + 1)
  return Math.max(nextHour.getTime() - now.getTime(), 1_000)
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      refetchInterval: () => getMsUntilNextHour(),
      refetchIntervalInBackground: true,
    },
  },
})

function ThemeClassSync({ children }: PropsWithChildren) {
  useEffect(() => {
    document.documentElement.classList.add('dark', 'theme')
    return () => {
      document.documentElement.classList.remove('dark', 'theme')
    }
  }, [])

  return children
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
        <ThemeClassSync>
          <AuthProvider>
            {children}
            <Toaster richColors closeButton />
          </AuthProvider>
        </ThemeClassSync>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
