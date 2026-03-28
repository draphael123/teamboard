import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

async function getBoardAccess(boardId, requiredRole = null) {
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
  if (requiredRole && membership.role !== requiredRole) return null
  return { user, role: membership.role, admin }
}

// GET /api/boards/[boardId]/fields
export async function GET(request, { params }) {
  const access = await getBoardAccess(params.boardId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await access.admin
    .from('board_fields')
    .select('*')
    .eq('board_id', params.boardId)
    .order('position', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data || [])
}

// POST /api/boards/[boardId]/fields — create a new custom field
export async function POST(request, { params }) {
  const access = await getBoardAccess(params.boardId, 'owner')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, field_type = 'text', options = [] } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const validTypes = ['text', 'number', 'select', 'date', 'checkbox', 'url']
  if (!validTypes.includes(field_type)) {
    return NextResponse.json({ error: 'Invalid field type' }, { status: 400 })
  }

  // Get current max position
  const { data: existing } = await access.admin
    .from('board_fields')
    .select('position')
    .eq('board_id', params.boardId)
    .order('position', { ascending: false })
    .limit(1)

  const position = existing?.length > 0 ? (existing[0].position ?? 0) + 1 : 0

  const { data, error } = await access.admin
    .from('board_fields')
    .insert({ board_id: params.boardId, name: name.trim(), field_type, options, position })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
