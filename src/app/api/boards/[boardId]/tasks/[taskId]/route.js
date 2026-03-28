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

async function logActivity(admin, { taskId, boardId, userId, action, field, oldValue, newValue }) {
  try {
    await admin.from('task_activity').insert({
      task_id: taskId, board_id: boardId, user_id: userId,
      action, field: field || null,
      old_value: oldValue != null ? String(oldValue) : null,
      new_value: newValue != null ? String(newValue) : null,
    })
  } catch (_) { /* non-fatal */ }
}

// PATCH /api/boards/[boardId]/tasks/[taskId]
export async function PATCH(request, { params }) {
  const access = await getBoardAccess(params.boardId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.role === 'viewer') return NextResponse.json({ error: 'Viewers cannot edit tasks' }, { status: 403 })

  const updates = await request.json()

  // Fetch current task to diff
  const { data: oldTask } = await access.admin
    .from('tasks')
    .select('status, assigned_to, priority, title')
    .eq('id', params.taskId)
    .single()

  // Strip protected fields
  delete updates.id; delete updates.board_id; delete updates.created_by; delete updates.created_at

  // Set completed_at when moving to done
  if (updates.status === 'done' && oldTask?.status !== 'done') {
    updates.completed_at = new Date().toISOString()
  } else if (updates.status && updates.status !== 'done' && oldTask?.status === 'done') {
    updates.completed_at = null // un-completing
  }

  const { data, error } = await access.admin
    .from('tasks')
    .update(updates)
    .eq('id', params.taskId)
    .eq('board_id', params.boardId)
    .select('*, assignee:assigned_to(id,full_name,email), creator:created_by(id,full_name,email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Log meaningful changes
  if (oldTask) {
    const base = { taskId: params.taskId, boardId: params.boardId, userId: access.user.id }
    if (updates.status && updates.status !== oldTask.status) {
      await logActivity(access.admin, { ...base, action: 'moved', field: 'status', oldValue: oldTask.status, newValue: updates.status })
    }
    if ('assigned_to' in updates && updates.assigned_to !== oldTask.assigned_to) {
      await logActivity(access.admin, { ...base, action: 'assigned', field: 'assigned_to', oldValue: oldTask.assigned_to, newValue: updates.assigned_to })
    }
    if (updates.priority && updates.priority !== oldTask.priority) {
      await logActivity(access.admin, { ...base, action: 'updated', field: 'priority', oldValue: oldTask.priority, newValue: updates.priority })
    }
    if (updates.title && updates.title !== oldTask.title) {
      await logActivity(access.admin, { ...base, action: 'updated', field: 'title', oldValue: oldTask.title, newValue: updates.title })
    }
  }

  return NextResponse.json(data)
}

// DELETE /api/boards/[boardId]/tasks/[taskId]
export async function DELETE(request, { params }) {
  const access = await getBoardAccess(params.boardId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.role === 'viewer') return NextResponse.json({ error: 'Viewers cannot delete tasks' }, { status: 403 })

  const { error } = await access.admin
    .from('tasks')
    .delete()
    .eq('id', params.taskId)
    .eq('board_id', params.boardId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
