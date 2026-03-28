# TeamBoard — Setup & Deployment Guide

A full-stack discussion and task board built with **Next.js 14** + **Supabase**, deployable to Vercel in ~10 minutes.

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Choose a name (e.g. `teamboard`), set a database password, pick the closest region
3. Wait for the project to be ready (~2 min)

---

## 2. Run the Database Schema

1. In your Supabase dashboard → **SQL Editor** → **New Query**
2. Paste the entire contents of `supabase/schema.sql`
3. Click **Run** — all tables, RLS policies, and triggers will be created

---

## 3. Get Your API Keys

In your Supabase dashboard → **Settings → API**:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | "Project URL" |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | "anon / public" key |
| `SUPABASE_SERVICE_ROLE_KEY` | "service_role" key (keep this secret!) |

---

## 4. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
COWORK_API_KEY=some-long-random-secret-string
```

> **COWORK_API_KEY** — generate any random string. This is what Claude/Cowork uses to call the API.
> Suggested: `openssl rand -hex 32`

---

## 5. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 6. Deploy to Vercel (Free)

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo
3. Add the 4 environment variables from step 4
4. Click **Deploy** — your app will be live at `https://your-app.vercel.app`

---

## Cowork / Claude API Reference

All endpoints require:
```
Authorization: Bearer <COWORK_API_KEY>
Content-Type: application/json
```

### List all boards
```
GET /api/cowork/boards
GET /api/cowork/boards?user_id=<uuid>
```

### Create a board
```
POST /api/cowork/boards
{ "name": "Q2 Planning", "description": "...", "created_by": "<user_uuid>" }
```

### List tasks
```
GET /api/cowork/tasks
GET /api/cowork/tasks?board_id=<uuid>
GET /api/cowork/tasks?status=todo
GET /api/cowork/tasks?status=in_progress
GET /api/cowork/tasks?assigned_to=<user_uuid>
GET /api/cowork/tasks?due_before=2026-04-01
GET /api/cowork/tasks?priority=high
```

### Create a task
```
POST /api/cowork/tasks
{
  "board_id": "<uuid>",
  "title": "Write onboarding doc",
  "description": "...",
  "status": "todo",           // todo | in_progress | done
  "priority": "high",         // low | medium | high
  "assigned_to": "<user_uuid>",
  "due_date": "2026-04-15"
}
```

### Get task (with comments)
```
GET /api/cowork/tasks/:id
```

### Update a task
```
PATCH /api/cowork/tasks/:id
{
  "status": "in_progress",
  "assigned_to": "<user_uuid>",
  "priority": "high"
}
```
Updatable fields: `title`, `description`, `status`, `priority`, `assigned_to`, `due_date`

### Delete a task
```
DELETE /api/cowork/tasks/:id
```

---

## Project Structure

```
src/
├── app/
│   ├── auth/login/        Login page
│   ├── auth/signup/       Signup page
│   ├── dashboard/         Board list + create board
│   ├── boards/[boardId]/  Kanban board view
│   └── api/cowork/        Claude/Cowork REST API
├── components/
│   └── Sidebar.js         Navigation sidebar
└── lib/
    ├── supabase.js         Browser Supabase client
    └── supabase-server.js  Server + admin Supabase clients
supabase/
└── schema.sql             Full database schema
```

---

## User Roles

| Role | Can do |
|---|---|
| **owner** | All actions, invite members, delete board |
| **member** | Create/edit/delete tasks, comment |
| **viewer** | Read-only access |

---

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth (email/password)
- **Deployment**: Vercel (recommended)
