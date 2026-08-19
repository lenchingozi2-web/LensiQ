begin;

drop function if exists public.search_question_bank(text, text, text, integer);

create function public.search_question_bank(
  search_text text,
  subject_filter text default null,
  division_filter text default null,
  max_results integer default 40
)
returns table (
  id uuid,
  subject text,
  division text,
  topic text,
  type text,
  year integer,
  question_text text,
  image_url text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  option_e text,
  correct_answer text,
  model_answer text,
  relevance real
)
language sql
stable
set search_path = public
as $$
  with query_terms as (
    select
      websearch_to_tsquery('simple', trim(search_text)) as tsquery,
      lower(trim(search_text)) as phrase
  ),
  ranked_questions as (
    select
      q.*,
      to_tsvector(
        'simple',
        concat_ws(' ', q.question_text, q.division, q.topic, q.subject, q.source_flag)
      ) as document,
      query_terms.tsquery,
      query_terms.phrase
    from public.questions q
    cross join query_terms
    where length(trim(search_text)) > 0
      and (subject_filter is null or q.subject = subject_filter)
      and (division_filter is null or q.division = division_filter)
  )
  select
    ranked_questions.id,
    ranked_questions.subject,
    ranked_questions.division,
    ranked_questions.topic,
    ranked_questions.type,
    ranked_questions.year,
    ranked_questions.question_text,
    ranked_questions.image_url,
    ranked_questions.option_a,
    ranked_questions.option_b,
    ranked_questions.option_c,
    ranked_questions.option_d,
    ranked_questions.option_e,
    ranked_questions.correct_answer,
    ranked_questions.model_answer,
    (
      ts_rank_cd(ranked_questions.document, ranked_questions.tsquery)
      + case when lower(ranked_questions.question_text) like '%' || ranked_questions.phrase || '%' then 0.75 else 0 end
      + case when lower(coalesce(ranked_questions.topic, '')) like '%' || ranked_questions.phrase || '%' then 0.35 else 0 end
    )::real as relevance
  from ranked_questions
  where ranked_questions.document @@ ranked_questions.tsquery
  order by relevance desc, ranked_questions.created_at desc
  limit least(greatest(coalesce(max_results, 40), 1), 100);
$$;

revoke all on function public.search_question_bank(text, text, text, integer) from public;
grant execute on function public.search_question_bank(text, text, text, integer) to anon, authenticated, service_role;

commit;
