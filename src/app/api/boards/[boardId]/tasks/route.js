import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

async function getBoardAccess(boardId) {
  const supabase = createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return null

  const admin = createAdminSupabaseClient()
  const { data: membership } = await admin
    .from('board_members')
    .select('role')
    .eq('board_id', boardId)
    .eq('user_id', user.id)
    .single()

  if (!membership) return null
  return { user, role: membership.role, admin }
}

// GET /api/boards/[boardId]/tasks — fetch tasks (for polling)
export async function GET(request, { params }) {
  const access = await getBoardAccess(params.boardId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await access.admin
    .from('tasks')
    .select('*, assignee:assigned_to(id,full_name,email), creator:created_by(id,full_name,email)')
    .eq('board_id', params.boardId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// POST /api/boards/[boardId]/tasks — create task
export async function POST(request, { params }) {
  const access = await getBoardAccess(params.boardId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (access.role === 'viewer') {
    return NextResponse.json({ error: 'Viewers cannot create tasks' }, { status: 403 })
  }

  const { title, description, status, priority, assigned_to, due_date } = await request.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const { data, error } = await access.admin
    .from('tasks')
    .insert({
      board_id: params.boardId,
      title: title.trim(),
      description: description?.trim() || null,
      status: status || 'todo',
      priority: priority || 'medium',
      assigned_to: assigned_to || null,
      due_date: due_date || null,
      created_by: access.user.id,
    })
    .select('*, assignee:assigned_to(id,full_name,email), creator:created_by(id,full_name,email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
