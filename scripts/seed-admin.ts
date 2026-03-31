import { createAdminClient, getRequiredEnv } from './_shared'

async function main() {
  const supabase = createAdminClient()
  const email = getRequiredEnv('ADMIN_EMAIL')
  const password = getRequiredEnv('ADMIN_PASSWORD')
  const username = process.env.ADMIN_USERNAME ?? email.split('@')[0] ?? 'admin'

  const { data: userList, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  })

  if (listError) {
    throw listError
  }

  const existingUser = userList.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())

  const authUser =
    existingUser ??
    (
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
        },
      })
    ).data.user

  if (!authUser) {
    throw new Error('Failed to create or load the admin user.')
  }

  if (existingUser) {
    const { error: updateUserError } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password,
      user_metadata: {
        ...(existingUser.user_metadata ?? {}),
        username,
      },
    })

    if (updateUserError) {
      throw updateUserError
    }
  }

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: authUser.id,
    username,
    role: 'admin',
  })

  if (profileError) {
    throw profileError
  }

  console.log(`Admin user ready: ${email}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
