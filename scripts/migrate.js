// Migration script — run with: node scripts/migrate.js <DB_PASSWORD>
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

const password = process.argv[2]
if (!password) {
  console.error('Usage: node scripts/migrate.js <DB_PASSWORD>')
  console.error('Find password in: Supabase Dashboard → Settings → Database → Connection string')
  process.exit(1)
}

const PROJECT_REF = 'zjtptlmrolegnvwesuwu'

// Direct IPv6 connection (Supabase new projects are IPv6-only for direct DB)
const client = new Client({
  host: '2a05:d01c:874:6b01:950b:b0e2:540f:55a4',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: password,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  console.log('🔌 Conectare la Supabase PostgreSQL...')
  await client.connect()
  console.log('✅ Conectat!')

  const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql')
  const sql = fs.readFileSync(schemaPath, 'utf8')

  // Split on semicolons but keep statement-level structure
  // Run statements one by one, skip errors on already-existing objects
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  let ok = 0, skipped = 0, errors = 0

  for (const stmt of statements) {
    const preview = stmt.slice(0, 60).replace(/\n/g, ' ')
    try {
      await client.query(stmt)
      console.log(`  ✅ ${preview}`)
      ok++
    } catch (err) {
      // Ignore "already exists" and similar idempotent errors
      const msg = err.message
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate key') ||
        msg.includes('does not exist') && stmt.includes('IF NOT EXISTS')
      ) {
        console.log(`  ⏭  (skip) ${preview}`)
        skipped++
      } else if (msg.includes('supabase_realtime') || msg.includes('publication')) {
        console.log(`  ⚠️  Realtime (setează manual în dashboard): ${preview.slice(0, 40)}`)
        skipped++
      } else {
        console.error(`  ❌ EROARE: ${msg}`)
        console.error(`     SQL: ${preview}`)
        errors++
      }
    }
  }

  await client.end()
  console.log(`\n📊 Rezultat: ${ok} OK · ${skipped} skipped · ${errors} erori`)
  if (errors === 0) {
    console.log('🎉 Schema aplicată cu succes!')
  }
}

run().catch(err => {
  console.error('❌ Eroare fatală:', err.message)
  process.exit(1)
})
