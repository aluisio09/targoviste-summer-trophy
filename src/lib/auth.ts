import { SignJWT, jwtVerify } from 'jose'

const getSecret = () => new TextEncoder().encode(process.env.AUTH_SECRET!)

export async function createAdminToken(): Promise<string> {
  return new SignJWT({ admin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecret())
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload.admin === true
  } catch {
    return false
  }
}
