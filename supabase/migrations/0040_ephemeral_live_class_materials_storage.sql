begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ephemeral_class_materials',
  'ephemeral_class_materials',
  false,
  20971520,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
)
on conflict (id) do update set public = false, file_size_limit = 20971520,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read their own ephemeral Live Class materials" on storage.objects;
drop policy if exists "Users can upload their own ephemeral Live Class materials" on storage.objects;
drop policy if exists "Users can delete their own ephemeral Live Class materials" on storage.objects;
create policy "Users can read their own ephemeral Live Class materials"
  on storage.objects for select
  using (bucket_id = 'ephemeral_class_materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can upload their own ephemeral Live Class materials"
  on storage.objects for insert
  with check (bucket_id = 'ephemeral_class_materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete their own ephemeral Live Class materials"
  on storage.objects for delete
  using (bucket_id = 'ephemeral_class_materials' and (storage.foldername(name))[1] = auth.uid()::text);
commit;
