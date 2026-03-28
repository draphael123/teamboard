'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Layers, Settings, Trash2, AlertCircle, Sparkles } from 'lucide-react'

const BOARD_COLORS = [
  '#2952ff', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#64748b',
]

// Generic board templates — just seed tasks, no domain-specific content
const TEMPLATES = [
  {
    id: 'blank',
    label: 'Blank Board',
    description: 'Start from scratch',
    icon: '⬜',
    tasks: [],
  },
  {
    id: 'kanban',
    label: 'Kanban Starter',
    description: '3-column board with sample tasks',
    icon: '📋',
    tasks: [
      { title: 'Define project scope', status: 'todo', priority: 'high' },
      { title: 'Gather requirements', status: 'todo', priority: 'medium' },
      { title: 'Set up repository', status: 'in_progress', priority: 'medium' },
      { title: 'Initial setup complete', status: 'done', priority: 'low' },
    ],
  },
  {
    id: 'sprint',
    label: 'Sprint Board',
    description: 'Backlog → In Progress → Done',
    icon: '🏃',
    tasks: [
      { title: 'Sprint planning meeting', status: 'done', priority: 'high' },
      { title: 'Write user stories', status: 'in_progress', priority: 'high' },
      { title: 'Design mockups', status: 'in_progress', priority: 'medium' },
      { title: 'Implement feature A', status: 'todo', priority: 'high' },
      { title: 'Implement feature B', status: 'todo', priority: 'medium' },
      { title: 'QA testing', status: 'todo', priority: 'medium' },
      { title: 'Deploy to staging', status: 'todo', priority: 'low' },
    ],
  },
  {
    id: 'product',
    label: 'Product Launch',
    description: 'Pre-launch checklist tasks',
    icon: '🚀',
    tasks: [
      { title: 'Define launch goals', status: 'done', priority: 'high' },
      { title: 'Build landing page', status: 'in_progress', priority: 'high' },
      { title: 'Write launch copy', status: 'in_progress', priority: 'medium' },
      { title: 'Set up analytics', status: 'todo', priority: 'medium' },
      { title: 'Prepare press kit', status: 'todo', priority: 'medium' },
      { title: 'Schedule social posts', status: 'todo', priority: 'low' },
      { title: 'Send launch email', status: 'todo', priority: 'high' },
    ],
  },
  {
    id: 'content',
    label: 'Content Calendar',
    description: 'Plan and track content production',
    icon: '📅',
    tasks: [
      { title: 'Brainstorm topics', status: 'done', priority: 'medium' },
      { title: 'Write post #1 draft', status: 'in_progress', priority: 'high' },
      { title: 'Write post #2 draft', status: 'todo', priority: 'medium' },
      { title: 'Design graphics for post #1', status: 'todo', priority: 'medium' },
      { title: 'Schedule & publish post #1', status: 'todo', priority: 'high' },
      { title: 'Review analytics', status: 'todo', priority: 'low' },
    ],
  },
  {
    id: 'hiring',
    label: 'Hiring Pipeline',
    description: 'Track candidates through stages',
    icon: '👥',
    tasks: [
      { title: 'Write job description', status: 'done', priority: 'high' },
      { title: 'Post to job boards', status: 'done', priority: 'high' },
      { title: 'Screen applications', status: 'in_progress', priority: 'high' },
      { title: 'Schedule interviews', status: 'todo', priority: 'medium' },
      { title: 'Conduct interviews', status: 'todo', priority: 'high' },
      { title: 'Send offer letter', status: 'todo', priority: 'high' },
    ],
  },
]

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    ...(options.body ? { body: typeof options.body === 'string' ? options.body : JSON.stringify(options.body) } : {}),
  })
  const data = await res.json()
  return { data, ok: res.ok }
}

export default function DashboardClient({ boards: initialBoards, user }) {
  const router = useRouter()
  const [boards, setBoards] = useState(initialBoards)
  const [sortBy, setSortBy] = useState('recent')   // recent | name | oldest

  const sortedBoards = useMemo(() => {
    return [...boards].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at)
      return new Date(b.created_at) - new Date(a.created_at)
    })
  }, [boards, sortBy])

  // Create flow
  const [showCreate, setShowCreate] = useState(false)
  const [step, setStep] = useState(1)           // 1 = pick template, 2 = fill details
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newColor, setNewColor] = useState(BOARD_COLORS[0])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  // Edit flow
  const [editingBoard, setEditingBoard] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editColor, setEditColor] = useState(BOARD_COLORS[0])
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState(null)

  // Delete flow
  const [deletingBoard, setDeletingBoard] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function openCreate() {
    setStep(1)
    setSelectedTemplate(null)
    setNewName('')
    setNewDesc('')
    setNewColor(BOARD_COLORS[0])
    setCreateError(null)
    setShowCreate(true)
  }

  function closeCreate() {
    setShowCreate(false)
    setStep(1)
    setSelectedTemplate(null)
  }

  function selectTemplate(tpl) {
    setSelectedTemplate(tpl)
    setStep(2)
  }

  async function createBoard(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setCreateError(null)

    const { data, ok } = await apiFetch('/api/boards', {
      method: 'POST',
      body: { name: newName.trim(), description: newDesc.trim(), color: newColor },
    })

    if (!ok) {
      setCreateError(data.error || 'Failed to create board')
      setCreating(false)
      return
    }

    const board = data

    // Seed template tasks if any
    if (selectedTemplate?.tasks?.length > 0) {
      await Promise.all(
        selectedTemplate.tasks.map(t =>
          apiFetch(`/api/boards/${board.id}/tasks`, {
            method: 'POST',
            body: { title: t.title, status: t.status, priority: t.priority },
          })
        )
      )
    }

    setBoards(prev => [{ ...board, userRole: 'owner' }, ...prev])
    closeCreate()
    setCreating(false)
    router.push(`/boards/${board.id}`)
  }

  function openEdit(board, e) {
    e.stopPropagation()
    setEditingBoard(board)
    setEditName(board.name)
    setEditDesc(board.description || '')
    setEditColor(board.color || BOARD_COLORS[0])
    setEditError(null)
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!editName.trim()) return
    setEditSaving(true)
    setEditError(null)

    const { data, ok } = await apiFetch(`/api/boards/${editingBoard.id}`, {
      method: 'PATCH',
      body: { name: editName.trim(), description: editDesc.trim(), color: editColor },
    })

    if (!ok) {
      setEditError(data.error || 'Failed to save')
      setEditSaving(false)
      return
    }

    setBoards(prev => prev.map(b => b.id === editingBoard.id ? { ...b, ...data } : b))
    setEditingBoard(null)
    setEditSaving(false)
  }

  function openDelete(board, e) {
    e.stopPropagation()
    setDeletingBoard(board)
    setDeleteConfirm(false)
  }

  async function confirmDelete() {
    setDeleting(true)
    const { ok } = await apiFetch(`/api/boards/${deletingBoard.id}`, { method: 'DELETE' })
    if (ok) {
      setBoards(prev => prev.filter(b => b.id !== deletingBoard.id))
      setDeletingBoard(null)
    }
    setDeleting(false)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Good {timeOfDay()}, {user?.full_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(107,114,128,0.9)' }}>
            {boards.length > 0 ? `You have ${boards.length} board${boards.length !== 1 ? 's' : ''}.` : 'Create your first board to get started.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="input w-36 py-2 text-sm"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="recent">Most recent</option>
            <option value="name">Name A–Z</option>
            <option value="oldest">Oldest first</option>
          </select>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Sparkles size={15} /> New Board
          </button>
        </div>
      </div>

      {/* Boards grid */}
      {boards.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, rgba(41,82,255,0.15), rgba(139,92,246,0.15))', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Layers size={28} style={{ color: 'rgba(77,116,255,0.8)' }} />
          </div>
          <p className="font-bold text-white text-lg">No boards yet</p>
          <p className="text-sm mt-1.5 mb-6" style={{ color: 'rgba(107,114,128,0.9)' }}>
            Create your first board and pick a template to hit the ground running.
          </p>
          <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
            <Sparkles size={15} /> Create your first board
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedBoards.map(board => (
            <BoardCard
              key={board.id}
              board={board}
              onClick={() => router.push(`/boards/${board.id}`)}
              onEdit={board.userRole === 'owner' ? (e) => openEdit(board, e) : null}
              onDelete={board.userRole === 'owner' ? (e) => openDelete(board, e) : null}
            />
          ))}
          <button
            onClick={openCreate}
            className="flex flex-col items-center justify-center gap-2 h-40 rounded-2xl cursor-pointer transition-all duration-200"
            style={{
              background: 'rgba(14,14,26,0.4)',
              border: '2px dashed rgba(255,255,255,0.1)',
              color: 'rgba(100,116,139,0.8)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(41,82,255,0.4)'
              e.currentTarget.style.color = 'rgba(77,116,255,0.9)'
              e.currentTarget.style.background = 'rgba(41,82,255,0.05)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
              e.currentTarget.style.color = 'rgba(100,116,139,0.8)'
              e.currentTarget.style.background = 'rgba(14,14,26,0.4)'
              e.currentTarget.style.transform = ''
            }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ background: 'rgba(41,82,255,0.1)', border: '1px solid rgba(41,82,255,0.2)' }}>
              <Plus size={18} style={{ color: 'rgba(77,116,255,0.8)' }} />
            </div>
            <span className="text-sm font-semibold">New Board</span>
          </button>
        </div>
      )}

      {/* ── Create Board Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-2xl p-6">

            {/* Step 1: Pick a template */}
            {step === 1 && (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-semibold text-gray-100">Choose a template</h2>
                  <button onClick={closeCreate} className="btn-ghost p-1.5"><X size={18} /></button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {TEMPLATES.map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => selectTemplate(tpl)}
                      className="card p-4 text-left hover:border-gray-600 hover:bg-gray-800/50 transition-all group"
                    >
                      <div className="text-2xl mb-2">{tpl.icon}</div>
                      <p className="font-semibold text-sm text-gray-200 group-hover:text-white">{tpl.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{tpl.description}</p>
                      {tpl.tasks.length > 0 && (
                        <p className="text-[10px] text-gray-600 mt-2">{tpl.tasks.length} starter tasks</p>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Step 2: Fill in name/color */}
            {step === 2 && (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <button
                    onClick={() => setStep(1)}
                    className="btn-ghost p-1.5 text-gray-500 hover:text-gray-300"
                  >
                    ←
                  </button>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-gray-100">
                      {selectedTemplate?.icon} {selectedTemplate?.label}
                    </h2>
                    <p className="text-xs text-gray-500">{selectedTemplate?.description}</p>
                  </div>
                  <button onClick={closeCreate} className="btn-ghost p-1.5"><X size={18} /></button>
                </div>

                {createError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg mb-4">
                    {createError}
                  </div>
                )}

                <form onSubmit={createBoard} className="space-y-4">
                  <div>
                    <label className="label">Board name *</label>
                    <input
                      className="input"
                      placeholder="e.g. Q2 Roadmap"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      autoFocus required
                    />
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <textarea
                      className="input resize-none h-20"
                      placeholder="What is this board for?"
                      value={newDesc}
                      onChange={e => setNewDesc(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Color</label>
                    <div className="flex gap-2 flex-wrap">
                      {BOARD_COLORS.map(c => (
                        <button
                          key={c} type="button" onClick={() => setNewColor(c)}
                          className={`w-7 h-7 rounded-full transition-transform hover:scale-110
                            ${newColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110' : ''}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={closeCreate} className="btn-ghost flex-1">Cancel</button>
                    <button
                      type="submit"
                      className="btn-primary flex-1"
                      disabled={creating || !newName.trim()}
                    >
                      {creating ? 'Creating…' : 'Create Board'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Board Modal ── */}
      {editingBoard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-100">Edit Board</h2>
              <button onClick={() => setEditingBoard(null)} className="btn-ghost p-1.5"><X size={18} /></button>
            </div>

            {editError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg mb-4">
                {editError}
              </div>
            )}

            <form onSubmit={saveEdit} className="space-y-4">
              <div>
                <label className="label">Board name *</label>
                <input className="input" value={editName} onChange={e => setEditName(e.target.value)} required autoFocus />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input resize-none h-20"
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {BOARD_COLORS.map(c => (
                    <button
                      key={c} type="button" onClick={() => setEditColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform hover:scale-110
                        ${editColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingBoard(null)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={editSaving || !editName.trim()}>
                  {editSaving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deletingBoard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-5">
              <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-gray-100">Delete "{deletingBoard.name}"?</h2>
                <p className="text-sm text-gray-500 mt-1">
                  This will permanently delete the board and all its tasks. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeletingBoard(null)} className="btn-ghost flex-1">Cancel</button>
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete board'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Task Progress Bar ──────────────────────────────────────────────────────────

function TaskProgressBar({ counts }) {
  if (!counts) return null
  const total = (counts.todo || 0) + (counts.in_progress || 0) + (counts.done || 0)
  if (total === 0) return (
    <p className="text-[10px] mt-1.5" style={{ color: 'rgba(75,85,99,0.7)' }}>No tasks yet</p>
  )
  const todoPct = (counts.todo / total) * 100
  const inProgPct = (counts.in_progress / total) * 100
  const donePct = (counts.done / total) * 100

  return (
    <div className="mt-2">
      <div className="flex rounded-full overflow-hidden h-1.5 gap-px" style={{ background: 'rgba(255,255,255,0.06)' }}>
        {counts.done > 0 && (
          <div style={{ width: `${donePct}%`, background: '#10b981', transition: 'width 0.3s' }} />
        )}
        {counts.in_progress > 0 && (
          <div style={{ width: `${inProgPct}%`, background: '#2952ff', transition: 'width 0.3s' }} />
        )}
        {counts.todo > 0 && (
          <div style={{ width: `${todoPct}%`, background: 'rgba(100,116,139,0.5)', transition: 'width 0.3s' }} />
        )}
      </div>
      <p className="text-[10px] mt-1" style={{ color: 'rgba(75,85,99,0.8)' }}>
        {counts.done}/{total} done
        {counts.in_progress > 0 && <span className="ml-1.5" style={{ color: 'rgba(77,116,255,0.7)' }}>{counts.in_progress} in progress</span>}
      </p>
    </div>
  )
}

// ── Board Card ─────────────────────────────────────────────────────────────────

function BoardCard({ board, onClick, onEdit, onDelete }) {
  const color = board.color || '#2952ff'

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className="relative text-left cursor-pointer flex flex-col overflow-hidden w-full h-40 rounded-2xl transition-all duration-200"
        style={{
          background: 'rgba(14,14,26,0.85)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${color}40, 0 0 20px ${color}20`
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.borderColor = `${color}40`
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)'
          e.currentTarget.style.transform = ''
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
        }}
      >
        {/* Color band at top */}
        <div className="h-1.5 w-full shrink-0" style={{ background: `linear-gradient(90deg, ${color}, ${color}80)` }} />

        {/* Subtle glow blob */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none"
             style={{ background: `radial-gradient(ellipse at 10% 0%, ${color}18 0%, transparent 60%)` }} />

        <div className="flex-1 p-5 flex flex-col justify-between relative z-10">
          <div className="flex items-start justify-between">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}99)`, boxShadow: `0 4px 12px ${color}50` }}
            >
              {board.name.substring(0, 2).toUpperCase()}
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(156,163,175,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {board.userRole}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-white text-sm truncate">{board.name}</p>
            {board.description && (
              <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'rgba(107,114,128,0.9)' }}>
                {board.description}
              </p>
            )}
            {/* Task progress bar */}
            <TaskProgressBar counts={board.taskCounts} />
          </div>
        </div>
      </button>

      {/* Owner actions */}
      {(onEdit || onDelete) && (
        <div className="absolute top-4 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          {onEdit && (
            <button
              onClick={onEdit}
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
              style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(156,163,175,0.8)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(41,82,255,0.3)'; e.currentTarget.style.color = 'white' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; e.currentTarget.style.color = 'rgba(156,163,175,0.8)' }}
              title="Edit board"
            >
              <Settings size={11} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
              style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(156,163,175,0.8)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.3)'; e.currentTarget.style.color = '#f87171' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; e.currentTarget.style.color = 'rgba(156,163,175,0.8)' }}
              title="Delete board"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function timeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
