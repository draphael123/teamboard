import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// POST /api/inbox/[inboxToken]
// Called by Resend inbound email webhook when an email arrives at {inbox_token}@inbound.resend.dev
// Payload: { from, subject, text, html, to }
export async function POST(request, { params }) {
  const admin = createAdminSupabaseClient()

  // Look up board by inbox token
  const { data: board, error: bErr } = await admin
    .from('boards')
    .select('id, created_by')
    .eq('inbox_token', params.inboxToken)
    .single()

  if (bErr || !board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid payload' }, { status: 400 }) }

  const subject = body.subject || '(No subject)'
  const description = body.text || body.html?.replace(/<[^>]*>/g, '') || ''

  // Create task assigned to nobody, in To Do column
  const { data: task, error: tErr } = await admin
    .from('tasks')
    .insert({
      board_id: board.id,
      created_by: board.created_by, // attribute to board owner
      title: subject.substring(0, 200),
      description: description.substring(0, 2000),
      status: 'todo',
      priority: 'medium',
    })
    .select('id, title')
    .single()

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 400 })

  // Log activity
  await admin.from('task_activity').insert({
    task_id: task.id,
    board_id: board.id,
    user_id: board.created_by,
    action: 'created',
    new_value: `via email from ${body.from || 'unknown'}`,
  }).catch(() => {})

  return NextResponse.json({ task_id: task.id, title: task.title })
}
