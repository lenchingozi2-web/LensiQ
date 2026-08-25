-- LenxiQ AI question-bank repair: exact, guarded, source-preserving updates.
-- Generated 2026-08-25 from read-only export and validated candidates.
-- No answer keys are changed. No missing content is fabricated.
BEGIN;
UPDATE public.questions SET question_text = replace(question_text, '\''', '''') WHERE question_text IS NOT NULL AND position('\''' in question_text) > 0;
UPDATE public.questions SET option_a = replace(option_a, '\''', '''') WHERE option_a IS NOT NULL AND position('\''' in option_a) > 0;
UPDATE public.questions SET option_b = replace(option_b, '\''', '''') WHERE option_b IS NOT NULL AND position('\''' in option_b) > 0;
UPDATE public.questions SET option_c = replace(option_c, '\''', '''') WHERE option_c IS NOT NULL AND position('\''' in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, '\''', '''') WHERE option_d IS NOT NULL AND position('\''' in option_d) > 0;
UPDATE public.questions SET option_e = replace(option_e, '\''', '''') WHERE option_e IS NOT NULL AND position('\''' in option_e) > 0;
UPDATE public.questions SET correct_answer = replace(correct_answer, '\''', '''') WHERE correct_answer IS NOT NULL AND position('\''' in correct_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, '\''', '''') WHERE model_answer IS NOT NULL AND position('\''' in model_answer) > 0;
UPDATE public.questions SET question_text = replace(question_text, '\"', '"') WHERE question_text IS NOT NULL AND position('\"' in question_text) > 0;
UPDATE public.questions SET option_a = replace(option_a, '\"', '"') WHERE option_a IS NOT NULL AND position('\"' in option_a) > 0;
UPDATE public.questions SET option_b = replace(option_b, '\"', '"') WHERE option_b IS NOT NULL AND position('\"' in option_b) > 0;
UPDATE public.questions SET option_c = replace(option_c, '\"', '"') WHERE option_c IS NOT NULL AND position('\"' in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, '\"', '"') WHERE option_d IS NOT NULL AND position('\"' in option_d) > 0;
UPDATE public.questions SET option_e = replace(option_e, '\"', '"') WHERE option_e IS NOT NULL AND position('\"' in option_e) > 0;
UPDATE public.questions SET correct_answer = replace(correct_answer, '\"', '"') WHERE correct_answer IS NOT NULL AND position('\"' in correct_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, '\"', '"') WHERE model_answer IS NOT NULL AND position('\"' in model_answer) > 0;
UPDATE public.questions SET question_text = replace(question_text, '\>', '>') WHERE question_text IS NOT NULL AND position('\>' in question_text) > 0;
UPDATE public.questions SET option_a = replace(option_a, '\>', '>') WHERE option_a IS NOT NULL AND position('\>' in option_a) > 0;
UPDATE public.questions SET option_b = replace(option_b, '\>', '>') WHERE option_b IS NOT NULL AND position('\>' in option_b) > 0;
UPDATE public.questions SET option_c = replace(option_c, '\>', '>') WHERE option_c IS NOT NULL AND position('\>' in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, '\>', '>') WHERE option_d IS NOT NULL AND position('\>' in option_d) > 0;
UPDATE public.questions SET option_e = replace(option_e, '\>', '>') WHERE option_e IS NOT NULL AND position('\>' in option_e) > 0;
UPDATE public.questions SET correct_answer = replace(correct_answer, '\>', '>') WHERE correct_answer IS NOT NULL AND position('\>' in correct_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, '\>', '>') WHERE model_answer IS NOT NULL AND position('\>' in model_answer) > 0;
UPDATE public.questions SET question_text = replace(question_text, '\<', '<') WHERE question_text IS NOT NULL AND position('\<' in question_text) > 0;
UPDATE public.questions SET option_a = replace(option_a, '\<', '<') WHERE option_a IS NOT NULL AND position('\<' in option_a) > 0;
UPDATE public.questions SET option_b = replace(option_b, '\<', '<') WHERE option_b IS NOT NULL AND position('\<' in option_b) > 0;
UPDATE public.questions SET option_c = replace(option_c, '\<', '<') WHERE option_c IS NOT NULL AND position('\<' in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, '\<', '<') WHERE option_d IS NOT NULL AND position('\<' in option_d) > 0;
UPDATE public.questions SET option_e = replace(option_e, '\<', '<') WHERE option_e IS NOT NULL AND position('\<' in option_e) > 0;
UPDATE public.questions SET correct_answer = replace(correct_answer, '\<', '<') WHERE correct_answer IS NOT NULL AND position('\<' in correct_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, '\<', '<') WHERE model_answer IS NOT NULL AND position('\<' in model_answer) > 0;
UPDATE public.questions SET question_text = replace(question_text, '\~', '~') WHERE question_text IS NOT NULL AND position('\~' in question_text) > 0;
UPDATE public.questions SET option_a = replace(option_a, '\~', '~') WHERE option_a IS NOT NULL AND position('\~' in option_a) > 0;
UPDATE public.questions SET option_b = replace(option_b, '\~', '~') WHERE option_b IS NOT NULL AND position('\~' in option_b) > 0;
UPDATE public.questions SET option_c = replace(option_c, '\~', '~') WHERE option_c IS NOT NULL AND position('\~' in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, '\~', '~') WHERE option_d IS NOT NULL AND position('\~' in option_d) > 0;
UPDATE public.questions SET option_e = replace(option_e, '\~', '~') WHERE option_e IS NOT NULL AND position('\~' in option_e) > 0;
UPDATE public.questions SET correct_answer = replace(correct_answer, '\~', '~') WHERE correct_answer IS NOT NULL AND position('\~' in correct_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, '\~', '~') WHERE model_answer IS NOT NULL AND position('\~' in model_answer) > 0;
UPDATE public.questions SET question_text = replace(question_text, '\[', '[') WHERE question_text IS NOT NULL AND position('\[' in question_text) > 0;
UPDATE public.questions SET option_a = replace(option_a, '\[', '[') WHERE option_a IS NOT NULL AND position('\[' in option_a) > 0;
UPDATE public.questions SET option_b = replace(option_b, '\[', '[') WHERE option_b IS NOT NULL AND position('\[' in option_b) > 0;
UPDATE public.questions SET option_c = replace(option_c, '\[', '[') WHERE option_c IS NOT NULL AND position('\[' in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, '\[', '[') WHERE option_d IS NOT NULL AND position('\[' in option_d) > 0;
UPDATE public.questions SET option_e = replace(option_e, '\[', '[') WHERE option_e IS NOT NULL AND position('\[' in option_e) > 0;
UPDATE public.questions SET correct_answer = replace(correct_answer, '\[', '[') WHERE correct_answer IS NOT NULL AND position('\[' in correct_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, '\[', '[') WHERE model_answer IS NOT NULL AND position('\[' in model_answer) > 0;
UPDATE public.questions SET question_text = replace(question_text, '\]', ']') WHERE question_text IS NOT NULL AND position('\]' in question_text) > 0;
UPDATE public.questions SET option_a = replace(option_a, '\]', ']') WHERE option_a IS NOT NULL AND position('\]' in option_a) > 0;
UPDATE public.questions SET option_b = replace(option_b, '\]', ']') WHERE option_b IS NOT NULL AND position('\]' in option_b) > 0;
UPDATE public.questions SET option_c = replace(option_c, '\]', ']') WHERE option_c IS NOT NULL AND position('\]' in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, '\]', ']') WHERE option_d IS NOT NULL AND position('\]' in option_d) > 0;
UPDATE public.questions SET option_e = replace(option_e, '\]', ']') WHERE option_e IS NOT NULL AND position('\]' in option_e) > 0;
UPDATE public.questions SET correct_answer = replace(correct_answer, '\]', ']') WHERE correct_answer IS NOT NULL AND position('\]' in correct_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, '\]', ']') WHERE model_answer IS NOT NULL AND position('\]' in model_answer) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'inittially', 'initially') WHERE id = '046c5b17-46db-4d34-85db-50b41ab9c168' AND option_b IS NOT NULL AND position('inittially' in option_b) > 0;
UPDATE public.questions SET question_text = replace(question_text, 'serotonine', 'serotonin') WHERE id = '06d3f41c-c3fb-4fb2-aac9-977084d9da04' AND question_text IS NOT NULL AND position('serotonine' in question_text) > 0;
UPDATE public.questions SET question_text = replace(question_text, 'A tuberculosis', 'A. tuberculosis') WHERE id = '075b4695-e046-4940-819f-7d4c4e5f63b8' AND question_text IS NOT NULL AND position('A tuberculosis' in question_text) > 0;
UPDATE public.questions SET option_d = replace(option_d, 'phenobartitone', 'phenobarbital') WHERE id = '087a7c15-6a02-40a1-9460-b208d5e32d31' AND option_d IS NOT NULL AND position('phenobartitone' in option_d) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' N:B: Fentanyl is an opioid analgesia', '') WHERE id = '0adb80b7-2389-4bec-b95c-f593d2b5f00f' AND option_e IS NOT NULL AND position(' N:B: Fentanyl is an opioid analgesia' in option_e) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'opiods', 'opioids') WHERE id = '0b484caa-bc18-4dbf-b1f6-a9e9f2e423a8' AND option_b IS NOT NULL AND position('opiods' in option_b) > 0;
UPDATE public.questions SET option_c = replace(option_c, 'opiods', 'opioids') WHERE id = '0b484caa-bc18-4dbf-b1f6-a9e9f2e423a8' AND option_c IS NOT NULL AND position('opiods' in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, 'metabolise', 'metabolised') WHERE id = '0b484caa-bc18-4dbf-b1f6-a9e9f2e423a8' AND option_d IS NOT NULL AND position('metabolise' in option_d) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, '3
Oxidase-negative', '3. Oxidase-negative') WHERE id = '0bce53e3-8ad1-485b-b396-b02ff2a56eb9' AND model_answer IS NOT NULL AND position('3
Oxidase-negative' in model_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'O (somatic)
H (flagellar), and K (capsular)', 'O (somatic), H (flagellar), and K (capsular)') WHERE id = '0bce53e3-8ad1-485b-b396-b02ff2a56eb9' AND model_answer IS NOT NULL AND position('O (somatic)
H (flagellar), and K (capsular)' in model_answer) > 0;
UPDATE public.questions SET question_text = replace(question_text, ' EXCEPT 148', ' EXCEPT') WHERE id = '0c00a54c-b7c1-443b-b2f5-bb4394d0f1ea' AND question_text IS NOT NULL AND position(' EXCEPT 148' in question_text) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' System 2', '') WHERE id = '0cd6eccf-ee77-43ce-9b9e-c41403e3cd46' AND option_e IS NOT NULL AND position(' System 2' in option_e) > 0;
UPDATE public.questions SET option_c = replace(option_c, 'intravenousIy', 'intravenously') WHERE id = '0ce36648-d65c-4700-8dcd-40746c56ad2f' AND option_c IS NOT NULL AND position('intravenousIy' in option_c) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, '4
Erythrocytic', '4. Erythrocytic') WHERE id = '0cf244e9-b88e-49a0-b672-b2bfccee23af' AND model_answer IS NOT NULL AND position('4
Erythrocytic' in model_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'seizures
careful', 'seizures, careful') WHERE id = '0cf244e9-b88e-49a0-b672-b2bfccee23af' AND model_answer IS NOT NULL AND position('seizures
careful' in model_answer) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'acethylcholine', 'acetylcholine') WHERE id = '0e770df5-f98b-4edd-b51d-d4f262f82d76' AND option_a IS NOT NULL AND position('acethylcholine' in option_a) > 0;
UPDATE public.questions SET question_text = replace(question_text, 'ẞ2', 'β2') WHERE id = '0eaa8dfb-45f1-42b5-b7b4-dd0f47d38efe' AND question_text IS NOT NULL AND position('ẞ2' in question_text) > 0;
UPDATE public.questions SET option_d = replace(option_d, '5. HT', '5-HT') WHERE id = '0f6f7ba4-aca7-4479-8c7f-a47e38378e57' AND option_d IS NOT NULL AND position('5. HT' in option_d) > 0;
UPDATE public.questions SET question_text = replace(question_text, 'anaestghetic', 'anaesthetic') WHERE id = '11a71012-7b3a-4a07-99ed-b8b41e2260d3' AND question_text IS NOT NULL AND position('anaestghetic' in question_text) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'They causes', 'It causes') WHERE id = '11c6fe71-02c1-49e9-b85f-9a411bea38a3' AND option_a IS NOT NULL AND position('They causes' in option_a) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'adminstration', 'administration') WHERE id = '11e20e49-b92e-4370-8542-69bc2e46b363' AND option_a IS NOT NULL AND position('adminstration' in option_a) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' Orphan receptors, INCORRECT statement', '') WHERE id = '1387be96-c4a6-4c31-884f-a6421d299eb8' AND option_e IS NOT NULL AND position(' Orphan receptors, INCORRECT statement' in option_e) > 0;
UPDATE public.questions SET option_c = replace(option_c, '+to', 'to') WHERE id = '1517f154-9396-42f5-977c-83de07b74c2b' AND option_c IS NOT NULL AND position('+to' in option_c) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' (e) None of the above: Correct', '') WHERE id = '1537b21f-3504-4481-bef5-cf9a3939c172' AND option_e IS NOT NULL AND position(' (e) None of the above: Correct' in option_e) > 0;
UPDATE public.questions SET question_text = replace(question_text, 'antimalalaria', 'antimalarial') WHERE id = '15690d3e-1a7a-469f-97c2-a7205f8a8e1a' AND question_text IS NOT NULL AND position('antimalalaria' in question_text) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'Herpes simple
virus', 'Herpes simplex virus') WHERE id = '15d61210-5d89-4fde-ad00-0cb9c84bd1b6' AND model_answer IS NOT NULL AND position('Herpes simple
virus' in model_answer) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'incre+ases', 'increases') WHERE id = '16e6e7f0-f26c-459b-b9fa-60e712190eec' AND option_a IS NOT NULL AND position('incre+ases' in option_a) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'immunosuppresants', 'immunosuppressants') WHERE id = '16e6e7f0-f26c-459b-b9fa-60e712190eec' AND option_b IS NOT NULL AND position('immunosuppresants' in option_b) > 0;
UPDATE public.questions SET option_a = replace(option_a, '0. 5', '0.5') WHERE id = '17648a1a-c51f-49b1-a548-d22816748d6e' AND option_a IS NOT NULL AND position('0. 5' in option_a) > 0;
UPDATE public.questions SET question_text = replace(question_text, '14 hours 1.56ug/ml', '14 hours. 1.56ug/ml') WHERE id = '17648a1a-c51f-49b1-a548-d22816748d6e' AND question_text IS NOT NULL AND position('14 hours 1.56ug/ml' in question_text) > 0;
UPDATE public.questions SET question_text = replace(question_text, ' NSAID)', ' (NSAID)') WHERE id = '17f2f7ac-d94b-4f97-ba1d-f409dcc157dc' AND question_text IS NOT NULL AND position(' NSAID)' in question_text) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'th
intestine', 'the intestine') WHERE id = '182e4006-67da-4560-b00f-2f04fe54689a' AND model_answer IS NOT NULL AND position('th
intestine' in model_answer) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'vasocosriction', 'vasoconstriction') WHERE id = '184d5a44-c388-4692-a8ee-0da68bfd4781' AND option_b IS NOT NULL AND position('vasocosriction' in option_b) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' A parasympatholytic agent useful for the treatment of CNS disorders because of good penetrability of the blood-brain barrier is', '') WHERE id = '19456f5b-44d1-4c79-b9d2-8d2e8a35e8df' AND option_e IS NOT NULL AND position(' A parasympatholytic agent useful for the treatment of CNS disorders because of good penetrability of the blood-brain barrier is' in option_e) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' F. Leukocytosis is a common feature of inflammatory reactions.', '') WHERE id = '197cc295-7df5-4acf-b718-973207222748' AND option_e IS NOT NULL AND position(' F. Leukocytosis is a common feature of inflammatory reactions.' in option_e) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, '1Protease', '1 Protease') WHERE id = '19cb8d48-537d-404c-8fab-b550387ffbf2' AND model_answer IS NOT NULL AND position('1Protease' in model_answer) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'Inhibitionof', 'inhibition of') WHERE id = '1bb6c341-8bd4-4ba6-b492-e9eb8852aaba' AND option_a IS NOT NULL AND position('Inhibitionof' in option_a) > 0;
UPDATE public.questions SET question_text = replace(question_text, '(viral load', '(viral load)') WHERE id = '1c8c24d9-5ca5-4eb1-98b3-d10bb99b1403' AND question_text IS NOT NULL AND position('(viral load' in question_text) > 0;
UPDATE public.questions SET option_a = replace(option_a, '14a- methylase', '14a-methylase') WHERE id = '1c91b8b6-a10e-49e1-b25f-ffe4d08b3251' AND option_a IS NOT NULL AND position('14a- methylase' in option_a) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'Ianosterol', 'lanosterol') WHERE id = '1c91b8b6-a10e-49e1-b25f-ffe4d08b3251' AND option_a IS NOT NULL AND position('Ianosterol' in option_a) > 0;
UPDATE public.questions SET option_a = replace(option_a, '37. 45°C', '37-45°C') WHERE id = '1ca2bce5-c5b4-4dea-a182-bb145ae24701' AND option_a IS NOT NULL AND position('37. 45°C' in option_a) > 0;
UPDATE public.questions SET option_b = replace(option_b, '37. 40°C', '37-40°C') WHERE id = '1ca2bce5-c5b4-4dea-a182-bb145ae24701' AND option_b IS NOT NULL AND position('37. 40°C' in option_b) > 0;
UPDATE public.questions SET option_c = replace(option_c, '37. 43°C', '37-43°C') WHERE id = '1ca2bce5-c5b4-4dea-a182-bb145ae24701' AND option_c IS NOT NULL AND position('37. 43°C' in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, '37. 47°C', '37-47°C') WHERE id = '1ca2bce5-c5b4-4dea-a182-bb145ae24701' AND option_d IS NOT NULL AND position('37. 47°C' in option_d) > 0;
UPDATE public.questions SET option_e = replace(option_e, '37. 42°C', '37-42°C') WHERE id = '1ca2bce5-c5b4-4dea-a182-bb145ae24701' AND option_e IS NOT NULL AND position('37. 42°C' in option_e) > 0;
UPDATE public.questions SET option_d = replace(option_d, 'Edrophoniumis', 'Edrophonium is') WHERE id = '1d129c12-ca80-4289-a1c1-f97eb1a0a44a' AND option_d IS NOT NULL AND position('Edrophoniumis' in option_d) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' (b) Bupropion inhibits monoamine oxidase: Correct. Bupropion is a norepinephrine- dopamine reuptake inhibitor, not a monoamine oxidase inhibitor', '') WHERE id = '1e29a26b-a309-4939-9564-3d9b18ae42fc' AND option_e IS NOT NULL AND position(' (b) Bupropion inhibits monoamine oxidase: Correct. Bupropion is a norepinephrine- dopamine reuptake inhibitor, not a monoamine oxidase inhibitor' in option_e) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'volume(PCV)', 'volume (PCV)') WHERE id = '1f48c948-e76e-4a34-8007-ae7cf9fab231' AND model_answer IS NOT NULL AND position('volume(PCV)' in model_answer) > 0;
UPDATE public.questions SET option_b = replace(option_b, ' [G] Protamine sulphate combines with heparin to for a stable complex devoid of anticoagulant activity', '') WHERE id = '22286e03-aa22-4d66-8191-1193512dddbf' AND option_b IS NOT NULL AND position(' [G] Protamine sulphate combines with heparin to for a stable complex devoid of anticoagulant activity' in option_b) > 0;
UPDATE public.questions SET question_text = replace(question_text, 'comple', 'complex') WHERE id = '222c411e-711a-4d03-81d2-f24253f3d0fc' AND question_text IS NOT NULL AND position('comple' in question_text) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'infects', 'infect') WHERE id = '23a70dfa-e80b-4830-87d7-91f9c95d60c1' AND option_b IS NOT NULL AND position('infects' in option_b) > 0;
UPDATE public.questions SET option_a = replace(option_a, '25. year-old man with inguinal lymphadenopathy', '25-year-old man with inguinal lymphadenopathy') WHERE id = '25679b16-dde1-49de-b328-538d11e51ad1' AND option_a IS NOT NULL AND position('25. year-old man with inguinal lymphadenopathy' in option_a) > 0;
UPDATE public.questions SET option_b = replace(option_b, '25. year-old woman with mediastinal and inguinal lymphadenopathy', '25-year-old woman with mediastinal and inguinal lymphadenopathy') WHERE id = '25679b16-dde1-49de-b328-538d11e51ad1' AND option_b IS NOT NULL AND position('25. year-old woman with mediastinal and inguinal lymphadenopathy' in option_b) > 0;
UPDATE public.questions SET option_c = replace(option_c, '25. year-old woman with mediastinal lymphadenopathy alone', '25-year-old woman with mediastinal lymphadenopathy alone') WHERE id = '25679b16-dde1-49de-b328-538d11e51ad1' AND option_c IS NOT NULL AND position('25. year-old woman with mediastinal lymphadenopathy alone' in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, '25. year-old man with cervical and inguinal lymphadenopathy', '25-year-old man with cervical and inguinal lymphadenopathy') WHERE id = '25679b16-dde1-49de-b328-538d11e51ad1' AND option_d IS NOT NULL AND position('25. year-old man with cervical and inguinal lymphadenopathy' in option_d) > 0;
UPDATE public.questions SET option_e = replace(option_e, '25. year-old man with cervical and mediastinal lymphadenopathy', '25-year-old man with cervical and mediastinal lymphadenopathy') WHERE id = '25679b16-dde1-49de-b328-538d11e51ad1' AND option_e IS NOT NULL AND position('25. year-old man with cervical and mediastinal lymphadenopathy' in option_e) > 0;
UPDATE public.questions SET option_c = replace(option_c, 'immunophilinns', 'immunophilins') WHERE id = '25a2713d-edf7-4eb1-a682-81b5a196c76d' AND option_c IS NOT NULL AND position('immunophilinns' in option_c) > 0;
UPDATE public.questions SET option_b = replace(option_b, '4. 10mm in diameter', '4-10mm in diameter') WHERE id = '26d7f594-fbcc-4535-a6ed-94fd0922be89' AND option_b IS NOT NULL AND position('4. 10mm in diameter' in option_b) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'clinically: ', 'clinically ') WHERE id = '2865cf3a-3e15-4d4e-8dc5-e6c5fed6d423' AND option_a IS NOT NULL AND position('clinically: ' in option_a) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' QUESTIONS 3 - 6 For each numbered phrase, Select ONE drug (A-E) that is most closely associated with it. Each drug (A-E) may be selected once, more than once, or not at all', '') WHERE id = '28a3a8ae-ad4f-4591-9063-745ca542762a' AND option_e IS NOT NULL AND position(' QUESTIONS 3 - 6 For each numbered phrase, Select ONE drug (A-E) that is most closely associated with it. Each drug (A-E) may be selected once, more than once, or not at all' in option_e) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' 29, Which alters the shape of the dose response curve', '') WHERE id = '2b349acc-6e90-4a33-9239-8a9a8ab5eb60' AND option_e IS NOT NULL AND position(' 29, Which alters the shape of the dose response curve' in option_e) > 0;
UPDATE public.questions SET option_e = replace(option_e, 'is protein', 'its protein') WHERE id = '2bba0a55-f2b9-4c86-abed-1617c87c9971' AND option_e IS NOT NULL AND position('is protein' in option_e) > 0;
UPDATE public.questions SET option_d = replace(option_d, 'inravenously', 'intravenously') WHERE id = '2ed2b20f-9008-484d-97cb-30362625f97a' AND option_d IS NOT NULL AND position('inravenously' in option_d) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'Corticosteriod', 'Corticosteroid') WHERE id = '2ffd0ecf-acc7-48b4-9e84-f99040833116' AND model_answer IS NOT NULL AND position('Corticosteriod' in model_answer) > 0;
UPDATE public.questions SET option_b = replace(option_b, ' -Tripathi', '') WHERE id = '302fda84-08f7-46fc-9027-1402173f194f' AND option_b IS NOT NULL AND position(' -Tripathi' in option_b) > 0;
UPDATE public.questions SET option_c = replace(option_c, ' =?', '') WHERE id = '305376f7-c8ac-4bba-8479-dac967ed098e' AND option_c IS NOT NULL AND position(' =?' in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, 'maybe', 'may be') WHERE id = '3067c1dd-a168-42ed-a777-2356c8c9a3f6' AND option_d IS NOT NULL AND position('maybe' in option_d) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'to ch ', 'to which ') WHERE id = '3217ae6d-5cab-4421-a60c-9ba3c95395fa' AND option_b IS NOT NULL AND position('to ch ' in option_b) > 0;
UPDATE public.questions SET question_text = replace(question_text, 'drugs', 'drug') WHERE id = '324157fa-2ab8-45cc-958a-8b461faeb4e1' AND question_text IS NOT NULL AND position('drugs' in question_text) > 0;
UPDATE public.questions SET option_c = replace(option_c, 'phosphate', 'phosphatase') WHERE id = '327b36ca-3630-4f75-a804-626e5c54e684' AND option_c IS NOT NULL AND position('phosphate' in option_c) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' The rate-limiting step in the biosynthesis of norepinephrine involves the enzyme', '') WHERE id = '33b94f50-ad4b-4bae-bd8a-7d7f24dcdbf3' AND option_e IS NOT NULL AND position(' The rate-limiting step in the biosynthesis of norepinephrine involves the enzyme' in option_e) > 0;
UPDATE public.questions SET option_d = replace(option_d, ' (this is also true, but shape change is the classic first answer)', '') WHERE id = '33f26e77-4a2d-4b58-8757-c8cf2c1ff9ef' AND option_d IS NOT NULL AND position(' (this is also true, but shape change is the classic first answer)' in option_d) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' COMPLETE PHARMACOLOGY General Pharmacology', '') WHERE id = '346914aa-7b5f-47a6-b9ba-fe503f73cf58' AND option_e IS NOT NULL AND position(' COMPLETE PHARMACOLOGY General Pharmacology' in option_e) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' ANTIHYPERLIPIDEMICS', '') WHERE id = '3588193a-6303-4fcd-931d-80a68abdf2c6' AND option_e IS NOT NULL AND position(' ANTIHYPERLIPIDEMICS' in option_e) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'Inflenza', 'Influenza') WHERE id = '367c8411-7af0-4a08-8fa0-cdf8500daa6b' AND option_b IS NOT NULL AND position('Inflenza' in option_b) > 0;
UPDATE public.questions SET option_c = replace(option_c, 'Gamciclovir', 'Ganciclovir') WHERE id = '367c8411-7af0-4a08-8fa0-cdf8500daa6b' AND option_c IS NOT NULL AND position('Gamciclovir' in option_c) > 0;
UPDATE public.questions SET question_text = replace(question_text, 'docs', 'does') WHERE id = '3718a0e0-97b6-431b-b384-7a10a3359663' AND question_text IS NOT NULL AND position('docs' in question_text) > 0;
UPDATE public.questions SET question_text = replace(question_text, '[E}', '[E]') WHERE id = '374e37c5-09df-4989-bdf7-11421da46ef5' AND question_text IS NOT NULL AND position('[E}' in question_text) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'lipophylic', 'lipophilic') WHERE id = '375e9c83-d839-4f56-b817-628204a29d57' AND option_a IS NOT NULL AND position('lipophylic' in option_a) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'selecive', 'selective') WHERE id = '375e9c83-d839-4f56-b817-628204a29d57' AND option_b IS NOT NULL AND position('selecive' in option_b) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'Sodium ,', 'Sodium,') WHERE id = '37f0855e-4368-4208-a5b8-0adc34811442' AND model_answer IS NOT NULL AND position('Sodium ,' in model_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'beer lambert’s Law', 'Beer-Lambert''s Law') WHERE id = '37f0855e-4368-4208-a5b8-0adc34811442' AND model_answer IS NOT NULL AND position('beer lambert’s Law' in model_answer) > 0;
UPDATE public.questions SET option_c = replace(option_c, ',physostigmine', ', physostigmine') WHERE id = '382bfaa8-1cd8-4da7-a123-51322d697427' AND option_c IS NOT NULL AND position(',physostigmine' in option_c) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'water leukocytes', 'water, leukocytes') WHERE id = '384e84eb-402a-42be-8172-04b7c2a53eb8' AND option_b IS NOT NULL AND position('water leukocytes' in option_b) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' fN/B: Tolerance does not develop to the miotic, convulsant and constipating actions Marked tolerance develop to the analgesic, sedating, and respiratory depressants effects. Tolerance also develop to the antidiuretic, emetic and hypotensive effects', '') WHERE id = '388583c7-6956-4dfd-92b4-8a62f6bbca82' AND option_e IS NOT NULL AND position(' fN/B: Tolerance does not develop to the miotic, convulsant and constipating actions Marked tolerance develop to the analgesic, sedating, and respiratory depressants effects. Tolerance also develop to the antidiuretic, emetic and hypotensive effects' in option_e) > 0;
UPDATE public.questions SET option_c = replace(option_c, 'intravenousIy', 'intravenously') WHERE id = '38a8a9dd-b179-469a-aad8-ce16399f5c9c' AND option_c IS NOT NULL AND position('intravenousIy' in option_c) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'da
5', 'day 5') WHERE id = '39c25440-440f-46d5-9b71-de9cb69bfa75' AND model_answer IS NOT NULL AND position('da
5' in model_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'dengu
', 'dengue
') WHERE id = '39c25440-440f-46d5-9b71-de9cb69bfa75' AND model_answer IS NOT NULL AND position('dengu
' in model_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'platele
count', 'platelet count') WHERE id = '39c25440-440f-46d5-9b71-de9cb69bfa75' AND model_answer IS NOT NULL AND position('platele
count' in model_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'sever
', 'severe
') WHERE id = '39c25440-440f-46d5-9b71-de9cb69bfa75' AND model_answer IS NOT NULL AND position('sever
' in model_answer) > 0;
UPDATE public.questions SET option_a = replace(option_a, '[prostacyclin)', '(prostacyclin)') WHERE id = '3c84cf12-24d5-43fe-a532-2711ff2c5a0c' AND option_a IS NOT NULL AND position('[prostacyclin)' in option_a) > 0;
UPDATE public.questions SET option_a = replace(option_a, '4. 4–6.0 ×10¹²/L', '4.4–6.0 ×10¹²/L') WHERE id = '3dae2932-89bf-4096-9064-e7fefc9e7ad8' AND option_a IS NOT NULL AND position('4. 4–6.0 ×10¹²/L' in option_a) > 0;
UPDATE public.questions SET option_b = replace(option_b, '4. 2–5.0 ×10¹²/L', '4.2–5.0 ×10¹²/L') WHERE id = '3dae2932-89bf-4096-9064-e7fefc9e7ad8' AND option_b IS NOT NULL AND position('4. 2–5.0 ×10¹²/L' in option_b) > 0;
UPDATE public.questions SET option_c = replace(option_c, '4. 0–5.0 ×10¹²/L', '4.0–5.0 ×10¹²/L') WHERE id = '3dae2932-89bf-4096-9064-e7fefc9e7ad8' AND option_c IS NOT NULL AND position('4. 0–5.0 ×10¹²/L' in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, '4. 2–5.2 ×10¹²/L', '4.2–5.2 ×10¹²/L') WHERE id = '3dae2932-89bf-4096-9064-e7fefc9e7ad8' AND option_d IS NOT NULL AND position('4. 2–5.2 ×10¹²/L' in option_d) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'medic', 'medicine') WHERE id = '3de286db-674b-40e1-b0a5-b7ab2214fe7e' AND model_answer IS NOT NULL AND position('medic' in model_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, '4hours', '4 hours') WHERE id = '3f454a9b-ab51-4ec2-b8ef-c42be43eab67' AND model_answer IS NOT NULL AND position('4hours' in model_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'g/dl', 'g/dL') WHERE id = '3f454a9b-ab51-4ec2-b8ef-c42be43eab67' AND model_answer IS NOT NULL AND position('g/dl' in model_answer) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'opiod', 'opioid') WHERE id = '3fdf6b40-4471-4065-b118-1439228844e9' AND option_b IS NOT NULL AND position('opiod' in option_b) > 0;
UPDATE public.questions SET option_c = replace(option_c, 'opiod', 'opioid') WHERE id = '3fdf6b40-4471-4065-b118-1439228844e9' AND option_c IS NOT NULL AND position('opiod' in option_c) > 0;
UPDATE public.questions SET question_text = replace(question_text, 'opiod', 'opioid') WHERE id = '3fdf6b40-4471-4065-b118-1439228844e9' AND question_text IS NOT NULL AND position('opiod' in question_text) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'cell', 'cells') WHERE id = '407606b4-73a4-485a-be26-06018c48c60c' AND option_a IS NOT NULL AND position('cell' in option_a) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'indiect', 'indirect') WHERE id = '40a700dd-f89f-41ac-933e-0d53db019c92' AND option_a IS NOT NULL AND position('indiect' in option_a) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'Amphoterisin', 'Amphotericin') WHERE id = '417741ae-0520-443c-81c7-6c77b8536f5a' AND option_a IS NOT NULL AND position('Amphoterisin' in option_a) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' Adrenergic recetors mediate all the following except', '') WHERE id = '42e49719-4024-40c5-91b0-2f3e9136e7ba' AND option_e IS NOT NULL AND position(' Adrenergic recetors mediate all the following except' in option_e) > 0;
UPDATE public.questions SET question_text = replace(question_text, ' EXCEPT 66', ' EXCEPT') WHERE id = '42e49719-4024-40c5-91b0-2f3e9136e7ba' AND question_text IS NOT NULL AND position(' EXCEPT 66' in question_text) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'allegy', 'allergy') WHERE id = '42fbe7f6-0946-4a67-87fd-15552c636e94' AND option_a IS NOT NULL AND position('allegy' in option_a) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'lympadenopathy', 'lymphadenopathy') WHERE id = '42fbe7f6-0946-4a67-87fd-15552c636e94' AND option_b IS NOT NULL AND position('lympadenopathy' in option_b) > 0;
UPDATE public.questions SET option_c = replace(option_c, 'usally', 'usually') WHERE id = '42fbe7f6-0946-4a67-87fd-15552c636e94' AND option_c IS NOT NULL AND position('usally' in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, ' none of the above', '') WHERE id = '42fbe7f6-0946-4a67-87fd-15552c636e94' AND option_d IS NOT NULL AND position(' none of the above' in option_d) > 0;
UPDATE public.questions SET question_text = replace(question_text, 'consider', 'considered') WHERE id = '4306ea90-5792-4134-87f6-fb7f8ab3d331' AND question_text IS NOT NULL AND position('consider' in question_text) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, '.it''s', '. It''s') WHERE id = '446dd20f-cdf5-40d7-83ff-e52a6ca3c2f6' AND model_answer IS NOT NULL AND position('.it''s' in model_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'anti platelet', 'antiplatelet') WHERE id = '446dd20f-cdf5-40d7-83ff-e52a6ca3c2f6' AND model_answer IS NOT NULL AND position('anti platelet' in model_answer) > 0;
UPDATE public.questions SET option_c = replace(option_c, '2-3hours', '2-3 hours') WHERE id = '451691dd-16fb-41f3-bdc5-d457dec0bd9b' AND option_c IS NOT NULL AND position('2-3hours' in option_c) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' System 1', '') WHERE id = '451691dd-16fb-41f3-bdc5-d457dec0bd9b' AND option_e IS NOT NULL AND position(' System 1' in option_e) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'lipophylic', 'lipophilic') WHERE id = '46002fa2-779f-471b-a28b-5d55c41b8823' AND option_a IS NOT NULL AND position('lipophylic' in option_a) > 0;
UPDATE public.questions SET question_text = replace(question_text, 'Muscucutaneous', 'Mucocutaneous') WHERE id = '46b464c2-f58b-4f9e-ae45-f47320207afa' AND question_text IS NOT NULL AND position('Muscucutaneous' in question_text) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'X,a', 'Xa') WHERE id = '471907eb-bf05-461d-9742-5533acb39892' AND model_answer IS NOT NULL AND position('X,a' in model_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'vitamin k', 'vitamin K') WHERE id = '471907eb-bf05-461d-9742-5533acb39892' AND model_answer IS NOT NULL AND position('vitamin k' in model_answer) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'sprectrum', 'spectrum') WHERE id = '474e8487-81b3-4e12-8ec8-9113047bdbcb' AND option_b IS NOT NULL AND position('sprectrum' in option_b) > 0;
UPDATE public.questions SET question_text = replace(question_text, 'Paramomycin', 'Paromomycin') WHERE id = '4829c1e3-c98b-46c5-9fc8-e7a03491be6c' AND question_text IS NOT NULL AND position('Paramomycin' in question_text) > 0;
UPDATE public.questions SET question_text = replace(question_text, 'specie', 'species') WHERE id = '4899574d-d2c3-45ef-b156-6259eca62119' AND question_text IS NOT NULL AND position('specie' in question_text) > 0;
UPDATE public.questions SET option_c = replace(option_c, 'counter- regulatory', 'counter-regulatory') WHERE id = '48ab506e-ba19-4067-aeb7-80e02839941e' AND option_c IS NOT NULL AND position('counter- regulatory' in option_c) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' CORRECT PHARMACOLOGY GENERAL', '') WHERE id = '499f3660-0438-4ae1-9bf4-896506046354' AND option_e IS NOT NULL AND position(' CORRECT PHARMACOLOGY GENERAL' in option_e) > 0;
UPDATE public.questions SET option_c = replace(option_c, '30-40grams', '30-40 grams') WHERE id = '4bc2fd7a-7ab6-43c9-8b69-2c2bce51c391' AND option_c IS NOT NULL AND position('30-40grams' in option_c) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'produse', 'produce') WHERE id = '4c8b4d2b-0917-4af3-a4e1-7f05759f9d16' AND option_a IS NOT NULL AND position('produse' in option_a) > 0;
UPDATE public.questions SET option_d = replace(option_d, 'abscence', 'absence') WHERE id = '4c8b4d2b-0917-4af3-a4e1-7f05759f9d16' AND option_d IS NOT NULL AND position('abscence' in option_d) > 0;
UPDATE public.questions SET option_a = replace(option_a, ' - From Dr Joachim', '') WHERE id = '4e67c286-60d0-4984-ac6e-0b2f11f974be' AND option_a IS NOT NULL AND position(' - From Dr Joachim' in option_a) > 0;
UPDATE public.questions SET option_c = replace(option_c, ' - From Akoko', '') WHERE id = '4e67c286-60d0-4984-ac6e-0b2f11f974be' AND option_c IS NOT NULL AND position(' - From Akoko' in option_c) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'heart,.', 'heart,') WHERE id = '4eeed909-b3c2-4745-ae2d-561feded1249' AND option_b IS NOT NULL AND position('heart,.' in option_b) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' System 3', '') WHERE id = '5131b44b-a0f8-4eb4-8263-ea067c0d0843' AND option_e IS NOT NULL AND position(' System 3' in option_e) > 0;
UPDATE public.questions SET question_text = replace(question_text, ' ·', '') WHERE id = '5168d75e-83b4-415d-a1f6-06a35421b0c8' AND question_text IS NOT NULL AND position(' ·' in question_text) > 0;
UPDATE public.questions SET option_e = replace(option_e, 'None of the above 137 Concerning 5-HT agonists and antagonists which is a receptor TRUE statement [C]#', 'None of the above') WHERE id = '5213718c-0fc2-415f-8cf7-57d04e989ad2' AND option_e IS NOT NULL AND position('None of the above 137 Concerning 5-HT agonists and antagonists which is a receptor TRUE statement [C]#' in option_e) > 0;
UPDATE public.questions SET option_c = replace(option_c, 'ẞ2', 'β2') WHERE id = '525a0fe3-54f9-4029-9462-9f01a47d1670' AND option_c IS NOT NULL AND position('ẞ2' in option_c) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'lipophylic', 'lipophilic') WHERE id = '5290fcfb-1504-4751-8cff-f2c2745ec19b' AND option_a IS NOT NULL AND position('lipophylic' in option_a) > 0;
UPDATE public.questions SET option_c = replace(option_c, 'Dugs', 'Drugs') WHERE id = '543f126c-0b9e-4eb2-8e46-d99fe6df0100' AND option_c IS NOT NULL AND position('Dugs' in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, 'Inflammatory', 'inflammatory') WHERE id = '55ff39d7-b67e-46a5-8a40-2c40a6792d57' AND option_d IS NOT NULL AND position('Inflammatory' in option_d) > 0;
UPDATE public.questions SET question_text = replace(question_text, 'patent', 'parent') WHERE id = '57474781-2030-4bf5-9559-937034c950d5' AND question_text IS NOT NULL AND position('patent' in question_text) > 0;
UPDATE public.questions SET option_a = replace(option_a, ' Pharmacology pq General Drug elimination (e)', '') WHERE id = '57d6fca7-3251-46a3-97da-f1eee34f4125' AND option_a IS NOT NULL AND position(' Pharmacology pq General Drug elimination (e)' in option_a) > 0;
UPDATE public.questions SET option_d = replace(option_d, 'adninistration', 'administration') WHERE id = '58373be6-05d1-489e-8a54-6936fc82df98' AND option_d IS NOT NULL AND position('adninistration' in option_d) > 0;
UPDATE public.questions SET option_a = replace(option_a, '[anion eg. CaH7O2COO is', '[anion eg. CaH7O2COO] is') WHERE id = '58de83bf-d840-4f81-b2d3-81da4e3bdf23' AND option_a IS NOT NULL AND position('[anion eg. CaH7O2COO is' in option_a) > 0;
UPDATE public.questions SET option_c = replace(option_c, 'opoids', 'opioids') WHERE id = '5920f68d-7625-4fff-b431-19ef8a00ea6f' AND option_c IS NOT NULL AND position('opoids' in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, 'N- acetylcysteine', 'N-acetylcysteine') WHERE id = '5920f68d-7625-4fff-b431-19ef8a00ea6f' AND option_d IS NOT NULL AND position('N- acetylcysteine' in option_d) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 're
isolated', 're-isolated') WHERE id = '593752a6-7085-4d9d-bea0-2f7aa92c2cf1' AND model_answer IS NOT NULL AND position('re
isolated' in model_answer) > 0;
UPDATE public.questions SET option_b = replace(option_b, '(page 372 of Tara) in patients with AIDS)', 'in patients with AIDS') WHERE id = '5a3bdb9c-90b1-47c0-9c5e-a777703b12ad' AND option_b IS NOT NULL AND position('(page 372 of Tara) in patients with AIDS)' in option_b) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'clearnce', 'clearance') WHERE id = '5a3f1e0b-4cd2-4ce1-bc2f-c329c38c5b68' AND model_answer IS NOT NULL AND position('clearnce' in model_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'beta-
lactamases', 'beta-lactamases') WHERE id = '5de64df3-484d-41e9-aa86-76a0d616b008' AND model_answer IS NOT NULL AND position('beta-
lactamases' in model_answer) > 0;
UPDATE public.questions SET question_text = replace(question_text, 'acidiy', 'acidity') WHERE id = '5e3d81d7-06a5-4daa-bbe3-995ebef5d56a' AND question_text IS NOT NULL AND position('acidiy' in question_text) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'smal
intestine', 'small intestine') WHERE id = '5e4f30fc-ca48-428d-a09d-83210f4c60b3' AND model_answer IS NOT NULL AND position('smal
intestine' in model_answer) > 0;
UPDATE public.questions SET option_e = replace(option_e, 'Nonee', 'None') WHERE id = '5f54157f-4cfc-4549-9dfc-fafec6a94d77' AND option_e IS NOT NULL AND position('Nonee' in option_e) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'ERG3genes', 'ERG3 genes') WHERE id = '5f628f4c-0bdf-4db6-a4ce-545bd1069cce' AND option_a IS NOT NULL AND position('ERG3genes' in option_a) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'B-1,3- glucan', 'B-1,3-glucan') WHERE id = '5f8b28dc-4615-4aec-9573-d1c90cf1784b' AND option_b IS NOT NULL AND position('B-1,3- glucan' in option_b) > 0;
UPDATE public.questions SET option_d = replace(option_d, '2,3- epoxidase', '2,3-epoxidase') WHERE id = '5f8b28dc-4615-4aec-9573-d1c90cf1784b' AND option_d IS NOT NULL AND position('2,3- epoxidase' in option_d) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'Sedative -hypnotic', 'Sedative-hypnotic') WHERE id = '60206df2-99ac-4955-932d-18c045dc2e3d' AND model_answer IS NOT NULL AND position('Sedative -hypnotic' in model_answer) > 0;
UPDATE public.questions SET option_c = replace(option_c, 'Vasodillation', 'Vasodilation') WHERE id = '63b79cf6-1c01-4109-baeb-d2cbf60a9f9a' AND option_c IS NOT NULL AND position('Vasodillation' in option_c) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' Anticonvulsants Anticonvulsants', '') WHERE id = '649201b2-f897-4ef1-86eb-da920d65d7bd' AND option_e IS NOT NULL AND position(' Anticonvulsants Anticonvulsants' in option_e) > 0;
UPDATE public.questions SET option_c = replace(option_c, '0. 3', '0.3') WHERE id = '66668dc8-ac24-41be-8943-e1983dd4dd4c' AND option_c IS NOT NULL AND position('0. 3' in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, '0. 03', '0.03') WHERE id = '66668dc8-ac24-41be-8943-e1983dd4dd4c' AND option_d IS NOT NULL AND position('0. 03' in option_d) > 0;
UPDATE public.questions SET option_d = replace(option_d, '8hrr', '8hrs') WHERE id = '6781cff2-3f37-4870-9243-7b336058999c' AND option_d IS NOT NULL AND position('8hrr' in option_d) > 0;
UPDATE public.questions SET option_c = replace(option_c, 'short- term', 'short-term') WHERE id = '686cb450-0cd1-43db-a9b8-9b426f78b4e0' AND option_c IS NOT NULL AND position('short- term' in option_c) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'neuro transmitter', 'neurotransmitter') WHERE id = '6880f358-78ab-4d86-9caf-e5777cefc0c7' AND option_a IS NOT NULL AND position('neuro transmitter' in option_a) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, '2
Exotoxin A', '2. Exotoxin A') WHERE id = '6a83a313-b6ff-4c76-aae6-f1682bfe7951' AND model_answer IS NOT NULL AND position('2
Exotoxin A' in model_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'Ceftazidime
Cefepime', 'Ceftazidime, Cefepime') WHERE id = '6a83a313-b6ff-4c76-aae6-f1682bfe7951' AND model_answer IS NOT NULL AND position('Ceftazidime
Cefepime' in model_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'amikacin
tobramycin', 'amikacin, tobramycin') WHERE id = '6a83a313-b6ff-4c76-aae6-f1682bfe7951' AND model_answer IS NOT NULL AND position('amikacin
tobramycin' in model_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'ceftazidime
cefepime', 'ceftazidime, cefepime') WHERE id = '6a83a313-b6ff-4c76-aae6-f1682bfe7951' AND model_answer IS NOT NULL AND position('ceftazidime
cefepime' in model_answer) > 0;
UPDATE public.questions SET option_d = replace(option_d, 'Streptomycin cells', 'Streptomycin') WHERE id = '6b1db570-6abc-4dff-add6-3bf96182cd32' AND option_d IS NOT NULL AND position('Streptomycin cells' in option_d) > 0;
UPDATE public.questions SET question_text = replace(question_text, 'pathalogy', 'pathology') WHERE id = '6d6c8a28-bba5-47f8-8c35-0d4cc51a676c' AND question_text IS NOT NULL AND position('pathalogy' in question_text) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'Clinica
manifestations', 'Clinical manifestations') WHERE id = '6e581281-7899-4a40-8c98-5d29fcc5de19' AND model_answer IS NOT NULL AND position('Clinica
manifestations' in model_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'neonata
herpes', 'neonatal herpes') WHERE id = '6e581281-7899-4a40-8c98-5d29fcc5de19' AND model_answer IS NOT NULL AND position('neonata
herpes' in model_answer) > 0;
UPDATE public.questions SET option_e = replace(option_e, 'B- agonists', 'B-agonists') WHERE id = '6f64a007-9c6b-47dc-b928-9f0ed78f7235' AND option_e IS NOT NULL AND position('B- agonists' in option_e) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'Methlnatrexine', 'Methylnaltrexone') WHERE id = '6fb681da-2450-4201-ad4f-575cf35e5879' AND option_b IS NOT NULL AND position('Methlnatrexine' in option_b) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' SYSTEM 1 COMPILATION Antiarrhythmics Item Number: 11423', '') WHERE id = '6fb681da-2450-4201-ad4f-575cf35e5879' AND option_e IS NOT NULL AND position(' SYSTEM 1 COMPILATION Antiarrhythmics Item Number: 11423' in option_e) > 0;
UPDATE public.questions SET question_text = replace(question_text, 'Agents that does not promote peristaltic reflex', 'Which agent does not promote the peristaltic reflex?') WHERE id = '6fb681da-2450-4201-ad4f-575cf35e5879' AND question_text IS NOT NULL AND position('Agents that does not promote peristaltic reflex' in question_text) > 0;
UPDATE public.questions SET option_e = replace(option_e, 'none of the above 37', 'none of the above') WHERE id = '70f8d183-4783-4969-8856-f54dffea56c5' AND option_e IS NOT NULL AND position('none of the above 37' in option_e) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'halogenatee', 'halogenated') WHERE id = '71959cfe-f54a-417d-ae1a-8aa8796d34d5' AND option_a IS NOT NULL AND position('halogenatee' in option_a) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'smal
intestine', 'small
intestine') WHERE id = '72564dfc-6b51-4c7f-b0f6-53e82e07c38a' AND model_answer IS NOT NULL AND position('smal
intestine' in model_answer) > 0;
UPDATE public.questions SET option_d = replace(option_d, 'svmptoms', 'symptoms') WHERE id = '7284385e-f6e0-4cd0-9e03-f0b9665afdde' AND option_d IS NOT NULL AND position('svmptoms' in option_d) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'development of development ', 'development of ') WHERE id = '72a87106-1622-425b-affd-09e138b64848' AND option_a IS NOT NULL AND position('development of development ' in option_a) > 0;
UPDATE public.questions SET option_c = replace(option_c, 'assoclated', 'associated') WHERE id = '72a87106-1622-425b-affd-09e138b64848' AND option_c IS NOT NULL AND position('assoclated' in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, 'accumulatlon', 'accumulation') WHERE id = '72a87106-1622-425b-affd-09e138b64848' AND option_d IS NOT NULL AND position('accumulatlon' in option_d) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'drug( generic)', 'drug (generic)') WHERE id = '732c96d3-eebd-4056-8130-31357bbd8cad' AND option_b IS NOT NULL AND position('drug( generic)' in option_b) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' antipsychotics-mcq-explained Antipsychotics and Lithium', '') WHERE id = '732ffc1f-961f-4b29-ad1f-d85d53d97831' AND option_e IS NOT NULL AND position(' antipsychotics-mcq-explained Antipsychotics and Lithium' in option_e) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'benzoicacid', 'benzoic acid') WHERE id = '7363032a-e3b8-4a37-acd5-c2adc5015598' AND option_a IS NOT NULL AND position('benzoicacid' in option_a) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'call', 'cell') WHERE id = '7363032a-e3b8-4a37-acd5-c2adc5015598' AND option_b IS NOT NULL AND position('call' in option_b) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'in to', 'into') WHERE id = '7363032a-e3b8-4a37-acd5-c2adc5015598' AND option_b IS NOT NULL AND position('in to' in option_b) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'syndrome cyt', 'cytochrome') WHERE id = '73c0331b-f373-4659-ac08-be51f7e48ee2' AND option_b IS NOT NULL AND position('syndrome cyt' in option_b) > 0;
UPDATE public.questions SET option_e = replace(option_e, 'Match receptor with the appropriate receptor action. a1,a2,61,62,63', '') WHERE id = '7474d845-a405-4526-85fc-61f3e9cf2a09' AND option_e IS NOT NULL AND position('Match receptor with the appropriate receptor action. a1,a2,61,62,63' in option_e) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'cos', 'costs') WHERE id = '74abda38-b015-40e9-8439-3f0bb55702c3' AND model_answer IS NOT NULL AND position('cos' in model_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'developin', 'developing') WHERE id = '74abda38-b015-40e9-8439-3f0bb55702c3' AND model_answer IS NOT NULL AND position('developin' in model_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'prophylatics', 'prophylaxis') WHERE id = '74abda38-b015-40e9-8439-3f0bb55702c3' AND model_answer IS NOT NULL AND position('prophylatics' in model_answer) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'Non- sterile', 'Non-sterile') WHERE id = '75bac0dd-5d87-4811-9b4e-43c5390b5439' AND model_answer IS NOT NULL AND position('Non- sterile' in model_answer) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'drug', 'drugs') WHERE id = '76217799-32f1-450c-8398-702bedaf4d9d' AND option_a IS NOT NULL AND position('drug' in option_a) > 0;
UPDATE public.questions SET option_e = replace(option_e, 'use', 'used') WHERE id = '76217799-32f1-450c-8398-702bedaf4d9d' AND option_e IS NOT NULL AND position('use' in option_e) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'DESRIPTION', 'DESCRIPTION') WHERE id = '76276154-7660-47c5-8d54-61e845360688' AND model_answer IS NOT NULL AND position('DESRIPTION' in model_answer) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' local-anaesthetics-mcqs-from-louis Local Anaesthetics MCQs (from Louis)', '') WHERE id = '764e0cce-5fe9-4c7c-a272-6fbc373f3aab' AND option_e IS NOT NULL AND position(' local-anaesthetics-mcqs-from-louis Local Anaesthetics MCQs (from Louis)' in option_e) > 0;
UPDATE public.questions SET option_d = replace(option_d, ' 18 Shobabala General Two substances A and B, A being toxic when administered solely and B not being toxic even when administered in same amount, then when they are administered together they are both toxic', '') WHERE id = '791a890d-c033-4f48-84ed-c6acf892dc40' AND option_d IS NOT NULL AND position(' 18 Shobabala General Two substances A and B, A being toxic when administered solely and B not being toxic even when administered in same amount, then when they are administered together they are both toxic' in option_d) > 0;
UPDATE public.questions SET question_text = replace(question_text, '? ·', '?') WHERE id = '7af9474c-2d83-43ca-bf7f-952ed431e292' AND question_text IS NOT NULL AND position('? ·' in question_text) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' (75). Drug tolerance, WRONG statement is', '') WHERE id = '7b395e0d-3dfe-4108-9412-ed66f6d5ab89' AND option_e IS NOT NULL AND position(' (75). Drug tolerance, WRONG statement is' in option_e) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'unset', 'onset') WHERE id = '7b8a8193-c9f8-45d0-b91a-dbe32cf0c217' AND option_a IS NOT NULL AND position('unset' in option_a) > 0;
UPDATE public.questions SET option_e = replace(option_e, 'play', 'plays') WHERE id = '7b9855f9-077b-498d-ad21-cd751b673fab' AND option_e IS NOT NULL AND position('play' in option_e) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' COMPENDIUM SYSTEM 4 CHEMOTHERAPY & TOXICOLOGY', '') WHERE id = '7dac19b1-fc98-4212-a2d0-a75c775d5164' AND option_e IS NOT NULL AND position(' COMPENDIUM SYSTEM 4 CHEMOTHERAPY & TOXICOLOGY' in option_e) > 0;
UPDATE public.questions SET option_c = replace(option_c, 'Gamciclovir', 'Ganciclovir') WHERE id = '7f276dbf-c400-4c4b-8961-b25aef91fac5' AND option_c IS NOT NULL AND position('Gamciclovir' in option_c) > 0;
UPDATE public.questions SET option_a = replace(option_a, 'GABA, site', 'GABA site') WHERE id = '7fbdc7b8-7f53-48de-92d4-93edc1926cad' AND option_a IS NOT NULL AND position('GABA, site' in option_a) > 0;
UPDATE public.questions SET option_c = replace(option_c, 'Neostigmine,physostigmine', 'Neostigmine, physostigmine') WHERE id = '8097cfbc-f809-499e-aa1c-6e88a3d50920' AND option_c IS NOT NULL AND position('Neostigmine,physostigmine' in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, 'is associate with', 'is associated with') WHERE id = '810068a4-c500-45ee-9273-f7552f0d3068' AND option_d IS NOT NULL AND position('is associate with' in option_d) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'parotiti', 'parotitis') WHERE id = '841845df-5994-4f9e-9e05-3edf654e1266' AND model_answer IS NOT NULL AND position('parotiti' in model_answer) > 0;
UPDATE public.questions SET question_text = replace(question_text, 'famil', 'family') WHERE id = '841845df-5994-4f9e-9e05-3edf654e1266' AND question_text IS NOT NULL AND position('famil' in question_text) > 0;
UPDATE public.questions SET question_text = replace(question_text, 'rergard', 'regard') WHERE id = '8543532d-384e-4987-a518-fe7f5b815632' AND question_text IS NOT NULL AND position('rergard' in question_text) > 0;
UPDATE public.questions SET option_d = replace(option_d, 'symptom', 'symptoms') WHERE id = '854684bf-3378-4fbf-b0c2-71f36395fa92' AND option_d IS NOT NULL AND position('symptom' in option_d) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'corticosteriod', 'corticosteroid') WHERE id = '8652ba88-aa45-4b67-a280-c8286829f120' AND option_b IS NOT NULL AND position('corticosteriod' in option_b) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' F. Usually affects the lower lobes bilaterally.', '') WHERE id = '87600487-c782-455c-ac48-2b6b2abe37c9' AND option_e IS NOT NULL AND position(' F. Usually affects the lower lobes bilaterally.' in option_e) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'Sucralfate Bismuth and Misopr are mucosal protective drugs', 'Sucralfate, bismuth, and misoprostol are mucosal-protective drugs') WHERE id = '88caea69-be4c-4c2b-9a4b-fc02ab6fa818' AND option_b IS NOT NULL AND position('Sucralfate Bismuth and Misopr are mucosal protective drugs' in option_b) > 0;
UPDATE public.questions SET option_e = replace(option_e, ' OLD PHARM PQ SYSTEM', '') WHERE id = '88caea69-be4c-4c2b-9a4b-fc02ab6fa818' AND option_e IS NOT NULL AND position(' OLD PHARM PQ SYSTEM' in option_e) > 0;
UPDATE public.questions SET question_text = replace(question_text, 'WRONG statement concerning treatment', 'Which statement is incorrect concerning treatment?') WHERE id = '88caea69-be4c-4c2b-9a4b-fc02ab6fa818' AND question_text IS NOT NULL AND position('WRONG statement concerning treatment' in question_text) > 0;
UPDATE public.questions SET option_c = replace(option_c, 'wi', 'with') WHERE id = '8ec3a9c9-bed4-4665-b992-561a68f753a1' AND option_c IS NOT NULL AND position('wi' in option_c) > 0;
UPDATE public.questions SET option_b = replace(option_b, 'Bacterial', 'Bacteria') WHERE id = '8f03e46e-583b-4d08-8de8-9d34595d03f8' AND option_b IS NOT NULL AND position('Bacterial' in option_b) > 0;
UPDATE public.questions SET option_c = replace(option_c, 'due the', 'due to the') WHERE id = '8f03e46e-583b-4d08-8de8-9d34595d03f8' AND option_c IS NOT NULL AND position('due the' in option_c) > 0;
UPDATE public.questions SET option_d = replace(option_d, '10hours', '10 hours') WHERE id = '8fa1fad1-65de-4e4f-8ebf-67541f3c8719' AND option_d IS NOT NULL AND position('10hours' in option_d) > 0;
UPDATE public.questions SET option_c = replace(option_c, 'time- dependently', 'time-dependently') WHERE id = '902fecf8-7629-4874-9cad-cef1b5ac8f12' AND option_c IS NOT NULL AND position('time- dependently' in option_c) > 0;
UPDATE public.questions SET model_answer = replace(model_answer, 'Neprotoxicity', 'Nephrotoxicity') WHERE id = '90acfed8-23ac-4ad9-a2cf-2098330c39ed' AND model_answer IS NOT NULL AND position('Neprotoxicity' in model_answer) > 0;
COMMIT;
