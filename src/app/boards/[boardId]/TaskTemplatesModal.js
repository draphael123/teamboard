'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { X, Plus, FileText, Trash2, Edit3, Check, ChevronRight, Layers, AlertCircle } from 'lucide-react'

const TEMPLATE_ICONS = ['📋', '🐛', '✨', '🔧', '📝', '🎨', '🚀', '💡', '📊', '🔒', '⚡', '🧪', '📌', '🎯', '💬']

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' }
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#6b7280' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' }
]

export default function TaskTemplatesModal({ isOpen, onClose, boardId, onSelectTemplate }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [error, setError] = useState('')
  const [showIconPicker, setShowIconPicker] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    icon: '📋',
    default_title: '',
    default_description: '',
    default_status: 'todo',
    default_priority: 'medium'
  })

  useEffect(() => {
    if (isOpen && boardId) fetchTemplates()
  }, [isOpen, boardId])

  async function fetchTemplates() {
    setLoading(true)
    try {
      const res = await fetch(`/api/task-templates?boardId=${boardId}`)
      const data = await res.json()
      if (res.ok) setTemplates(data)
      else setError(data.error)
    } catch (e) {
      setError('Failed to load templates')
    }
    setLoading(false)
  }

  function resetForm() {
    setFormData({
      name: '',
      icon: '📋',
      default_title: '',
      default_description: '',
      default_status: 'todo',
      default_priority: 'medium'
    })
    setShowIconPicker(false)
    setError('')
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      setError('Template name is required')
      return
    }
    setError('')

    const payload = {
      ...formData,
      board_id: boardId
    }

    try {
      let res
      if (view === 'edit' && editingTemplate) {
        res = await fetch('/api/task-templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingTemplate.id, ...payload })
        })
      } else {
        res = await fetch('/api/task-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      if (res.ok) {
        await fetchTemplates()
        setView('list')
        resetForm()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save template')
      }
    } catch (e) {
      setError('Failed to save template')
    }
  }

  async function handleDelete(id) {
    try {
      const res = await fetch(`/api/task-templates?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setTemplates(prev => prev.filter(t => t.id !== id))
      }
    } catch (e) {
      setError('Failed to delete template')
    }
  }

  function handleEdit(template) {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      icon: template.icon || '📋',
      default_title: template.default_title || '',
      default_description: template.default_description || '',
      default_status: template.default_status || 'todo',
      default_priority: template.default_priority || 'medium'
    })
    setView('edit')
  }

  function handleUseTemplate(template) {
    onSelectTemplate({
      title: template.default_title || '',
      description: template.default_description || '',
      status: template.default_status || 'todo',
      priority: template.default_priority || 'medium',
      custom_values: template.default_custom_values || {}
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {view !== 'list' && (
              <button
                onClick={() => { setView('list'); resetForm(); }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ←
              </button>
            )}
            <FileText className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">
              {view === 'list' ? 'Task Templates' : view === 'create' ? 'New Template' : 'Edit Template'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* List View */}
        {view === 'list' && (
          <div className="p-6">
            {loading ? (
              <div className="text-center py-8 text-gray-400">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                <p className="text-gray-400 mb-1">No templates yet</p>
                <p className="text-gray-500 text-sm mb-4">Create reusable task templates to speed up your workflow</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto mb-4">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className="group flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all cursor-pointer"
                    onClick={() => handleUseTemplate(template)}
                  >
                    <span className="text-2xl">{template.icon || '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{template.name}</p>
                      <p className="text-gray-500 text-xs truncate">
                        {template.default_title ? `"${template.default_title}"` : 'No default title'}
                        {' · '}
                        {template.default_status} · {template.default_priority}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(template); }}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(template.id); }}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => { resetForm(); setView('create'); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/20 text-purple-400 hover:text-purple-300 transition-all text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Create Template
            </button>
          </div>
        )}

        {/* Create / Edit View */}
        {(view === 'create' || view === 'edit') && (
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Icon + Name */}
            <div className="flex items-start gap-3">
              <div className="relative">
                <button
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 flex items-center justify-center text-2xl transition-colors"
                >
                  {formData.icon}
                </button>
                {showIconPicker && (
                  <div className="absolute top-14 left-0 z-10 p-2 bg-[#1e1e3a] border border-white/10 rounded-xl shadow-xl grid grid-cols-5 gap-1">
                    {TEMPLATE_ICONS.map(icon => (
                      <button
                        key={icon}
                        onClick={() => { setFormData(prev => ({ ...prev, icon })); setShowIconPicker(false); }}
                        className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center text-lg transition-colors"
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-400 mb-1">Template Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Bug Report, Feature Request..."
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/20 text-sm"
                />
              </div>
            </div>

            {/* Default Title */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Default Title</label>
              <input
                type="text"
                value={formData.default_title}
                onChange={e => setFormData(prev => ({ ...prev, default_title: e.target.value }))}
                placeholder="Pre-filled task title..."
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/20 text-sm"
              />
            </div>

            {/* Default Description */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Default Description</label>
              <textarea
                value={formData.default_description}
                onChange={e => setFormData(prev => ({ ...prev, default_description: e.target.value }))}
                placeholder="Pre-filled task description or checklist..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/20 text-sm resize-none"
              />
            </div>

            {/* Status + Priority Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Default Status</label>
                <select
                  value={formData.default_status}
                  onChange={e => setFormData(prev => ({ ...prev, default_status: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/20 text-sm"
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Default Priority</label>
                <select
                  value={formData.default_priority}
                  onChange={e => setFormData(prev => ({ ...prev, default_priority: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/20 text-sm"
                >
                  {PRIORITY_OPTIONS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-colors text-sm font-medium"
            >
              <Check className="w-4 h-4" />
              {view === 'edit' ? 'Update Template' : 'Save Template'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
          }
