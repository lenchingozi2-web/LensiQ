-- LenxiQ AI: normalize remaining font-private-use glyphs found in the full question-bank audit.
-- These are formatting-only replacements; no medical words, options, or answer keys are changed.
BEGIN;

UPDATE public.questions SET question_text = replace(question_text, chr(61623), '•') WHERE question_text IS NOT NULL AND position(chr(61623) in question_text) > 0;
UPDATE public.questions SET option_a = replace(option_a, chr(61623), '•') WHERE option_a IS NOT NULL AND position(chr(61623) in option_a) > 0;
UPDATE public.questions SET option_b = replace(option_b, chr(61623), '•') WHERE option_b IS NOT NULL AND position(chr(61623) in option_b) > 0;
UPDATE public.questions SET option_c = replace(option_c, chr(61623), '•') WHERE option_c IS NOT NULL AND position(chr(61623) in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, chr(61623), '•') WHERE option_d IS NOT NULL AND position(chr(61623) in option_d) > 0;
UPDATE public.questions SET option_e = replace(option_e, chr(61623), '•') WHERE option_e IS NOT NULL AND position(chr(61623) in option_e) > 0;
UPDATE public.questions SET correct_answer = replace(correct_answer, chr(61623), '•') WHERE correct_answer IS NOT NULL AND position(chr(61623) in correct_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, chr(61623), '•') WHERE model_answer IS NOT NULL AND position(chr(61623) in model_answer) > 0;

UPDATE public.questions SET question_text = replace(question_text, chr(61613), '↑') WHERE question_text IS NOT NULL AND position(chr(61613) in question_text) > 0;
UPDATE public.questions SET option_a = replace(option_a, chr(61613), '↑') WHERE option_a IS NOT NULL AND position(chr(61613) in option_a) > 0;
UPDATE public.questions SET option_b = replace(option_b, chr(61613), '↑') WHERE option_b IS NOT NULL AND position(chr(61613) in option_b) > 0;
UPDATE public.questions SET option_c = replace(option_c, chr(61613), '↑') WHERE option_c IS NOT NULL AND position(chr(61613) in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, chr(61613), '↑') WHERE option_d IS NOT NULL AND position(chr(61613) in option_d) > 0;
UPDATE public.questions SET option_e = replace(option_e, chr(61613), '↑') WHERE option_e IS NOT NULL AND position(chr(61613) in option_e) > 0;
UPDATE public.questions SET correct_answer = replace(correct_answer, chr(61613), '↑') WHERE correct_answer IS NOT NULL AND position(chr(61613) in correct_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, chr(61613), '↑') WHERE model_answer IS NOT NULL AND position(chr(61613) in model_answer) > 0;

UPDATE public.questions SET question_text = replace(question_text, chr(61540), 'δ') WHERE question_text IS NOT NULL AND position(chr(61540) in question_text) > 0;
UPDATE public.questions SET option_a = replace(option_a, chr(61540), 'δ') WHERE option_a IS NOT NULL AND position(chr(61540) in option_a) > 0;
UPDATE public.questions SET option_b = replace(option_b, chr(61540), 'δ') WHERE option_b IS NOT NULL AND position(chr(61540) in option_b) > 0;
UPDATE public.questions SET option_c = replace(option_c, chr(61540), 'δ') WHERE option_c IS NOT NULL AND position(chr(61540) in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, chr(61540), 'δ') WHERE option_d IS NOT NULL AND position(chr(61540) in option_d) > 0;
UPDATE public.questions SET option_e = replace(option_e, chr(61540), 'δ') WHERE option_e IS NOT NULL AND position(chr(61540) in option_e) > 0;
UPDATE public.questions SET correct_answer = replace(correct_answer, chr(61540), 'δ') WHERE correct_answer IS NOT NULL AND position(chr(61540) in correct_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, chr(61540), 'δ') WHERE model_answer IS NOT NULL AND position(chr(61540) in model_answer) > 0;

COMMIT;
