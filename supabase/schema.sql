-- ============================================================
-- Family Operations Board — Supabase Schema
-- Run this in your Supabase SQL Editor (in order)
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. EXTENSIONS
-- ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────────
-- 2. PROFILES
-- ──────────────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  display_name text not null,
  role        text not null check (role in ('parent_admin', 'family_member')),
  created_at  timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'family_member')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ──────────────────────────────────────────────
-- 3. CATEGORIES
-- ──────────────────────────────────────────────
create table categories (
  id   uuid primary key default uuid_generate_v4(),
  name text not null unique
);

insert into categories (name) values
  ('Chores'),
  ('Tasks'),
  ('Projects');

-- ──────────────────────────────────────────────
-- 4. TASKS
-- ──────────────────────────────────────────────
create table tasks (
  id             uuid primary key default uuid_generate_v4(),
  title          text not null,
  category_id    uuid not null references categories(id),
  description    text,
  created_by     uuid not null references profiles(id),
  assigned_date  date,
  due_date       date,
  completed_date date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_updated_at
  before update on tasks
  for each row execute procedure update_updated_at();

-- ──────────────────────────────────────────────
-- 5. TASK PARTICIPANTS
-- ──────────────────────────────────────────────
create table task_participants (
  id              uuid primary key default uuid_generate_v4(),
  task_id         uuid not null references tasks(id) on delete cascade,
  user_id         uuid not null references profiles(id),
  participant_role text,
  status          text not null default 'Not Started'
                    check (status in (
                      'Not Started','In Progress','Waiting',
                      'Question','Completed','Incomplete','Unable to Complete'
                    )),
  date_assigned   date,
  date_completed  date,
  unable_reason   text,
  last_checkin_at timestamptz,
  unique(task_id, user_id)
);

-- ──────────────────────────────────────────────
-- 6. TASK COMMENTS
-- ──────────────────────────────────────────────
create table task_comments (
  id         uuid primary key default uuid_generate_v4(),
  task_id    uuid not null references tasks(id) on delete cascade,
  user_id    uuid not null references profiles(id),
  type       text not null check (type in ('question','answer','check_in','note','reminder')),
  body       text not null,
  created_at timestamptz not null default now()
);

-- ──────────────────────────────────────────────
-- 7. TASK ACTIVITY
-- ──────────────────────────────────────────────
create table task_activity (
  id          uuid primary key default uuid_generate_v4(),
  task_id     uuid not null references tasks(id) on delete cascade,
  actor_id    uuid not null references profiles(id),
  action_type text not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- ──────────────────────────────────────────────
-- 8. ROW LEVEL SECURITY
-- ──────────────────────────────────────────────

-- Helper: check if current user is a parent_admin
create or replace function is_parent_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'parent_admin'
  );
$$;

-- Helper: check if current user is assigned to a task
create or replace function is_task_participant(p_task_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from task_participants
    where task_id = p_task_id and user_id = auth.uid()
  );
$$;

-- ── PROFILES ──
alter table profiles enable row level security;

create policy "Users can read all profiles"
  on profiles for select using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- ── CATEGORIES ──
alter table categories enable row level security;

create policy "Anyone authenticated can read categories"
  on categories for select using (auth.uid() is not null);

-- ── TASKS ──
alter table tasks enable row level security;

-- Parents see all tasks; family members see only assigned tasks
create policy "Parents read all tasks"
  on tasks for select using (is_parent_admin());

create policy "Family members read assigned tasks"
  on tasks for select using (
    not is_parent_admin() and is_task_participant(id)
  );

-- Parents can insert tasks
create policy "Parents can create tasks"
  on tasks for insert with check (is_parent_admin());

-- Parents can update only tasks they created
create policy "Parents can update own tasks"
  on tasks for update using (
    is_parent_admin() and created_by = auth.uid()
  );

-- No deletes allowed by any user
-- (no delete policy = no deletes)

-- ── TASK_PARTICIPANTS ──
alter table task_participants enable row level security;

-- Parents see all participant rows; family members see their own
create policy "Parents read all participants"
  on task_participants for select using (is_parent_admin());

create policy "Family members read own participant rows"
  on task_participants for select using (
    not is_parent_admin() and user_id = auth.uid()
  );

-- Parents can insert participants (assigning users to tasks)
create policy "Parents can assign participants"
  on task_participants for insert with check (is_parent_admin());

-- Parents can update any participant row
create policy "Parents can update any participant"
  on task_participants for update using (is_parent_admin());

-- Family members can update ONLY their own row
create policy "Family members update own participant row"
  on task_participants for update using (
    not is_parent_admin() and user_id = auth.uid()
  );

-- ── TASK_COMMENTS ──
alter table task_comments enable row level security;

-- Parents see all comments
create policy "Parents read all comments"
  on task_comments for select using (is_parent_admin());

-- Family members see comments only on their tasks
create policy "Family members read comments on assigned tasks"
  on task_comments for select using (
    not is_parent_admin() and is_task_participant(task_id)
  );

-- Parents can comment on any task
create policy "Parents can insert comments"
  on task_comments for insert with check (is_parent_admin());

-- Family members can comment only on tasks they're assigned to
create policy "Family members comment on assigned tasks"
  on task_comments for insert with check (
    not is_parent_admin() and is_task_participant(task_id)
  );

-- Users can update their own comments
create policy "Users update own comments"
  on task_comments for update using (user_id = auth.uid());

-- ── TASK_ACTIVITY ──
alter table task_activity enable row level security;

-- Parents see all activity
create policy "Parents read all activity"
  on task_activity for select using (is_parent_admin());

-- Family members see activity only on their tasks
create policy "Family members read activity on assigned tasks"
  on task_activity for select using (
    not is_parent_admin() and is_task_participant(task_id)
  );

-- Any authenticated user can insert activity (system-generated)
create policy "Authenticated users insert activity"
  on task_activity for insert with check (auth.uid() is not null);

-- ──────────────────────────────────────────────
-- 9. VIEWS (convenience)
-- ──────────────────────────────────────────────

-- Task list view with participant count and current user's status
create or replace view task_list_view as
select
  t.id,
  t.title,
  t.description,
  t.category_id,
  c.name as category_name,
  t.created_by,
  p.display_name as created_by_name,
  t.assigned_date,
  t.due_date,
  t.completed_date,
  t.created_at,
  t.updated_at,
  count(tp.id) as participant_count,
  array_agg(distinct pr.display_name) filter (where pr.display_name is not null) as participant_names
from tasks t
join categories c on c.id = t.category_id
join profiles p on p.id = t.created_by
left join task_participants tp on tp.task_id = t.id
left join profiles pr on pr.id = tp.user_id
group by t.id, c.name, p.display_name;
