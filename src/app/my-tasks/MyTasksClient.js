'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Flag, CheckSquare, ExternalLink, CheckCircle2, Circle } from 'lucide-react'
import { format, isToday, isTomorrow, isPast } from 'date-fns'

const PRIORITY_BADGE = {
  high:   { cls: 'badge-high',   label: 'High' },
  medium: { cls: 'badge-medium', label: 'Medium' },
  low:    { cls: 'badge-low',    label: 'Low' },
}

const STATUS_LABELS = {
  todo:        { label: 'To Do',       color: '#64748b' },
  in_progress: { label: 'In Progress', color: '#2952ff' },
  done:        { label: 'Done',        color: '#10b981' },
}

function formatDue(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isToday(d)) return { text: 'Today', overdue: false, soon: true }
  if (isTomorrow(d)) return { text: 'Tomorrow', overdue: false, soon: true }
  if (isPast(d)) return { text: format(d, 'MMM d'), overdue: true, soon: false }
  return { text: format(d, 'MMM d'), overdue: false, soon: false }
}

export default function MyTasksClient({ tasks, currentUser }) {
  const router = useRouter()
  const [showDone, setShowDone] = useState(false)
  const [sortBy, setSortBy] = useState('due')   // due | priority | board

  const filtered = useMemo(() => {
    let t = showDone ? tasks : tasks.filter(x => x.status !== 'done')

    if (sortBy === 'due') {
      t = [...t].sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return new Date(a.due_date) - new Date(b.due_date)
      })
    } else if (sortBy === 'priority') {
      const order = { high: 0, medium: 1, low: 2 }
      t = [...t].sort((a, b) => (order[a.priority] ?? 1) - (order[b.priority] ?? 1))
    } else if (sortBy === 'board') {
      t = [...t].sort((a, b) => (a.board?.name || '').localeCompare(b.board?.name || ''))
    }

    return t
  }, [tasks, showDone, sortBy])

  // Group by board
  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach(t => {
      const bid = t.board?.id || 'unknown'
      if (!map[bid]) map[bid] = { board: t.board, tasks: [] }
      map[bid].tasks.push(t)
    })
    return Object.values(map)
  }, [filtered])

  const totalActive = tasks.filter(t => t.status !== 'done').length
  const overdueCount = tasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && t.status !== 'done').length

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">My Tasks</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(107,114,128,0.9)' }}>
          {totalActive} active task{totalActive !== 1 ? 's' : ''} across all boards
          {overdueCount > 0 && (
            <span className="ml-2 text-red-400 font-semibold">{overdueCount} overdue</span>
          )}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setShowDone(false)}
            className="px-4 py-2 text-sm font-medium transition-all"
            style={!showDone
              ? { background: 'linear-gradient(135deg,#2952ff,#6d28d9)', color: 'white' }
              : { background: 'transparent', color: 'rgba(107,114,128,0.9)' }}
          >
            Active
          </button>
          <button
            onClick={() => setShowDone(true)}
            className="px-4 py-2 text-sm font-medium transition-all"
            style={showDone
              ? { background: 'linear-gradient(135deg,#2952ff,#6d28d9)', color: 'white' }
              : { background: 'transparent', color: 'rgba(107,114,128,0.9)' }}
          >
            All
          </button>
        </div>

        <select
          className="input w-40 py-2 text-sm"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          <option value="due">Sort: Due date</option>
          <option value="priority">Sort: Priority</option>
          <option value="board">Sort: Board</option>
        </select>
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 card">
          <CheckCircle2 size={40} className="mx-auto mb-4" style={{ color: 'rgba(16,185,129,0.5)' }} />
          <p className="font-bold text-white">
            {showDone ? 'No tasks assigned to you yet.' : 'You\'re all caught up! 🎉'}
          </p>
          <p className="text-sm mt-1" style={{ color: 'rgba(107,114,128,0.9)' }}>
            Tasks assigned to you will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ board, tasks: groupTasks }) => (
            <div key={board?.id || 'unknown'}>
              {/* Board header */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-bold"
                     style={{ background: board?.color || '#2952ff', boxShadow: `0 0 8px ${board?.color || '#2952ff'}60` }}>
                  {(board?.name || '?').substring(0, 2).toUpperCase()}
                </div>
                <span className="text-sm font-bold text-gray-200">{board?.name || 'Unknown board'}</span>
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(156,163,175,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  {groupTasks.length}
                </span>
                <button
                  onClick={() => router.push(`/boards/${board?.id}`)}
                  className="ml-auto flex items-center gap-1 text-xs transition-colors"
                  style={{ color: 'rgba(77,116,255,0.8)' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#4d74ff'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(77,116,255,0.8)'}
                >
                  Open board <ExternalLink size={11} />
                </button>
              </div>

              {/* Tasks in group */}
              <div className="space-y-2">
                {groupTasks.map(task => {
                  const due = task.due_date ? formatDue(task.due_date) : null
                  const badge = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.low
                  const status = STATUS_LABELS[task.status]
                  const subtasksDone = (task.subtasks || []).filter(s => s.completed).length
                  const subtasksTotal = (task.subtasks || []).length

                  return (
                    <div
                      key={task.id}
                      onClick={() => router.push(`/boards/${board?.id}`)}
                      className="rounded-xl p-4 flex items-start gap-4 cursor-pointer transition-all duration-150 group"
                      style={{ background: 'rgba(14,14,26,0.7)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: `3px solid ${board?.color || '#2952ff'}60` }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(18,18,32,0.9)'
                        e.currentTarget.style.borderLeftColor = board?.color || '#2952ff'
                        e.currentTarget.style.transform = 'translateX(2px)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(14,14,26,0.7)'
                        e.currentTarget.style.borderLeftColor = `${board?.color || '#2952ff'}60`
                        e.currentTarget.style.transform = ''
                      }}
                    >
                      {/* Status dot */}
                      <div className="mt-0.5 shrink-0">
                        {task.status === 'done'
                          ? <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                          : <Circle size={18} style={{ color: status.color }} />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm leading-snug ${task.status === 'done' ? 'line-through text-gray-500' : 'text-gray-100 group-hover:text-white'}`}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'rgba(107,114,128,0.8)' }}>
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={badge.cls}><Flag size={9} />{badge.label}</span>
                          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full"
                                style={{ background: `${status.color}18`, color: status.color, border: `1px solid ${status.color}30` }}>
                            {status.label}
                          </span>
                          {due && (
                            <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full
                              ${due.overdue ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                                : due.soon ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                                : 'text-gray-500 bg-white/5 border border-white/8'}`}>
                              <Calendar size={9} /> {due.text}
                            </span>
                          )}
                          {subtasksTotal > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-gray-500">
                              <CheckSquare size={9} /> {subtasksDone}/{subtasksTotal}
                            </span>
                          )}
                          {task.votes?.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-gray-500">
                              ▲ {task.votes.length}
                            </span>
                          )}
                          {(task.labels || []).map(l => (
                            <span key={l.id} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                  style={{ background: `${l.color}20`, color: l.color, border: `1px solid ${l.color}30` }}>
                              {l.text}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
