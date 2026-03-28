import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Sidebar from '@/components/Sidebar'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch boards the user is a member of
  const { data: memberships } = await supabase
    .from('board_members')
    .select('role, boards(*)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  const boards = (memberships || []).map(m => ({ ...m.boards, userRole: m.role }))

  return (
    <div className="flex min-h-screen">
      <Sidebar boards={boards} user={profile} />
      <main className="flex-1 ml-[260px]">
        <DashboardClient boards={boards} user={profile} />
      </main>
    </div>
  )
}
