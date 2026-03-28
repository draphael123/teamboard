import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

// GET /api/search?q=query&limit=20
export async function GET(request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  const admin = createAdminSupabaseClient()

  // Get user's board IDs
  const { data: memberships } = await admin
    .from('board_members').select('board_id').eq('user_id', user.id)
  const boardIds = (memberships || []).map(m => m.board_id)
  if (boardIds.length === 0) return NextResponse.json([])

  // Search tasks by title or description
  const { data, error } = await admin
    .from('tasks')
    .select('id, title, status, priority, due_date, board_id, boards(id, name, color)')
    .in('board_id', boardIds)
    .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(Number(searchParams.get('limit') || 20))

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data || [])
}
