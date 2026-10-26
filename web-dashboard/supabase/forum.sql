-- Run in Supabase SQL Editor to enable the authenticated member discussion forum.
create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null default 'Anggota',
  category text not null check (category in ('Umum', 'Hardware', 'Firmware', 'Dashboard')),
  title text not null check (char_length(title) between 3 and 120),
  content text not null check (char_length(content) between 3 and 5000),
  created_at timestamptz not null default now()
);

create table if not exists public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null default 'Anggota',
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists forum_posts_created_at_idx on public.forum_posts (created_at desc);
create index if not exists forum_replies_post_created_idx on public.forum_replies (post_id, created_at);

alter table public.forum_posts enable row level security;
alter table public.forum_replies enable row level security;

grant select, insert on public.forum_posts to authenticated;
grant select, insert on public.forum_replies to authenticated;

drop policy if exists "Members can read forum posts" on public.forum_posts;
create policy "Members can read forum posts"
  on public.forum_posts for select to authenticated using (true);

drop policy if exists "Members can create own forum posts" on public.forum_posts;
create policy "Members can create own forum posts"
  on public.forum_posts for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Members can read forum replies" on public.forum_replies;
create policy "Members can read forum replies"
  on public.forum_replies for select to authenticated using (true);

drop policy if exists "Members can create own forum replies" on public.forum_replies;
create policy "Members can create own forum replies"
  on public.forum_replies for insert to authenticated
  with check (auth.uid() = user_id);

