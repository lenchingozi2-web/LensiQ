-- High-confidence, non-semantic typo and grammar repairs identified in the global audit.
-- No answer choices or medical facts are changed.

-- Microbiology MCQ wording
update public.questions
set question_text = replace(question_text, 'Gram stained', 'Gram-stained')
where id = 'f983e886-5409-4092-9fce-99d06b5c51c5';

update public.questions
set question_text = replace(question_text, 'gull-winged shaped', 'gull-wing-shaped')
where id = 'f983e886-5409-4092-9fce-99d06b5c51c5';

update public.questions
set question_text = replace(question_text, 'a selective media at', 'a selective medium at')
where id = 'f983e886-5409-4092-9fce-99d06b5c51c5';

-- The source uses this term as a paired classification label.
update public.questions
set question_text = replace(question_text, 'serotype and nonserotype', 'serotype and non-serotype')
where id in (
  'f46702b0-6618-4b99-b1ef-197dc4b40885',
  '894e382a-80f0-4e80-af6d-9f43b12e1f7a'
);
