import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

// GET — fetch all custom values for a task
export async function GET(req, { params }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('task_custom_values')
    .select('field_id, value')
    .eq('task_id', params.taskId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return as { fieldId: value } map
  const map = {}
  for (const row of data) map[row.field_id] = row.value
  return NextResponse.json(map)
}

// PUT — upsert a single custom value { fieldId, value }
export async function PUT(req, { params }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fieldId, value } = await req.json()

  const { error } = await supabase
    .from('task_custom_values')
    .upsert(
      { task_id: params.taskId, field_id: fieldId, value, updated_at: new Date().toISOString() },
      { onConflict: 'task_id,field_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
