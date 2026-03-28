'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, ChevronDown, Calendar, User, Flag, MessageSquare, Trash2, Settings, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns'

const COLUMNS = [
  { id: 'todo',        label: 'To Do',       color: 'bg-gray-600' },
  { id: 'in_progress', label: 'In Progress',  color: 'bg-brand-600' },
  { id: 'done',        label: 'Done',         color: 'bg-green-600' },
]

const PRIORITIES = { high: 'text-red-400', medium: 'text-yellow-400', low: 'text-gray-500' }
const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' }

export default function BoardClient({ board, tasks: initialTasks, members, currentUser, userRole }) {
  const router = useRouter()
  const supabase = createClient()

  const [tasks, setTasks] = useState(initialTasks)
  const [activeTask, setActiveTask] = useState(null)        // task being viewed/edited
  const [showNewTask, setShowNewTask] = useState(null)      // column id for new task
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState(null)

  // ── Computed ──────────────────────────────────────────────
  const tasksByStatus = useMemo(() => {
    const map = { todo: [], in_progress: [], done: [] }
    tasks.forEach(t => { if (map[t.status]) map[t.status].push(t) })
    return map
  }, [tasks])

  // ── CRUD helpers ──────────────────────────────────────────
  async function createTask(status, { title, description, assignedTo, priority, dueDate }) {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        board_id: board.id,
        title,
        description,
        status,
        priority: priority || 'medium',
        assigned_to: assignedTo || null,
        due_date: dueDate || null,
        created_by: currentUser.id,
      })
      .select('*, assignee:assigned_to(id,full_name,email), creator:created_by(id,full_name,email)')
      .single()
    if (!error) setTasks(prev => [...prev, data])
    return { data, error }
  }

  async function updateTask(id, updates) {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select('*, assignee:assigned_to(id,full_name,email), creator:created_by(id,full_name,email)')
      .single()
    if (!error) setTasks(prev => prev.map(t => t.id === id ? data : t))
    if (!error && activeTask?.id === id) setActiveTask(data)
    return { data, error }
  }

  async function deleteTask(id) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
    if (activeTask?.id === id) setActiveTask(null)
  }

  async function moveTask(id, newStatus) {
    await updateTask(id, { status: newStatus })
  }

  async function inviteMember(e) {
    e.preventDefault()
    setInviting(true)
    setInviteError(null)
    // Look up profile by email
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', inviteEmail.trim())
      .single()
    if (error || !profile) {
      setInviteError('No user found with that email. They must sign up first.')
      setInviting(false)
      return
    }
    // Add to board
    const { error: err2 } = await supabase
      .from('board_members')
      .insert({ board_id: board.id, user_id: profile.id, role: 'member' })
    if (err2 && err2.code !== '23505') {
      setInviteError(err2.message)
      setInviting(false)
      return
    }
    setInviteEmail('')
    setShowInvite(false)
    setInviting(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Board header */}
      <header className="flex items-center justify-between px-7 py-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: board.color }}
          >
            {board.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-100">{board.name}</h1>
            {board.description && <p className="text-xs text-gray-500">{board.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Member avatars */}
          <div className="flex -space-x-2">
            {members.slice(0, 5).map(m => (
              <div
                key={m.id}
                title={m.full_name || m.email}
                className="w-7 h-7 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center
                           text-[10px] font-bold text-gray-200"
              >
                {(m.full_name || m.email || '?')[0].toUpperCase()}
              </div>
            ))}
          </div>
          {(userRole === 'owner') && (
            <button onClick={() => setShowInvite(true)} className="btn-ghost flex items-center gap-1.5 text-xs">
              <UserPlus size={14} /> Invite
            </button>
          )}
          <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded-full">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-5 p-6 h-full min-w-fit">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              column={col}
              tasks={tasksByStatus[col.id]}
              members={members}
              canEdit={userRole !== 'viewer'}
              onTaskClick={setActiveTask}
              onAddTask={() => setShowNewTask(col.id)}
              onMoveTask={moveTask}
            />
          ))}
        </div>
      </div>

      {/* New Task Modal */}
      {showNewTask && (
        <NewTaskModal
          status={showNewTask}
          members={members}
          onClose={() => setShowNewTask(null)}
          onCreate={async (data) => {
            const { error } = await createTask(showNewTask, data)
            if (!error) setShowNewTask(null)
          }}
        />
      )}

      {/* Task Detail Modal */}
      {activeTask && (
        <TaskDetailModal
          task={activeTask}
          members={members}
          currentUser={currentUser}
          canEdit={userRole !== 'viewer'}
          onClose={() => setActiveTask(null)}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onMove={moveTask}
        />
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-100">Invite to board</h2>
              <button onClick={() => setShowInvite(false)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            {inviteError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-2 rounded-lg mb-4">
                {inviteError}
              </div>
            )}
            <form onSubmit={inviteMember} className="space-y-4">
              <div>
                <label className="label">Email address</label>
                <input
                  type="email" className="input" placeholder="colleague@company.com"
                  value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required
                />
                <p className="text-xs text-gray-600 mt-1">They must already have a TeamBoard account.</p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowInvite(false)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={inviting}>
                  {inviting ? 'Inviting…' : 'Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({ column, tasks, members, canEdit, onTaskClick, onAddTask, onMoveTask }) {
  return (
    <div className="w-72 shrink-0 flex flex-col bg-gray-900/50 rounded-xl border border-gray-800">
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${column.color}`} />
          <span className="text-sm font-semibold text-gray-200">{column.label}</span>
          <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
            {tasks.length}
          </span>
        </div>
        {canEdit && (
          <button onClick={onAddTask} className="text-gray-600 hover:text-gray-300 transition-colors p-0.5 rounded">
            <Plus size={15} />
          </button>
        )}
      </div>

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
        ))}
        {canEdit && (
          <button
            onClick={onAddTask}
            className="w-full text-left text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1.5 py-2 px-2
                       rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus size={13} /> Add task
          </button>
        )}
      </div>
    </div>
  )
}

// ── Task Card ─────────────────────────────────────────────────────────────────

function TaskCard({ task, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left card p-3.5 hover:border-gray-700 hover:bg-gray-800/80
                 transition-all cursor-pointer group space-y-2.5"
    >
      <p className="text-sm text-gray-200 font-medium leading-snug group-hover:text-white">
        {task.title}
      </p>
      {task.description && (
        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{task.description}</p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-medium ${PRIORITIES[task.priority] || 'text-gray-500'}`}>
            <Flag size={11} className="inline mr-0.5" />{PRIORITY_LABELS[task.priority]}
          </span>
          {task.due_date && (
            <span className="text-[11px] text-gray-600 flex items-center gap-0.5">
              <Calendar size={10} />
              {format(new Date(task.due_date), 'MMM d')}
            </span>
          )}
        </div>
        {task.assignee && (
          <div
            title={task.assignee.full_name || task.assignee.email}
            className="w-6 h-6 rounded-full bg-brand-700 flex items-center justify-center text-[10px] font-bold text-white"
          >
            {(task.assignee.full_name || task.assignee.email || '?')[0].toUpperCase()}
          </div>
        )}
      </div>
    </button>
  )
}

// ── New Task Modal ────────────────────────────────────────────────────────────

function NewTaskModal({ status, members, onClose, onCreate }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    await onCreate({ title: title.trim(), description: description.trim(), assignedTo, priority, dueDate })
    setSaving(false)
  }

  const colLabel = COLUMNS.find(c => c.id === status)?.label || status

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-100">New task · <span className="text-gray-400 font-normal">{colLabel}</span></h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input className="input" placeholder="Task title" value={title} onChange={e => setTitle(e.target.value)} autoFocus required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none h-20" placeholder="Optional details…" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Priority</label>
              <select className="input" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="label">Due date</label>
              <input type="date" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Assign to</label>
            <select className="input" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
              <option value="">Unassigned</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving || !title.trim()}>
              {saving ? 'Adding…' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Task Detail Modal ─────────────────────────────────────────────────────────

function TaskDetailModal({ task, members, currentUser, canEdit, onClose, onUpdate, onDelete, onMove }) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [priority, setPriority] = useState(task.priority)
  const [assignedTo, setAssignedTo] = useState(task.assigned_to || '')
  const [dueDate, setDueDate] = useState(task.due_date || '')
  const [status, setStatus] = useState(task.status)
  const [saving, setSaving] = useState(false)
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(false)
  const supabase = createClient()

  // Load comments on mount
  useState(() => {
    setLoadingComments(true)
    supabase.from('comments')
      .select('*, author:user_id(id,full_name,email)')
      .eq('task_id', task.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setComments(data || [])
        setLoadingComments(false)
      })
  })

  async function handleSave() {
    setSaving(true)
    await onUpdate(task.id, {
      title, description, priority,
      assigned_to: assignedTo || null,
      due_date: dueDate || null,
      status,
    })
    setSaving(false)
  }

  async function handleAddComment(e) {
    e.preventDefault()
    if (!comment.trim()) return
    const { data } = await supabase.from('comments')
      .insert({ task_id: task.id, user_id: currentUser.id, content: comment.trim() })
      .select('*, author:user_id(id,full_name,email)')
      .single()
    if (data) setComments(prev => [...prev, data])
    setComment('')
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="card w-full sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <select
              className="text-xs font-semibold bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-gray-300
                         focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={status}
              onChange={e => { setStatus(e.target.value); onMove(task.id, e.target.value) }}
              disabled={!canEdit}
            >
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={() => { if (confirm('Delete this task?')) onDelete(task.id) }}
                className="btn-ghost p-1.5 text-gray-600 hover:text-red-400"
              >
                <Trash2 size={15} />
              </button>
            )}
            <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Title */}
          <input
            className="text-xl font-semibold text-gray-100 bg-transparent border-none outline-none w-full
                       placeholder-gray-700 focus:ring-0 p-0"
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={!canEdit}
          />

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label flex items-center gap-1"><Flag size={11} /> Priority</label>
              <select className="input" value={priority} onChange={e => setPriority(e.target.value)} disabled={!canEdit}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="label flex items-center gap-1"><User size={11} /> Assigned to</label>
              <select className="input" value={assignedTo} onChange={e => setAssignedTo(e.target.value)} disabled={!canEdit}>
                <option value="">Unassigned</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
              </select>
            </div>
            <div>
              <label className="label flex items-center gap-1"><Calendar size={11} /> Due date</label>
              <input type="date" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={!canEdit} />
            </div>
            <div>
              <label className="label">Created by</label>
              <p className="text-sm text-gray-400 py-2">{task.creator?.full_name || task.creator?.email || '—'}</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none h-28"
              placeholder="Add more details…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={!canEdit}
            />
          </div>

          {/* Save button */}
          {canEdit && (
            <button onClick={handleSave} className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}

          {/* Comments */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-1.5">
              <MessageSquare size={14} /> Comments ({comments.length})
            </h3>
            <div className="space-y-3 mb-4">
              {comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 shrink-0 mt-0.5">
                    {(c.author?.full_name || c.author?.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="bg-gray-800 rounded-xl px-4 py-2.5 flex-1">
                    <p className="text-xs font-medium text-gray-400 mb-1">
                      {c.author?.full_name || c.author?.email}
                      <span className="text-gray-600 font-normal ml-2">
                        {format(new Date(c.created_at), 'MMM d, h:mm a')}
                      </span>
                    </p>
                    <p className="text-sm text-gray-200 leading-relaxed">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddComment} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-brand-700 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-1">
                {(currentUser.full_name || currentUser.email || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Write a comment…"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                />
                <button type="submit" className="btn-primary px-3" disabled={!comment.trim()}>Send</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
