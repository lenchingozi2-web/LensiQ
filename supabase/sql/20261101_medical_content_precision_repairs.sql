-- LenxiQ medical content: source-preserving corrections to MCQ, theory and practical.
-- Run only against project hixvbcrrklyajhkyliay.
-- All edits are reversible from the private, versioned original-row snapshots.
BEGIN;
SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '8s';

DO $guard$
BEGIN
  IF to_regclass('public.questions') IS NULL THEN
    RAISE EXCEPTION 'Expected medical question bank public.questions is missing';
  END IF;
END
$guard$;

CREATE SCHEMA IF NOT EXISTS lenxiq_internal;
REVOKE ALL ON SCHEMA lenxiq_internal FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS lenxiq_internal.question_repair_history (
  batch_id text NOT NULL,
  question_id uuid NOT NULL,
  original_row jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, question_id)
);
REVOKE ALL ON lenxiq_internal.question_repair_history FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS lenxiq_internal.question_review_queue (
  question_id uuid PRIMARY KEY,
  issue_codes text[] NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON lenxiq_internal.question_review_queue FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION lenxiq_internal.clean_rendering(p_text text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT
SET search_path = pg_catalog
AS $fn$
  SELECT replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                p_text,
                chr(8203), ''),      -- zero-width space
              chr(65279), ''),      -- byte-order mark / zero-width no-break space
            chr(160), ' '),        -- nonbreaking space
          chr(8239), ' '),         -- narrow nonbreaking space
        chr(61623), '•'),         -- mapped private font bullet
      chr(61613), '↑'),           -- mapped private font up-arrow
    chr(61540), 'δ');             -- mapped private font delta
$fn$;
REVOKE ALL ON FUNCTION lenxiq_internal.clean_rendering(text)
  FROM PUBLIC, anon, authenticated;

-- Include only rows whose original text actually contains a known corruption.
-- Carefully identified clinical updates are tied to a specific source record.
WITH candidates AS (
  SELECT q.id
  FROM public.questions q
  WHERE q.question_text IS DISTINCT FROM lenxiq_internal.clean_rendering(q.question_text)
    OR q.option_a IS DISTINCT FROM lenxiq_internal.clean_rendering(q.option_a)
    OR q.option_b IS DISTINCT FROM lenxiq_internal.clean_rendering(q.option_b)
    OR q.option_c IS DISTINCT FROM lenxiq_internal.clean_rendering(q.option_c)
    OR q.option_d IS DISTINCT FROM lenxiq_internal.clean_rendering(q.option_d)
    OR q.option_e IS DISTINCT FROM lenxiq_internal.clean_rendering(q.option_e)
    OR q.correct_answer IS DISTINCT FROM lenxiq_internal.clean_rendering(q.correct_answer)
    OR q.model_answer IS DISTINCT FROM lenxiq_internal.clean_rendering(q.model_answer)
    OR (
      q.id = '0cf244e9-b88e-49a0-b672-b2bfccee23af'
      AND q.model_answer ~ 'every 7[[:space:]]+hours for P[.] malariae'
    )
    OR (
      q.id = '15d61210-5d89-4fde-ad00-0cb9c84bd1b6'
      AND q.model_answer ~ 'Azithromycin [(]single dose[)] or Doxycycline [(]7-day course[)] as first-lin(e)?[[:space:]]+for chlamydial urethritis'
    )
)
INSERT INTO lenxiq_internal.question_repair_history (batch_id, question_id, original_row)
SELECT '20261101_clinical_rendering_v1', q.id, to_jsonb(q)
FROM public.questions q
JOIN candidates c ON c.id = q.id
ON CONFLICT (batch_id, question_id) DO NOTHING;

-- Make only source-preserving typographic changes and the two verified
-- theory-answer factual corrections. No answer keys are inferred or rewritten.
UPDATE public.questions q
SET
  question_text = lenxiq_internal.clean_rendering(q.question_text),
  option_a = lenxiq_internal.clean_rendering(q.option_a),
  option_b = lenxiq_internal.clean_rendering(q.option_b),
  option_c = lenxiq_internal.clean_rendering(q.option_c),
  option_d = lenxiq_internal.clean_rendering(q.option_d),
  option_e = lenxiq_internal.clean_rendering(q.option_e),
  correct_answer = lenxiq_internal.clean_rendering(q.correct_answer),
  model_answer =
    CASE
      WHEN q.id = '0cf244e9-b88e-49a0-b672-b2bfccee23af'
        THEN regexp_replace(
          lenxiq_internal.clean_rendering(q.model_answer),
          'every 7[[:space:]]+hours for P[.] malariae',
          'every 72 hours for P. malariae',
          'g'
        )
      WHEN q.id = '15d61210-5d89-4fde-ad00-0cb9c84bd1b6'
        THEN regexp_replace(
          lenxiq_internal.clean_rendering(q.model_answer),
          'Azithromycin [(]single dose[)] or Doxycycline [(]7-day course[)] as first-lin(e)?[[:space:]]+for chlamydial urethritis',
          'Doxycycline 100 mg orally twice daily for 7 days is first-line for chlamydial urethritis; azithromycin 1 g orally as a single dose is an alternative.',
          'g'
        )
      ELSE lenxiq_internal.clean_rendering(q.model_answer)
    END
WHERE
  q.question_text IS DISTINCT FROM lenxiq_internal.clean_rendering(q.question_text)
  OR q.option_a IS DISTINCT FROM lenxiq_internal.clean_rendering(q.option_a)
  OR q.option_b IS DISTINCT FROM lenxiq_internal.clean_rendering(q.option_b)
  OR q.option_c IS DISTINCT FROM lenxiq_internal.clean_rendering(q.option_c)
  OR q.option_d IS DISTINCT FROM lenxiq_internal.clean_rendering(q.option_d)
  OR q.option_e IS DISTINCT FROM lenxiq_internal.clean_rendering(q.option_e)
  OR q.correct_answer IS DISTINCT FROM lenxiq_internal.clean_rendering(q.correct_answer)
  OR q.model_answer IS DISTINCT FROM lenxiq_internal.clean_rendering(q.model_answer)
  OR (q.id = '0cf244e9-b88e-49a0-b672-b2bfccee23af'
      AND q.model_answer ~ 'every 7[[:space:]]+hours for P[.] malariae')
  OR (q.id = '15d61210-5d89-4fde-ad00-0cb9c84bd1b6'
      AND q.model_answer ~ 'Azithromycin [(]single dose[)] or Doxycycline [(]7-day course[)] as first-lin(e)?[[:space:]]+for chlamydial urethritis');

-- Private QA queue: inspect ALL MCQs for structural concerns without
-- changing an answer key that has not been clinically verified.
WITH checks AS (
 SELECT q.id,
  array_remove(ARRAY[
    CASE WHEN q.question_text IS NULL OR btrim(q.question_text) = ''
      THEN 'missing_question' END,
    CASE WHEN q.correct_answer IS NULL OR btrim(q.correct_answer) = ''
      THEN 'missing_correct_answer' END,
    CASE WHEN
      (CASE WHEN nullif(btrim(q.option_a), '') IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN nullif(btrim(q.option_b), '') IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN nullif(btrim(q.option_c), '') IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN nullif(btrim(q.option_d), '') IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN nullif(btrim(q.option_e), '') IS NOT NULL THEN 1 ELSE 0 END) < 2
      THEN 'fewer_than_two_options' END,
    CASE WHEN nullif(lower(btrim(q.option_a)), '') IS NOT NULL AND
        (lower(btrim(q.option_a)) = lower(btrim(q.option_b)) OR
         lower(btrim(q.option_a)) = lower(btrim(q.option_c)) OR
         lower(btrim(q.option_a)) = lower(btrim(q.option_d)) OR
         lower(btrim(q.option_a)) = lower(btrim(q.option_e)))
      THEN 'duplicate_option_text' END,
    CASE WHEN q.correct_answer ~* '^[A-E]$' AND
      CASE upper(q.correct_answer)
        WHEN 'A' THEN nullif(btrim(q.option_a), '') IS NULL
        WHEN 'B' THEN nullif(btrim(q.option_b), '') IS NULL
        WHEN 'C' THEN nullif(btrim(q.option_c), '') IS NULL
        WHEN 'D' THEN nullif(btrim(q.option_d), '') IS NULL
        WHEN 'E' THEN nullif(btrim(q.option_e), '') IS NULL
        ELSE false
      END
      THEN 'answer_letter_has_no_option' END,
    CASE WHEN coalesce(q.question_text,'') || coalesce(q.model_answer,'')
                || coalesce(q.option_a,'') || coalesce(q.option_b,'')
                || coalesce(q.option_c,'') || coalesce(q.option_d,'')
                || coalesce(q.option_e,'') LIKE '%' || chr(65533) || '%'
       THEN 'unrecoverable_replacement_glyph' END,
    CASE WHEN coalesce(q.question_text,'') || coalesce(q.model_answer,'')
                || coalesce(q.option_a,'') || coalesce(q.option_b,'')
                || coalesce(q.option_c,'') || coalesce(q.option_d,'')
                || coalesce(q.option_e,'') LIKE '%■%'
       THEN 'ambiguous_black_square_glyph' END
  ]::text[], NULL)::text[] AS issues
 FROM public.questions q
 WHERE lower(coalesce(q.type, '')) = 'mcq'
)
INSERT INTO lenxiq_internal.question_review_queue(question_id, issue_codes)
SELECT id, issues FROM checks WHERE cardinality(issues) > 0
ON CONFLICT(question_id) DO UPDATE
SET issue_codes = EXCLUDED.issue_codes, detected_at = now()
WHERE lenxiq_internal.question_review_queue.issue_codes IS DISTINCT FROM EXCLUDED.issue_codes;

COMMIT;

SELECT
  (SELECT count(*) FROM public.questions) AS total_questions,
  (SELECT count(*) FROM public.questions WHERE lower(type)='mcq') AS mcq_questions,
  (SELECT count(*) FROM public.questions WHERE lower(type)='theory') AS theory_questions,
  (SELECT count(*) FROM public.questions WHERE lower(type)='practical') AS practical_questions,
  (SELECT count(*) FROM lenxiq_internal.question_repair_history
    WHERE batch_id='20261101_clinical_rendering_v1') AS saved_original_rows,
  (SELECT count(*) FROM lenxiq_internal.question_review_queue) AS mcqs_queued_for_clinical_review;
