import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import type { Tables } from '@/types/database'
import { hasSupabaseEnv } from '@/lib/env'
import { getSupabaseClient, supabase } from '@/lib/supabase'

interface AuthContextValue {
  isConfigured: boolean
  isLoading: boolean
  session: Session | null
  user: User | null
  profile: Tables<'profiles'> | null
  role: Tables<'profiles'>['role'] | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function fetchProfile(userId: string) {
  const client = getSupabaseClient()
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).single()
  if (error) {
    throw error
  }

  return data
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [isSessionLoading, setIsSessionLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) {
      return
    }

    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setSession(data.session)
        setIsSessionLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsSessionLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const profileQuery = useQuery({
    queryKey: ['profile', session?.user.id],
    queryFn: () => fetchProfile(session!.user.id),
    enabled: Boolean(session?.user && supabase),
  })

  const value: AuthContextValue = {
    isConfigured: hasSupabaseEnv,
    isLoading: isSessionLoading || (Boolean(session?.user) && profileQuery.isLoading),
    session,
    user: session?.user ?? null,
    profile: profileQuery.data ?? null,
    role: profileQuery.data?.role ?? null,
    signIn: async (email, password) => {
      const client = getSupabaseClient()
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) {
        throw error
      }
    },
    signOut: async () => {
      const client = getSupabaseClient()
      const { error } = await client.auth.signOut()
      if (error) {
        throw error
      }
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
