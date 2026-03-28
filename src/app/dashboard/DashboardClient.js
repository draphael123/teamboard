'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Layers } from 'lucide-react'

const BOARD_COLORS = [
  '#2952ff', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#64748b',
]

export default function DashboardClient({ boards: initialBoards, user }) {
  const router = useRouter()
  const [boards, setBoards] = useState(initialBoards)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newColor, setNewColor] = useState(BOARD_COLORS[0])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

  async function createBoard(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setError(null)

    // Route through server-side API to avoid PostgREST JWT verification issues
    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim(), color: newColor }),
    })

    const data = await res.json()

    if (!res.ok) { setError(data.error || 'Failed to create board'); setCreating(false); return }

    const board = data
    setBoards(prev => [{ ...board, userRole: 'owner' }, ...prev])
    setShowCreate(false)
    setNewName('')
    setNewDesc('')
    setNewColor(BOARD_COLORS[0])
    setCreating(false)
    router.refresh()
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            Good {timeOfDay()}, {user?.full_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">Here are all your boards.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Board
        </button>
      </div>

      {/* Boards grid */}
      {boards.length === 0 ? (
        <div className="text-center py-20">
          <Layers size={40} className="text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">No boards yet</p>
          <p className="text-gray-600 text-sm mt-1">Create your first board to get started.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mt-5 inline-flex items-center gap-2">
            <Plus size={16} /> Create Board
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {boards.map(board => (
            <BoardCard key={board.id} board={board} onClick={() => router.push(`/boards/${board.id}`)} />
          ))}
          <button
            onClick={() => setShowCreate(true)}
            className="card border-dashed border-gray-700 flex flex-col items-center justify-center gap-2
                       h-36 text-gray-600 hover:text-gray-400 hover:border-gray-500 transition-colors cursor-pointer"
          >
            <Plus size={20} />
            <span className="text-sm font-medium">New Board</span>
          </button>
        </div>
      )}

      {/* Create Board Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-100">Create Board</h2>
              <button onClick={() => setShowCreate(false)} className="btn-ghost p-1.5">
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <form onSubmit={createBoard} className="space-y-4">
              <div>
                <label className="label">Board name *</label>
                <input
                  className="input"
                  placeholder="e.g. Q2 Marketing"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  autoFocus
                  required
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
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform hover:scale-110
                        ${newColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={creating || !newName.trim()}>
                  {creating ? 'Creating…' : 'Create Board'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function BoardCard({ board, onClick }) {
  return (
    <button
      onClick={onClick}
      className="card p-5 text-left hover:border-gray-700 hover:bg-gray-800/50 transition-all cursor-pointer
                 flex flex-col gap-3 h-36 group"
    >
      <div className="flex items-start justify-between">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm"
          style={{ backgroundColor: board.color || '#2952ff' }}
        >
          {board.name.substring(0, 2).toUpperCase()}
        </div>
        <span className="text-[11px] text-gray-600 font-medium uppercase tracking-wide bg-gray-800 px-2 py-0.5 rounded-full">
          {board.userRole}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-100 text-sm truncate group-hover:text-white">{board.name}</p>
        {board.description && (
          <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{board.description}</p>
        )}
      </div>
    </button>
  )
}

function timeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
