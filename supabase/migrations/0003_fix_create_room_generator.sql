create or replace function public.create_room(p_soup_id uuid, p_mode text, p_max_players int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_room_id uuid;
  new_code text;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;

  new_code := public.make_room_code();

  insert into public.rooms (code, soup_id, host_user_id, mode, max_players)
  values (new_code, p_soup_id, (select auth.uid()), coalesce(p_mode, 'AI 主持'), greatest(1, least(coalesce(p_max_players, 6), 8)))
  returning id into new_room_id;

  insert into public.room_members (room_id, user_id, role)
  values (new_room_id, (select auth.uid()), 'host');

  return new_room_id;
end;
$$;
