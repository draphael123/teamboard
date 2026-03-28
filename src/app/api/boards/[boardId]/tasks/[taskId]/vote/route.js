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

// POST /api/boards/[boardId]/tasks/[taskId]/vote — toggle vote for current user
export async function POST(req, { params }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { taskId } = params

  // Get current votes
  const { data: task, error } = await supabase
    .from('tasks')
    .select('votes')
    .eq('id', taskId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const votes = task.votes || []
  const alreadyVoted = votes.includes(user.id)
  const newVotes = alreadyVoted
    ? votes.filter(id => id !== user.id)
    : [...votes, user.id]

  const { data: updated, error: upErr } = await supabase
    .from('tasks')
    .update({ votes: newVotes })
    .eq('id', taskId)
    .select('id, votes')
    .single()

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  return NextResponse.json({ votes: updated.votes, voted: !alreadyVoted })
}
