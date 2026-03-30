'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, X, Calendar, User, Flag, MessageSquare, Trash2,
  Settings, UserPlus, Bell, Search, GripVertical,
  Check, AlertCircle, Tag, CheckSquare, Square,
  LayoutDashboard, List, Table2, CalendarDays,
  Hash, Link2, ToggleLeft, AlignLeft, ChevronDown,
  Sliders, Edit2, GripHorizontal, ArrowUpDown,
  ExternalLink, ChevronRight, ChevronLeft,
  BarChart2, Download, Layers, Copy, Users, Activity,
  Clock, AlertTriangle, Lock, Repeat, Github, Paperclip,
  Upload, FileText, Eye, EyeOff, Mail, Globe,
} from 'lucide-react'
import AnalyticsModal from './AnalyticsModal'
import GlobalSearchModal from './GlobalSearchModal'
import TaskTemplatesModal from './TaskTemplatesModal'

// ── Simple markdown renderer ───────────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.85em">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:0.9rem;font-weight:600;color:#d1d5db;margin:8px 0 4px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:1rem;font-weight:600;color:#e5e7eb;margin:10px 0 4px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:1.1rem;font-weight:700;color:#f3f4f6;margin:12px 0 4px">$1</h1>')
    .replace(/^- (.+)$/gm, '<li style="margin:2px 0 2px 16px;list-style:disc">$1</li>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#7ba3ff;text-decoration:underline">$1</a>')
    .replace(/\n/g, '<br/>')
}
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { format, isToday, isTomorrow, isPast, startOfMonth, endOfMonth,
         eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isSameMonth } from 'date-fns'

// ── Constants ──────────────────────────────────────────────────────────────────

const COLUMNS = [
  { id: 'todo',        label: 'To Do',       dotColor: '#64748b', colClass: 'col-todo',        headerGradient: 'from-slate-500/20 to-transparent' },
  { id: 'in_progress', label: 'In Progress', dotColor: '#2952ff', colClass: 'col-in-progress', headerGradient: 'from-brand-500/20 to-transparent' },
  { id: 'done',        label: 'Done',        dotColor: '#10b981', colClass: 'col-done',         headerGradient: 'from-emerald-500/20 to-transparent' },
]

const BOARD_COLORS = [
  '#2952ff', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#64748b',
]

const PRIORITY_BADGE = {
  high:   { cls: 'badge-high',   label: 'High' },
  medium: { cls: 'badge-medium', label: 'Medium' },
  low:    { cls: 'badge-low',    label: 'Low' },
}

const LABEL_OPTIONS = [
  { id: 'bug',      color: '#ef4444', text: 'Bug' },
  { id: 'feature',  color: '#2952ff', text: 'Feature' },
  { id: 'blocked',  color: '#f59e0b', text: 'Blocked' },
  { id: 'design',   color: '#8b5cf6', text: 'Design' },
  { id: 'research', color: '#06b6d4', text: 'Research' },
  { id: 'urgent',   color: '#ec4899', text: 'Urgent' },
  { id: 'infra',    color: '#10b981', text: 'Infra' },
  { id: 'docs',     color: '#64748b', text: 'Docs' },
]

const FIELD_TYPES = [
  { id: 'text',     label: 'Text',     icon: AlignLeft },
  { id: 'number',   label: 'Number',   icon: Hash },
  { id: 'select',   label: 'Select',   icon: ChevronDown },
  { id: 'date',     label: 'Date',     icon: Calendar },
  { id: 'checkbox', label: 'Checkbox', icon: ToggleLeft },
  { id: 'url',      label: 'URL',      icon: Link2 },
]

const VIEW_MODES = [
  { id: 'kanban',   label: 'Board',    icon: LayoutDashboard },
  { id: 'list',     label: 'List',     icon: List },
  { id: 'table',    label: 'Table',    icon: Table2 },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
]

const SELECT_COLORS = [
  '#ef4444','#f59e0b','#10b981','#2952ff','#8b5cf6','#ec4899','#06b6d4','#64748b',
]

async function fireConfetti() {
  try {
    const { default: confetti } = await import('canvas-confetti')
    confetti({ particleCount: 90, spread: 65, origin: { y: 0.6 },
      colors: ['#2952ff', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'] })
  } catch (_) {}
}

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

// ── Field type icon helper ─────────────────────────────────────────────────────

function FieldIcon({ type, size = 11 }) {
  const t = FIELD_TYPES.find(f => f.id === type)
  const Icon = t?.icon || AlignLeft
  return <Icon size={size} />
}

// ── Custom field value renderer ───────────────────────────────────────────────

function FieldValue({ field, value }) {
  if (value === undefined || value === null || value === '') return <span className="text-gray-600">—</span>
  switch (field.field_type) {
    case 'checkbox':
      return value ? <Check size={13} className="text-emerald-400" /> : <span className="text-gray-600">—</span>
    case 'url':
      return (
        <a href={value} target="_blank" rel="noopener noreferrer"
           className="text-brand-400 hover:text-brand-300 truncate flex items-center gap-1 text-xs"
           onClick={e => e.stopPropagation()}>
          <Link2 size={9} />{value}
        </a>
      )
    case 'select': {
      const opt = (field.options || []).find(o => o.value === value)
      if (!opt) return <span className="text-gray-400 text-xs">{value}</span>
      return (
        <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: `${opt.color}20`, color: opt.color, border: `1px solid ${opt.color}30` }}>
          {opt.value}
        </span>
      )
    }
    case 'date':
      return <span className="text-gray-300 text-xs">{format(new Date(value), 'MMM d, yyyy')}</span>
    default:
      return <span className="text-gray-300 text-xs truncate">{String(value)}</span>
  }
}

// ── Custom field input ─────────────────────────────────────────────────────────

function FieldInput({ field, value, onChange, disabled }) {
  switch (field.field_type) {
    case 'text':
      return (
        <input className="input text-sm py-1.5" value={value || ''} placeholder="—"
               onChange={e => onChange(e.target.value)} disabled={disabled} />
      )
    case 'number':
      return (
        <input type="number" className="input text-sm py-1.5" value={value ?? ''} placeholder="—"
               onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
               disabled={disabled} />
      )
    case 'url':
      return (
        <input type="url" className="input text-sm py-1.5" value={value || ''} placeholder="https://…"
               onChange={e => onChange(e.target.value)} disabled={disabled} />
      )
    case 'date':
      return (
        <input type="date" className="input text-sm py-1.5" value={value || ''}
               onChange={e => onChange(e.target.value || null)} disabled={disabled} />
      )
    case 'checkbox':
      return (
        <button
          type="button"
          onClick={() => !disabled && onChange(!value)}
          disabled={disabled}
          className="flex items-center gap-2 text-sm transition-colors"
          style={{ color: value ? '#10b981' : 'rgba(107,114,128,0.7)' }}
        >
          {value ? <CheckSquare size={16} /> : <Square size={16} />}
          <span>{value ? 'Yes' : 'No'}</span>
        </button>
      )
    case 'select': {
      const opts = field.options || []
      return (
        <select className="input text-sm py-1.5" value={value || ''} onChange={e => onChange(e.target.value || null)} disabled={disabled}>
          <option value="">—</option>
          {opts.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
        </select>
      )
    }
    default:
      return <input className="input text-sm py-1.5" value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled} />
  }
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function BoardClient({ board: initialBoard, tasks: initialTasks, members: initialMembers, boardFields: initialBoardFields, currentUser, userRole }) {
  const router = useRouter()
  const boardId = initialBoard.id

  // Core state
  const [board, setBoard]             = useState(initialBoard)
  const [tasks, setTasks]             = useState(initialTasks)
  const [members, setMembers]         = useState(initialMembers)
  const [boardFields, setBoardFields] = useState(initialBoardFields || [])

  // View mode
  const [viewMode, setViewMode] = useState('kanban')

  // Modal state
  const [activeTask, setActiveTask]     = useState(null)
  const [showNewTask, setShowNewTask]   = useState(null)
  const [showInvite, setShowInvite]     = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // DnD state
  const [draggingTask, setDraggingTask] = useState(null)

  // Filters
  const [searchQuery, setSearchQuery]       = useState('')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')

  // Notifications
  const [notifications, setNotifications]         = useState([])
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)
  const notifRef = useRef(null)

  // Bulk select
  const [bulkMode, setBulkMode]             = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set())

  // Swimlanes
  const [swimlaneBy, setSwimlaneBy] = useState('none')

  // Analytics / Global Search
  const [showAnalytics, setShowAnalytics]         = useState(false)
  const [showGlobalSearch, setShowGlobalSearch]   = useState(false)

  // Inline edit
  const [editingTaskId, setEditingTaskId]   = useState(null)
  const [editingTitle, setEditingTitle]     = useState('')

  // WIP limits (from board settings)
  const wipLimits = board.settings?.wip_limits || {}

  // Dark mode
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return true
    const saved = localStorage.getItem('tb_dark_mode')
    if (saved !== null) return saved === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  // Shortcuts overlay
  const [showShortcuts, setShowShortcuts] = useState(false)

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const searchRef = useRef(null)

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  // Apply / remove dark mode class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('tb_dark_mode', String(darkMode))
  }, [darkMode])

  useEffect(() => {
    function handleKeyDown(e) {
      const tag = e.target.tagName
      if (e.key === 'Escape') {
        setActiveTask(null); setShowNewTask(null)
        setShowInvite(false); setShowSettings(false); setShowNotifDropdown(false)
        setShowAnalytics(false); setShowGlobalSearch(false); setShowShortcuts(false)
        setBulkMode(false); setSelectedTaskIds(new Set())
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); setShowGlobalSearch(true); return
      }
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setShowNewTask('todo') }
      else if (e.key === '/') { e.preventDefault(); searchRef.current?.focus() }
      else if (e.key === '?') { e.preventDefault(); setShowShortcuts(v => !v) }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ── Polling ───────────────────────────────────────────────────────────────

  const pollTasks = useCallback(async () => {
    const { data, ok } = await apiFetch(`/api/boards/${boardId}/tasks`)
    if (ok && Array.isArray(data)) setTasks(data)
  }, [boardId])

  const pollNotifications = useCallback(async () => {
    const { data, ok } = await apiFetch('/api/notifications')
    if (ok && Array.isArray(data)) setNotifications(data)
  }, [])

  useEffect(() => {
    const taskInterval  = setInterval(pollTasks, 30_000)
    const notifInterval = setInterval(pollNotifications, 60_000)
    pollNotifications()
    return () => { clearInterval(taskInterval); clearInterval(notifInterval) }
  }, [pollTasks, pollNotifications])

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Task CRUD ─────────────────────────────────────────────────────────────

  async function createTask(status, fields) {
    const { data, ok } = await apiFetch(`/api/boards/${boardId}/tasks`, {
      method: 'POST', body: { ...fields, status },
    })
    if (ok) setTasks(prev => [...prev, data])
    return { ok, error: ok ? null : data.error }
  }

  async function updateTask(id, updates) {
    const prevTask = tasks.find(t => t.id === id)
    const { data, ok } = await apiFetch(`/api/boards/${boardId}/tasks/${id}`, { method: 'PATCH', body: updates })
    if (ok) {
      setTasks(prev => prev.map(t => t.id === id ? data : t))
      if (activeTask?.id === id) setActiveTask(data)
      if (updates.status === 'done' && prevTask?.status !== 'done') fireConfetti()
    }
    return { ok, data, error: ok ? null : data.error }
  }

  async function deleteTask(id) {
    const { ok } = await apiFetch(`/api/boards/${boardId}/tasks/${id}`, { method: 'DELETE' })
    if (ok) { setTasks(prev => prev.filter(t => t.id !== id)); if (activeTask?.id === id) setActiveTask(null) }
    return { ok }
  }

  async function moveTask(id, newStatus) {
    const prevTask = tasks.find(t => t.id === id)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
    if (newStatus === 'done' && prevTask?.status !== 'done') fireConfetti()
    await apiFetch(`/api/boards/${boardId}/tasks/${id}`, { method: 'PATCH', body: { status: newStatus } })
  }

  // ── Board CRUD ────────────────────────────────────────────────────────────

  async function updateBoard(updates) {
    const { data, ok } = await apiFetch(`/api/boards/${boardId}`, { method: 'PATCH', body: updates })
    if (ok) setBoard(data)
    return { ok, data, error: ok ? null : data.error }
  }

  async function deleteBoard() {
    const { ok } = await apiFetch(`/api/boards/${boardId}`, { method: 'DELETE' })
    if (ok) router.push('/dashboard')
    return { ok }
  }

  // ── Field CRUD ────────────────────────────────────────────────────────────

  async function createField(fieldData) {
    const { data, ok } = await apiFetch(`/api/boards/${boardId}/fields`, { method: 'POST', body: fieldData })
    if (ok) setBoardFields(prev => [...prev, data])
    return { ok, data, error: ok ? null : data.error }
  }

  async function updateField(fieldId, updates) {
    const { data, ok } = await apiFetch(`/api/boards/${boardId}/fields/${fieldId}`, { method: 'PATCH', body: updates })
    if (ok) setBoardFields(prev => prev.map(f => f.id === fieldId ? data : f))
    return { ok, data, error: ok ? null : data.error }
  }

  async function deleteField(fieldId) {
    const { ok } = await apiFetch(`/api/boards/${boardId}/fields/${fieldId}`, { method: 'DELETE' })
    if (ok) setBoardFields(prev => prev.filter(f => f.id !== fieldId))
    return { ok }
  }

  // ── Bulk actions ─────────────────────────────────────────────────────────

  function toggleSelectTask(id) {
    setSelectedTaskIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedTaskIds.size === filteredTasks.length) {
      setSelectedTaskIds(new Set())
    } else {
      setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)))
    }
  }

  async function bulkMove(newStatus) {
    const ids = [...selectedTaskIds]
    await Promise.all(ids.map(id => apiFetch(`/api/boards/${boardId}/tasks/${id}`, { method: 'PATCH', body: { status: newStatus } })))
    setTasks(prev => prev.map(t => selectedTaskIds.has(t.id) ? { ...t, status: newStatus } : t))
    setSelectedTaskIds(new Set())
  }

  async function bulkAssign(userId) {
    const ids = [...selectedTaskIds]
    await Promise.all(ids.map(id => apiFetch(`/api/boards/${boardId}/tasks/${id}`, { method: 'PATCH', body: { assigned_to: userId || null } })))
    await pollTasks()
    setSelectedTaskIds(new Set())
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selectedTaskIds.size} task(s)? This cannot be undone.`)) return
    const ids = [...selectedTaskIds]
    await Promise.all(ids.map(id => apiFetch(`/api/boards/${boardId}/tasks/${id}`, { method: 'DELETE' })))
    setTasks(prev => prev.filter(t => !selectedTaskIds.has(t.id)))
    setSelectedTaskIds(new Set()); setBulkMode(false)
  }

  // ── Export CSV ────────────────────────────────────────────────────────────

  function exportCSV() {
    const headers = ['Title', 'Status', 'Priority', 'Assigned To', 'Due Date', 'Labels', 'Description', 'Created']
    const rows = filteredTasks.map(t => [
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.status,
      t.priority,
      `"${t.assignee?.full_name || t.assignee?.email || ''}"`,
      t.due_date || '',
      `"${(t.labels || []).map(l => l.text).join(', ')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.created_at ? format(new Date(t.created_at), 'yyyy-MM-dd') : '',
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${board.name.replace(/\s+/g, '_')}_tasks.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  // ── Duplicate board ────────────────────────────────────────────────────────

  async function duplicateBoard(includeTasks = true) {
    const { data, ok } = await apiFetch(`/api/boards/${boardId}/duplicate`, {
      method: 'POST', body: { include_tasks: includeTasks },
    })
    if (ok) router.push(`/boards/${data.id}`)
    return { ok, error: ok ? null : data.error }
  }

  // ── Inline edit ───────────────────────────────────────────────────────────

  async function inlineEditSave(id) {
    const t = editingTitle.trim()
    if (t && t !== tasks.find(x => x.id === id)?.title) {
      await updateTask(id, { title: t })
    }
    setEditingTaskId(null); setEditingTitle('')
  }

  // ── Voting ────────────────────────────────────────────────────────────────

  async function toggleVote(taskId) {
    const { data, ok } = await apiFetch(`/api/boards/${boardId}/tasks/${taskId}/vote`, { method: 'POST' })
    if (ok) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, votes: data.votes } : t))
      if (activeTask?.id === taskId) setActiveTask(prev => ({ ...prev, votes: data.votes }))
    }
  }

  // ── Members ───────────────────────────────────────────────────────────────

  async function inviteMember(email) {
    const { data, ok } = await apiFetch(`/api/boards/${boardId}/members`, { method: 'POST', body: { email } })
    if (ok) { setMembers(prev => [...prev, data.user]); router.refresh() }
    return { ok, error: ok ? null : data.error }
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  async function markNotifRead(id) {
    await apiFetch(`/api/notifications/${id}`, { method: 'PATCH' })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllNotifsRead() {
    await apiFetch('/api/notifications/all', { method: 'PATCH' })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  // ── DnD ───────────────────────────────────────────────────────────────────

  function handleDragStart(event) {
    setDraggingTask(tasks.find(t => t.id === event.active.id) || null)
  }

  function handleDragEnd(event) {
    const { active, over } = event
    setDraggingTask(null)
    if (!over) return
    const targetColumn = COLUMNS.find(c => c.id === over.id)?.id
    if (!targetColumn) return
    const task = tasks.find(t => t.id === active.id)
    if (task && task.status !== targetColumn) moveTask(active.id, targetColumn)
  }

  // ── Filtered / grouped tasks ──────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchSearch   = !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase())
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* Board header */}
      <header className="flex items-center justify-between px-7 py-4 shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(7,7,15,0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
               style={{ backgroundColor: board.color }}>
            {board.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-100">{board.name}</h1>
            {board.description && <p className="text-xs text-gray-500">{board.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View mode switcher */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            {VIEW_MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setViewMode(id)}
                title={label}
                className="px-3 py-1.5 transition-all flex items-center gap-1.5 text-xs font-medium"
                style={viewMode === id
                  ? { background: 'linear-gradient(135deg,rgba(41,82,255,0.25),rgba(109,40,217,0.2))', color: '#7ba3ff', borderRight: '1px solid rgba(41,82,255,0.15)' }
                  : { background: 'transparent', color: 'rgba(107,114,128,0.8)' }}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Member avatars */}
          <div className="flex -space-x-2">
            {members.slice(0, 5).map(m => (
              <div key={m.id} title={m.full_name || m.email}
                   className="w-7 h-7 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center text-[10px] font-bold text-gray-200">
                {(m.full_name || m.email || '?')[0].toUpperCase()}
              </div>
            ))}
          </div>

          {userRole === 'owner' && (
            <button onClick={() => setShowInvite(true)} className="btn-ghost flex items-center gap-1.5 text-xs">
              <UserPlus size={14} /> Invite
            </button>
          )}

          {/* Notification bell */}
          <div className="relative" ref={notifRef}>
            <button onClick={() => setShowNotifDropdown(v => !v)} className="btn-ghost p-2 relative">
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-brand-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifDropdown && (
              <NotificationDropdown notifications={notifications} onMarkRead={markNotifRead}
                onMarkAllRead={markAllNotifsRead} onClose={() => setShowNotifDropdown(false)} />
            )}
          </div>

          {/* Analytics */}
          <button onClick={() => setShowAnalytics(true)} className="btn-ghost p-2" title="Board analytics">
            <BarChart2 size={16} />
          </button>

          {/* Export CSV */}
          <button onClick={exportCSV} className="btn-ghost p-2" title="Export to CSV">
            <Download size={16} />
          </button>

          {/* Global search */}
          <button onClick={() => setShowGlobalSearch(true)} className="btn-ghost p-2" title="Global search (⌘K)">
            <Search size={16} />
          </button>

          {/* Dark mode toggle */}
          <button onClick={() => setDarkMode(v => !v)} className="btn-ghost p-2" title={darkMode ? 'Light mode' : 'Dark mode'}>
            {darkMode ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>

          {/* Keyboard shortcuts */}
          <button onClick={() => setShowShortcuts(true)} className="btn-ghost p-2" title="Keyboard shortcuts (?)">
            <Hash size={16} />
          </button>

          {userRole === 'owner' && (
            <button onClick={() => setShowSettings(true)} className="btn-ghost p-2">
              <Settings size={16} />
            </button>
          )}

          <span className="text-xs text-gray-400 px-2.5 py-1 rounded-full font-medium"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex items-center gap-3 px-7 py-3 shrink-0"
           style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(7,7,15,0.6)', backdropFilter: 'blur(8px)' }}>
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input ref={searchRef} className="input pl-8 py-1.5 text-xs h-8"
                 placeholder="Search tasks… (/)" value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <select className="input py-1.5 text-xs h-8 w-36" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select className="input py-1.5 text-xs h-8 w-36" value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
          <option value="all">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setSearchQuery(''); setFilterPriority('all'); setFilterAssignee('all') }}
                  className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
            <X size={12} /> Clear
          </button>
        )}

        {/* Swimlane toggle (kanban only) */}
        {viewMode === 'kanban' && (
          <button
            onClick={() => setSwimlaneBy(s => s === 'none' ? 'assignee' : 'none')}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
            style={swimlaneBy !== 'none'
              ? { background: 'rgba(41,82,255,0.15)', color: '#7ba3ff', border: '1px solid rgba(41,82,255,0.3)' }
              : { background: 'rgba(255,255,255,0.04)', color: 'rgba(107,114,128,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Layers size={12} /> Swimlanes
          </button>
        )}

        {/* Bulk select toggle */}
        <button
          onClick={() => { setBulkMode(v => !v); setSelectedTaskIds(new Set()) }}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all ml-auto"
          style={bulkMode
            ? { background: 'rgba(41,82,255,0.15)', color: '#7ba3ff', border: '1px solid rgba(41,82,255,0.3)' }
            : { background: 'rgba(255,255,255,0.04)', color: 'rgba(107,114,128,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <CheckSquare size={12} /> {bulkMode ? `${selectedTaskIds.size} selected` : 'Select'}
        </button>
      </div>

      {/* View content */}
      {viewMode === 'kanban' && swimlaneBy === 'none' && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-5 p-6 h-full min-w-fit">
              {COLUMNS.map(col => (
                <DroppableColumn key={col.id} column={col} tasks={tasksByStatus[col.id]}
                  members={members} canEdit={userRole !== 'viewer'}
                  onTaskClick={setActiveTask} onAddTask={() => setShowNewTask(col.id)}
                  draggingTaskId={draggingTask?.id}
                  wipLimit={wipLimits[col.id]}
                  bulkMode={bulkMode} selectedTaskIds={selectedTaskIds} onToggleSelect={toggleSelectTask}
                  editingTaskId={editingTaskId} editingTitle={editingTitle}
                  onStartEdit={(t) => { setEditingTaskId(t.id); setEditingTitle(t.title) }}
                  onSaveEdit={inlineEditSave}
                  onEditTitleChange={setEditingTitle} />
              ))}
            </div>
          </div>
          <DragOverlay>
            {draggingTask ? (
              <div className="card p-3.5 w-72 opacity-90 shadow-2xl rotate-1 border-brand-600">
                <p className="text-sm text-gray-200 font-medium">{draggingTask.title}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {viewMode === 'kanban' && swimlaneBy === 'assignee' && (
        <SwimlaneKanban tasks={filteredTasks} members={members} canEdit={userRole !== 'viewer'}
          onTaskClick={setActiveTask} onAddTask={setShowNewTask} onMoveTask={moveTask}
          wipLimits={wipLimits}
          bulkMode={bulkMode} selectedTaskIds={selectedTaskIds} onToggleSelect={toggleSelectTask} />
      )}

      {viewMode === 'list' && (
        <ListView tasks={filteredTasks} members={members} boardFields={boardFields}
          canEdit={userRole !== 'viewer'} onTaskClick={setActiveTask}
          onAddTask={() => setShowNewTask('todo')} onMoveTask={moveTask} />
      )}

      {viewMode === 'table' && (
        <TableView tasks={filteredTasks} members={members} boardFields={boardFields}
          canEdit={userRole !== 'viewer'} onTaskClick={setActiveTask}
          onAddTask={() => setShowNewTask('todo')} />
      )}

      {viewMode === 'calendar' && (
        <CalendarView tasks={filteredTasks} onTaskClick={setActiveTask} />
      )}

      {/* Modals */}
      {showNewTask && (
        <NewTaskModal status={showNewTask} members={members} boardFields={boardFields} boardId={initialBoard.id} onClose={() => setShowNewTask(null)}
          onCreate={async (data) => { const { ok } = await createTask(showNewTask, data); if (ok) setShowNewTask(null) }} />
      )}

      {activeTask && (
        <TaskDetailModal task={activeTask} boardId={boardId} members={members}
          boardFields={boardFields} currentUser={currentUser} canEdit={userRole !== 'viewer'}
          tasks={tasks}
          onClose={() => setActiveTask(null)} onUpdate={updateTask}
          onDelete={deleteTask} onMove={moveTask} onVote={toggleVote} />
      )}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvite={inviteMember} />}

      {showSettings && (
        <BoardSettingsModal board={board} boardFields={boardFields}
          onClose={() => setShowSettings(false)} onUpdate={updateBoard} onDelete={deleteBoard}
          onCreateField={createField} onUpdateField={updateField} onDeleteField={deleteField}
          onDuplicate={duplicateBoard} />
      )}

      {showAnalytics && (
        <AnalyticsModal tasks={tasks} members={members} onClose={() => setShowAnalytics(false)} />
      )}

      {showGlobalSearch && (
        <GlobalSearchModal
          onClose={() => setShowGlobalSearch(false)}
          onOpenTask={(task) => { setActiveTask(task) }}
          currentBoardId={boardId} />
      )}

      {/* Bulk action toolbar */}
      {bulkMode && selectedTaskIds.size > 0 && (
        <BulkActionToolbar
          count={selectedTaskIds.size}
          members={members}
          onMove={bulkMove}
          onAssign={bulkAssign}
          onDelete={bulkDelete}
          onClear={() => setSelectedTaskIds(new Set())}
        />
      )}

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && <ShortcutOverlay onClose={() => setShowShortcuts(false)} />}
    </div>
  )
}

// ── Droppable Column (Kanban) ──────────────────────────────────────────────────

function DroppableColumn({ column, tasks, members, canEdit, onTaskClick, onAddTask, draggingTaskId,
  wipLimit, bulkMode, selectedTaskIds, onToggleSelect, editingTaskId, editingTitle, onStartEdit, onSaveEdit, onEditTitleChange }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const atWip  = wipLimit && tasks.length >= wipLimit
  const overWip = wipLimit && tasks.length > wipLimit
  const wipColor = overWip ? '#ef4444' : atWip ? '#f59e0b' : null

  return (
    <div ref={setNodeRef}
         className={`w-72 shrink-0 flex flex-col rounded-2xl transition-all duration-200 ${column.colClass}
           ${isOver ? 'ring-2 ring-brand-400 ring-offset-2 ring-offset-[#07070f] scale-[1.01]' : ''}`}
         style={{ minHeight: '200px', outline: wipColor ? `1px solid ${wipColor}40` : undefined }}>
      <div className={`flex items-center justify-between px-4 py-3 rounded-t-2xl bg-gradient-to-r ${column.headerGradient}`}
           style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full shadow-lg"
               style={{ backgroundColor: column.dotColor, boxShadow: `0 0 8px ${column.dotColor}80` }} />
          <span className="text-sm font-bold text-gray-100">{column.label}</span>
          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                style={wipColor
                  ? { background: `${wipColor}20`, color: wipColor, border: `1px solid ${wipColor}40` }
                  : { background: 'rgba(255,255,255,0.08)', color: 'rgba(156,163,175,0.9)' }}>
            {tasks.length}{wipLimit ? `/${wipLimit}` : ''}
          </span>
          {wipColor && <AlertTriangle size={11} style={{ color: wipColor }} />}
        </div>
        {canEdit && (
          <button onClick={onAddTask} className="w-6 h-6 rounded-md flex items-center justify-center transition-all"
                  style={{ color: 'rgba(156,163,175,0.6)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'white' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(156,163,175,0.6)' }}>
            <Plus size={14} />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {tasks.map(task => (
          <DraggableTaskCard key={task.id} task={task} onClick={() => onTaskClick(task)}
            isDragging={task.id === draggingTaskId} columnColor={column.dotColor}
            bulkMode={bulkMode} selected={selectedTaskIds?.has(task.id)} onToggleSelect={onToggleSelect}
            isEditing={editingTaskId === task.id} editingTitle={editingTitle}
            onStartEdit={onStartEdit} onSaveEdit={onSaveEdit} onEditTitleChange={onEditTitleChange} />
        ))}
        {canEdit && (
          <button onClick={onAddTask}
                  className="w-full text-left text-xs flex items-center gap-1.5 py-2 px-2.5 rounded-xl transition-all duration-150"
                  style={{ color: 'rgba(100,116,139,0.8)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(156,163,175,0.9)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(100,116,139,0.8)' }}>
            <Plus size={12} /> Add task
          </button>
        )}
      </div>
    </div>
  )
}

// ── Draggable Task Card (Kanban) ───────────────────────────────────────────────

function DraggableTaskCard({ task, onClick, isDragging, columnColor,
  bulkMode, selected, onToggleSelect, isEditing, editingTitle, onStartEdit, onSaveEdit, onEditTitleChange }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id })
  const badge = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.low
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
  const transformStyle = transform ? { transform: CSS.Translate.toString(transform) } : {}

  function handleClick(e) {
    if (bulkMode) { e.stopPropagation(); onToggleSelect(task.id); return }
    onClick()
  }

  return (
    <div ref={setNodeRef}
         className={`rounded-xl p-3.5 transition-all duration-150 group space-y-2.5 relative cursor-pointer ${isDragging ? 'opacity-40' : ''}`}
         style={{
           ...transformStyle,
           background: selected ? 'rgba(41,82,255,0.12)' : 'rgba(14,14,26,0.8)',
           border: selected ? '1px solid rgba(41,82,255,0.4)' : '1px solid rgba(255,255,255,0.07)',
           borderLeft: `3px solid ${selected ? '#2952ff' : columnColor + '40'}`,
           borderRadius: '12px',
         }}
         onMouseEnter={e => {
           if (!isDragging && !selected) {
             e.currentTarget.style.borderLeftColor = columnColor
             e.currentTarget.style.boxShadow = `0 0 0 1px rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.4), 0 0 12px ${columnColor}20`
             e.currentTarget.style.transform = (transformStyle.transform || '') + ' translateY(-1px)'
           }
         }}
         onMouseLeave={e => {
           if (!selected) {
             e.currentTarget.style.borderLeftColor = `${columnColor}40`
             e.currentTarget.style.boxShadow = ''
           }
           e.currentTarget.style.transform = transformStyle.transform || ''
         }}
         onClick={handleClick}>

      {/* Bulk checkbox or drag handle */}
      {bulkMode ? (
        <div className="absolute top-3 right-3" onClick={e => { e.stopPropagation(); onToggleSelect(task.id) }}>
          <div className="w-4 h-4 rounded flex items-center justify-center transition-all"
               style={selected
                 ? { background: '#2952ff', border: '1px solid #2952ff' }
                 : { background: 'transparent', border: '1px solid rgba(107,114,128,0.4)' }}>
            {selected && <Check size={10} className="text-white" />}
          </div>
        </div>
      ) : (
        <div {...attributes} {...listeners} onClick={e => e.stopPropagation()}
             className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-0.5 rounded"
             style={{ color: 'rgba(100,116,139,0.7)' }}>
          <GripVertical size={13} />
        </div>
      )}

      {/* Title — double-click to inline edit */}
      {isEditing ? (
        <input
          className="text-sm text-gray-200 font-semibold w-full bg-gray-800 border border-brand-500/50 rounded px-1.5 py-0.5 outline-none pr-5"
          value={editingTitle}
          autoFocus
          onChange={e => onEditTitleChange(e.target.value)}
          onClick={e => e.stopPropagation()}
          onBlur={() => onSaveEdit(task.id)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); onSaveEdit(task.id) }
            if (e.key === 'Escape') { onEditTitleChange(''); onSaveEdit(task.id) }
          }}
        />
      ) : (
        <p
          className="text-sm text-gray-200 font-semibold leading-snug pr-5 group-hover:text-white transition-colors"
          onDoubleClick={e => { e.stopPropagation(); onStartEdit(task) }}>
          {task.title}
        </p>
      )}

      {task.description && (
        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{task.description}</p>
      )}
      {task.labels?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.labels.map(l => (
            <span key={l.id} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: `${l.color}20`, color: l.color, border: `1px solid ${l.color}30` }}>
              {l.text}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={badge.cls}><Flag size={9} />{badge.label}</span>
          {task.due_date && (
            <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium
              ${isOverdue ? 'text-red-400 bg-red-500/10 border border-red-500/20' : 'text-gray-500 bg-white/5 border border-white/8'}`}>
              <Calendar size={9} />{format(new Date(task.due_date), 'MMM d')}
            </span>
          )}
          {task.subtasks?.length > 0 && (
            <span className="text-[10px] font-medium text-gray-600 flex items-center gap-0.5">
              <CheckSquare size={9} />{task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
            </span>
          )}
          {task.blocked_by?.length > 0 && (
            <span className="text-[10px] font-medium flex items-center gap-0.5" style={{ color: '#f59e0b' }}>
              <Lock size={9} />Blocked
            </span>
          )}
          {task.recur_rule && (
            <span className="text-[10px] font-medium text-gray-600 flex items-center gap-0.5">
              <Repeat size={9} />{task.recur_rule}
            </span>
          )}
          {(task.attachments_count > 0 || task._att_count > 0) && (
            <span className="text-[10px] text-gray-600 flex items-center gap-0.5">
              <Paperclip size={9} />
            </span>
          )}
        </div>
        {task.assignee && (
          <div title={task.assignee.full_name || task.assignee.email}
               className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
               style={{ background: 'linear-gradient(135deg, #2952ff, #8b5cf6)' }}>
            {(task.assignee.full_name || task.assignee.email || '?')[0].toUpperCase()}
          </div>
        )}
        {task.votes?.length > 0 && (
          <span className="text-[10px] font-medium text-gray-500 flex items-center gap-0.5 ml-auto">
            ▲ {task.votes.length}
          </span>
        )}
      </div>
    </div>
  )
}

// ── List View ──────────────────────────────────────────────────────────────────

function ListView({ tasks, members, boardFields, canEdit, onTaskClick, onAddTask, onMoveTask }) {
  const grouped = useMemo(() => {
    const map = { todo: [], in_progress: [], done: [] }
    tasks.forEach(t => { if (map[t.status]) map[t.status].push(t) })
    return map
  }, [tasks])

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {COLUMNS.map(col => {
          const colTasks = grouped[col.id]
          return (
            <div key={col.id}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.dotColor }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(156,163,175,0.7)' }}>
                  {col.label}
                </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(156,163,175,0.7)' }}>
                  {colTasks.length}
                </span>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                {colTasks.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-gray-600 italic">No tasks</div>
                ) : (
                  colTasks.map((task, i) => (
                    <ListTaskRow key={task.id} task={task} col={col} boardFields={boardFields}
                      isLast={i === colTasks.length - 1} onClick={() => onTaskClick(task)}
                      canEdit={canEdit} onMoveTask={onMoveTask} />
                  ))
                )}
                {canEdit && (
                  <button onClick={onAddTask}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-xs transition-colors"
                          style={{ color: 'rgba(100,116,139,0.7)', borderTop: colTasks.length > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
                          onMouseLeave={e => e.currentTarget.style.color = 'rgba(100,116,139,0.7)'}>
                    <Plus size={12} /> Add task
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ListTaskRow({ task, col, boardFields, isLast, onClick, canEdit, onMoveTask }) {
  const badge = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.low
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done'
  const customValues = task.custom_values || {}

  return (
    <div onClick={onClick} className="flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors group"
         style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)', background: 'rgba(14,14,26,0.5)' }}
         onMouseEnter={e => e.currentTarget.style.background = 'rgba(41,82,255,0.04)'}
         onMouseLeave={e => e.currentTarget.style.background = 'rgba(14,14,26,0.5)'}>
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col.dotColor }} />
      <p className={`flex-1 text-sm font-medium truncate ${task.status === 'done' ? 'line-through text-gray-500' : 'text-gray-200 group-hover:text-white'}`}>
        {task.title}
      </p>
      <div className="flex items-center gap-2.5 shrink-0">
        <span className={badge.cls}><Flag size={9} />{badge.label}</span>
        {task.due_date && (
          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5
            ${isOverdue ? 'text-red-400 bg-red-500/10' : 'text-gray-500 bg-white/5'}`}>
            <Calendar size={9} />{format(new Date(task.due_date), 'MMM d')}
          </span>
        )}
        {/* Custom field values (first 2 fields) */}
        {boardFields.slice(0, 2).map(field => {
          const val = customValues[field.id]
          if (val === undefined || val === null || val === '') return null
          return (
            <span key={field.id} className="text-[11px] text-gray-500 flex items-center gap-1">
              <FieldIcon type={field.field_type} size={9} />
              <FieldValue field={field} value={val} />
            </span>
          )
        })}
        {task.assignee && (
          <div title={task.assignee.full_name || task.assignee.email}
               className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
               style={{ background: 'linear-gradient(135deg,#2952ff,#8b5cf6)' }}>
            {(task.assignee.full_name || task.assignee.email || '?')[0].toUpperCase()}
          </div>
        )}
        {task.subtasks?.length > 0 && (
          <span className="text-[10px] text-gray-600 flex items-center gap-0.5">
            <CheckSquare size={9} />{task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Table View ─────────────────────────────────────────────────────────────────

function TableView({ tasks, members, boardFields, canEdit, onTaskClick, onAddTask }) {
  const [sortKey, setSortKey]   = useState('created_at')
  const [sortDir, setSortDir]   = useState('desc')

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = useMemo(() => {
    return [...tasks].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey]
      // Custom field sort
      if (sortKey.startsWith('cf_')) {
        const fieldId = sortKey.slice(3)
        av = (a.custom_values || {})[fieldId]
        bv = (b.custom_values || {})[fieldId]
      }
      if (av == null && bv == null) return 0
      if (av == null) return sortDir === 'asc' ? 1 : -1
      if (bv == null) return sortDir === 'asc' ? -1 : 1
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [tasks, sortKey, sortDir])

  const SortIcon = ({ col }) => (
    <ArrowUpDown size={10} className={`ml-1 transition-opacity ${sortKey === col ? 'opacity-100' : 'opacity-30'}`} />
  )

  const statusColors = { todo: '#64748b', in_progress: '#2952ff', done: '#10b981' }
  const statusLabels = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="min-w-max rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Table header */}
        <div className="flex items-center px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest"
             style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(107,114,128,0.8)' }}>
          <div className="w-8 shrink-0" />
          <button className="flex-1 min-w-[200px] text-left flex items-center hover:text-gray-300 transition-colors" onClick={() => toggleSort('title')}>
            Title <SortIcon col="title" />
          </button>
          <button className="w-28 text-left flex items-center hover:text-gray-300 transition-colors" onClick={() => toggleSort('status')}>
            Status <SortIcon col="status" />
          </button>
          <button className="w-24 text-left flex items-center hover:text-gray-300 transition-colors" onClick={() => toggleSort('priority')}>
            Priority <SortIcon col="priority" />
          </button>
          <button className="w-28 text-left flex items-center hover:text-gray-300 transition-colors" onClick={() => toggleSort('due_date')}>
            Due Date <SortIcon col="due_date" />
          </button>
          <div className="w-28 text-left">Assignee</div>
          {boardFields.map(field => (
            <button key={field.id} className="w-32 text-left flex items-center hover:text-gray-300 transition-colors"
                    onClick={() => toggleSort(`cf_${field.id}`)}>
              <FieldIcon type={field.field_type} />
              <span className="ml-1 truncate">{field.name}</span>
              <SortIcon col={`cf_${field.id}`} />
            </button>
          ))}
        </div>

        {/* Table rows */}
        {sorted.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-600 text-sm">No tasks match the current filters.</div>
        ) : (
          sorted.map((task, i) => {
            const badge = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.low
            const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done'
            const customValues = task.custom_values || {}
            return (
              <div key={task.id} onClick={() => onTaskClick(task)}
                   className="flex items-center px-4 py-3 cursor-pointer transition-colors group"
                   style={{ borderBottom: i < sorted.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', background: 'rgba(14,14,26,0.4)' }}
                   onMouseEnter={e => e.currentTarget.style.background = 'rgba(41,82,255,0.05)'}
                   onMouseLeave={e => e.currentTarget.style.background = 'rgba(14,14,26,0.4)'}>
                <div className="w-8 shrink-0">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColors[task.status] }} />
                </div>
                <p className={`flex-1 min-w-[200px] text-sm font-medium truncate pr-4 ${task.status === 'done' ? 'line-through text-gray-500' : 'text-gray-200 group-hover:text-white'}`}>
                  {task.title}
                </p>
                <div className="w-28">
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ background: `${statusColors[task.status]}18`, color: statusColors[task.status], border: `1px solid ${statusColors[task.status]}30` }}>
                    {statusLabels[task.status]}
                  </span>
                </div>
                <div className="w-24">
                  <span className={badge.cls}><Flag size={9} />{badge.label}</span>
                </div>
                <div className="w-28">
                  {task.due_date ? (
                    <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                      {format(new Date(task.due_date), 'MMM d, yyyy')}
                    </span>
                  ) : <span className="text-gray-600">—</span>}
                </div>
                <div className="w-28">
                  {task.assignee ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                           style={{ background: 'linear-gradient(135deg,#2952ff,#8b5cf6)' }}>
                        {(task.assignee.full_name || task.assignee.email || '?')[0].toUpperCase()}
                      </div>
                      <span className="text-xs text-gray-400 truncate">
                        {task.assignee.full_name || task.assignee.email}
                      </span>
                    </div>
                  ) : <span className="text-gray-600">—</span>}
                </div>
                {boardFields.map(field => (
                  <div key={field.id} className="w-32 pr-2" onClick={e => e.stopPropagation()}>
                    <FieldValue field={field} value={customValues[field.id]} />
                  </div>
                ))}
              </div>
            )
          })
        )}

        {/* Add row */}
        {canEdit && (
          <button onClick={onAddTask}
                  className="flex items-center gap-2 px-4 py-3 w-full text-xs transition-colors"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(100,116,139,0.7)' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(100,116,139,0.7)'}>
            <Plus size={12} /> Add task
          </button>
        )}
      </div>
    </div>
  )
}

// ── Calendar View ──────────────────────────────────────────────────────────────

function CalendarView({ tasks, onTaskClick }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart  = startOfMonth(currentMonth)
  const monthEnd    = endOfMonth(currentMonth)
  const days        = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad    = getDay(monthStart) // 0=Sun

  const tasksByDay = useMemo(() => {
    const map = {}
    tasks.forEach(t => {
      if (!t.due_date) return
      const key = format(new Date(t.due_date), 'yyyy-MM-dd')
      if (!map[key]) map[key] = []
      map[key].push(t)
    })
    return map
  }, [tasks])

  const noDateTasks = tasks.filter(t => !t.due_date)

  const statusColors = { todo: '#64748b', in_progress: '#2952ff', done: '#10b981' }
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
                  className="btn-ghost p-2"><ChevronLeft size={16} /></button>
          <h2 className="text-base font-semibold text-gray-100">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))}
                  className="btn-ghost p-2"><ChevronRight size={16} /></button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekdays.map(d => (
            <div key={d} className="text-center text-[11px] font-bold uppercase tracking-widest py-2"
                 style={{ color: 'rgba(107,114,128,0.6)' }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Padding cells */}
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[100px] rounded-xl p-2"
                 style={{ background: 'rgba(255,255,255,0.01)' }} />
          ))}

          {/* Day cells */}
          {days.map(day => {
            const key = format(day, 'yyyy-MM-dd')
            const dayTasks = tasksByDay[key] || []
            const isToday_ = isToday(day)
            const isCurrentMonth = isSameMonth(day, currentMonth)

            return (
              <div key={key} className="min-h-[100px] rounded-xl p-2 flex flex-col"
                   style={{
                     background: isToday_ ? 'rgba(41,82,255,0.08)' : 'rgba(255,255,255,0.02)',
                     border: isToday_ ? '1px solid rgba(41,82,255,0.25)' : '1px solid rgba(255,255,255,0.05)',
                   }}>
                <div className={`text-xs font-semibold mb-1.5 w-6 h-6 flex items-center justify-center rounded-full
                  ${isToday_ ? 'bg-brand-500 text-white' : 'text-gray-500'}`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1 flex-1 min-h-0 overflow-hidden">
                  {dayTasks.slice(0, 3).map(task => (
                    <button key={task.id} onClick={() => onTaskClick(task)}
                            className="w-full text-left rounded-md px-1.5 py-1 text-[10px] font-medium truncate transition-opacity hover:opacity-80"
                            style={{ background: `${statusColors[task.status]}25`, color: statusColors[task.status], border: `1px solid ${statusColors[task.status]}30` }}>
                      {task.title}
                    </button>
                  ))}
                  {dayTasks.length > 3 && (
                    <p className="text-[10px] text-gray-600 pl-1">+{dayTasks.length - 3} more</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* No-date tasks */}
        {noDateTasks.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(107,114,128,0.6)' }}>
              No due date ({noDateTasks.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {noDateTasks.map(task => (
                <button key={task.id} onClick={() => onTaskClick(task)}
                        className="text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all hover:opacity-80"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: 'rgba(156,163,175,0.9)',
                        }}>
                  {task.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── New Task Modal ─────────────────────────────────────────────────────────────

function NewTaskModal({ status, members, boardFields = [], onClose, onCreate, boardId }) {
  const [showTemplates, setShowTemplates] = useState(false)
  
  function applyTemplate(templateData) {
    setTitle(templateData.title || '')
    setDescription(templateData.description || '')
    setStatus(templateData.status || status || 'todo')
    setPriority(templateData.priority || 'medium')
    if (templateData.custom_values) setCustomValues(templateData.custom_values)
  }

  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [assignedTo, setAssignedTo]   = useState('')
  const [priority, setPriority]       = useState('medium')
  const [dueDate, setDueDate]         = useState('')
  const [customValues, setCustomValues] = useState({})
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState(null)

  function setCustomValue(fieldId, value) {
    setCustomValues(prev => ({ ...prev, [fieldId]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true); setError(null)
    const { ok, error: err } = await onCreate({
      title: title.trim(), description: description.trim(),
      assigned_to: assignedTo || null, priority, due_date: dueDate || null,
      custom_values: customValues,
    })
    if (!ok) setError(err || 'Failed to create task')
    setSaving(false)
  }

  const colLabel = COLUMNS.find(c => c.id === status)?.label || status

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-100">New task · <span className="text-gray-400 font-normal">{colLabel}</span></h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Template Picker */}
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setShowTemplates(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/20 text-purple-400 hover:text-purple-300 transition-all text-xs font-medium"
              >
                <FileText className="w-3.5 h-3.5" />
                Use Template
              </button>
            </div>
            {showTemplates && (
              <TaskTemplatesModal
                isOpen={showTemplates}
                onClose={() => setShowTemplates(false)}
                boardId={boardId}
                onSelectTemplate={applyTemplate}
              />
            )}
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
              {members.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
            </select>
          </div>

          {/* Custom fields */}
          {boardFields.length > 0 && (
            <div className="pt-2 border-t border-gray-800 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-600">Custom fields</p>
              {boardFields.map(field => (
                <div key={field.id}>
                  <label className="label flex items-center gap-1">
                    <FieldIcon type={field.field_type} /> {field.name}
                  </label>
                  <FieldInput
                    field={field}
                    value={customValues[field.id]}
                    onChange={val => setCustomValue(field.id, val)}
                  />
                </div>
              ))}
            </div>
          )}

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

function TaskDetailModal({ task, boardId, members, boardFields, currentUser, canEdit, tasks, onClose, onUpdate, onDelete, onMove, onVote }) {
  const [title, setTitle]               = useState(task.title)
  const [description, setDescription]   = useState(task.description || '')
  const [priority, setPriority]         = useState(task.priority)
  const [assignedTo, setAssignedTo]     = useState(task.assigned_to || '')
  const [dueDate, setDueDate]           = useState(task.due_date || '')
  const [status, setStatus]             = useState(task.status)
  const [labels, setLabels]             = useState(task.labels || [])
  const [subtasks, setSubtasks]         = useState(task.subtasks || [])
  const [customValues, setCustomValues] = useState(task.custom_values || {})
  const [newSubtask, setNewSubtask]     = useState('')
  const [saving, setSaving]             = useState(false)
  const [comment, setComment]           = useState('')
  const [comments, setComments]         = useState([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [addingComment, setAddingComment]     = useState(false)
  const [bottomTab, setBottomTab]             = useState('comments') // 'comments' | 'activity'
  const [activityLog, setActivityLog]         = useState([])
  const [loadingActivity, setLoadingActivity] = useState(false)
  const commentsEndRef = useRef(null)

  // New feature state
  const [blockedBy, setBlockedBy]             = useState(task.blocked_by || [])
  const [recurRule, setRecurRule]             = useState(task.recur_rule || '')
  const [githubPrUrl, setGithubPrUrl]         = useState(task.github_pr_url || '')
  const [prStatus, setPrStatus]               = useState(null) // { state, html_url, title }
  const [descEditMode, setDescEditMode]       = useState(false)
  const [attachments, setAttachments]         = useState([])
  const [loadingAtt, setLoadingAtt]           = useState(true)
  const [uploadingAtt, setUploadingAtt]       = useState(false)
  const fileInputRef = useRef(null)

  // Time tracking
  const [timeEntries, setTimeEntries]         = useState([])
  const [loadingTime, setLoadingTime]         = useState(true)
  const [timerRunning, setTimerRunning]       = useState(false)
  const [timerSeconds, setTimerSeconds]       = useState(0)
  const [activeEntryId, setActiveEntryId]     = useState(null)
  const timerRef = useRef(null)

  // Votes
  const [votes, setVotes] = useState(task.votes || [])

  useEffect(() => {
    async function load() {
      setLoadingComments(true)
      const { data, ok } = await apiFetch(`/api/tasks/${task.id}/comments`)
      if (ok) setComments(data || [])
      setLoadingComments(false)
    }
    load()
  }, [task.id])

  useEffect(() => {
    if (bottomTab !== 'activity') return
    async function loadActivity() {
      setLoadingActivity(true)
      const { data, ok } = await apiFetch(`/api/tasks/${task.id}/activity`)
      if (ok) setActivityLog(data || [])
      setLoadingActivity(false)
    }
    loadActivity()
  }, [task.id, bottomTab])

  // Load attachments
  useEffect(() => {
    async function loadAtt() {
      setLoadingAtt(true)
      const { data, ok } = await apiFetch(`/api/boards/${boardId}/tasks/${task.id}/attachments`)
      if (ok) setAttachments(data || [])
      setLoadingAtt(false)
    }
    loadAtt()
  }, [task.id, boardId])

  // Load time entries
  useEffect(() => {
    async function loadTime() {
      setLoadingTime(true)
      const { data, ok } = await apiFetch(`/api/boards/${boardId}/tasks/${task.id}/time`)
      if (ok) {
        setTimeEntries(data || [])
        const running = (data || []).find(e => !e.ended_at && e.user_id === currentUser?.id)
        if (running) { setTimerRunning(true); setActiveEntryId(running.id) }
      }
      setLoadingTime(false)
    }
    loadTime()
  }, [task.id, boardId, currentUser?.id])

  // Live timer tick
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000)
    } else {
      clearInterval(timerRef.current); setTimerSeconds(0)
    }
    return () => clearInterval(timerRef.current)
  }, [timerRunning])

  async function startTimer() {
    const { data, ok } = await apiFetch(`/api/boards/${boardId}/tasks/${task.id}/time`, { method: 'POST' })
    if (ok) { setTimerRunning(true); setActiveEntryId(data.id); setTimeEntries(prev => [data, ...prev]) }
  }

  async function stopTimer() {
    if (!activeEntryId) return
    const { data, ok } = await apiFetch(`/api/time-entries/${activeEntryId}`, { method: 'PATCH', body: { stop: true } })
    if (ok) {
      setTimerRunning(false); setActiveEntryId(null)
      setTimeEntries(prev => prev.map(e => e.id === activeEntryId ? data : e))
    }
  }

  function fmtSeconds(s) {
    if (!s) return '0:00'
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
    return h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
      : `${m}:${String(sec).padStart(2,'0')}`
  }

  const totalTrackedSeconds = timeEntries.reduce((acc, e) => acc + (e.seconds || 0), 0)

  // Fetch GitHub PR status when URL is set
  useEffect(() => {
    if (!githubPrUrl) { setPrStatus(null); return }
    const match = githubPrUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
    if (!match) return
    const [, owner, repo, num] = match
    fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${num}`, {
      headers: process.env.NEXT_PUBLIC_GITHUB_TOKEN ? { Authorization: `token ${process.env.NEXT_PUBLIC_GITHUB_TOKEN}` } : {},
    })
      .then(r => r.json())
      .then(d => { if (d.state) setPrStatus({ state: d.state, title: d.title, html_url: d.html_url, merged: d.merged }) })
      .catch(() => {})
  }, [githubPrUrl])

  useEffect(() => {
    if (!loadingComments) commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length, loadingComments])

  async function handleSave() {
    setSaving(true)
    await onUpdate(task.id, {
      title, description, priority,
      assigned_to: assignedTo || null,
      due_date: dueDate || null,
      status, labels, custom_values: customValues,
      blocked_by: blockedBy,
      recur_rule: recurRule || null,
      github_pr_url: githubPrUrl || null,
    })
    setSaving(false)
  }

  async function handleUploadFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAtt(true)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api/boards/${boardId}/tasks/${task.id}/attachments`, { method: 'POST', body: form })
    const data = await res.json()
    if (res.ok) setAttachments(prev => [...prev, data])
    setUploadingAtt(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function deleteAttachment(attId) {
    await apiFetch(`/api/attachments/${attId}`, { method: 'DELETE' })
    setAttachments(prev => prev.filter(a => a.id !== attId))
  }

  function toggleBlockedBy(taskId) {
    setBlockedBy(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId])
  }

  function toggleLabel(labelOption) {
    setLabels(prev => {
      const exists = prev.find(l => l.id === labelOption.id)
      return exists ? prev.filter(l => l.id !== labelOption.id) : [...prev, labelOption]
    })
  }

  async function addSubtask(e) {
    e.preventDefault()
    if (!newSubtask.trim()) return
    const updated = [...subtasks, { id: crypto.randomUUID(), text: newSubtask.trim(), completed: false }]
    setSubtasks(updated); setNewSubtask('')
    await onUpdate(task.id, { subtasks: updated })
  }

  async function toggleSubtask(id) {
    const updated = subtasks.map(s => s.id === id ? { ...s, completed: !s.completed } : s)
    setSubtasks(updated)
    await onUpdate(task.id, { subtasks: updated })
  }

  async function deleteSubtask(id) {
    const updated = subtasks.filter(s => s.id !== id)
    setSubtasks(updated)
    await onUpdate(task.id, { subtasks: updated })
  }

  async function handleAddComment(e) {
    e.preventDefault()
    if (!comment.trim()) return
    setAddingComment(true)
    const { data, ok } = await apiFetch(`/api/tasks/${task.id}/comments`, {
      method: 'POST', body: { content: comment.trim() },
    })
    if (ok) { setComments(prev => [...prev, data]); setComment('') }
    setAddingComment(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="card w-full sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <select className="text-xs font-semibold bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-gray-300
                             focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={status} onChange={e => { setStatus(e.target.value); onMove(task.id, e.target.value) }}
                  disabled={!canEdit}>
            {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button onClick={() => { if (confirm('Delete this task?')) onDelete(task.id) }}
                      className="btn-ghost p-1.5 text-gray-600 hover:text-red-400">
                <Trash2 size={15} />
              </button>
            )}
            <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Title */}
          <input className="text-xl font-semibold text-gray-100 bg-transparent border-none outline-none w-full placeholder-gray-700 focus:ring-0 p-0"
                 value={title} onChange={e => setTitle(e.target.value)} disabled={!canEdit} />

          {/* Core meta grid */}
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

          {/* Custom fields / Properties */}
          {boardFields.length > 0 && (
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-1.5">
                <Sliders size={13} /> Properties
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {boardFields.map(field => (
                  <div key={field.id}>
                    <label className="label flex items-center gap-1">
                      <FieldIcon type={field.field_type} /> {field.name}
                    </label>
                    <FieldInput
                      field={field}
                      value={customValues[field.id]}
                      onChange={val => setCustomValues(prev => ({ ...prev, [field.id]: val }))}
                      disabled={!canEdit}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description — markdown toggle */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Description</label>
              {description && (
                <button onClick={() => setDescEditMode(v => !v)}
                        className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors">
                  {descEditMode ? <><Eye size={10} /> Preview</> : <><Edit2 size={10} /> Edit</>}
                </button>
              )}
            </div>
            {!descEditMode ? (
              <div
                className="min-h-[64px] rounded-xl px-3 py-2.5 text-sm text-gray-300 leading-relaxed cursor-text"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                onClick={() => canEdit && setDescEditMode(true)}
                dangerouslySetInnerHTML={{ __html: description ? renderMarkdown(description) : '<span style="color:#4b5563;font-style:italic">Click to add description… (supports **markdown**)</span>' }}
              />
            ) : (
              <textarea className="input resize-none h-28" placeholder="Add details… (**bold**, *italic*, `code`, [links](url))"
                        value={description} onChange={e => setDescription(e.target.value)}
                        onBlur={() => setDescEditMode(false)} autoFocus disabled={!canEdit} />
            )}
          </div>

          {/* GitHub PR */}
          <div>
            <label className="label flex items-center gap-1"><Github size={11} /> GitHub PR</label>
            <div className="flex gap-2">
              <input className="input flex-1 text-sm" placeholder="https://github.com/org/repo/pull/123"
                     value={githubPrUrl} onChange={e => setGithubPrUrl(e.target.value)} disabled={!canEdit} />
              {prStatus && (
                <a href={prStatus.html_url} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all"
                   style={prStatus.merged
                     ? { background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }
                     : prStatus.state === 'open'
                     ? { background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }
                     : { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <Github size={11} />
                  {prStatus.merged ? 'Merged' : prStatus.state === 'open' ? 'Open' : 'Closed'}
                </a>
              )}
            </div>
          </div>

          {/* Recurrence */}
          <div>
            <label className="label flex items-center gap-1"><Repeat size={11} /> Recurrence</label>
            <div className="flex gap-2">
              {[{ id: '', label: 'None' }, { id: 'daily', label: 'Daily' }, { id: 'weekly', label: 'Weekly' }, { id: 'monthly', label: 'Monthly' }].map(opt => (
                <button key={opt.id} type="button" onClick={() => canEdit && setRecurRule(opt.id)}
                        disabled={!canEdit}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                        style={recurRule === opt.id
                          ? { background: 'rgba(41,82,255,0.2)', color: '#7ba3ff', border: '1px solid rgba(41,82,255,0.3)' }
                          : { background: 'rgba(255,255,255,0.04)', color: 'rgba(107,114,128,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {recurRule && <p className="text-[11px] text-gray-500 mt-1.5">When completed, a new copy will auto-generate with the next due date.</p>}
          </div>

          {/* Dependencies */}
          <div>
            <label className="label flex items-center gap-1"><Lock size={11} /> Blocked by</label>
            {blockedBy.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {blockedBy.map(depId => {
                  const dep = tasks?.find(t => t.id === depId)
                  if (!dep) return null
                  const isDone = dep.status === 'done'
                  return (
                    <div key={depId} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg"
                         style={isDone
                           ? { background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }
                           : { background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}>
                      {isDone ? <Check size={10} /> : <Lock size={10} />}
                      <span className="max-w-[160px] truncate">{dep.title}</span>
                      {canEdit && (
                        <button onClick={() => toggleBlockedBy(depId)} className="hover:text-red-400 ml-0.5"><X size={10} /></button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {canEdit && <DependencyPicker tasks={tasks} currentTaskId={task.id} blockedBy={blockedBy} onToggle={toggleBlockedBy} />}
          </div>

          {/* Attachments */}
          <div>
            <label className="label flex items-center gap-1"><Paperclip size={11} /> Attachments</label>
            {loadingAtt ? (
              <p className="text-xs text-gray-600">Loading…</p>
            ) : (
              <div className="space-y-1.5 mb-2">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-3 px-3 py-2 rounded-lg group"
                       style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <FileText size={13} className="text-gray-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <a href={att.url} target="_blank" rel="noopener noreferrer"
                         className="text-sm text-brand-400 hover:text-brand-300 truncate block">{att.filename}</a>
                      <p className="text-[10px] text-gray-600">
                        {att.size_bytes ? `${(att.size_bytes / 1024).toFixed(1)} KB · ` : ''}
                        {att.uploader?.full_name || att.uploader?.email}
                      </p>
                    </div>
                    {canEdit && (
                      <button onClick={() => deleteAttachment(att.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-600 hover:text-red-400">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {attachments.length === 0 && <p className="text-xs text-gray-700">No attachments yet</p>}
              </div>
            )}
            {canEdit && (
              <>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleUploadFile} />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAtt}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                        style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(107,114,128,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Upload size={11} />{uploadingAtt ? 'Uploading…' : 'Attach file'}
                </button>
              </>
            )}
          </div>

          {/* Time Tracking */}
          <div>
            <label className="label flex items-center justify-between">
              <span className="flex items-center gap-1"><Clock size={11} /> Time Tracking</span>
              {totalTrackedSeconds > 0 && (
                <span className="text-[10px] text-gray-500 font-mono">Total: {fmtSeconds(totalTrackedSeconds)}</span>
              )}
            </label>
            <div className="flex items-center gap-2 mb-2">
              {timerRunning ? (
                <>
                  <span className="text-sm font-mono text-brand-400 tabular-nums min-w-[4rem]">{fmtSeconds(timerSeconds)}</span>
                  <button onClick={stopTimer}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                          style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    ■ Stop
                  </button>
                </>
              ) : canEdit ? (
                <button onClick={startTimer}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                        style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(107,114,128,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Clock size={11} /> Start timer
                </button>
              ) : null}
            </div>
            {!loadingTime && timeEntries.length > 0 && (
              <div className="space-y-1">
                {timeEntries.slice(0, 5).map(e => (
                  <div key={e.id} className="flex items-center justify-between text-[11px] text-gray-500 px-2 py-1 rounded"
                       style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <span className="font-mono">{e.seconds ? fmtSeconds(e.seconds) : (e.ended_at ? '—' : '▶ running')}</span>
                    <span>{new Date(e.started_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Voting */}
          <div>
            <label className="label flex items-center gap-1">▲ Votes</label>
            <button onClick={() => onVote && onVote(task.id)}
                    className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-all"
                    style={votes.includes(currentUser?.id)
                      ? { background: 'rgba(41,82,255,0.15)', color: '#7ba3ff', border: '1px solid rgba(41,82,255,0.3)' }
                      : { background: 'rgba(255,255,255,0.04)', color: 'rgba(107,114,128,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
              ▲ {votes.length > 0 ? `${votes.length} vote${votes.length !== 1 ? 's' : ''}` : 'Vote'}
            </button>
          </div>

          {/* Save */}
          {canEdit && (
            <button onClick={handleSave} className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}

          {/* Labels */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2.5 flex items-center gap-1.5">
              <Tag size={13} /> Labels
            </h3>
            <div className="flex flex-wrap gap-2">
              {LABEL_OPTIONS.map(opt => {
                const active = labels.some(l => l.id === opt.id)
                return (
                  <button key={opt.id} onClick={() => canEdit && toggleLabel(opt)} disabled={!canEdit}
                          className="text-xs font-semibold px-2.5 py-1 rounded-full transition-all"
                          style={active
                            ? { background: `${opt.color}25`, color: opt.color, border: `1px solid ${opt.color}50`, boxShadow: `0 0 8px ${opt.color}30` }
                            : { background: 'rgba(255,255,255,0.04)', color: 'rgba(107,114,128,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {active && <span className="mr-1">✓</span>}{opt.text}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2.5 flex items-center gap-1.5">
              <CheckSquare size={13} /> Subtasks
              {subtasks.length > 0 && (
                <span className="text-xs font-normal text-gray-500 ml-1">
                  {subtasks.filter(s => s.completed).length}/{subtasks.length}
                </span>
              )}
            </h3>
            {subtasks.length > 0 && (
              <div className="h-1 rounded-full mb-3 overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div className="h-full rounded-full transition-all duration-300"
                     style={{ width: `${(subtasks.filter(s => s.completed).length / subtasks.length) * 100}%`, background: 'linear-gradient(90deg,#2952ff,#10b981)' }} />
              </div>
            )}
            <div className="space-y-1.5 mb-3">
              {subtasks.map(s => (
                <div key={s.id} className="flex items-center gap-2.5 group/sub rounded-lg px-2 py-1.5 transition-colors"
                     style={{ background: 'rgba(255,255,255,0.02)' }}
                     onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                     onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}>
                  <button onClick={() => canEdit && toggleSubtask(s.id)} disabled={!canEdit}
                          className="shrink-0 transition-colors"
                          style={{ color: s.completed ? '#10b981' : 'rgba(107,114,128,0.6)' }}>
                    {s.completed ? <CheckSquare size={15} /> : <Square size={15} />}
                  </button>
                  <span className={`flex-1 text-sm ${s.completed ? 'line-through text-gray-600' : 'text-gray-300'}`}>{s.text}</span>
                  {canEdit && (
                    <button onClick={() => deleteSubtask(s.id)}
                            className="opacity-0 group-hover/sub:opacity-100 transition-opacity p-0.5 rounded"
                            style={{ color: 'rgba(107,114,128,0.6)' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(107,114,128,0.6)'}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <form onSubmit={addSubtask} className="flex gap-2">
                <input className="input flex-1 text-sm py-1.5" placeholder="Add a subtask…"
                       value={newSubtask} onChange={e => setNewSubtask(e.target.value)} />
                <button type="submit" className="btn-primary px-3 py-1.5 text-xs" disabled={!newSubtask.trim()}>Add</button>
              </form>
            )}
          </div>

          {/* Comments / Activity tabs */}
          <div>
            <div className="flex items-center gap-0 mb-4 border-b border-gray-800">
              {[
                { id: 'comments', label: `Comments (${comments.length})`, icon: MessageSquare },
                { id: 'activity', label: 'Activity', icon: Activity },
              ].map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setBottomTab(id)}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors relative"
                        style={bottomTab === id ? { color: '#7ba3ff' } : { color: 'rgba(107,114,128,0.8)' }}>
                  <Icon size={13} />{label}
                  {bottomTab === id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-t" />}
                </button>
              ))}
            </div>

            {bottomTab === 'comments' && (
              <>
                {loadingComments ? (
                  <div className="text-xs text-gray-600 py-4 text-center">Loading comments…</div>
                ) : (
                  <div className="space-y-3 mb-4">
                    {comments.length === 0 && (
                      <p className="text-xs text-gray-600 text-center py-4">No comments yet</p>
                    )}
                    {comments.map(c => (
                      <div key={c.id} className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 shrink-0 mt-0.5">
                          {(c.author?.full_name || c.author?.email || '?')[0].toUpperCase()}
                        </div>
                        <div className="bg-gray-800 rounded-xl px-4 py-2.5 flex-1">
                          <p className="text-xs font-medium text-gray-400 mb-1">
                            {c.author?.full_name || c.author?.email}
                            <span className="text-gray-600 font-normal ml-2">{format(new Date(c.created_at), 'MMM d, h:mm a')}</span>
                          </p>
                          <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{c.content}</p>
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
                    <input className="input flex-1" placeholder="Write a comment… (@mention teammates)"
                           value={comment} onChange={e => setComment(e.target.value)} />
                    <button type="submit" className="btn-primary px-3" disabled={!comment.trim() || addingComment}>
                      {addingComment ? '…' : 'Send'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {bottomTab === 'activity' && (
              <div className="space-y-1">
                {loadingActivity ? (
                  <div className="text-xs text-gray-600 py-4 text-center">Loading activity…</div>
                ) : activityLog.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-4">No activity recorded yet</p>
                ) : (
                  activityLog.map(entry => (
                    <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-gray-800/40 last:border-0">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5"
                           style={{ background: 'linear-gradient(135deg,#2952ff,#8b5cf6)' }}>
                        {(entry.actor?.full_name || entry.actor?.email || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-gray-300">{entry.actor?.full_name || entry.actor?.email}</span>
                        <span className="text-xs text-gray-500 ml-1.5">
                          {entry.action === 'created' && 'created this task'}
                          {entry.action === 'moved' && `moved to ${entry.new_value}`}
                          {entry.action === 'assigned' && (entry.new_value ? `assigned to ${entry.new_value}` : 'unassigned')}
                          {entry.action === 'updated' && `updated ${entry.field}: ${entry.old_value} → ${entry.new_value}`}
                          {entry.action === 'commented' && 'added a comment'}
                        </span>
                        <p className="text-[10px] text-gray-600 mt-0.5">{format(new Date(entry.created_at), 'MMM d, h:mm a')}</p>
                      </div>
                      <ActivityIcon action={entry.action} />
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Notification Dropdown ──────────────────────────────────────────────────────

function NotificationDropdown({ notifications, onMarkRead, onMarkAllRead }) {
  const unread = notifications.filter(n => !n.read)
  return (
    <div className="absolute right-0 top-10 w-80 card p-0 shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <span className="text-sm font-semibold text-gray-200">Notifications</span>
        {unread.length > 0 && (
          <button onClick={onMarkAllRead} className="text-xs text-brand-400 hover:text-brand-300">Mark all read</button>
        )}
      </div>
      <div className="max-h-72 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm">No notifications</div>
        ) : notifications.map(n => (
          <button key={n.id} onClick={() => !n.read && onMarkRead(n.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors flex items-start gap-3 ${!n.read ? 'bg-brand-500/5' : ''}`}>
            <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${n.read ? 'bg-transparent' : 'bg-brand-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-200 truncate">{n.title}</p>
              {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
              <p className="text-[10px] text-gray-600 mt-1">{format(new Date(n.created_at), 'MMM d, h:mm a')}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Board Settings Modal (tabs: General | Fields) ──────────────────────────────

function BoardSettingsModal({ board, boardFields, onClose, onUpdate, onDelete, onCreateField, onUpdateField, onDeleteField, onDuplicate }) {
  const [tab, setTab]           = useState('general')
  const [name, setName]         = useState(board.name)
  const [description, setDescription] = useState(board.description || '')
  const [color, setColor]       = useState(board.color || '#2952ff')
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]       = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  // WIP limits state
  const [wipLimits, setWipLimits] = useState(board.settings?.wip_limits || {})
  const [savingWip, setSavingWip] = useState(false)
  // Public share
  const [publicToken, setPublicToken] = useState(board.public_token || null)
  const [generatingToken, setGeneratingToken] = useState(false)
  const [copied, setCopied] = useState(false)
  // Inbox token
  const inboxToken = board.inbox_token
  const [copiedInbox, setCopiedInbox] = useState(false)
  // Webhook
  const [webhookUrl, setWebhookUrl]         = useState(board.webhook_url || '')
  const [savingWebhook, setSavingWebhook]   = useState(false)
  const [webhookSaved, setWebhookSaved]     = useState(false)
  // Background
  const [background, setBackground]         = useState(board.background || '')
  const [savingBg, setSavingBg]             = useState(false)
  const BACKGROUND_PRESETS = [
    '', 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
    'linear-gradient(135deg, #0a0a0a, #1a1a2e)', 'linear-gradient(135deg, #1a1a2e, #16213e)',
    'linear-gradient(135deg, #0d1117, #0d4f3c)', 'linear-gradient(135deg, #1a0028, #2d0045)',
    '#07070f', '#0a1628',
  ]
  // Template
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateSaved, setTemplateSaved]   = useState(false)

  // Add field state
  const [showAddField, setShowAddField]     = useState(false)
  const [newFieldName, setNewFieldName]     = useState('')
  const [newFieldType, setNewFieldType]     = useState('text')
  const [newFieldOptions, setNewFieldOptions] = useState([{ value: 'Option 1', color: SELECT_COLORS[0] }])
  const [addingField, setAddingField]       = useState(false)
  const [fieldError, setFieldError]         = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true); setError(null)
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

  async function handleAddField(e) {
    e.preventDefault()
    if (!newFieldName.trim()) return
    setAddingField(true); setFieldError(null)
    const { ok, error: err } = await onCreateField({
      name: newFieldName.trim(),
      field_type: newFieldType,
      options: newFieldType === 'select' ? newFieldOptions.filter(o => o.value.trim()) : [],
    })
    if (!ok) setFieldError(err || 'Failed to create field')
    else {
      setShowAddField(false); setNewFieldName(''); setNewFieldType('text')
      setNewFieldOptions([{ value: 'Option 1', color: SELECT_COLORS[0] }])
    }
    setAddingField(false)
  }

  function addOption() {
    setNewFieldOptions(prev => [...prev, { value: `Option ${prev.length + 1}`, color: SELECT_COLORS[prev.length % SELECT_COLORS.length] }])
  }

  function updateOption(i, key, val) {
    setNewFieldOptions(prev => prev.map((o, idx) => idx === i ? { ...o, [key]: val } : o))
  }

  function removeOption(i) {
    setNewFieldOptions(prev => prev.filter((_, idx) => idx !== i))
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <h2 className="font-semibold text-gray-100">Board Settings</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 shrink-0">
          {[
            { id: 'general', label: 'General' },
            { id: 'fields', label: `Fields (${boardFields.length})` },
            { id: 'wip', label: 'WIP Limits' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
                    className="px-5 py-2.5 text-sm font-medium transition-colors relative"
                    style={tab === t.id ? { color: '#7ba3ff' } : { color: 'rgba(107,114,128,0.8)' }}>
              {t.label}
              {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'general' && (
            <>
              {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="label">Board name *</label>
                  <input className="input" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea className="input resize-none h-20" placeholder="What is this board for?"
                            value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div>
                  <label className="label">Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {BOARD_COLORS.map(c => (
                      <button key={c} type="button" onClick={() => setColor(c)}
                              className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110' : ''}`}
                              style={{ backgroundColor: c }} />
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

              {/* Public share link */}
              <div className="mt-6 pt-5 border-t border-gray-800">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Globe size={11} /> Public Share Link
                </p>
                {publicToken ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input readOnly className="input flex-1 text-xs py-1.5 font-mono text-gray-400"
                             value={`${typeof window !== 'undefined' ? window.location.origin : ''}/public/${publicToken}`} />
                      <button onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/public/${publicToken}`)
                        setCopied(true); setTimeout(() => setCopied(false), 2000)
                      }} className="btn-ghost px-3 text-xs">
                        {copied ? <Check size={13} className="text-emerald-400" /> : 'Copy'}
                      </button>
                    </div>
                    <button onClick={async () => {
                      await apiFetch(`/api/boards/${board.id}/share`, { method: 'DELETE' })
                      setPublicToken(null)
                    }} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                      Revoke link
                    </button>
                  </div>
                ) : (
                  <button onClick={async () => {
                    setGeneratingToken(true)
                    const { data, ok } = await apiFetch(`/api/boards/${board.id}/share`, { method: 'POST' })
                    if (ok) setPublicToken(data.public_token)
                    setGeneratingToken(false)
                  }} disabled={generatingToken}
                  className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg w-full transition-colors"
                  style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(156,163,175,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <Globe size={13} />{generatingToken ? 'Generating…' : 'Generate public link'}
                  </button>
                )}
              </div>

              {/* Email-to-task inbox */}
              {inboxToken && (
                <div className="mt-6 pt-5 border-t border-gray-800">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Mail size={11} /> Email-to-Task Inbox
                  </p>
                  <p className="text-xs text-gray-500 mb-2 leading-relaxed">
                    Forward any email to this address and it will create a task on this board.
                    Works with Resend inbound email — point your MX records or forward to:
                  </p>
                  <div className="flex gap-2">
                    <input readOnly className="input flex-1 text-xs py-1.5 font-mono text-gray-400"
                           value={`/api/inbox/${inboxToken}`} />
                    <button onClick={() => {
                      navigator.clipboard.writeText(`${typeof window !== 'undefined' ? window.location.origin : ''}/api/inbox/${inboxToken}`)
                      setCopiedInbox(true); setTimeout(() => setCopiedInbox(false), 2000)
                    }} className="btn-ghost px-3 text-xs">
                      {copiedInbox ? <Check size={13} className="text-emerald-400" /> : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              {/* Duplicate board */}
              <div className="mt-6 pt-5 border-t border-gray-800">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">Duplicate Board</p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => { setDuplicating(true); await onDuplicate(true); setDuplicating(false) }}
                    disabled={duplicating}
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg transition-colors"
                    style={{ background: 'rgba(41,82,255,0.08)', color: '#7ba3ff', border: '1px solid rgba(41,82,255,0.2)' }}>
                    <Copy size={13} /> {duplicating ? 'Cloning…' : 'Clone with tasks'}
                  </button>
                  <button
                    onClick={async () => { setDuplicating(true); await onDuplicate(false); setDuplicating(false) }}
                    disabled={duplicating}
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg transition-colors"
                    style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(107,114,128,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <Copy size={13} /> Empty copy
                  </button>
                </div>
              </div>

              {/* Board Background */}
              <div className="mt-6 pt-5 border-t border-gray-800">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">Board Background</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {BACKGROUND_PRESETS.map((bg, i) => (
                    <button key={i} onClick={() => setBackground(bg)}
                            className="w-8 h-8 rounded-lg transition-all hover:scale-110 ring-offset-gray-900"
                            title={bg || 'Default'}
                            style={{
                              background: bg || '#07070f',
                              border: background === bg ? '2px solid #7ba3ff' : '1px solid rgba(255,255,255,0.1)',
                            }} />
                  ))}
                  <input value={background} onChange={e => setBackground(e.target.value)}
                         placeholder="css gradient or hex" className="input flex-1 text-xs py-1" />
                </div>
                <button onClick={async () => {
                  setSavingBg(true)
                  await apiFetch(`/api/boards/${board.id}/background`, { method: 'PATCH', body: { background } })
                  setSavingBg(false)
                }} className="btn-ghost text-xs px-3 py-1.5" disabled={savingBg}>
                  {savingBg ? 'Saving…' : 'Apply background'}
                </button>
              </div>

              {/* Outbound Webhook */}
              <div className="mt-6 pt-5 border-t border-gray-800">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2 flex items-center gap-1">
                  <ExternalLink size={11} /> Outbound Webhook
                </p>
                <p className="text-xs text-gray-600 mb-2">POST JSON to this URL on task create/update/delete.</p>
                <div className="flex gap-2">
                  <input className="input flex-1 text-xs py-1.5" placeholder="https://…" value={webhookUrl}
                         onChange={e => setWebhookUrl(e.target.value)} />
                  <button onClick={async () => {
                    setSavingWebhook(true)
                    if (webhookUrl.trim()) {
                      await apiFetch(`/api/boards/${board.id}/webhook`, { method: 'POST', body: { url: webhookUrl.trim() } })
                    } else {
                      await apiFetch(`/api/boards/${board.id}/webhook`, { method: 'DELETE' })
                    }
                    setSavingWebhook(false); setWebhookSaved(true); setTimeout(() => setWebhookSaved(false), 2000)
                  }} className="btn-ghost px-3 text-xs" disabled={savingWebhook}>
                    {webhookSaved ? <Check size={13} className="text-emerald-400" /> : (savingWebhook ? '…' : 'Save')}
                  </button>
                </div>
              </div>

              {/* Save as Template */}
              <div className="mt-6 pt-5 border-t border-gray-800">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">Board Templates</p>
                <button onClick={async () => {
                  setSavingTemplate(true)
                  await apiFetch(`/api/boards/${board.id}/template`, { method: 'POST', body: { template_name: board.name } })
                  setSavingTemplate(false); setTemplateSaved(true); setTimeout(() => setTemplateSaved(false), 3000)
                }} disabled={savingTemplate}
                className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg w-full transition-colors"
                style={{ background: 'rgba(139,92,246,0.08)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <Copy size={13} />
                  {templateSaved ? '✓ Saved as template!' : (savingTemplate ? 'Saving…' : 'Save as template')}
                </button>
                <p className="text-[11px] text-gray-600 mt-1.5">Saves columns only (no tasks). Use from the dashboard when creating a new board.</p>
              </div>

              {/* Danger zone */}
              <div className="mt-6 pt-5 border-t border-gray-800">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">Danger Zone</p>
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)}
                          className="w-full text-sm text-red-400 border border-red-500/30 rounded-lg px-4 py-2 hover:bg-red-500/10 transition-colors">
                    Delete this board…
                  </button>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-red-300">This will permanently delete the board and all its tasks. This cannot be undone.</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmDelete(false)} className="btn-ghost flex-1 text-sm">Cancel</button>
                      <button onClick={handleDelete} disabled={deleting}
                              className="flex-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg px-4 py-2 transition-colors">
                        {deleting ? 'Deleting…' : 'Yes, delete'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'wip' && (
            <div className="space-y-5">
              <p className="text-xs text-gray-500 leading-relaxed">
                WIP (Work In Progress) limits cap how many tasks can be in a column. Columns near the limit turn amber; over-limit columns turn red.
              </p>
              {COLUMNS.map(col => (
                <div key={col.id} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 w-36 shrink-0">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.dotColor }} />
                    <span className="text-sm text-gray-300 font-medium">{col.label}</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="No limit"
                    className="input w-28 py-1.5 text-sm"
                    value={wipLimits[col.id] || ''}
                    onChange={e => setWipLimits(prev => ({
                      ...prev,
                      [col.id]: e.target.value ? Number(e.target.value) : undefined,
                    }))}
                  />
                  {wipLimits[col.id] && (
                    <button onClick={() => setWipLimits(prev => { const n = { ...prev }; delete n[col.id]; return n })}
                            className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={async () => {
                  setSavingWip(true)
                  const clean = Object.fromEntries(Object.entries(wipLimits).filter(([, v]) => v))
                  await onUpdate({ settings: { ...(board.settings || {}), wip_limits: clean } })
                  setSavingWip(false)
                }}
                disabled={savingWip}
                className="btn-primary w-full">
                {savingWip ? 'Saving…' : 'Save WIP limits'}
              </button>
            </div>
          )}

          {tab === 'fields' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                Custom fields appear as properties on every task in this board — like Notion's database properties.
              </p>

              {/* Existing fields */}
              {boardFields.length === 0 && !showAddField && (
                <div className="text-center py-6 rounded-xl" style={{ border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <Sliders size={24} className="mx-auto mb-2 opacity-30" style={{ color: '#7ba3ff' }} />
                  <p className="text-sm text-gray-500">No custom fields yet</p>
                  <p className="text-xs text-gray-600 mt-1">Add fields to track data like story points, status, links, and more</p>
                </div>
              )}

              <div className="space-y-2">
                {boardFields.map(field => {
                  const TypeIcon = FIELD_TYPES.find(t => t.id === field.field_type)?.icon || AlignLeft
                  return (
                    <div key={field.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl group"
                         style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                           style={{ background: 'rgba(41,82,255,0.15)', color: '#7ba3ff' }}>
                        <TypeIcon size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 font-medium">{field.name}</p>
                        <p className="text-[11px] text-gray-500 capitalize">{field.field_type}
                          {field.field_type === 'select' && field.options?.length > 0 && ` · ${field.options.length} options`}
                        </p>
                      </div>
                      <button onClick={() => { if (confirm(`Delete field "${field.name}"? This will remove all values.`)) onDeleteField(field.id) }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                              style={{ color: 'rgba(107,114,128,0.6)' }}
                              onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                              onMouseLeave={e => e.currentTarget.style.color = 'rgba(107,114,128,0.6)'}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Add field form */}
              {showAddField ? (
                <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(41,82,255,0.2)' }}>
                  <p className="text-sm font-semibold text-gray-200">New field</p>
                  {fieldError && <div className="text-red-400 text-xs">{fieldError}</div>}
                  <form onSubmit={handleAddField} className="space-y-3">
                    <div>
                      <label className="label">Field name *</label>
                      <input className="input" placeholder="e.g. Story Points, Status, Link…"
                             value={newFieldName} onChange={e => setNewFieldName(e.target.value)} autoFocus required />
                    </div>
                    <div>
                      <label className="label">Field type</label>
                      <div className="grid grid-cols-3 gap-2">
                        {FIELD_TYPES.map(({ id, label, icon: Icon }) => (
                          <button key={id} type="button" onClick={() => setNewFieldType(id)}
                                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all"
                                  style={newFieldType === id
                                    ? { background: 'rgba(41,82,255,0.2)', color: '#7ba3ff', border: '1px solid rgba(41,82,255,0.3)' }
                                    : { background: 'rgba(255,255,255,0.03)', color: 'rgba(107,114,128,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <Icon size={12} />{label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Select options */}
                    {newFieldType === 'select' && (
                      <div>
                        <label className="label">Options</label>
                        <div className="space-y-1.5">
                          {newFieldOptions.map((opt, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input
                                type="color"
                                value={opt.color}
                                onChange={e => updateOption(i, 'color', e.target.value)}
                                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                                style={{ minWidth: '24px' }}
                              />
                              <input className="input flex-1 py-1 text-sm" value={opt.value}
                                     onChange={e => updateOption(i, 'value', e.target.value)} placeholder="Option name" />
                              <button type="button" onClick={() => removeOption(i)}
                                      className="p-1 text-gray-600 hover:text-red-400 transition-colors">
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                          <button type="button" onClick={addOption}
                                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors py-1">
                            <Plus size={11} /> Add option
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={() => { setShowAddField(false); setFieldError(null) }} className="btn-ghost flex-1 text-sm">Cancel</button>
                      <button type="submit" className="btn-primary flex-1 text-sm" disabled={addingField || !newFieldName.trim()}>
                        {addingField ? 'Adding…' : 'Add field'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <button onClick={() => setShowAddField(true)}
                        className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                        style={{ background: 'rgba(41,82,255,0.08)', color: '#7ba3ff', border: '1px solid rgba(41,82,255,0.2)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(41,82,255,0.15)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(41,82,255,0.08)'}>
                  <Plus size={14} /> Add a field
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Activity Icon helper ───────────────────────────────────────────────────────

function ActivityIcon({ action }) {
  const map = {
    created:   { icon: Plus, color: '#10b981' },
    moved:     { icon: ArrowUpDown, color: '#2952ff' },
    assigned:  { icon: User, color: '#8b5cf6' },
    updated:   { icon: Edit2, color: '#f59e0b' },
    commented: { icon: MessageSquare, color: '#06b6d4' },
  }
  const { icon: Icon, color } = map[action] || { icon: Activity, color: '#64748b' }
  return (
    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
         style={{ background: `${color}20`, color }}>
      <Icon size={9} />
    </div>
  )
}

// ── Dependency Picker ──────────────────────────────────────────────────────────

function DependencyPicker({ tasks, currentTaskId, blockedBy, onToggle }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    if (!query.trim()) return []
    return (tasks || [])
      .filter(t => t.id !== currentTaskId && t.title.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8)
  }, [tasks, query, currentTaskId])

  return (
    <div className="relative">
      <input className="input text-sm py-1.5" placeholder="Search tasks to block on…"
             value={query} onChange={e => { setQuery(e.target.value); setOpen(true) }}
             onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl shadow-2xl overflow-hidden"
             style={{ background: 'rgba(14,14,26,0.98)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {filtered.map(t => {
            const selected = blockedBy.includes(t.id)
            return (
              <button key={t.id} onMouseDown={() => { onToggle(t.id); setQuery('') }}
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2 transition-colors"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(41,82,255,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0"
                     style={selected ? { background: '#2952ff' } : { border: '1px solid rgba(107,114,128,0.5)' }}>
                  {selected && <Check size={9} className="text-white" />}
                </div>
                <span className="text-sm text-gray-200 truncate">{t.title}</span>
                <span className="text-[10px] text-gray-600 shrink-0 ml-auto">{t.status.replace('_', ' ')}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Bulk Action Toolbar ────────────────────────────────────────────────────────

function BulkActionToolbar({ count, members, onMove, onAssign, onDelete, onClear }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
         style={{ background: 'rgba(7,7,15,0.95)', border: '1px solid rgba(41,82,255,0.3)', backdropFilter: 'blur(16px)' }}>
      <span className="text-sm font-semibold text-brand-400">{count} selected</span>
      <div className="w-px h-5 bg-gray-700" />

      {/* Move to */}
      <div className="flex items-center gap-1">
        {COLUMNS.map(col => (
          <button key={col.id} onClick={() => onMove(col.id)}
                  className="text-xs px-2.5 py-1.5 rounded-lg transition-all font-medium"
                  style={{ background: `${col.dotColor}18`, color: col.dotColor, border: `1px solid ${col.dotColor}30` }}
                  title={`Move to ${col.label}`}>
            → {col.label}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-gray-700" />

      {/* Assign */}
      <select className="input py-1 text-xs h-7 w-28"
              onChange={e => onAssign(e.target.value)}
              defaultValue="">
        <option value="" disabled>Assign to…</option>
        <option value="">Unassign</option>
        {members.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
      </select>

      <div className="w-px h-5 bg-gray-700" />

      {/* Delete */}
      <button onClick={onDelete}
              className="text-xs px-2.5 py-1.5 rounded-lg text-red-400 transition-all"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <Trash2 size={12} className="inline mr-1" />Delete
      </button>

      <button onClick={onClear} className="text-gray-500 hover:text-gray-300 transition-colors ml-1">
        <X size={14} />
      </button>
    </div>
  )
}

// ── Swimlane Kanban (group by assignee) ────────────────────────────────────────

function SwimlaneKanban({ tasks, members, canEdit, onTaskClick, onAddTask, onMoveTask, wipLimits, bulkMode, selectedTaskIds, onToggleSelect }) {
  // Build lanes: one per assignee + unassigned
  const lanes = useMemo(() => {
    const laneMap = { unassigned: { id: 'unassigned', label: 'Unassigned', tasks: [] } }
    members.forEach(m => { laneMap[m.id] = { id: m.id, label: m.full_name || m.email, avatar: m, tasks: [] } })
    tasks.forEach(t => {
      const key = t.assigned_to || 'unassigned'
      if (laneMap[key]) laneMap[key].tasks.push(t)
      else laneMap['unassigned'].tasks.push(t)
    })
    return Object.values(laneMap).filter(l => l.tasks.length > 0 || l.id === 'unassigned')
  }, [tasks, members])

  const statusColors = { todo: '#64748b', in_progress: '#2952ff', done: '#10b981' }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {lanes.map(lane => {
        const byStatus = { todo: [], in_progress: [], done: [] }
        lane.tasks.forEach(t => { if (byStatus[t.status]) byStatus[t.status].push(t) })

        return (
          <div key={lane.id} className="rounded-2xl overflow-hidden"
               style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            {/* Lane header */}
            <div className="flex items-center gap-3 px-5 py-3"
                 style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                   style={{ background: lane.id === 'unassigned' ? 'rgba(100,116,139,0.3)' : 'linear-gradient(135deg,#2952ff,#8b5cf6)' }}>
                {lane.id === 'unassigned' ? <User size={13} /> : lane.label[0].toUpperCase()}
              </div>
              <span className="text-sm font-semibold text-gray-200">{lane.label}</span>
              <span className="text-xs text-gray-500">{lane.tasks.length} task{lane.tasks.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Columns */}
            <div className="flex gap-0">
              {COLUMNS.map((col, i) => (
                <div key={col.id} className="flex-1 p-3 space-y-2"
                     style={{ borderRight: i < COLUMNS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest mb-2 flex items-center gap-1.5"
                     style={{ color: col.dotColor }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.dotColor }} />
                    {col.label} <span className="font-normal text-gray-600">{byStatus[col.id].length}</span>
                  </p>
                  {byStatus[col.id].map(task => (
                    <div key={task.id}
                         onClick={() => bulkMode ? onToggleSelect(task.id) : onTaskClick(task)}
                         className="rounded-lg px-3 py-2.5 cursor-pointer transition-all group"
                         style={{
                           background: selectedTaskIds?.has(task.id) ? 'rgba(41,82,255,0.12)' : 'rgba(14,14,26,0.6)',
                           border: selectedTaskIds?.has(task.id) ? '1px solid rgba(41,82,255,0.4)' : '1px solid rgba(255,255,255,0.06)',
                         }}
                         onMouseEnter={e => { if (!selectedTaskIds?.has(task.id)) e.currentTarget.style.background = 'rgba(41,82,255,0.05)' }}
                         onMouseLeave={e => { if (!selectedTaskIds?.has(task.id)) e.currentTarget.style.background = 'rgba(14,14,26,0.6)' }}>
                      <p className={`text-xs font-medium leading-snug ${task.status === 'done' ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                        {task.title}
                      </p>
                      {task.due_date && (
                        <p className="text-[10px] text-gray-600 mt-1 flex items-center gap-0.5">
                          <Calendar size={8} />{format(new Date(task.due_date), 'MMM d')}
                        </p>
                      )}
                      {/* Quick move buttons */}
                      {canEdit && (
                        <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {COLUMNS.filter(c => c.id !== col.id).map(c => (
                            <button key={c.id} onClick={e => { e.stopPropagation(); onMoveTask(task.id, c.id) }}
                                    className="text-[9px] px-1.5 py-0.5 rounded font-semibold transition-colors"
                                    style={{ background: `${c.dotColor}15`, color: c.dotColor }}>
                              → {c.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {byStatus[col.id].length === 0 && (
                    <p className="text-[11px] text-gray-700 text-center py-2">—</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Shortcut Overlay ───────────────────────────────────────────────────────────

function ShortcutOverlay({ onClose }) {
  const shortcuts = [
    { key: 'N', desc: 'New task' },
    { key: '/', desc: 'Focus search bar' },
    { key: '⌘K', desc: 'Global search' },
    { key: '?', desc: 'Toggle shortcuts' },
    { key: 'Esc', desc: 'Close modal / cancel' },
    { key: 'Drag', desc: 'Move task between columns' },
    { key: 'Double-click', desc: 'Inline edit task title' },
    { key: 'B key (header)', desc: 'Toggle bulk select mode' },
  ]
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
         onClick={onClose}>
      <div className="card w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-100 flex items-center gap-2">
            <Hash size={15} className="text-brand-400" /> Keyboard Shortcuts
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>
        <div className="space-y-2">
          {shortcuts.map(({ key, desc }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="text-xs text-gray-400">{desc}</span>
              <kbd className="text-[11px] font-mono px-2 py-0.5 rounded"
                   style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#d1d5db' }}>
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Invite Modal ───────────────────────────────────────────────────────────────

function InviteModal({ onClose, onInvite }) {
  const [email, setEmail]     = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError]     = useState(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setInviting(true); setError(null)
    const { ok, error: err } = await onInvite(email.trim())
    if (!ok) { setError(err || 'Invite failed'); setInviting(false) }
    else { setSuccess(true); setInviting(false); setEmail(''); setTimeout(onClose, 1200) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-100">Invite member</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>
        {success ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
              <Check size={24} className="text-emerald-400" />
            </div>
            <p className="text-gray-300 font-medium">Invitation sent!</p>
          </div>
        ) : (
          <>
            {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Email address</label>
                <input type="email" className="input" placeholder="colleague@company.com"
                       value={email} onChange={e => setEmail(e.target.value)} autoFocus required />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={inviting || !email.trim()}>
                  {inviting ? 'Sending…' : 'Send invite'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
