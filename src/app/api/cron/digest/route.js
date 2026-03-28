import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// GET /api/cron/digest  → called daily by Vercel cron
// Sends each user a summary of their tasks due today or tomorrow
export async function GET(request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ skipped: true, reason: 'RESEND_API_KEY not configured' })
  }

  const admin = createAdminSupabaseClient()
  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10)

  // Find tasks due today or tomorrow that aren't done
  const { data: tasks } = await admin
    .from('tasks')
    .select('*, assignee:assigned_to(id,full_name,email), board:board_id(name)')
    .in('due_date', [today, tomorrow])
    .neq('status', 'done')
    .not('assigned_to', 'is', null)

  if (!tasks || tasks.length === 0) return NextResponse.json({ sent: 0 })

  // Group by assignee
  const byUser = {}
  for (const t of tasks) {
    if (!t.assignee?.email) continue
    const key = t.assignee.email
    if (!byUser[key]) byUser[key] = { name: t.assignee.full_name || t.assignee.email, email: key, tasks: [] }
    byUser[key].tasks.push(t)
  }

  let sent = 0
  for (const { name, email, tasks: userTasks } of Object.values(byUser)) {
    const todayTasks = userTasks.filter(t => t.due_date === today)
    const tomorrowTasks = userTasks.filter(t => t.due_date === tomorrow)

    const rows = (label, list) => list.length === 0 ? '' : `
      <h3 style="margin:16px 0 8px;color:#374151;">${label}</h3>
      <ul style="margin:0;padding:0 0 0 20px;">
        ${list.map(t => `<li style="margin:4px 0;"><strong>${t.title}</strong> — <span style="color:#6b7280;">${t.board?.name || 'Board'}</span></li>`).join('')}
      </ul>`

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#111827;">Hi ${name} 👋</h2>
        <p style="color:#6b7280;">Here's your task digest for today.</p>
        ${rows('Due Today', todayTasks)}
        ${rows('Due Tomorrow', tomorrowTasks)}
        <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;" />
        <p style="font-size:12px;color:#9ca3af;">
          You're receiving this because you have assigned tasks in TeamBoard.
          <a href="${process.env.NEXT_PUBLIC_URL || 'https://teamboard-amber.vercel.app'}/dashboard">View all tasks →</a>
        </p>
      </div>`

    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM || 'TeamBoard <noreply@teamboard-amber.vercel.app>',
        to: email,
        subject: `📋 Your tasks for ${today} — TeamBoard`,
        html,
      })
      sent++
    } catch (e) {
      console.error('Digest email failed for', email, e.message)
    }
  }

  return NextResponse.json({ sent })
}
