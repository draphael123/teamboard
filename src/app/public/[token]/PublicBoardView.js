'use client'

import { useMemo, useState } from 'react'
import { format, isPast } from 'date-fns'
import { Flag, Calendar, CheckSquare, Eye, LayoutDashboard, List } from 'lucide-react'

const COLUMNS = [
  { id: 'todo',        label: 'To Do',       color: '#64748b' },
  { id: 'in_progress', label: 'In Progress',  color: '#2952ff' },
  { id: 'done',        label: 'Done',         color: '#10b981' },
]
const PRIORITY_BADGE = {
  high:   { cls: 'badge-high',   label: 'High' },
  medium: { cls: 'badge-medium', label: 'Medium' },
  low:    { cls: 'badge-low',    label: 'Low' },
}

export default function PublicBoardView({ board, tasks, members }) {
  const [view, setView] = useState('kanban')

  const tasksByStatus = useMemo(() => {
    const m = { todo: [], in_progress: [], done: [] }
    tasks.forEach(t => { if (m[t.status]) m[t.status].push(t) })
    return m
  }, [tasks])

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #07070f 0%, #0d0d1f 50%, #07070f 100%)' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/[0.07]"
              style={{ background: 'rgba(7,7,15,0.9)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
               style={{ backgroundColor: board.color || '#2952ff' }}>
            {board.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-100">{board.name}</h1>
            {board.description && <p className="text-xs text-gray-500">{board.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 px-2.5 py-1 rounded-full"
               style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Eye size={11} /> Read-only view
          </div>
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            {[{ id: 'kanban', icon: LayoutDashboard }, { id: 'list', icon: List }].map(({ id, icon: Icon }) => (
              <button key={id} onClick={() => setView(id)}
                      className="px-3 py-1.5 transition-all"
                      style={view === id
                        ? { background: 'rgba(41,82,255,0.2)', color: '#7ba3ff' }
                        : { background: 'transparent', color: 'rgba(107,114,128,0.7)' }}>
                <Icon size={13} />
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-500">{tasks.length} tasks</span>
        </div>
      </header>

      {/* Board */}
      {view === 'kanban' ? (
        <div className="flex gap-5 p-6 overflow-x-auto">
          {COLUMNS.map(col => (
            <div key={col.id} className="w-72 shrink-0 flex flex-col rounded-2xl"
                 style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06]">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color, boxShadow: `0 0 8px ${col.color}60` }} />
                <span className="text-sm font-bold text-gray-100">{col.label}</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold"
                      style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(156,163,175,0.9)' }}>
                  {tasksByStatus[col.id].length}
                </span>
              </div>
              <div className="p-3 space-y-2.5">
                {tasksByStatus[col.id].map(task => (
                  <PublicTaskCard key={task.id} task={task} columnColor={col.color} />
                ))}
                {tasksByStatus[col.id].length === 0 && (
                  <p className="text-xs text-gray-700 text-center py-4">No tasks</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          {COLUMNS.map(col => (
            <div key={col.id}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{col.label}</span>
                <span className="text-[11px] text-gray-600">{tasksByStatus[col.id].length}</span>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                {tasksByStatus[col.id].length === 0 ? (
                  <p className="px-4 py-3 text-xs text-gray-600 italic">No tasks</p>
                ) : tasksByStatus[col.id].map((task, i) => (
                  <div key={task.id} className="flex items-center gap-4 px-4 py-3"
                       style={{ background: 'rgba(14,14,26,0.5)', borderBottom: i < tasksByStatus[col.id].length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                    <p className={`flex-1 text-sm font-medium ${task.status === 'done' ? 'line-through text-gray-500' : 'text-gray-200'}`}>{task.title}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={PRIORITY_BADGE[task.priority]?.cls || 'badge-low'}>
                        <Flag size={9} />{PRIORITY_BADGE[task.priority]?.label || 'Low'}
                      </span>
                      {task.due_date && (
                        <span className="text-[11px] text-gray-500"><Calendar size={9} className="inline mr-0.5" />{format(new Date(task.due_date), 'MMM d')}</span>
                      )}
                      {task.assignee && (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                             style={{ background: 'linear-gradient(135deg,#2952ff,#8b5cf6)' }}
                             title={task.assignee.full_name || task.assignee.email}>
                          {(task.assignee.full_name || task.assignee.email || '?')[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-center py-8 text-xs text-gray-700">
        Powered by <a href="https://teamboard-amber.vercel.app" className="text-gray-500 hover:text-gray-400">TeamBoard</a>
      </div>
    </div>
  )
}

function PublicTaskCard({ task, columnColor }) {
  const badge = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.low
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done'
  return (
    <div className="rounded-xl p-3.5 space-y-2"
         style={{ background: 'rgba(14,14,26,0.7)', border: `1px solid rgba(255,255,255,0.07)`, borderLeft: `3px solid ${columnColor}40` }}>
      <p className={`text-sm font-semibold leading-snug ${task.status === 'done' ? 'line-through text-gray-500' : 'text-gray-200'}`}>{task.title}</p>
      {task.description && <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>}
      {task.labels?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.labels.map(l => (
            <span key={l.id} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: `${l.color}20`, color: l.color }}>{l.text}</span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={badge.cls}><Flag size={9} />{badge.label}</span>
          {task.due_date && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-medium
              ${isOverdue ? 'text-red-400 bg-red-500/10' : 'text-gray-500 bg-white/5'}`}>
              <Calendar size={9} />{format(new Date(task.due_date), 'MMM d')}
            </span>
          )}
          {task.subtasks?.length > 0 && (
            <span className="text-[10px] text-gray-600 flex items-center gap-0.5">
              <CheckSquare size={9} />{task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
            </span>
          )}
        </div>
        {task.assignee && (
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
               style={{ background: 'linear-gradient(135deg,#2952ff,#8b5cf6)' }}
               title={task.assignee.full_name || task.assignee.email}>
            {(task.assignee.full_name || task.assignee.email || '?')[0].toUpperCase()}
          </div>
        )}
      </div>
    </div>
  )
}
