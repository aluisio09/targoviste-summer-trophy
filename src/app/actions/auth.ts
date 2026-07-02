'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminToken } from '@/lib/auth'

export async function loginAction(formData: FormData) {
  const password = formData.get('password') as string

  if (password !== process.env.ADMIN_PASSWORD) {
    return { error: 'Parola incorectă.' }
  }

  const token = await createAdminToken()
  const cookieStore = await cookies()
  cookieStore.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  })

  redirect('/admin/dashboard')
}

export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete('admin_token')
  redirect('/admin')
}
