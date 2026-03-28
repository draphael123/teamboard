import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

export async function POST(request) {
  // Verify session server-side via cookies (bypasses PostgREST JWT issues)
  const supabase = createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, description, color } = await request.json()

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Board name is required' }, { status: 400 })
  }

  // Use admin client to bypass RLS for mutations (user is already verified above)
  const admin = createAdminSupabaseClient()

  // Insert board
  const { data: board, error: boardErr } = await admin
    .from('boards')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      color: color || '#2952ff',
      created_by: user.id,
    })
    .select()
    .single()

  if (boardErr) {
    return NextResponse.json({ error: boardErr.message }, { status: 400 })
  }

  // Insert creator as owner in board_members
  const { error: memberErr } = await admin
    .from('board_members')
    .insert({ board_id: board.id, user_id: user.id, role: 'owner' })

  if (memberErr) {
    // Rollback board if member insert fails
    await admin.from('boards').delete().eq('id', board.id)
    return NextResponse.json({ error: memberErr.message }, { status: 400 })
  }

  return NextResponse.json(board, { status: 201 })
}
