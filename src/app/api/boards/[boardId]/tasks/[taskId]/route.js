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

// Fire outbound webhook (non-blocking)
async function fireWebhook(webhookUrl, payload) {
  if (!webhookUrl) return
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TeamBoard-Event': payload.event },
      body: JSON.stringify(payload),
    })
  } catch (_) { /* non-fatal */ }
}

// Create in-app notification for a user
async function createNotification(admin, { userId, boardId, taskId, type, message }) {
  if (!userId) return
  try {
    await admin.from('notifications').insert({ user_id: userId, board_id: boardId, task_id: taskId, type, message })
  } catch (_) { /* non-fatal */ }
}

// PATCH /api/boards/[boardId]/tasks/[taskId]
export async function PATCH(request, { params }) {
  const access = await getBoardAccess(params.boardId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.role === 'viewer') return NextResponse.json({ error: 'Viewers cannot edit tasks' }, { status: 403 })

  const updates = await request.json()

  // Fetch current task + board (for webhook URL)
  const { data: oldTask } = await access.admin
    .from('tasks')
    .select('status, assigned_to, priority, title, recur_rule, due_date, blocked_by')
    .eq('id', params.taskId)
    .single()

  const { data: board } = await access.admin
    .from('boards')
    .select('name, webhook_url')
    .eq('id', params.boardId)
    .single()

  // Strip protected fields
  delete updates.id; delete updates.board_id; delete updates.created_by; delete updates.created_at

  // Set completed_at when moving to done
  if (updates.status === 'done' && oldTask?.status !== 'done') {
    updates.completed_at = new Date().toISOString()
  } else if (updates.status && updates.status !== 'done' && oldTask?.status === 'done') {
    updates.completed_at = null
  }

  const { data, error } = await access.admin
    .from('tasks')
    .update(updates)
    .eq('id', params.taskId)
    .eq('board_id', params.boardId)
    .select('*, assignee:assigned_to(id,full_name,email), creator:created_by(id,full_name,email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Recurring task: when moved to done, clone for next occurrence
  if (updates.status === 'done' && oldTask?.status !== 'done' && oldTask?.recur_rule) {
    const nextDue = computeNextDue(oldTask.due_date, oldTask.recur_rule)
    await access.admin.from('tasks').insert({
      board_id: params.boardId,
      created_by: access.user.id,
      title: data.title,
      description: data.description,
      priority: data.priority,
      assigned_to: data.assigned_to,
      labels: data.labels,
      subtasks: (data.subtasks || []).map(s => ({ ...s, completed: false })),
      recur_rule: oldTask.recur_rule,
      due_date: nextDue,
      status: 'todo',
    }).catch(() => {})
  }

  // Log meaningful changes
  if (oldTask) {
    const base = { taskId: params.taskId, boardId: params.boardId, userId: access.user.id }
    if (updates.status && updates.status !== oldTask.status) {
      await logActivity(access.admin, { ...base, action: 'moved', field: 'status', oldValue: oldTask.status, newValue: updates.status })
    }
    if ('assigned_to' in updates && updates.assigned_to !== oldTask.assigned_to) {
      await logActivity(access.admin, { ...base, action: 'assigned', field: 'assigned_to', oldValue: oldTask.assigned_to, newValue: updates.assigned_to })
      // Notify newly assigned user
      if (updates.assigned_to && updates.assigned_to !== access.user.id) {
        await createNotification(access.admin, {
          userId: updates.assigned_to,
          boardId: params.boardId,
          taskId: params.taskId,
          type: 'assignment',
          message: `You were assigned to "${oldTask.title}" on board "${board?.name}"`,
        })
      }
    }
    if (updates.priority && updates.priority !== oldTask.priority) {
      await logActivity(access.admin, { ...base, action: 'updated', field: 'priority', oldValue: oldTask.priority, newValue: updates.priority })
    }
    if (updates.title && updates.title !== oldTask.title) {
      await logActivity(access.admin, { ...base, action: 'updated', field: 'title', oldValue: oldTask.title, newValue: updates.title })
    }
  }

  // Fire outbound webhook (non-blocking)
  fireWebhook(board?.webhook_url, {
    event: 'task.updated',
    board_id: params.boardId,
    board_name: board?.name,
    task: {
      id: data.id,
      title: data.title,
      status: data.status,
      priority: data.priority,
      assigned_to: data.assigned_to,
    },
    changes: updates,
    actor_id: access.user.id,
    timestamp: new Date().toISOString(),
  })

  return NextResponse.json(data)
}

function computeNextDue(currentDue, rule) {
  const base = currentDue ? new Date(currentDue) : new Date()
  if (rule === 'daily')   base.setDate(base.getDate() + 1)
  else if (rule === 'weekly')  base.setDate(base.getDate() + 7)
  else if (rule === 'monthly') base.setMonth(base.getMonth() + 1)
  return base.toISOString().slice(0, 10)
}

// DELETE /api/boards/[boardId]/tasks/[taskId]
export async function DELETE(request, { params }) {
  const access = await getBoardAccess(params.boardId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.role === 'viewer') return NextResponse.json({ error: 'Viewers cannot delete tasks' }, { status: 403 })

  // Fetch task + board for webhook
  const { data: task } = await access.admin
    .from('tasks')
    .select('title, assigned_to')
    .eq('id', params.taskId)
    .single()

  const { data: board } = await access.admin
    .from('boards')
    .select('name, webhook_url')
    .eq('id', params.boardId)
    .single()

  const { error } = await access.admin
    .from('tasks')
    .delete()
    .eq('id', params.taskId)
    .eq('board_id', params.boardId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Fire webhook
  fireWebhook(board?.webhook_url, {
    event: 'task.deleted',
    board_id: params.boardId,
    board_name: board?.name,
    task: { id: params.taskId, title: task?.title },
    actor_id: access.user.id,
    timestamp: new Date().toISOString(),
  })

  return NextResponse.json({ success: true })
}
