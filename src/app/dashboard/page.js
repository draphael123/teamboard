import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import Sidebar from '@/components/Sidebar'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminSupabaseClient()

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    admin.from('board_members').select('role, boards(*)').eq('user_id', user.id).order('joined_at', { ascending: false }),
  ])

  const boards = (memberships || []).map(m => ({ ...m.boards, userRole: m.role }))
  const boardIds = boards.map(b => b.id).filter(Boolean)

  // Fetch task counts per board for progress bars
  let taskCountsByBoard = {}
  if (boardIds.length > 0) {
    const { data: taskRows } = await admin
      .from('tasks')
      .select('board_id, status')
      .in('board_id', boardIds)

    ;(taskRows || []).forEach(t => {
      if (!taskCountsByBoard[t.board_id]) {
        taskCountsByBoard[t.board_id] = { todo: 0, in_progress: 0, done: 0 }
      }
      if (taskCountsByBoard[t.board_id][t.status] !== undefined) {
        taskCountsByBoard[t.board_id][t.status]++
      }
    })
  }

  const boardsWithCounts = boards.map(b => ({
    ...b,
    taskCounts: taskCountsByBoard[b.id] || { todo: 0, in_progress: 0, done: 0 },
  }))

  return (
    <div className="flex min-h-screen">
      <Sidebar boards={boards} user={profile} />
      <main className="flex-1 ml-[260px]">
        <DashboardClient boards={boardsWithCounts} user={profile} />
      </main>
    </div>
  )
}
