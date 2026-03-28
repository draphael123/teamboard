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

// PATCH /api/boards/[boardId]/tasks/[taskId]
export async function PATCH(request, { params }) {
  const access = await getBoardAccess(params.boardId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.role === 'viewer') return NextResponse.json({ error: 'Viewers cannot edit tasks' }, { status: 403 })

  const updates = await request.json()

  // Strip protected fields
  delete updates.id
  delete updates.board_id
  delete updates.created_by
  delete updates.created_at

  const { data, error } = await access.admin
    .from('tasks')
    .update(updates)
    .eq('id', params.taskId)
    .eq('board_id', params.boardId)
    .select('*, assignee:assigned_to(id,full_name,email), creator:created_by(id,full_name,email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
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
