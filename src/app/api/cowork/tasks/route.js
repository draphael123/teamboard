/**
 * Cowork API — Tasks
 * GET  /api/cowork/tasks               → list tasks (filter by board_id, status, assigned_to)
 * POST /api/cowork/tasks               → create a task
 *
 * Authentication: Bearer token using COWORK_API_KEY env var
 */
import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

function authorized(req) {
  const auth = req.headers.get('authorization') || ''
  return auth.replace('Bearer ', '') === process.env.COWORK_API_KEY
}

export async function GET(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminSupabaseClient()
  const { searchParams } = new URL(req.url)

  let query = supabase.from('tasks').select(`
    id, title, description, status, priority, due_date, created_at, updated_at,
    board_id,
    assignee:assigned_to(id, full_name, email),
    creator:created_by(id, full_name, email),
    boards(id, name)
  `).order('created_at', { ascending: false })

  if (searchParams.get('board_id'))   query = query.eq('board_id',   searchParams.get('board_id'))
  if (searchParams.get('status'))     query = query.eq('status',     searchParams.get('status'))
  if (searchParams.get('priority'))   query = query.eq('priority',   searchParams.get('priority'))
  if (searchParams.get('assigned_to'))query = query.eq('assigned_to',searchParams.get('assigned_to'))
  if (searchParams.get('due_before')) query = query.lte('due_date',  searchParams.get('due_before'))
  if (searchParams.get('due_after'))  query = query.gte('due_date',  searchParams.get('due_after'))

  const limit = parseInt(searchParams.get('limit') || '100')
  query = query.limit(limit)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    tasks: data,
    count: data.length,
    filters: Object.fromEntries(searchParams.entries()),
  })
}

export async function POST(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminSupabaseClient()
  const body = await req.json()
  const { board_id, title, description, status, priority, assigned_to, due_date, created_by } = body

  if (!board_id) return NextResponse.json({ error: 'board_id is required' }, { status: 400 })
  if (!title)    return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      board_id,
      title,
      description: description || null,
      status: status || 'todo',
      priority: priority || 'medium',
      assigned_to: assigned_to || null,
      due_date: due_date || null,
      created_by: created_by || null,
    })
    .select(`
      id, title, description, status, priority, due_date, created_at,
      assignee:assigned_to(id, full_name, email),
      creator:created_by(id, full_name, email)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task }, { status: 201 })
}
