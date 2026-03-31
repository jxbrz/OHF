import { createClient } from '@supabase/supabase-js'
import { env, hasSupabaseEnv } from '@/lib/env'
import type { Database } from '@/types/database'

export const supabase = hasSupabaseEnv
  ? createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase environment variables are missing.')
  }

  return supabase
}
