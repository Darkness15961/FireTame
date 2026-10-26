import { supabase } from '@/supabase'

const STORAGE_KEY = 'firetame.health.pending'
const INTERVAL_MS = 60_000

interface PendingCheck {
  checked_at: string
  ok: boolean
  latency_ms: number | null
  origen: string
}

let schemaMissing = false

function readPending(): PendingCheck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) as unknown : []
    return Array.isArray(parsed) ? parsed as PendingCheck[] : []
  } catch {
    return []
  }
}

function writePending(rows: PendingCheck[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(-200)))
}

function rememberFailure(checkedAt: string) {
  const pending = readPending()
  pending.push({ checked_at: checkedAt, ok: false, latency_ms: null, origen: 'dashboard' })
  writePending(pending)
}

async function insertCheck(row: PendingCheck): Promise<boolean> {
  const { error } = await supabase.from('health_checks').insert(row)
  if (!error) return true
  if (/health_checks|schema cache|does not exist|PGRST205|42P01/i.test(error.message)) {
    schemaMissing = true
  }
  return false
}

async function flushPending() {
  const pending = readPending()
  if (!pending.length) return
  const remaining: PendingCheck[] = []
  for (const row of pending) {
    const saved = await insertCheck(row)
    if (!saved) remaining.push(row)
    if (schemaMissing) break
  }
  writePending(remaining)
}

/** Ping HTTP a Supabase. Si el servidor no responde, el fallo se guarda y se reintenta. */
export async function runHealthCheck(): Promise<void> {
  if (schemaMissing) return
  const checkedAt = new Date().toISOString()
  const start = performance.now()
  try {
    const { error } = await supabase.from('nodos').select('id').limit(1)
    if (error) throw error
    const latency = Math.round(performance.now() - start)
    await flushPending()
    await insertCheck({ checked_at: checkedAt, ok: true, latency_ms: latency, origen: 'dashboard' })
  } catch {
    rememberFailure(checkedAt)
    if (!schemaMissing) {
      const saved = await insertCheck({
        checked_at: checkedAt,
        ok: false,
        latency_ms: null,
        origen: 'dashboard',
      })
      if (saved) {
        const pending = readPending().filter((row) => row.checked_at !== checkedAt)
        writePending(pending)
      }
    }
  }
}

export function startHealthMonitor(): () => void {
  void runHealthCheck()
  const id = window.setInterval(() => {
    void runHealthCheck()
  }, INTERVAL_MS)
  return () => window.clearInterval(id)
}
