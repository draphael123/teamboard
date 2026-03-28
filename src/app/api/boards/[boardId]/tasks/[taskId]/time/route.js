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

// GET — list time entries for a task
export async function GET(req, { params }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { taskId, boardId } = params

  const { data, error } = await supabase
    .from('time_entries')
    .select('id, started_at, ended_at, seconds, note, user_id')
    .eq('task_id', taskId)
    .order('started_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — start a new timer (or log a manual entry)
export async function POST(req, { params }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { taskId, boardId } = params
  const body = await req.json().catch(() => ({}))

  // Stop any running timer for this user on this task first
  await supabase
    .from('time_entries')
    .update({ ended_at: new Date().toISOString() })
    .eq('task_id', taskId)
    .eq('user_id', user.id)
    .is('ended_at', null)

  const entryData = {
    task_id: taskId,
    board_id: boardId,
    user_id: user.id,
    started_at: body.started_at || new Date().toISOString(),
    note: body.note || null,
  }

  // If manual entry with seconds, set ended_at = started_at + seconds
  if (body.seconds) {
    const start = new Date(entryData.started_at)
    entryData.ended_at = new Date(start.getTime() + body.seconds * 1000).toISOString()
  }

  const { data, error } = await supabase
    .from('time_entries')
    .insert(entryData)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
