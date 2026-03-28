import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

// Verify user is a member of the board, return { user, role } or null
async function getBoardAccess(boardId, requiredRole = null) {
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
  if (requiredRole && membership.role !== requiredRole) return null
  return { user, role: membership.role, admin }
}

// PATCH /api/boards/[boardId] — update board name/description/color
export async function PATCH(request, { params }) {
  const access = await getBoardAccess(params.boardId, 'owner')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, color, settings } = await request.json()
  const updates = {}
  if (name !== undefined) updates.name = name.trim()
  if (description !== undefined) updates.description = description?.trim() || null
  if (color !== undefined) updates.color = color
  if (settings !== undefined) updates.settings = settings

  const { data, error } = await access.admin
    .from('boards')
    .update(updates)
    .eq('id', params.boardId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// DELETE /api/boards/[boardId] — delete board (owner only)
export async function DELETE(request, { params }) {
  const access = await getBoardAccess(params.boardId, 'owner')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await access.admin
    .from('boards')
    .delete()
    .eq('id', params.boardId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
