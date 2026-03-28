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

// GET — all tasks assigned to current user across all boards
export async function GET(req) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const statusFilter = url.searchParams.get('status') // optional: filter by status
  const dueSoon = url.searchParams.get('due_soon') === 'true' // tasks due in next 7 days

  let query = supabase
    .from('tasks')
    .select(`
      id, title, status, priority, due_date, labels, votes,
      board_id,
      boards!inner(id, name),
      columns!inner(id, name)
    `)
    .eq('assigned_to', user.id)
    .eq('boards.is_template', false)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(200)

  if (statusFilter) query = query.eq('status', statusFilter)

  if (dueSoon) {
    const today = new Date().toISOString().slice(0, 10)
    const week = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    query = query.gte('due_date', today).lte('due_date', week)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by board
  const byBoard = {}
  for (const task of data || []) {
    const bid = task.board_id
    if (!byBoard[bid]) {
      byBoard[bid] = { board: task.boards, tasks: [] }
    }
    byBoard[bid].tasks.push({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date,
      labels: task.labels,
      votes: task.votes,
      column: task.columns,
    })
  }

  return NextResponse.json(Object.values(byBoard))
}
