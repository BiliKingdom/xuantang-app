insert into public.achievements (id, title, description)
values
  ('first-game', '第一碗汤', '完成一次完整推理'),
  ('first-win', '真相触达', '首次猜中汤底'),
  ('clue-hunter', '线索猎手', '收齐一局关键线索'),
  ('one-key-question', '神之一问', '提出 10 个关键问题'),
  ('gold-host', '金牌煲汤人', '获得 5 次 MVP'),
  ('collector', '向夜饮尽', '收藏 20 个汤底')
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description;

create policy "users can insert own achievements"
on public.user_achievements for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "users can delete own achievements"
on public.user_achievements for delete
to authenticated
using (user_id = (select auth.uid()));
