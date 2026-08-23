begin;

update public.teaching_conversations
set recording_expires_at = recording_created_at + interval '30 days'
where session_type = 'live_class'
  and recording_path is not null
  and recording_created_at is not null
  and recording_expires_at is null;

commit;
