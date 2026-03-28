import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { randomUUID } from 'crypto'

async function getOwnerAccess(boardId) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminSupabaseClient()
  const { data: m } = await admin.from('board_members').select('role').eq('board_id', boardId).eq('user_id', user.id).single()
  if (!m || m.role !== 'owner') return null
  return { user, admin }
}

// POST /api/boards/[boardId]/share  → generate/refresh public token
export async function POST(request, { params }) {
  const access = await getOwnerAccess(params.boardId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = randomUUID()
  const { data, error } = await access.admin
    .from('boards').update({ public_token: token })
    .eq('id', params.boardId).select('public_token').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ public_token: data.public_token })
}

// DELETE /api/boards/[boardId]/share  → revoke public token
export async function DELETE(request, { params }) {
  const access = await getOwnerAccess(params.boardId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await access.admin.from('boards').update({ public_token: null }).eq('id', params.boardId)
  return NextResponse.json({ success: true })
}
