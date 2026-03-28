import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

async function getMemberAccess(boardId) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminSupabaseClient()
  const { data: m } = await admin.from('board_members').select('role').eq('board_id', boardId).eq('user_id', user.id).single()
  if (!m) return null
  return { user, role: m.role, admin }
}

// GET /api/boards/[boardId]/tasks/[taskId]/attachments
export async function GET(request, { params }) {
  const access = await getMemberAccess(params.boardId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await access.admin
    .from('task_attachments')
    .select('*, uploader:uploaded_by(id,full_name,email)')
    .eq('task_id', params.taskId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Generate signed URLs for each attachment
  const withUrls = await Promise.all((data || []).map(async att => {
    const { data: signed } = await access.admin.storage
      .from('task-attachments')
      .createSignedUrl(att.storage_path, 3600) // 1 hour
    return { ...att, url: signed?.signedUrl || null }
  }))

  return NextResponse.json(withUrls)
}

// POST /api/boards/[boardId]/tasks/[taskId]/attachments  (multipart/form-data)
export async function POST(request, { params }) {
  const access = await getMemberAccess(params.boardId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.role === 'viewer') return NextResponse.json({ error: 'Viewers cannot upload' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file')
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const ext = file.name.split('.').pop()
  const storagePath = `${params.boardId}/${params.taskId}/${Date.now()}_${file.name}`

  const { error: uploadError } = await access.admin.storage
    .from('task-attachments')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

  const { data, error } = await access.admin
    .from('task_attachments')
    .insert({
      task_id: params.taskId,
      board_id: params.boardId,
      uploaded_by: access.user.id,
      filename: file.name,
      storage_path: storagePath,
      content_type: file.type,
      size_bytes: buffer.length,
    })
    .select('*, uploader:uploaded_by(id,full_name,email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: signed } = await access.admin.storage
    .from('task-attachments').createSignedUrl(storagePath, 3600)

  return NextResponse.json({ ...data, url: signed?.signedUrl || null })
}
