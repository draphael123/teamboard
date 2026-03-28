import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

async function getOwnerAccess(boardId) {
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

  if (!membership || membership.role !== 'owner') return null
  return { user, admin }
}

// POST /api/boards/[boardId]/members — invite by email
export async function POST(request, { params }) {
  const access = await getOwnerAccess(params.boardId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email } = await request.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  // Look up profile by email
  const { data: profile, error: profileErr } = await access.admin
    .from('profiles')
    .select('id, full_name, email')
    .eq('email', email.trim().toLowerCase())
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'No user found with that email. They must sign up first.' }, { status: 404 })
  }

  // Check if already a member
  const { data: existing } = await access.admin
    .from('board_members')
    .select('id')
    .eq('board_id', params.boardId)
    .eq('user_id', profile.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'This user is already a member of this board.' }, { status: 409 })
  }

  const { error: memberErr } = await access.admin
    .from('board_members')
    .insert({ board_id: params.boardId, user_id: profile.id, role: 'member' })

  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 400 })
  return NextResponse.json({ success: true, user: profile }, { status: 201 })
}

// DELETE /api/boards/[boardId]/members — remove member by userId
export async function DELETE(request, { params }) {
  const access = await getOwnerAccess(params.boardId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = await request.json()
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  // Prevent removing self (owner)
  if (userId === access.user.id) {
    return NextResponse.json({ error: 'Cannot remove yourself as owner.' }, { status: 400 })
  }

  const { error } = await access.admin
    .from('board_members')
    .delete()
    .eq('board_id', params.boardId)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
