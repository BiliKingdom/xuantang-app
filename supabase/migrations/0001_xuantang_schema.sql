create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  avatar_url text,
  level int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.soups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  prompt text not null,
  difficulty text,
  duration_minutes int,
  min_players int,
  max_players int,
  rating numeric,
  accent text,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.soup_cases (
  soup_id uuid primary key references public.soups(id) on delete cascade,
  solution text not null,
  target_clue_count int not null,
  answer_keywords text[] not null
);

create table if not exists public.soup_rules (
  id uuid primary key default gen_random_uuid(),
  soup_id uuid not null references public.soups(id) on delete cascade,
  keywords text[] not null,
  answer text not null,
  clue_type text,
  clue text
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  soup_id uuid not null references public.soups(id),
  host_user_id uuid not null references public.profiles(id),
  status text not null default 'waiting',
  mode text not null default 'AI 主持',
  max_players int not null default 6,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  ready boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.game_questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  answer text not null,
  clue_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.game_clues (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  question_id uuid references public.game_questions(id) on delete set null,
  clue_type text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.game_guesses (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  score int not null,
  is_correct boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  soup_id uuid references public.soups(id) on delete set null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  soup_id uuid not null references public.soups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, soup_id)
);

create table if not exists public.achievements (
  id text primary key,
  title text not null,
  description text not null
);

create table if not exists public.user_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create index if not exists idx_rooms_code on public.rooms (code);
create index if not exists idx_rooms_host on public.rooms (host_user_id);
create index if not exists idx_rooms_soup on public.rooms (soup_id);
create index if not exists idx_room_members_user on public.room_members (user_id);
create index if not exists idx_room_members_room on public.room_members (room_id);
create index if not exists idx_game_questions_room on public.game_questions (room_id, created_at);
create index if not exists idx_game_clues_room on public.game_clues (room_id, created_at);
create index if not exists idx_game_guesses_room on public.game_guesses (room_id, created_at desc);
create index if not exists idx_favorites_user on public.favorites (user_id);
create index if not exists idx_posts_created_at on public.community_posts (created_at desc);

alter table public.profiles enable row level security;
alter table public.soups enable row level security;
alter table public.soup_cases enable row level security;
alter table public.soup_rules enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.game_questions enable row level security;
alter table public.game_clues enable row level security;
alter table public.game_guesses enable row level security;
alter table public.community_posts enable row level security;
alter table public.favorites enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'nickname', ''), split_part(new.email, '@', 1), '夜饮尽'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members
    where room_id = target_room_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_room_host(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rooms
    where id = target_room_id
      and host_user_id = (select auth.uid())
  );
$$;

create policy "profiles are readable by authenticated users"
on public.profiles for select
to authenticated
using (true);

create policy "users update own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "published soups are readable"
on public.soups for select
to authenticated
using (is_published = true);

create policy "members can read soup cases for their rooms"
on public.soup_cases for select
to authenticated
using (
  exists (
    select 1 from public.rooms
    where rooms.soup_id = soup_cases.soup_id
      and rooms.status = 'finished'
      and public.is_room_member(rooms.id)
  )
);

create policy "users can create rooms"
on public.rooms for insert
to authenticated
with check ((select auth.uid()) = host_user_id);

create policy "room members can read rooms"
on public.rooms for select
to authenticated
using (host_user_id = (select auth.uid()) or public.is_room_member(id));

create policy "room hosts can update rooms"
on public.rooms for update
to authenticated
using (public.is_room_host(id))
with check (public.is_room_host(id));

create policy "room members can read members"
on public.room_members for select
to authenticated
using (public.is_room_member(room_id) or user_id = (select auth.uid()));

create policy "room members can read questions"
on public.game_questions for select
to authenticated
using (public.is_room_member(room_id));

create policy "room members can read clues"
on public.game_clues for select
to authenticated
using (public.is_room_member(room_id));

create policy "room members can read guesses"
on public.game_guesses for select
to authenticated
using (public.is_room_member(room_id));

create policy "posts are readable"
on public.community_posts for select
to authenticated
using (true);

create policy "users can create posts"
on public.community_posts for insert
to authenticated
with check (author_id = (select auth.uid()));

create policy "users can read own favorites"
on public.favorites for select
to authenticated
using (user_id = (select auth.uid()));

create policy "users can write own favorites"
on public.favorites for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "achievements are readable"
on public.achievements for select
to authenticated
using (true);

create policy "users can read own achievements"
on public.user_achievements for select
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.create_room(p_soup_id uuid, p_mode text, p_max_players int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_room_id uuid;
  new_code text;
  attempts int := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;

  loop
    new_code := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 4));
    exit when not exists (select 1 from public.rooms where code = new_code);
    attempts := attempts + 1;
    if attempts > 12 then
      raise exception 'could not allocate room code';
    end if;
  end loop;

  insert into public.rooms (code, soup_id, host_user_id, mode, max_players)
  values (new_code, p_soup_id, (select auth.uid()), coalesce(p_mode, 'AI 主持'), greatest(1, least(coalesce(p_max_players, 6), 8)))
  returning id into new_room_id;

  insert into public.room_members (room_id, user_id, role)
  values (new_room_id, (select auth.uid()), 'host');

  return new_room_id;
end;
$$;

create or replace function public.join_room(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room public.rooms%rowtype;
  member_count int;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;

  select * into target_room
  from public.rooms
  where code = upper(trim(p_code))
  limit 1;

  if target_room.id is null then
    raise exception 'room not found';
  end if;

  if target_room.status <> 'waiting' then
    raise exception 'room already started';
  end if;

  select count(*) into member_count
  from public.room_members
  where room_id = target_room.id;

  if member_count >= target_room.max_players then
    raise exception 'room is full';
  end if;

  insert into public.room_members (room_id, user_id, role)
  values (target_room.id, (select auth.uid()), 'player')
  on conflict (room_id, user_id) do nothing;

  return target_room.id;
end;
$$;

create or replace function public.ask_room_question(p_room_id uuid, p_text text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_text text := left(trim(p_text), 80);
  target_soup uuid;
  matched_rule public.soup_rules%rowtype;
  answer_text text := '方向接近';
  question_id uuid;
begin
  if not public.is_room_member(p_room_id) then
    raise exception 'not a room member';
  end if;

  if clean_text = '' then
    raise exception 'question is empty';
  end if;

  select soup_id into target_soup
  from public.rooms
  where id = p_room_id;

  select * into matched_rule
  from public.soup_rules
  where soup_id = target_soup
    and exists (
      select 1
      from unnest(keywords) keyword
      where clean_text ilike '%' || keyword || '%'
    )
  order by id
  limit 1;

  if matched_rule.id is not null then
    answer_text := matched_rule.answer;
  elsif clean_text not like '%吗%' and clean_text not like '%是否%' and clean_text not like '%是不是%' then
    answer_text := '无法回答';
  end if;

  insert into public.game_questions (room_id, user_id, text, answer, clue_type)
  values (p_room_id, (select auth.uid()), clean_text, answer_text, matched_rule.clue_type)
  returning id into question_id;

  if matched_rule.clue_type is not null and matched_rule.clue is not null then
    insert into public.game_clues (room_id, question_id, clue_type, text)
    select p_room_id, question_id, matched_rule.clue_type, matched_rule.clue
    where not exists (
      select 1 from public.game_clues
      where room_id = p_room_id
        and text = matched_rule.clue
    );
  end if;

  return question_id;
end;
$$;

create or replace function public.submit_room_guess(p_room_id uuid, p_text text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_text text := left(trim(p_text), 180);
  target_soup uuid;
  keywords text[];
  hit_count int;
  clue_count int;
  final_score int;
  correct boolean;
begin
  if not public.is_room_member(p_room_id) then
    raise exception 'not a room member';
  end if;

  if clean_text = '' then
    raise exception 'guess is empty';
  end if;

  select soup_id into target_soup
  from public.rooms
  where id = p_room_id;

  select answer_keywords into keywords
  from public.soup_cases
  where soup_id = target_soup;

  select count(*) into hit_count
  from unnest(coalesce(keywords, array[]::text[])) keyword
  where clean_text ilike '%' || keyword || '%';

  select count(*) into clue_count
  from public.game_clues
  where room_id = p_room_id;

  final_score := least(96, 34 + hit_count * 10 + least(12, clue_count * 2));
  correct := final_score >= 72;

  insert into public.game_guesses (room_id, user_id, text, score, is_correct)
  values (p_room_id, (select auth.uid()), clean_text, final_score, correct);

  if correct then
    update public.rooms
    set status = 'finished',
        finished_at = now()
    where id = p_room_id;
  end if;

  return jsonb_build_object('score', final_score, 'is_correct', correct);
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.room_members;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.game_questions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.game_clues;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.game_guesses;
exception when duplicate_object then null;
end $$;
