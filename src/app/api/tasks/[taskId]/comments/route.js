import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

async function getTaskAccess(taskId) {
  const supabase = createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return null

  const admin = createAdminSupabaseClient()

  const { data: task } = await admin
    .from('tasks')
    .select('id, board_id')
    .eq('id', taskId)
    .single()

  if (!task) return null

  const { data: membership } = await admin
    .from('board_members')
    .select('role')
    .eq('board_id', task.board_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) return null
  return { user, role: membership.role, admin, task }
}

// GET /api/tasks/[taskId]/comments
export async function GET(request, { params }) {
  const access = await getTaskAccess(params.taskId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await access.admin
    .from('comments')
    .select('*, author:user_id(id,full_name,email)')
    .eq('task_id', params.taskId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// POST /api/tasks/[taskId]/comments
export async function POST(request, { params }) {
  const access = await getTaskAccess(params.taskId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content } = await request.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Content is required' }, { status: 400 })

  const { data, error } = await access.admin
    .from('comments')
    .insert({ task_id: params.taskId, user_id: access.user.id, content: content.trim() })
    .select('*, author:user_id(id,full_name,email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Log comment activity
  try {
    await access.admin.from('task_activity').insert({
      task_id: params.taskId, board_id: access.task.board_id,
      user_id: access.user.id, action: 'commented',
    })
  } catch (_) {}

  // Parse @mentions: find all @Name patterns, look up board members by name, notify
  const mentions = (content.match(/@([\w\s]+?)(?=\s|$|[^\w\s])/g) || [])
    .map(m => m.slice(1).trim())

  if (mentions.length > 0) {
    try {
      // Get all board members' profiles
      const { data: members } = await access.admin
        .from('board_members')
        .select('user_id, profiles(id, full_name, email)')
        .eq('board_id', access.task.board_id)

      const mentionedUserIds = (members || [])
        .filter(m => {
          const name = m.profiles?.full_name || m.profiles?.email || ''
          return mentions.some(mention =>
            name.toLowerCase().includes(mention.toLowerCase()) ||
            mention.toLowerCase().includes(name.toLowerCase().split(' ')[0])
          )
        })
        .map(m => m.user_id)
        .filter(uid => uid !== access.user.id) // don't notify yourself

      if (mentionedUserIds.length > 0) {
        const { data: task } = await access.admin
          .from('tasks')
          .select('title')
          .eq('id', params.taskId)
          .single()

        await access.admin.from('notifications').insert(
          mentionedUserIds.map(uid => ({
            user_id: uid,
            type: 'mention',
            title: `You were mentioned in a comment`,
            body: `On "${task?.title || 'a task'}": ${content.slice(0, 80)}${content.length > 80 ? '…' : ''}`,
            task_id: params.taskId,
            board_id: access.task.board_id,
          }))
        )
      }
    } catch (_) { /* non-fatal */ }
  }

  return NextResponse.json(data, { status: 201 })
}
