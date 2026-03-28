import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

async function getTaskAccess(taskId) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminSupabaseClient()
  const { data: task } = await admin.from('tasks').select('id, board_id').eq('id', taskId).single()
  if (!task) return null

  const { data: membership } = await admin
    .from('board_members').select('role').eq('board_id', task.board_id).eq('user_id', user.id).single()
  if (!membership) return null

  return { user, admin, task }
}

// GET /api/tasks/[taskId]/activity
export async function GET(request, { params }) {
  const access = await getTaskAccess(params.taskId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await access.admin
    .from('task_activity')
    .select('*, actor:user_id(id, full_name, email)')
    .eq('task_id', params.taskId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data || [])
}
