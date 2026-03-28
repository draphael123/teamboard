-- ============================================================
-- Discussion Board – Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- UUID extension (usually already enabled)
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────

-- Profiles (one row per user, auto-created on sign-up)
create table public.profiles (
  id            uuid        references auth.users(id) on delete cascade primary key,
  email         text        unique not null,
  full_name     text,
  avatar_url    text,
  is_admin      boolean     default false,
  created_at    timestamptz default now()
);

-- Boards (like Asana projects)
create table public.boards (
  id            uuid        default gen_random_uuid() primary key,
  name          text        not null,
  description   text,
  color         text        default '#2952ff',
  created_by    uuid        references public.profiles(id),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Board members with roles
create table public.board_members (
  id         uuid        default gen_random_uuid() primary key,
  board_id   uuid        references public.boards(id)   on delete cascade not null,
  user_id    uuid        references public.profiles(id) on delete cascade not null,
  role       text        default 'member' check (role in ('owner','member','viewer')),
  joined_at  timestamptz default now(),
  unique(board_id, user_id)
);

-- Tasks (live inside a board)
create table public.tasks (
  id            uuid        default gen_random_uuid() primary key,
  board_id      uuid        references public.boards(id) on delete cascade not null,
  title         text        not null,
  description   text,
  status        text        default 'todo'   check (status   in ('todo','in_progress','done')),
  priority      text        default 'medium' check (priority in ('low','medium','high')),
  assigned_to   uuid        references public.profiles(id),
  created_by    uuid        references public.profiles(id),
  due_date      date,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Comments on tasks
create table public.comments (
  id          uuid        default gen_random_uuid() primary key,
  task_id     uuid        references public.tasks(id) on delete cascade not null,
  user_id     uuid        references public.profiles(id),
  content     text        not null,
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────
-- ROW-LEVEL SECURITY
-- ─────────────────────────────────────────

alter table public.profiles      enable row level security;
alter table public.boards        enable row level security;
alter table public.board_members enable row level security;
alter table public.tasks         enable row level security;
alter table public.comments      enable row level security;

-- Profiles
create policy "Authenticated users can read all profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Boards
create policy "Board members can view boards"
  on public.boards for select
  using (
    auth.uid() in (
      select user_id from public.board_members where board_id = id
    )
  );

create policy "Authenticated users can create boards"
  on public.boards for insert
  with check (auth.role() = 'authenticated');

create policy "Board owners can update boards"
  on public.boards for update
  using (
    auth.uid() in (
      select user_id from public.board_members
      where board_id = id and role = 'owner'
    )
  );

create policy "Board owners can delete boards"
  on public.boards for delete
  using (
    auth.uid() in (
      select user_id from public.board_members
      where board_id = id and role = 'owner'
    )
  );

-- Board members
create policy "Authenticated users can read board memberships"
  on public.board_members for select
  using (auth.role() = 'authenticated');

create policy "Users can insert their own membership"
  on public.board_members for insert
  with check (auth.uid() = user_id);

create policy "Board owners can manage memberships"
  on public.board_members for all
  using (
    auth.uid() in (
      select user_id from public.board_members bm
      where bm.board_id = board_id and bm.role = 'owner'
    )
  );

-- Tasks
create policy "Board members can view tasks"
  on public.tasks for select
  using (
    auth.uid() in (
      select user_id from public.board_members where board_id = tasks.board_id
    )
  );

create policy "Board members can create tasks"
  on public.tasks for insert
  with check (
    auth.uid() in (
      select user_id from public.board_members where board_id = board_id
    )
  );

create policy "Board members can update tasks"
  on public.tasks for update
  using (
    auth.uid() in (
      select user_id from public.board_members where board_id = tasks.board_id
    )
  );

create policy "Board members can delete tasks"
  on public.tasks for delete
  using (
    auth.uid() in (
      select user_id from public.board_members where board_id = tasks.board_id
    )
  );

-- Comments
create policy "Board members can view comments"
  on public.comments for select
  using (
    auth.uid() in (
      select bm.user_id
      from public.board_members bm
      join public.tasks t on t.board_id = bm.board_id
      where t.id = task_id
    )
  );

create policy "Board members can create comments"
  on public.comments for insert
  with check (
    auth.uid() in (
      select bm.user_id
      from public.board_members bm
      join public.tasks t on t.board_id = bm.board_id
      where t.id = task_id
    )
  );

create policy "Comment authors can delete their own comments"
  on public.comments for delete
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- FUNCTIONS & TRIGGERS
-- ─────────────────────────────────────────

-- Auto-create profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update the `updated_at` column on boards & tasks
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger boards_updated_at
  before update on public.boards
  for each row execute procedure public.set_updated_at();

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.set_updated_at();
