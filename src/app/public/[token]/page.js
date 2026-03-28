import { notFound } from 'next/navigation'
import PublicBoardView from './PublicBoardView'

export const dynamic = 'force-dynamic'

export default async function PublicBoardPage({ params }) {
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://teamboard-amber.vercel.app'
  const res = await fetch(`${baseUrl}/api/public/${params.token}`, { cache: 'no-store' })

  if (!res.ok) notFound()

  const { board, tasks, members } = await res.json()
  return <PublicBoardView board={board} tasks={tasks} members={members} />
}
