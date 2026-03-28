import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

async function getTaskAccess(taskId) {
  const supabase = createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return null

  const admin = createAdminSupabaseClient()

  // Get the task to find its board
  const { data: task } = await admin
    .from('tasks')
    .select('id, board_id')
    .eq('id', taskId)
    .single()

  if (!task) return null

  // Verify user is a member of the board
  const { data: membership } = await admin
    .from('board_members')
    .select('role')
    .eq('board_id', task.board_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) return null
  return { user, role: membership.role, admin, task }
}

// GET /api/tasks/[taskId]/comments
export async function GET(request, { params }) {
  const access = await getTaskAccess(params.taskId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await access.admin
    .from('comments')
    .select('*, author:user_id(id,full_name,email)')
    .eq('task_id', params.taskId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// POST /api/tasks/[taskId]/comments
export async function POST(request, { params }) {
  const access = await getTaskAccess(params.taskId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content } = await request.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Content is required' }, { status: 400 })

  const { data, error } = await access.admin
    .from('comments')
    .insert({ task_id: params.taskId, user_id: access.user.id, content: content.trim() })
    .select('*, author:user_id(id,full_name,email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
