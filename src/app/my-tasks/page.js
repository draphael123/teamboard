import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import Sidebar from '@/components/Sidebar'
import MyTasksClient from './MyTasksClient'

export const metadata = { title: 'My Tasks — TeamBoard' }

export default async function MyTasksPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminSupabaseClient()

  const [{ data: profile }, { data: memberships }, { data: tasks }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    admin.from('board_members').select('role, boards(*)').eq('user_id', user.id),
    admin.from('tasks')
      .select('*, board:board_id(id,name,color), assignee:assigned_to(id,full_name,email), creator:created_by(id,full_name,email)')
      .eq('assigned_to', user.id)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }),
  ])

  const boards = (memberships || []).map(m => ({ ...m.boards, userRole: m.role }))

  return (
    <div className="flex min-h-screen">
      <Sidebar boards={boards} user={profile} />
      <main className="flex-1 ml-[260px]">
        <MyTasksClient tasks={tasks || []} currentUser={profile} />
      </main>
    </div>
  )
}
