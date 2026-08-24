-- Repair literal black-square glyphs stored in scientific notation.
-- Scope is limited to the seven records identified by the production audit.

-- Chemical Pathology: Acid-Base Disorders
update public.questions set model_answer = replace(model_answer, 'HPO■²■', 'HPO₄²⁻') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';
update public.questions set model_answer = replace(model_answer, 'H■PO■■', 'H₃PO₄') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';
update public.questions set model_answer = replace(model_answer, 'H■CO■', 'H₂CO₃') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';
update public.questions set model_answer = replace(model_answer, 'SO■²■', 'SO₄²⁻') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';
update public.questions set model_answer = replace(model_answer, 'HCO■■', 'HCO₃⁻') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';
update public.questions set model_answer = replace(model_answer, 'NH■■', 'NH₄⁺') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';
update public.questions set model_answer = replace(model_answer, 'NH■', 'NH₃') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';
update public.questions set model_answer = replace(model_answer, 'HSO■■', 'HSO₄⁻') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';
update public.questions set model_answer = replace(model_answer, 'FEHCO■', 'FEHCO₃') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';
update public.questions set model_answer = replace(model_answer, 'pCO■', 'pCO₂') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';
update public.questions set model_answer = replace(model_answer, 'CO■', 'CO₂') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';
update public.questions set model_answer = replace(model_answer, 'H■-ATPase', 'H⁺-ATPase') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';
update public.questions set model_answer = replace(model_answer, 'Na■/H■', 'Na⁺/H⁺') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';
update public.questions set model_answer = replace(model_answer, 'H■/K■', 'H⁺/K⁺') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';
update public.questions set model_answer = replace(model_answer, 'H■O', 'H₂O') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';
update public.questions set model_answer = replace(model_answer, 'Fe²■', 'Fe²⁺') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';
update public.questions set model_answer = replace(model_answer, 'Na■', 'Na⁺') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';
update public.questions set model_answer = replace(model_answer, 'Cl■', 'Cl⁻') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';
update public.questions set model_answer = replace(model_answer, 'K■', 'K⁺') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';
update public.questions set model_answer = replace(model_answer, 'H■', 'H⁺') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';
update public.questions set model_answer = replace(model_answer, '■', '') where id = '42d7d0a5-694f-4069-8042-c5516fe4e371';

-- Chemical Pathology: Kidney
update public.questions set model_answer = replace(model_answer, 'HCO■■', 'HCO₃⁻') where id = 'bcc617a5-ed81-41af-9ce2-4daa6754153e';
update public.questions set model_answer = replace(model_answer, 'NH■■', 'NH₄⁺') where id = 'bcc617a5-ed81-41af-9ce2-4daa6754153e';
update public.questions set model_answer = replace(model_answer, 'FEHCO■', 'FEHCO₃') where id = 'bcc617a5-ed81-41af-9ce2-4daa6754153e';
update public.questions set model_answer = replace(model_answer, 'Na■', 'Na⁺') where id = 'bcc617a5-ed81-41af-9ce2-4daa6754153e';
update public.questions set model_answer = replace(model_answer, 'Cl■', 'Cl⁻') where id = 'bcc617a5-ed81-41af-9ce2-4daa6754153e';
update public.questions set model_answer = replace(model_answer, 'K■', 'K⁺') where id = 'bcc617a5-ed81-41af-9ce2-4daa6754153e';
update public.questions set model_answer = replace(model_answer, 'H■', 'H⁺') where id = 'bcc617a5-ed81-41af-9ce2-4daa6754153e';
update public.questions set model_answer = replace(model_answer, '■', '') where id = 'bcc617a5-ed81-41af-9ce2-4daa6754153e';

-- Chemical Pathology: Liver
update public.questions set model_answer = replace(model_answer, 'Fe²■', 'Fe²⁺') where id = 'ca74d127-3f41-497b-bd7b-a1675427cebd';

-- Haematology MCQs
update public.questions set question_text = replace(question_text, '10■', '10⁹') where id = '3d2f11ad-7446-45ac-8f5d-9a2ca25b146d';
update public.questions set question_text = replace(question_text, '10■', '10⁹') where id = 'ad3182be-e684-406f-8338-50e50f79084a';
update public.questions set option_b = replace(option_b, '10■', '10⁹') where id = 'da7fd34a-161b-43c9-9e87-c295b3dc3b0b';
update public.questions set question_text = replace(question_text, '10■', '10⁹'), model_answer = replace(model_answer, '10■', '10⁹') where id = 'eedea628-dee8-4d8e-b96a-fc5a15e80af0';
