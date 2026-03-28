import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
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

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// POST — save board as template (duplicates board + columns marked is_template=true)
export async function POST(req, { params }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { template_name } = await req.json().catch(() => ({}))
  const admin = adminClient()

  // Fetch source board
  const { data: board } = await admin
    .from('boards')
    .select('*, columns(*)')
    .eq('id', params.boardId)
    .single()

  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })
  if (board.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Create template board
  const { data: tmpl, error: tmplErr } = await admin
    .from('boards')
    .insert({
      name: template_name || `${board.name} (Template)`,
      owner_id: user.id,
      is_template: true,
      template_name: template_name || board.name,
    })
    .select()
    .single()

  if (tmplErr) return NextResponse.json({ error: tmplErr.message }, { status: 500 })

  // Copy columns (no tasks)
  if (board.columns?.length) {
    await admin.from('columns').insert(
      board.columns.map(col => ({
        board_id: tmpl.id,
        name: col.name,
        position: col.position,
        color: col.color,
        wip_limit: col.wip_limit,
      }))
    )
  }

  // Add owner as member
  await admin.from('board_members').insert({ board_id: tmpl.id, user_id: user.id, role: 'owner' })

  return NextResponse.json(tmpl, { status: 201 })
}
