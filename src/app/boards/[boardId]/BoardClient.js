'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, X, Calendar, User, Flag, MessageSquare, Trash2,
  Settings, UserPlus, Bell, Search, ChevronDown, GripVertical,
  Check, AlertCircle,
} from 'lucide-react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { format } from 'date-fns'

// ── Constants ──────────────────────────────────────────────────────────────────

const COLUMNS = [
  { id: 'todo',        label: 'To Do',       color: 'bg-gray-600' },
  { id: 'in_progress', label: 'In Progress',  color: 'bg-brand-600' },
  { id: 'done',        label: 'Done',         color: 'bg-green-600' },
]

const BOARD_COLORS = [
  '#2952ff', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#64748b',
]

const PRIORITIES = { high: 'text-red-400', medium: 'text-yellow-400', low: 'text-gray-500' }
const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' }

// ── API helpers ────────────────────────────────────────────────────────────────

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    ...(options.body ? { body: typeof options.body === 'string' ? options.body : JSON.stringify(options.body) } : {}),
  })
  const data = await res.json()
  return { data, ok: res.ok, status: res.status }
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function BoardClient({ board: initialBoard, tasks: initialTasks, members: initialMembers, currentUser, userRole }) {
  const router = useRouter()
  const boardId = initialBoard.id

  // Core state
  const [board, setBoard]       = useState(initialBoard)
  const [tasks, setTasks]       = useState(initialTasks)
  const [members, setMembers]   = useState(initialMembers)

  // Modal state
  const [activeTask, setActiveTask]     = useState(null)
  const [showNewTask, setShowNewTask]   = useState(null)    // column id
  const [showInvite, setShowInvite]     = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // DnD state
  const [draggingTask, setDraggingTask] = useState(null)

  // Filters
  const [searchQuery, setSearchQuery]       = useState('')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')

  // Notifications
  const [notifications, setNotifications]   = useState([])
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)
  const notifRef = useRef(null)

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  // ── Polling ────────────────────────────────────────────────────────────────

  const pollTasks = useCallback(async () => {
    const { data, ok } = await apiFetch(`/api/boards/${boardId}/tasks`)
    if (ok && Array.isArray(data)) setTasks(data)
  }, [boardId])

  const pollNotifications = useCallback(async () => {
    const { data, ok } = await apiFetch('/api/notifications')
    if (ok && Array.isArray(data)) setNotifications(data)
  }, [])

  useEffect(() => {
    const taskInterval = setInterval(pollTasks, 30_000)
    const notifInterval = setInterval(pollNotifications, 60_000)
    pollNotifications() // initial load
    return () => { clearInterval(taskInterval); clearInterval(notifInterval) }
  }, [pollTasks, pollNotifications])

  // Close notification dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Task CRUD ──────────────────────────────────────────────────────────────

  async function createTask(status, fields) {
    const { data, ok } = await apiFetch(`/api/boards/${boardId}/tasks`, {
      method: 'POST',
      body: { ...fields, status },
    })
    if (ok) setTasks(prev => [...prev, data])
    return { ok, error: ok ? null : data.error }
  }

  async function updateTask(id, updates) {
    const { data, ok } = await apiFetch(`/api/boards/${boardId}/tasks/${id}`, {
      method: 'PATCH',
      body: updates,
    })
    if (ok) {
      setTasks(prev => prev.map(t => t.id === id ? data : t))
      if (activeTask?.id === id) setActiveTask(data)
    }
    return { ok, data, error: ok ? null : data.error }
  }

  async function deleteTask(id) {
    const { ok } = await apiFetch(`/api/boards/${boardId}/tasks/${id}`, { method: 'DELETE' })
    if (ok) {
      setTasks(prev => prev.filter(t => t.id !== id))
      if (activeTask?.id === id) setActiveTask(null)
    }
    return { ok }
  }

  async function moveTask(id, newStatus) {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
    await apiFetch(`/api/boards/${boardId}/tasks/${id}`, {
      method: 'PATCH',
      body: { status: newStatus },
    })
  }

  // ── Board settings ─────────────────────────────────────────────────────────

  async function updateBoard(updates) {
    const { data, ok } = await apiFetch(`/api/boards/${boardId}`, {
      method: 'PATCH',
      body: updates,
    })
    if (ok) setBoard(data)
    return { ok, data, error: ok ? null : data.error }
  }

  async function deleteBoard() {
    const { ok } = await apiFetch(`/api/boards/${boardId}`, { method: 'DELETE' })
    if (ok) router.push('/dashboard')
    return { ok }
  }

  // ── Member invite ──────────────────────────────────────────────────────────

  async function inviteMember(email) {
    const { data, ok } = await apiFetch(`/api/boards/${boardId}/members`, {
      method: 'POST',
      body: { email },
    })
    if (ok) {
      setMembers(prev => [...prev, data.user])
      router.refresh()
    }
    return { ok, error: ok ? null : data.error }
  }

  // ── Notification helpers ───────────────────────────────────────────────────

  async function markNotifRead(id) {
    await apiFetch(`/api/notifications/${id}`, { method: 'PATCH' })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllNotifsRead() {
    await apiFetch('/api/notifications/all', { method: 'PATCH' })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  // ── DnD handlers ──────────────────────────────────────────────────────────

  function handleDragStart(event) {
    const task = tasks.find(t => t.id === event.active.id)
    setDraggingTask(task || null)
  }

  function handleDragEnd(event) {
    const { active, over } = event
    setDraggingTask(null)
    if (!over) return

    const taskId = active.id
    const overId = over.id

    // Determine target column: overId could be a column id
    const targetColumn = COLUMNS.find(c => c.id === overId)?.id
    if (!targetColumn) return

    const task = tasks.find(t => t.id === taskId)
    if (task && task.status !== targetColumn) {
      moveTask(taskId, targetColumn)
    }
  }

  // ── Filtered tasks ─────────────────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchSearch = !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase())
      const matchPriority = filterPriority === 'all' || t.priority === filterPriority
      const matchAssignee = filterAssignee === 'all' ||
        (filterAssignee === 'unassigned' ? !t.assigned_to : t.assigned_to === filterAssignee)
      return matchSearch && matchPriority && matchAssignee
    })
  }, [tasks, searchQuery, filterPriority, filterAssignee])

  const tasksByStatus = useMemo(() => {
    const map = { todo: [], in_progress: [], done: [] }
    filteredTasks.forEach(t => { if (map[t.status]) map[t.status].push(t) })
    return map
  }, [filteredTasks])

  const hasFilters = searchQuery || filterPriority !== 'all' || filterAssignee !== 'all'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* Board header */}
      <header className="flex items-center justify-between px-7 py-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
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

          {/* Invite */}
          {userRole === 'owner' && (
            <button onClick={() => setShowInvite(true)} className="btn-ghost flex items-center gap-1.5 text-xs">
              <UserPlus size={14} /> Invite
            </button>
          )}

          {/* Notification bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifDropdown(v => !v)}
              className="btn-ghost p-2 relative"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-brand-500 text-white
                                 text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifDropdown && (
              <NotificationDropdown
                notifications={notifications}
                onMarkRead={markNotifRead}
                onMarkAllRead={markAllNotifsRead}
                onClose={() => setShowNotifDropdown(false)}
              />
            )}
          </div>

          {/* Settings (owner only) */}
          {userRole === 'owner' && (
            <button onClick={() => setShowSettings(true)} className="btn-ghost p-2">
              <Settings size={16} />
            </button>
          )}

          <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded-full">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex items-center gap-3 px-7 py-3 border-b border-gray-800 shrink-0 bg-gray-950">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            className="input pl-8 py-1.5 text-xs h-8"
            placeholder="Search tasks…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="input py-1.5 text-xs h-8 w-36"
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
        >
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          className="input py-1.5 text-xs h-8 w-36"
          value={filterAssignee}
          onChange={e => setFilterAssignee(e.target.value)}
        >
          <option value="all">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
          ))}
        </select>

        {hasFilters && (
          <button
            onClick={() => { setSearchQuery(''); setFilterPriority('all'); setFilterAssignee('all') }}
            className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Kanban board */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-5 p-6 h-full min-w-fit">
            {COLUMNS.map(col => (
              <DroppableColumn
                key={col.id}
                column={col}
                tasks={tasksByStatus[col.id]}
                members={members}
                canEdit={userRole !== 'viewer'}
                onTaskClick={setActiveTask}
                onAddTask={() => setShowNewTask(col.id)}
                draggingTaskId={draggingTask?.id}
              />
            ))}
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {draggingTask ? (
            <div className="card p-3.5 w-72 opacity-90 shadow-2xl rotate-1 border-brand-600">
              <p className="text-sm text-gray-200 font-medium">{draggingTask.title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Modals */}
      {showNewTask && (
        <NewTaskModal
          status={showNewTask}
          members={members}
          onClose={() => setShowNewTask(null)}
          onCreate={async (data) => {
            const { ok } = await createTask(showNewTask, data)
            if (ok) setShowNewTask(null)
          }}
        />
      )}

      {activeTask && (
        <TaskDetailModal
          task={activeTask}
          boardId={boardId}
          members={members}
          currentUser={currentUser}
          canEdit={userRole !== 'viewer'}
          onClose={() => setActiveTask(null)}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onMove={moveTask}
        />
      )}

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvite={inviteMember}
        />
      )}

      {showSettings && (
        <BoardSettingsModal
          board={board}
          onClose={() => setShowSettings(false)}
          onUpdate={updateBoard}
          onDelete={deleteBoard}
        />
      )}
    </div>
  )
}

// ── Droppable Column ───────────────────────────────────────────────────────────

function DroppableColumn({ column, tasks, members, canEdit, onTaskClick, onAddTask, draggingTaskId }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 flex flex-col rounded-xl border transition-colors
        ${isOver ? 'border-brand-500 bg-brand-500/5' : 'bg-gray-900/50 border-gray-800'}`}
    >
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
          <DraggableTaskCard
            key={task.id}
            task={task}
            onClick={() => onTaskClick(task)}
            isDragging={task.id === draggingTaskId}
          />
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

// ── Draggable Task Card ────────────────────────────────────────────────────────

function DraggableTaskCard({ task, onClick, isDragging }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id })

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
  } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card p-3.5 transition-all group space-y-2.5 relative
        ${isDragging ? 'opacity-40 border-dashed' : 'hover:border-gray-700 hover:bg-gray-800/80'}`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-3 right-3 text-gray-700 hover:text-gray-400 cursor-grab active:cursor-grabbing opacity-0
                   group-hover:opacity-100 transition-opacity p-0.5 rounded"
      >
        <GripVertical size={13} />
      </div>

      {/* Card content - click to open */}
      <button onClick={onClick} className="w-full text-left space-y-2.5">
        <p className="text-sm text-gray-200 font-medium leading-snug group-hover:text-white pr-5">
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
              <span className={`text-[11px] flex items-center gap-0.5
                ${new Date(task.due_date) < new Date() && task.status !== 'done' ? 'text-red-400' : 'text-gray-600'}`}>
                <Calendar size={10} />
                {format(new Date(task.due_date), 'MMM d')}
              </span>
            )}
          </div>
          {task.assignee && (
            <div
              title={task.assignee.full_name || task.assignee.email}
              className="w-6 h-6 rounded-full bg-brand-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0"
            >
              {(task.assignee.full_name || task.assignee.email || '?')[0].toUpperCase()}
            </div>
          )}
        </div>
      </button>
    </div>
  )
}

// ── New Task Modal ─────────────────────────────────────────────────────────────

function NewTaskModal({ status, members, onClose, onCreate }) {
  const [title, setTitle]         = useState('')
  const [description, setDescription] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [priority, setPriority]   = useState('medium')
  const [dueDate, setDueDate]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    const { ok, error: err } = await onCreate({
      title: title.trim(),
      description: description.trim(),
      assigned_to: assignedTo || null,
      priority,
      due_date: dueDate || null,
    })
    if (!ok) setError(err || 'Failed to create task')
    setSaving(false)
  }

  const colLabel = COLUMNS.find(c => c.id === status)?.label || status

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-100">
            New task · <span className="text-gray-400 font-normal">{colLabel}</span>
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input
              className="input" placeholder="Task title"
              value={title} onChange={e => setTitle(e.target.value)}
              autoFocus required
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none h-20" placeholder="Optional details…"
              value={description} onChange={e => setDescription(e.target.value)}
            />
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

// ── Task Detail Modal ──────────────────────────────────────────────────────────

function TaskDetailModal({ task, boardId, members, currentUser, canEdit, onClose, onUpdate, onDelete, onMove }) {
  const [title, setTitle]       = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [priority, setPriority] = useState(task.priority)
  const [assignedTo, setAssignedTo] = useState(task.assigned_to || '')
  const [dueDate, setDueDate]   = useState(task.due_date || '')
  const [status, setStatus]     = useState(task.status)
  const [saving, setSaving]     = useState(false)
  const [comment, setComment]   = useState('')
  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [addingComment, setAddingComment] = useState(false)
  const commentsEndRef = useRef(null)

  // Load comments on mount
  useEffect(() => {
    async function load() {
      setLoadingComments(true)
      const { data, ok } = await apiFetch(`/api/tasks/${task.id}/comments`)
      if (ok) setComments(data || [])
      setLoadingComments(false)
    }
    load()
  }, [task.id])

  // Scroll to bottom when comments load
  useEffect(() => {
    if (!loadingComments) commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length, loadingComments])

  async function handleSave() {
    setSaving(true)
    await onUpdate(task.id, {
      title,
      description,
      priority,
      assigned_to: assignedTo || null,
      due_date: dueDate || null,
      status,
    })
    setSaving(false)
  }

  async function handleAddComment(e) {
    e.preventDefault()
    if (!comment.trim()) return
    setAddingComment(true)
    const { data, ok } = await apiFetch(`/api/tasks/${task.id}/comments`, {
      method: 'POST',
      body: { content: comment.trim() },
    })
    if (ok) {
      setComments(prev => [...prev, data])
      setComment('')
    }
    setAddingComment(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="card w-full sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <select
            className="text-xs font-semibold bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-gray-300
                       focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={status}
            onChange={e => { setStatus(e.target.value); onMove(task.id, e.target.value) }}
            disabled={!canEdit}
          >
            {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>

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

          {/* Save */}
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

            {loadingComments ? (
              <div className="text-xs text-gray-600 py-4 text-center">Loading comments…</div>
            ) : (
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
                <div ref={commentsEndRef} />
              </div>
            )}

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
                <button type="submit" className="btn-primary px-3" disabled={!comment.trim() || addingComment}>
                  {addingComment ? '…' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Notification Dropdown ──────────────────────────────────────────────────────

function NotificationDropdown({ notifications, onMarkRead, onMarkAllRead, onClose }) {
  const unread = notifications.filter(n => !n.read)

  return (
    <div className="absolute right-0 top-10 w-80 card p-0 shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <span className="text-sm font-semibold text-gray-200">Notifications</span>
        {unread.length > 0 && (
          <button onClick={onMarkAllRead} className="text-xs text-brand-400 hover:text-brand-300">
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-72 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm">No notifications</div>
        ) : (
          notifications.map(n => (
            <button
              key={n.id}
              onClick={() => !n.read && onMarkRead(n.id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors
                         flex items-start gap-3 ${!n.read ? 'bg-brand-500/5' : ''}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${n.read ? 'bg-transparent' : 'bg-brand-500'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-200 truncate">{n.title}</p>
                {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                <p className="text-[10px] text-gray-600 mt-1">
                  {format(new Date(n.created_at), 'MMM d, h:mm a')}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ── Board Settings Modal ───────────────────────────────────────────────────────

function BoardSettingsModal({ board, onClose, onUpdate, onDelete }) {
  const [name, setName]         = useState(board.name)
  const [description, setDescription] = useState(board.description || '')
  const [color, setColor]       = useState(board.color || '#2952ff')
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]       = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    const { ok, error: err } = await onUpdate({ name: name.trim(), description: description.trim(), color })
    if (!ok) setError(err || 'Failed to save')
    else onClose()
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await onDelete()
    setDeleting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-100">Board Settings</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Board name *</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none h-20"
              placeholder="What is this board for?"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Color</label>
            <div className="flex gap-2 flex-wrap">
              {BOARD_COLORS.map(c => (
                <button
                  key={c} type="button" onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform hover:scale-110
                    ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>

        {/* Danger zone */}
        <div className="mt-6 pt-5 border-t border-gray-800">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">Danger Zone</p>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full text-sm text-red-400 border border-red-500/30 rounded-lg px-4 py-2
                         hover:bg-red-500/10 transition-colors"
            >
              Delete this board…
            </button>
          ) : (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">
                  This will permanently delete the board and all its tasks. This cannot be undone.
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="btn-ghost flex-1 text-sm">Cancel</button>
                <button
                  onClick={handleDelete}
                  className="flex-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg px-4 py-2 transition-colors"
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : 'Yes, delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Invite Modal ───────────────────────────────────────────────────────────────

function InviteModal({ onClose, onInvite }) {
  const [email, setEmail]   = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError]   = useState(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setInviting(true)
    setError(null)
    const { ok, error: err } = await onInvite(email.trim())
    if (!ok) {
      setError(err || 'Invite failed')
      setInviting(false)
    } else {
      setSuccess(true)
      setInviting(false)
      setEmail('')
      setTimeout(onClose, 1200)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-100">Invite to board</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>

        {success ? (
          <div className="flex items-center gap-2 text-green-400 text-sm py-2">
            <Check size={16} /> Member added successfully!
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-2 rounded-lg mb-4">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Email address</label>
                <input
                  type="email" className="input"
                  placeholder="colleague@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoFocus required
                />
                <p className="text-xs text-gray-600 mt-1">They must already have a TeamBoard account.</p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={inviting || !email.trim()}>
                  {inviting ? 'Inviting…' : 'Invite'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
