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

// POST — create a new board from a template
export async function POST(req, { params }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json().catch(() => ({}))
  const admin = adminClient()

  // Fetch template
  const { data: tmpl } = await admin
    .from('boards')
    .select('*, columns(*)')
    .eq('id', params.templateId)
    .eq('is_template', true)
    .single()

  if (!tmpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  // Create new board
  const { data: newBoard, error: boardErr } = await admin
    .from('boards')
    .insert({
      name: name || tmpl.template_name || tmpl.name.replace(' (Template)', ''),
      owner_id: user.id,
      is_template: false,
    })
    .select()
    .single()

  if (boardErr) return NextResponse.json({ error: boardErr.message }, { status: 500 })

  // Copy columns
  if (tmpl.columns?.length) {
    await admin.from('columns').insert(
      tmpl.columns.map(col => ({
        board_id: newBoard.id,
        name: col.name,
        position: col.position,
        color: col.color,
        wip_limit: col.wip_limit,
      }))
    )
  }

  // Add owner as member
  await admin.from('board_members').insert({ board_id: newBoard.id, user_id: user.id, role: 'owner' })

  return NextResponse.json(newBoard, { status: 201 })
}
