import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

// GET — list custom fields for board
export async function GET(req, { params }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('custom_fields')
    .select('*')
    .eq('board_id', params.boardId)
    .order('position')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — create a new custom field (owner only)
export async function POST(req, { params }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify owner
  const { data: board } = await supabase
    .from('boards')
    .select('owner_id')
    .eq('id', params.boardId)
    .single()

  if (board?.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, field_type, options = [] } = body

  if (!name || !field_type) {
    return NextResponse.json({ error: 'name and field_type required' }, { status: 400 })
  }

  // Get max position
  const { data: existing } = await supabase
    .from('custom_fields')
    .select('position')
    .eq('board_id', params.boardId)
    .order('position', { ascending: false })
    .limit(1)

  const position = existing?.[0] ? existing[0].position + 1 : 0

  const { data, error } = await supabase
    .from('custom_fields')
    .insert({ board_id: params.boardId, name, field_type, options, position })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
