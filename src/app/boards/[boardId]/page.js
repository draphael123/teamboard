import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import Sidebar from '@/components/Sidebar'
import BoardClient from './BoardClient'

export default async function BoardPage({ params }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminSupabaseClient()

  const [{ data: profile }, { data: memberships }, { data: board }, { data: tasks }, { data: boardMembers }, { data: boardFields }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('board_members').select('role, boards(*)').eq('user_id', user.id),
      supabase.from('boards').select('*').eq('id', params.boardId).single(),
      admin.from('tasks').select('*, assignee:assigned_to(id,full_name,email), creator:created_by(id,full_name,email)')
        .eq('board_id', params.boardId).order('created_at', { ascending: true }),
      supabase.from('board_members').select('role, profiles(id,full_name,email)')
        .eq('board_id', params.boardId),
      admin.from('board_fields').select('*').eq('board_id', params.boardId)
        .order('position', { ascending: true }),
    ])

  if (!board) notFound()

  // Check user is a member
  const isMember = (memberships || []).some(m => m.boards?.id === params.boardId)
  if (!isMember) redirect('/dashboard')

  const boards = (memberships || []).map(m => ({ ...m.boards, userRole: m.role }))
  const members = (boardMembers || []).map(m => ({ ...m.profiles, role: m.role }))
  const userMembership = (memberships || []).find(m => m.boards?.id === params.boardId)
  const userRole = userMembership?.role || 'viewer'

  return (
    <div className="flex min-h-screen">
      <Sidebar boards={boards} user={profile} />
      <main className="flex-1 ml-[260px]">
        <BoardClient
          board={board}
          tasks={tasks || []}
          members={members}
          boardFields={boardFields || []}
          currentUser={profile}
          userRole={userRole}
        />
      </main>
    </div>
  )
}
