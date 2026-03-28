import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

// POST /api/boards/[boardId]/duplicate
export async function POST(request, { params }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminSupabaseClient()

  // Verify user is a member
  const { data: membership } = await admin
    .from('board_members').select('role').eq('board_id', params.boardId).eq('user_id', user.id).single()
  if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const includeTasks = body.include_tasks !== false // default true

  // Get source board
  const { data: sourceBoard } = await admin.from('boards').select('*').eq('id', params.boardId).single()
  if (!sourceBoard) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  // Create new board
  const { data: newBoard, error: boardError } = await admin
    .from('boards')
    .insert({
      name: `${sourceBoard.name} (Copy)`,
      description: sourceBoard.description,
      color: sourceBoard.color,
      settings: sourceBoard.settings || {},
      created_by: user.id,
    })
    .select()
    .single()

  if (boardError) return NextResponse.json({ error: boardError.message }, { status: 400 })

  // Add creator as owner
  await admin.from('board_members').insert({ board_id: newBoard.id, user_id: user.id, role: 'owner' })

  // Copy board fields
  const { data: fields } = await admin.from('board_fields').select('*').eq('board_id', params.boardId).order('position')
  if (fields?.length > 0) {
    await admin.from('board_fields').insert(
      fields.map(({ id: _id, board_id: _bid, created_at: _ca, ...f }) => ({ ...f, board_id: newBoard.id }))
    )
  }

  // Copy tasks (without history/comments)
  if (includeTasks) {
    const { data: tasks } = await admin
      .from('tasks').select('*').eq('board_id', params.boardId).order('created_at')
    if (tasks?.length > 0) {
      await admin.from('tasks').insert(
        tasks.map(({ id: _id, board_id: _bid, created_at: _ca, completed_at: _co, ...t }) => ({
          ...t, board_id: newBoard.id, created_by: user.id, custom_values: t.custom_values || {}
        }))
      )
    }
  }

  return NextResponse.json(newBoard, { status: 201 })
}
