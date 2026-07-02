'use client'

import { useState, useTransition } from 'react'
import { loginAction } from '@/app/actions/auth'

export default function AdminLoginPage() {
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    setError('')
    startTransition(async () => {
      const result = await loginAction(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="min-h-screen bg-[#0f3d1f] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚽</div>
          <h1 className="text-xl font-extrabold text-gray-800">Targoviste Summer Trophy</h1>
          <p className="text-sm text-gray-500 mt-1">Panou de administrare</p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Parolă admin
            </label>
            <input
              type="password"
              name="password"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Introduceți parola"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-[#0f3d1f] text-white font-bold py-2.5 rounded-lg hover:bg-green-900 transition-colors disabled:opacity-60"
          >
            {isPending ? 'Se conectează...' : 'Intră în admin'}
          </button>
        </form>
      </div>
    </div>
  )
}
