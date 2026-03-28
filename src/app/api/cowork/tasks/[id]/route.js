/**
 * Cowork API — Single Task
 * GET    /api/cowork/tasks/:id    → get task details + comments
 * PATCH  /api/cowork/tasks/:id    → update task fields
 * DELETE /api/cowork/tasks/:id    → delete task
 *
 * Authentication: Bearer token using COWORK_API_KEY env var
 */
import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

function authorized(req) {
  const auth = req.headers.get('authorization') || ''
  return auth.replace('Bearer ', '') === process.env.COWORK_API_KEY
}

export async function GET(req, { params }) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminSupabaseClient()
  const [{ data: task }, { data: comments }] = await Promise.all([
    supabase.from('tasks')
      .select(`
        id, title, description, status, priority, due_date, created_at, updated_at, board_id,
        assignee:assigned_to(id, full_name, email),
        creator:created_by(id, full_name, email),
        boards(id, name)
      `)
      .eq('id', params.id)
      .single(),
    supabase.from('comments')
      .select('id, content, created_at, author:user_id(id, full_name, email)')
      .eq('task_id', params.id)
      .order('created_at', { ascending: true }),
  ])

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  return NextResponse.json({ task: { ...task, comments: comments || [] } })
}

export async function PATCH(req, { params }) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminSupabaseClient()
  const body = await req.json()

  // Whitelist updatable fields
  const allowed = ['title','description','status','priority','assigned_to','due_date']
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'No valid fields to update. Allowed: ' + allowed.join(', ') }, { status: 400 })

  const { data: task, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', params.id)
    .select(`
      id, title, description, status, priority, due_date, updated_at, board_id,
      assignee:assigned_to(id, full_name, email)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  return NextResponse.json({ task, updated_fields: Object.keys(updates) })
}

export async function DELETE(req, { params }) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('tasks').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true, id: params.id })
}
