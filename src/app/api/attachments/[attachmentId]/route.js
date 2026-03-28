import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

// DELETE /api/attachments/[attachmentId]
export async function DELETE(request, { params }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminSupabaseClient()

  // Get attachment (only uploader or board owner can delete)
  const { data: att, error: fetchErr } = await admin
    .from('task_attachments')
    .select('storage_path, uploaded_by, board_id')
    .eq('id', params.attachmentId)
    .single()

  if (fetchErr || !att) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check permission
  const { data: membership } = await admin
    .from('board_members').select('role').eq('board_id', att.board_id).eq('user_id', user.id).single()
  const canDelete = att.uploaded_by === user.id || membership?.role === 'owner'
  if (!canDelete) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Delete from storage
  await admin.storage.from('task-attachments').remove([att.storage_path])

  // Delete DB record
  await admin.from('task_attachments').delete().eq('id', params.attachmentId)

  return NextResponse.json({ success: true })
}
