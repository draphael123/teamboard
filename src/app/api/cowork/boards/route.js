/**
 * Cowork API — Boards
 * GET  /api/cowork/boards         → list all boards
 * POST /api/cowork/boards         → create a board
 *
 * Authentication: Bearer token using COWORK_API_KEY env var
 */
import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

function authorized(req) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace('Bearer ', '')
  return token === process.env.COWORK_API_KEY
}

export async function GET(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminSupabaseClient()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')

  let query = supabase.from('boards').select(`
    id, name, description, color, created_at, updated_at,
    created_by,
    board_members(user_id, role, profiles(id, full_name, email)),
    tasks(id, title, status, priority, assigned_to, due_date)
  `).order('created_at', { ascending: false })

  if (userId) {
    // Filter boards by member
    const { data: memberships } = await supabase
      .from('board_members')
      .select('board_id')
      .eq('user_id', userId)
    const ids = (memberships || []).map(m => m.board_id)
    query = query.in('id', ids)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ boards: data, count: data.length })
}

export async function POST(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminSupabaseClient()
  const body = await req.json()
  const { name, description, color, created_by } = body

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!created_by) return NextResponse.json({ error: 'created_by (user_id) is required' }, { status: 400 })

  const { data: board, error } = await supabase
    .from('boards')
    .insert({ name, description, color: color || '#2952ff', created_by })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-add creator as owner
  await supabase.from('board_members').insert({ board_id: board.id, user_id: created_by, role: 'owner' })

  return NextResponse.json({ board }, { status: 201 })
}
