import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

async function getBoardAccess(boardId) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

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

// PATCH /api/boards/[boardId]/fields/[fieldId]
export async function PATCH(request, { params }) {
  const access = await getBoardAccess(params.boardId)
  if (!access || access.role !== 'owner') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const updates = {}
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.options !== undefined) updates.options = body.options
  if (body.position !== undefined) updates.position = body.position

  const { data, error } = await access.admin
    .from('board_fields')
    .update(updates)
    .eq('id', params.fieldId)
    .eq('board_id', params.boardId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// DELETE /api/boards/[boardId]/fields/[fieldId]
export async function DELETE(request, { params }) {
  const access = await getBoardAccess(params.boardId)
  if (!access || access.role !== 'owner') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await access.admin
    .from('board_fields')
    .delete()
    .eq('id', params.fieldId)
    .eq('board_id', params.boardId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
