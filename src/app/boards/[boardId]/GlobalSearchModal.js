'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, Search, Flag, Clock, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'

const STATUS_COLORS = { todo: '#64748b', in_progress: '#2952ff', done: '#10b981' }
const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' }
const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#64748b' }

export default function GlobalSearchModal({ onClose, onOpenTask, currentBoardId }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const router = useRouter()
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim() || query.length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`)
        const data = await res.json()
        setResults(Array.isArray(data) ? data : [])
        setSelected(0)
      } catch (_) { setResults([]) }
      setLoading(false)
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  // Keyboard nav
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter' && results[selected]) openResult(results[selected])
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [results, selected])

  function openResult(task) {
    onClose()
    if (task.board_id === currentBoardId) {
      // Same board — open task in current view
      onOpenTask(task)
    } else {
      // Different board — navigate there
      router.push(`/boards/${task.board_id}`)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 pt-[15vh] p-4"
         onClick={onClose}>
      <div className="w-full max-w-xl card p-0 overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-800">
          <Search size={16} className="text-gray-500 shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-gray-100 placeholder-gray-600 outline-none text-sm"
            placeholder="Search tasks across all boards…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {loading && <div className="w-4 h-4 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin shrink-0" />}
          {!loading && query && (
            <button onClick={() => { setQuery(''); setResults([]) }} className="text-gray-600 hover:text-gray-400 shrink-0">
              <X size={13} />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-gray-600 shrink-0">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {results.length === 0 && query.length >= 2 && !loading && (
            <div className="text-center py-8 text-gray-600 text-sm">No tasks found for "{query}"</div>
          )}
          {results.length === 0 && query.length < 2 && (
            <div className="text-center py-8 text-gray-700 text-sm">Type 2+ characters to search</div>
          )}
          {results.map((task, i) => (
            <button key={task.id} onClick={() => openResult(task)}
                    className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-gray-800/50 last:border-0"
                    style={i === selected ? { background: 'rgba(41,82,255,0.08)' } : { background: 'transparent' }}
                    onMouseEnter={() => setSelected(i)}>
              {/* Board color dot */}
              <div className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                   style={{ backgroundColor: task.boards?.color || '#64748b' }} />

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${task.status === 'done' ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                  {task.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-gray-500">{task.boards?.name}</span>
                  <span className="text-gray-700">·</span>
                  <span className="text-[11px] font-semibold" style={{ color: STATUS_COLORS[task.status] }}>
                    {STATUS_LABELS[task.status]}
                  </span>
                  {task.due_date && (
                    <>
                      <span className="text-gray-700">·</span>
                      <span className="text-[11px] text-gray-500 flex items-center gap-0.5">
                        <Clock size={9} />{format(new Date(task.due_date), 'MMM d')}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ background: `${PRIORITY_COLORS[task.priority]}20`, color: PRIORITY_COLORS[task.priority] }}>
                <Flag size={8} className="inline mr-0.5" />{task.priority}
              </span>
            </button>
          ))}
        </div>

        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-800 flex items-center gap-3"
               style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className="text-[11px] text-gray-600">{results.length} result{results.length !== 1 ? 's' : ''}</span>
            <span className="text-[11px] text-gray-700 ml-auto">↑↓ navigate · Enter select</span>
          </div>
        )}
      </div>
    </div>
  )
}
