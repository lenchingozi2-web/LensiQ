insert into storage.buckets (id, name, public)
values ('live-class-recordings', 'live-class-recordings', false)
on conflict (id) do nothing;

create policy "Users can read their own Live Class recordings"
  on storage.objects for select
  using (bucket_id = 'live-class-recordings' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload their own Live Class recordings"
  on storage.objects for insert
  with check (bucket_id = 'live-class-recordings' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own Live Class recordings"
  on storage.objects for delete
  using (bucket_id = 'live-class-recordings' and (storage.foldername(name))[1] = auth.uid()::text);
