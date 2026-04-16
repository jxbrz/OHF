import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

type ClubUserRole = 'admin' | 'viewer'

interface ManageUsersRequestBody {
  action?: 'list_users' | 'create_user'
  email?: string
  password?: string
  username?: string
  role?: ClubUserRole
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function normalizeRole(value: unknown): ClubUserRole {
  return value === 'admin' ? 'admin' : 'viewer'
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Supabase function environment is not configured.' }, 500)
  }

  const authorization = request.headers.get('Authorization')
  if (!authorization) {
    return jsonResponse({ error: 'Missing authorization header.' }, 401)
  }

  let requestBody: ManageUsersRequestBody = {}
  try {
    requestBody = (await request.json()) as ManageUsersRequestBody
  } catch {
    requestBody = {}
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return jsonResponse({ error: 'Unable to validate the user session.' }, 401)
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || profile.role !== 'admin') {
    return jsonResponse({ error: 'Admin access is required.' }, 403)
  }

  try {
    if (requestBody.action === 'create_user') {
      const email = requestBody.email?.trim().toLowerCase()
      const password = requestBody.password?.trim()
      const username = requestBody.username?.trim() ?? ''
      const role = normalizeRole(requestBody.role)

      if (!email || !password || username.length < 3) {
        return jsonResponse({ error: 'Email, password, and username are required.' }, 400)
      }

      const { data: createdUserResponse, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
        },
      })

      if (createError || !createdUserResponse.user) {
        throw createError ?? new Error('Unable to create user.')
      }

      const createdUser = createdUserResponse.user

      const { error: profileUpsertError } = await adminClient.from('profiles').upsert({
        id: createdUser.id,
        username,
        role,
      })

      if (profileUpsertError) {
        throw profileUpsertError
      }

      await adminClient.from('audit_logs').insert({
        actor_profile_id: profile.id,
        action: 'create_club_user',
        entity_type: 'profile',
        entity_id: createdUser.id,
        payload: {
          email,
          role,
          username,
        },
      })

      return jsonResponse({
        success: true,
        user: {
          id: createdUser.id,
          email: createdUser.email ?? null,
          createdAt: createdUser.created_at ?? null,
          lastSignInAt: createdUser.last_sign_in_at ?? null,
          emailConfirmedAt: createdUser.email_confirmed_at ?? null,
          username,
          role,
        },
      })
    }

    const { data: listedUsersResponse, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    })

    if (listError) {
      throw listError
    }

    const listedUsers = listedUsersResponse.users ?? []
    const userIds = listedUsers.map((listedUser) => listedUser.id)

    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id, username, role')
      .in('id', userIds)

    if (profilesError) {
      throw profilesError
    }

    const profileMap = new Map((profiles ?? []).map((entry) => [entry.id, entry]))

    return jsonResponse({
      success: true,
      users: listedUsers.map((listedUser) => {
        const listedProfile = profileMap.get(listedUser.id)

        return {
          id: listedUser.id,
          email: listedUser.email ?? null,
          createdAt: listedUser.created_at ?? null,
          lastSignInAt: listedUser.last_sign_in_at ?? null,
          emailConfirmedAt: listedUser.email_confirmed_at ?? null,
          username: listedProfile?.username ?? null,
          role: normalizeRole(listedProfile?.role),
        }
      }),
    })
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unknown user management error',
      },
      500
    )
  }
})
