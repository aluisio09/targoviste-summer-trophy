import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return NextResponse.json({ error: 'Missing env vars', url: !!url, key: !!key })
  }

  try {
    const r = await fetch(`${url}/rest/v1/categories?order=display_order`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    })
    const text = await r.text()
    return NextResponse.json({
      status: r.status,
      ok: r.ok,
      url: url.substring(0, 30) + '...',
      data: text.substring(0, 500),
    })
  } catch (e: unknown) {
    return NextResponse.json({ fetchError: String(e) })
  }
}
