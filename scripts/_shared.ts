import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

config({ path: '.env.local', override: false })
config({ path: '.env', override: false })

export function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export function createAdminClient() {
  const supabaseUrl = getRequiredEnv('SUPABASE_URL')
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
