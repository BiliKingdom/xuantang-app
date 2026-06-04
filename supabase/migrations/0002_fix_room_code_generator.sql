create or replace function public.make_room_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  new_code text;
begin
  loop
    new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    exit when not exists (select 1 from public.rooms where code = new_code);
  end loop;

  return new_code;
end;
$$;
