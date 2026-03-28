import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// GET /api/public/[token]  → no auth required, read-only board data
export async function GET(request, { params }) {
  const admin = createAdminSupabaseClient()

  const { data: board, error: bErr } = await admin
    .from('boards')
    .select('id, name, description, color, created_at')
    .eq('public_token', params.token)
    .single()

  if (bErr || !board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  const { data: tasks } = await admin
    .from('tasks')
    .select('*, assignee:assigned_to(id,full_name,email), creator:created_by(id,full_name,email)')
    .eq('board_id', board.id)
    .order('created_at', { ascending: true })

  const { data: members } = await admin
    .from('board_members')
    .select('role, user:user_id(id,full_name,email)')
    .eq('board_id', board.id)

  return NextResponse.json({ board, tasks: tasks || [], members: (members || []).map(m => m.user) })
}
