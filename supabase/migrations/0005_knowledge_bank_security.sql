-- Keep the searchable knowledge-bank RPC available to signed-in users only.
revoke all on function public.search_knowledge_chunks(text, text, integer) from public;
revoke all on function public.search_knowledge_chunks(text, text, integer) from anon;
grant execute on function public.search_knowledge_chunks(text, text, integer) to authenticated, service_role;

-- The table is intentionally not directly readable; access is through the RPC.
-- This explicit deny policy documents that boundary and avoids an RLS table with no policy.
drop policy if exists knowledge_document_chunks_no_direct_access on public.knowledge_document_chunks;
create policy knowledge_document_chunks_no_direct_access
  on public.knowledge_document_chunks
  for all
  to authenticated
  using (false)
  with check (false);
