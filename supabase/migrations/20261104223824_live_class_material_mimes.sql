-- Structured source maps and legacy DOC uploads use these MIME types.
-- Preserve unrestricted buckets, existing formats, privacy and ownership policies.
update storage.buckets
set allowed_mime_types = array(
  select distinct mime from unnest(allowed_mime_types ||
    array['application/json', 'application/msword']) as mime order by mime
)
where id = 'ephemeral_class_materials' and allowed_mime_types is not null;
