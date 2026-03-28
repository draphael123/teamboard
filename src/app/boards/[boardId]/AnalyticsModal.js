'use client'

import { useMemo } from 'react'
import { X, TrendingUp, CheckCircle2, Clock, AlertCircle, Users, BarChart2 } from 'lucide-react'
import { format, subWeeks, isAfter, startOfWeek } from 'date-fns'

export default function AnalyticsModal({ tasks, members, onClose }) {
  const stats = useMemo(() => {
    const total     = tasks.length
    const done      = tasks.filter(t => t.status === 'done').length
    const inProg    = tasks.filter(t => t.status === 'in_progress').length
    const todo      = tasks.filter(t => t.status === 'todo').length
    const overdue   = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length
    const withDates = tasks.filter(t => t.due_date).length
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0

    // Velocity: tasks completed this week vs last week
    const thisWeekStart = startOfWeek(new Date())
    const lastWeekStart = startOfWeek(subWeeks(new Date(), 1))
    const completedThisWeek = tasks.filter(t =>
      t.completed_at && isAfter(new Date(t.completed_at), thisWeekStart)
    ).length
    const completedLastWeek = tasks.filter(t =>
      t.completed_at && isAfter(new Date(t.completed_at), lastWeekStart) && !isAfter(new Date(t.completed_at), thisWeekStart)
    ).length

    // Per member stats
    const memberStats = members.map(m => {
      const memberTasks = tasks.filter(t => t.assigned_to === m.id)
      return {
        ...m,
        total: memberTasks.length,
        done: memberTasks.filter(t => t.status === 'done').length,
        inProg: memberTasks.filter(t => t.status === 'in_progress').length,
        overdue: memberTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length,
      }
    }).filter(m => m.total > 0)

    // Priority breakdown
    const byPriority = {
      high:   tasks.filter(t => t.priority === 'high').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      low:    tasks.filter(t => t.priority === 'low').length,
    }

    // Subtask completion
    const allSubtasks = tasks.flatMap(t => t.subtasks || [])
    const subtaskTotal = allSubtasks.length
    const subtaskDone = allSubtasks.filter(s => s.completed).length

    // Bottleneck: tasks in_progress sorted by age
    const bottleneck = tasks
      .filter(t => t.status === 'in_progress')
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(0, 5)

    const maxMemberTotal = Math.max(...memberStats.map(m => m.total), 1)

    return {
      total, done, inProg, todo, overdue, withDates, completionRate,
      completedThisWeek, completedLastWeek,
      memberStats, byPriority, subtaskTotal, subtaskDone, bottleneck,
      maxMemberTotal,
    }
  }, [tasks, members])

  const velChange = stats.completedLastWeek > 0
    ? Math.round(((stats.completedThisWeek - stats.completedLastWeek) / stats.completedLastWeek) * 100)
    : null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <BarChart2 size={18} className="text-brand-400" />
            <h2 className="font-semibold text-gray-100">Board Analytics</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top stat cards */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard icon={<CheckCircle2 size={16} className="text-emerald-400" />}
              label="Completion" value={`${stats.completionRate}%`}
              sub={`${stats.done}/${stats.total} done`} color="#10b981" />
            <StatCard icon={<Clock size={16} className="text-brand-400" />}
              label="In Progress" value={stats.inProg}
              sub={`${stats.todo} remaining`} color="#2952ff" />
            <StatCard icon={<AlertCircle size={16} className="text-red-400" />}
              label="Overdue" value={stats.overdue}
              sub={stats.withDates > 0 ? `of ${stats.withDates} with dates` : 'no due dates'} color="#ef4444" />
            <StatCard icon={<TrendingUp size={16} className="text-violet-400" />}
              label="This Week" value={stats.completedThisWeek}
              sub={velChange != null ? `${velChange >= 0 ? '+' : ''}${velChange}% vs last week` : 'completed'} color="#8b5cf6" />
          </div>

          {/* Status bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Status breakdown</p>
              <p className="text-xs text-gray-600">{stats.total} total</p>
            </div>
            <div className="h-3 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.05)' }}>
              {stats.total > 0 && <>
                <div className="h-full transition-all" style={{ width: `${(stats.done/stats.total)*100}%`, background: '#10b981' }} />
                <div className="h-full transition-all" style={{ width: `${(stats.inProg/stats.total)*100}%`, background: '#2952ff' }} />
                <div className="h-full transition-all" style={{ width: `${(stats.todo/stats.total)*100}%`, background: '#475569' }} />
              </>}
            </div>
            <div className="flex items-center gap-4 mt-2">
              {[['#10b981', 'Done', stats.done], ['#2952ff', 'In Progress', stats.inProg], ['#475569', 'To Do', stats.todo]].map(([c, l, v]) => (
                <div key={l} className="flex items-center gap-1.5 text-xs text-gray-400">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                  <span>{l}: {v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Priority breakdown */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Priority distribution</p>
            <div className="grid grid-cols-3 gap-3">
              {[['High', stats.byPriority.high, '#ef4444'], ['Medium', stats.byPriority.medium, '#f59e0b'], ['Low', stats.byPriority.low, '#64748b']].map(([label, count, color]) => (
                <div key={label} className="rounded-xl p-3 flex items-center gap-3"
                     style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <div>
                    <p className="text-lg font-bold" style={{ color }}>{count}</p>
                    <p className="text-[11px] text-gray-500">{label} priority</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Member workload */}
          {stats.memberStats.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Users size={11} /> Member workload
              </p>
              <div className="space-y-2.5">
                {stats.memberStats.map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                         style={{ background: 'linear-gradient(135deg,#2952ff,#8b5cf6)' }}>
                      {(m.full_name || m.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-300 font-medium">{m.full_name || m.email}</span>
                        <span className="text-xs text-gray-500">{m.total} tasks</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                             style={{ width: `${(m.done / m.total) * 100}%`, background: 'linear-gradient(90deg,#10b981,#06b6d4)' }} />
                      </div>
                    </div>
                    {m.overdue > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full text-red-400 shrink-0" style={{ background: 'rgba(239,68,68,0.1)' }}>
                        {m.overdue} overdue
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subtask progress */}
          {stats.subtaskTotal > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Subtask completion</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(stats.subtaskDone/stats.subtaskTotal)*100}%`, background: 'linear-gradient(90deg,#2952ff,#10b981)' }} />
                </div>
                <span className="text-xs text-gray-400 shrink-0">{stats.subtaskDone}/{stats.subtaskTotal}</span>
              </div>
            </div>
          )}

          {/* Bottleneck */}
          {stats.bottleneck.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Longest in progress</p>
              <div className="space-y-1.5">
                {stats.bottleneck.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                       style={{ background: 'rgba(41,82,255,0.05)', border: '1px solid rgba(41,82,255,0.1)' }}>
                    <span className="text-[11px] text-gray-600 font-mono w-4">#{i+1}</span>
                    <span className="flex-1 text-sm text-gray-300 truncate">{t.title}</span>
                    <span className="text-[11px] text-gray-500 shrink-0">
                      since {format(new Date(t.created_at), 'MMM d')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.total === 0 && (
            <div className="text-center py-12 text-gray-600">
              <BarChart2 size={32} className="mx-auto mb-3 opacity-30" />
              <p>No tasks yet — analytics will appear once tasks are created.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: `${color}08`, border: `1px solid ${color}18` }}>
      <div className="flex items-center gap-1.5">{icon}<span className="text-xs text-gray-500 font-medium">{label}</span></div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-[11px] text-gray-600">{sub}</p>
    </div>
  )
}
