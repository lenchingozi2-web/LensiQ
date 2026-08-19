-- Generated from Year4_7Day_Master_Timetable.pdf. Do not alter questions in this migration.
create extension if not exists pg_trgm;

create table if not exists public.curriculum_courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  description text not null,
  accent_color text not null default '#E8A23D',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.curriculum_topics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.curriculum_courses(id) on delete cascade,
  slug text not null,
  title text not null,
  day_number smallint not null check (day_number between 1 and 7),
  day_title text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id, slug)
);

create index if not exists curriculum_topics_course_order_idx
  on public.curriculum_topics(course_id, day_number, order_index);
create index if not exists curriculum_topics_title_trgm_idx
  on public.curriculum_topics using gin (title gin_trgm_ops);

alter table public.teaching_attachments
  add column if not exists extraction_status text not null default 'pending',
  add column if not exists extracted_text text,
  add column if not exists extraction_error text,
  add column if not exists extracted_at timestamptz;

create table if not exists public.curriculum_attachment_chunks (
  id uuid primary key default gen_random_uuid(),
  attachment_id uuid not null references public.teaching_attachments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  created_at timestamptz not null default now(),
  unique(attachment_id, chunk_index)
);

create index if not exists curriculum_attachment_chunks_user_idx
  on public.curriculum_attachment_chunks(user_id, attachment_id, chunk_index);

alter table public.curriculum_courses enable row level security;
alter table public.curriculum_topics enable row level security;
alter table public.curriculum_attachment_chunks enable row level security;

drop policy if exists "Anyone can read curriculum courses" on public.curriculum_courses;
create policy "Anyone can read curriculum courses" on public.curriculum_courses
  for select using (true);
drop policy if exists "Anyone can read curriculum topics" on public.curriculum_topics;
create policy "Anyone can read curriculum topics" on public.curriculum_topics
  for select using (true);
drop policy if exists "Users can read their own attachment chunks" on public.curriculum_attachment_chunks;
create policy "Users can read their own attachment chunks" on public.curriculum_attachment_chunks
  for select using (auth.uid() = user_id);
drop policy if exists "Users can create their own attachment chunks" on public.curriculum_attachment_chunks;
create policy "Users can create their own attachment chunks" on public.curriculum_attachment_chunks
  for insert with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own attachment chunks" on public.curriculum_attachment_chunks;
create policy "Users can delete their own attachment chunks" on public.curriculum_attachment_chunks
  for delete using (auth.uid() = user_id);

insert into public.curriculum_courses (slug, name, description, accent_color, display_order)
values
  ('anatomical-pathology', 'Anatomical Pathology', 'Cell injury, inflammation, organ-system pathology, neoplasia, and practical specimen recognition.', '#F4A261', 1),
  ('chemical-pathology', 'Chemical Pathology', 'Clinical chemistry, endocrine testing, metabolic disease, and laboratory interpretation.', '#2A9D8F', 2),
  ('haematology-immunology', 'Haematology / Immunology', 'Blood formation, anaemia, transfusion, haem malignancy, immunity, and immune disorders.', '#457B9D', 3),
  ('microbiology', 'Microbiology', 'Bacteriology, virology, mycology, parasitology, infection control, and diagnosis.', '#7C3AED', 4),
  ('pharmacology', 'Pharmacology', 'General, autonomic, antimicrobial, endocrine, CNS, cardiovascular, and clinical pharmacology.', '#E76F51', 5)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  accent_color = excluded.accent_color,
  display_order = excluded.display_order,
  updated_at = now();

insert into public.curriculum_topics (course_id, slug, title, day_number, day_title, order_index)
select c.id, seed.slug, seed.title, seed.day_number, seed.day_title, seed.order_index
from public.curriculum_courses c
join (values
  ('anatomical-pathology', 'introduction-to-pathology', 'Introduction to Pathology', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 1),
  ('anatomical-pathology', 'definition-and-scope-of-pathology', 'Definition and scope of pathology', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 2),
  ('anatomical-pathology', 'cellular-response-to-injury', 'Cellular response to injury', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 3),
  ('anatomical-pathology', 'cellular-adaptation', 'Cellular adaptation', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 4),
  ('anatomical-pathology', 'reversible-cell-injury', 'Reversible cell injury', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 5),
  ('anatomical-pathology', 'irreversible-cell-injury', 'Irreversible cell injury', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 6),
  ('anatomical-pathology', 'cardiovascular-pathology', 'Cardiovascular pathology', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 7),
  ('anatomical-pathology', 'congenital-heart-diseases', 'Congenital heart diseases', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 8),
  ('anatomical-pathology', 'heart-failure', 'Heart failure', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 9),
  ('anatomical-pathology', 'blood-vessel-disorders', 'Blood vessel disorders', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 10),
  ('anatomical-pathology', 'arteriosclerosis', 'Arteriosclerosis', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 11),
  ('anatomical-pathology', 'atherosclerosis', 'Atherosclerosis', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 12),
  ('anatomical-pathology', 'aneurysms', 'Aneurysms', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 13),
  ('chemical-pathology', 'introduction-to-chemical-pathology', 'Introduction to Chemical Pathology', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 1),
  ('chemical-pathology', 'biological-specimens', 'Biological specimens', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 2),
  ('chemical-pathology', 'biological-variation', 'Biological variation', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 3),
  ('chemical-pathology', 'water-balance', 'Water balance', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 4),
  ('chemical-pathology', 'sodium-disorders', 'Sodium disorders', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 5),
  ('chemical-pathology', 'potassium-disorders', 'Potassium disorders', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 6),
  ('haematology-immunology', 'introduction-to-haematology', 'Introduction to Haematology', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 1),
  ('haematology-immunology', 'haematopoiesis', 'Haematopoiesis', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 2),
  ('haematology-immunology', 'erythropoiesis', 'Erythropoiesis', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 3),
  ('haematology-immunology', 'granulopoiesis', 'Granulopoiesis', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 4),
  ('haematology-immunology', 'white-blood-cell-physiology', 'White blood cell physiology', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 5),
  ('microbiology', 'introduction-to-medical-microbiology', 'Introduction to Medical Microbiology', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 1),
  ('microbiology', 'sterilization', 'Sterilization', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 2),
  ('microbiology', 'disinfection', 'Disinfection', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 3),
  ('microbiology', 'bacterial-cell-structure', 'Bacterial cell structure', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 4),
  ('microbiology', 'culture-techniques', 'Culture techniques', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 5),
  ('pharmacology', 'general-pharmacology', 'General Pharmacology', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 1),
  ('pharmacology', 'pharmacokinetics', 'Pharmacokinetics', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 2),
  ('pharmacology', 'pharmacodynamics', 'Pharmacodynamics', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 3),
  ('pharmacology', 'drug-metabolism', 'Drug metabolism', 1, 'CARDIOVASCULAR, CELL INJURY & BASIC MICROBIOLOGY', 4),
  ('anatomical-pathology', 'cell-death', 'Cell death', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 1),
  ('anatomical-pathology', 'necrosis', 'Necrosis', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 2),
  ('anatomical-pathology', 'apoptosis', 'Apoptosis', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 3),
  ('anatomical-pathology', 'intracellular-accumulations', 'Intracellular accumulations', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 4),
  ('anatomical-pathology', 'acute-inflammation', 'Acute inflammation', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 5),
  ('anatomical-pathology', 'chronic-inflammation', 'Chronic inflammation', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 6),
  ('anatomical-pathology', 'respiratory-pathology', 'Respiratory pathology', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 7),
  ('anatomical-pathology', 'copd', 'COPD', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 8),
  ('anatomical-pathology', 'bronchiectasis', 'Bronchiectasis', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 9),
  ('anatomical-pathology', 'asthma', 'Asthma', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 10),
  ('anatomical-pathology', 'tuberculosis', 'Tuberculosis', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 11),
  ('anatomical-pathology', 'pneumonia', 'Pneumonia', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 12),
  ('anatomical-pathology', 'pulmonary-embolism', 'Pulmonary embolism', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 13),
  ('anatomical-pathology', 'lung-cancers', 'Lung cancers', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 14),
  ('anatomical-pathology', 'mesothelioma', 'Mesothelioma', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 15),
  ('chemical-pathology', 'calcium-metabolism', 'Calcium metabolism', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 1),
  ('chemical-pathology', 'phosphate-metabolism', 'Phosphate metabolism', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 2),
  ('chemical-pathology', 'acid-base-balance', 'Acid-base balance', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 3),
  ('chemical-pathology', 'renal-function-tests', 'Renal function tests', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 4),
  ('haematology-immunology', 'primary-immune-response', 'Primary immune response', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 1),
  ('haematology-immunology', 'secondary-immune-response', 'Secondary immune response', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 2),
  ('haematology-immunology', 'antigen-antibody-reactions', 'Antigen-antibody reactions', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 3),
  ('haematology-immunology', 'lymphoid-tissues', 'Lymphoid tissues', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 4),
  ('microbiology', 'gram-positive-bacteria', 'Gram positive bacteria', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 1),
  ('microbiology', 'gram-negative-bacteria', 'Gram negative bacteria', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 2),
  ('microbiology', 'staphylococcus', 'Staphylococcus', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 3),
  ('microbiology', 'streptococcus', 'Streptococcus', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 4),
  ('pharmacology', 'cholinergic-drugs', 'Cholinergic drugs', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 1),
  ('pharmacology', 'anticholinergics', 'Anticholinergics', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 2),
  ('pharmacology', 'adrenergic-drugs', 'Adrenergic drugs', 2, 'INFLAMMATION, RESPIRATORY & IMMUNOLOGY', 3),
  ('anatomical-pathology', 'mediators-of-inflammation', 'Mediators of inflammation', 3, 'RENAL, ANAEMIAS & VIROLOGY', 1),
  ('anatomical-pathology', 'wound-healing', 'Wound healing', 3, 'RENAL, ANAEMIAS & VIROLOGY', 2),
  ('anatomical-pathology', 'renal-pathology-overview', 'Renal pathology overview', 3, 'RENAL, ANAEMIAS & VIROLOGY', 3),
  ('anatomical-pathology', 'glomerular-diseases', 'Glomerular diseases', 3, 'RENAL, ANAEMIAS & VIROLOGY', 4),
  ('anatomical-pathology', 'tubulo-interstitial-diseases', 'Tubulo-interstitial diseases', 3, 'RENAL, ANAEMIAS & VIROLOGY', 5),
  ('anatomical-pathology', 'pyelonephritis', 'Pyelonephritis', 3, 'RENAL, ANAEMIAS & VIROLOGY', 6),
  ('anatomical-pathology', 'acute-tubular-injury', 'Acute tubular injury', 3, 'RENAL, ANAEMIAS & VIROLOGY', 7),
  ('anatomical-pathology', 'cystic-kidney-diseases', 'Cystic kidney diseases', 3, 'RENAL, ANAEMIAS & VIROLOGY', 8),
  ('anatomical-pathology', 'renal-stones', 'Renal stones', 3, 'RENAL, ANAEMIAS & VIROLOGY', 9),
  ('anatomical-pathology', 'renal-cancers', 'Renal cancers', 3, 'RENAL, ANAEMIAS & VIROLOGY', 10),
  ('chemical-pathology', 'glucose-metabolism', 'Glucose metabolism', 3, 'RENAL, ANAEMIAS & VIROLOGY', 1),
  ('chemical-pathology', 'diabetes-mellitus', 'Diabetes mellitus', 3, 'RENAL, ANAEMIAS & VIROLOGY', 2),
  ('chemical-pathology', 'bilirubin-metabolism', 'Bilirubin metabolism', 3, 'RENAL, ANAEMIAS & VIROLOGY', 3),
  ('chemical-pathology', 'liver-function-tests', 'Liver function tests', 3, 'RENAL, ANAEMIAS & VIROLOGY', 4),
  ('haematology-immunology', 'iron-metabolism', 'Iron metabolism', 3, 'RENAL, ANAEMIAS & VIROLOGY', 1),
  ('haematology-immunology', 'iron-deficiency-anaemia', 'Iron deficiency anaemia', 3, 'RENAL, ANAEMIAS & VIROLOGY', 2),
  ('haematology-immunology', 'folate-metabolism', 'Folate metabolism', 3, 'RENAL, ANAEMIAS & VIROLOGY', 3),
  ('haematology-immunology', 'vitamin-b12-metabolism', 'Vitamin B12 metabolism', 3, 'RENAL, ANAEMIAS & VIROLOGY', 4),
  ('haematology-immunology', 'megaloblastic-anaemia', 'Megaloblastic anaemia', 3, 'RENAL, ANAEMIAS & VIROLOGY', 5),
  ('microbiology', 'virology', 'Virology', 3, 'RENAL, ANAEMIAS & VIROLOGY', 1),
  ('microbiology', 'dna-viruses', 'DNA viruses', 3, 'RENAL, ANAEMIAS & VIROLOGY', 2),
  ('microbiology', 'rna-viruses', 'RNA viruses', 3, 'RENAL, ANAEMIAS & VIROLOGY', 3),
  ('microbiology', 'hepatitis-viruses', 'Hepatitis viruses', 3, 'RENAL, ANAEMIAS & VIROLOGY', 4),
  ('microbiology', 'hiv', 'HIV', 3, 'RENAL, ANAEMIAS & VIROLOGY', 5),
  ('pharmacology', 'antimicrobials', 'Antimicrobials', 3, 'RENAL, ANAEMIAS & VIROLOGY', 1),
  ('pharmacology', 'penicillins', 'Penicillins', 3, 'RENAL, ANAEMIAS & VIROLOGY', 2),
  ('pharmacology', 'cephalosporins', 'Cephalosporins', 3, 'RENAL, ANAEMIAS & VIROLOGY', 3),
  ('pharmacology', 'aminoglycosides', 'Aminoglycosides', 3, 'RENAL, ANAEMIAS & VIROLOGY', 4),
  ('pharmacology', 'tetracyclines', 'Tetracyclines', 3, 'RENAL, ANAEMIAS & VIROLOGY', 5),
  ('anatomical-pathology', 'thrombosis', 'Thrombosis', 4, 'GIT, TRANSFUSION & MYCOLOGY', 1),
  ('anatomical-pathology', 'embolism', 'Embolism', 4, 'GIT, TRANSFUSION & MYCOLOGY', 2),
  ('anatomical-pathology', 'shock', 'Shock', 4, 'GIT, TRANSFUSION & MYCOLOGY', 3),
  ('anatomical-pathology', 'esophageal-disorders', 'Esophageal disorders', 4, 'GIT, TRANSFUSION & MYCOLOGY', 4),
  ('anatomical-pathology', 'gastritis', 'Gastritis', 4, 'GIT, TRANSFUSION & MYCOLOGY', 5),
  ('anatomical-pathology', 'peptic-ulcer-disease', 'Peptic ulcer disease', 4, 'GIT, TRANSFUSION & MYCOLOGY', 6),
  ('anatomical-pathology', 'gastric-cancers', 'Gastric cancers', 4, 'GIT, TRANSFUSION & MYCOLOGY', 7),
  ('anatomical-pathology', 'inflammatory-bowel-disease', 'Inflammatory bowel disease', 4, 'GIT, TRANSFUSION & MYCOLOGY', 8),
  ('anatomical-pathology', 'colonic-polyps', 'Colonic polyps', 4, 'GIT, TRANSFUSION & MYCOLOGY', 9),
  ('anatomical-pathology', 'colonic-cancers', 'Colonic cancers', 4, 'GIT, TRANSFUSION & MYCOLOGY', 10),
  ('anatomical-pathology', 'liver-cirrhosis', 'Liver cirrhosis', 4, 'GIT, TRANSFUSION & MYCOLOGY', 11),
  ('anatomical-pathology', 'liver-cancer', 'Liver cancer', 4, 'GIT, TRANSFUSION & MYCOLOGY', 12),
  ('anatomical-pathology', 'gall-stones', 'Gall stones', 4, 'GIT, TRANSFUSION & MYCOLOGY', 13),
  ('anatomical-pathology', 'cholecystitis', 'Cholecystitis', 4, 'GIT, TRANSFUSION & MYCOLOGY', 14),
  ('chemical-pathology', 'plasma-proteins', 'Plasma proteins', 4, 'GIT, TRANSFUSION & MYCOLOGY', 1),
  ('chemical-pathology', 'immunoglobulins', 'Immunoglobulins', 4, 'GIT, TRANSFUSION & MYCOLOGY', 2),
  ('chemical-pathology', 'plasma-lipids', 'Plasma lipids', 4, 'GIT, TRANSFUSION & MYCOLOGY', 3),
  ('chemical-pathology', 'tumour-markers', 'Tumour markers', 4, 'GIT, TRANSFUSION & MYCOLOGY', 4),
  ('haematology-immunology', 'abo-blood-group-system', 'ABO blood group system', 4, 'GIT, TRANSFUSION & MYCOLOGY', 1),
  ('haematology-immunology', 'rh-blood-group-system', 'Rh blood group system', 4, 'GIT, TRANSFUSION & MYCOLOGY', 2),
  ('haematology-immunology', 'blood-transfusion', 'Blood transfusion', 4, 'GIT, TRANSFUSION & MYCOLOGY', 3),
  ('haematology-immunology', 'blood-component-therapy', 'Blood component therapy', 4, 'GIT, TRANSFUSION & MYCOLOGY', 4),
  ('haematology-immunology', 'transfusion-reactions', 'Transfusion reactions', 4, 'GIT, TRANSFUSION & MYCOLOGY', 5),
  ('microbiology', 'mycology', 'Mycology', 4, 'GIT, TRANSFUSION & MYCOLOGY', 1),
  ('microbiology', 'candida', 'Candida', 4, 'GIT, TRANSFUSION & MYCOLOGY', 2),
  ('microbiology', 'aspergillus', 'Aspergillus', 4, 'GIT, TRANSFUSION & MYCOLOGY', 3),
  ('microbiology', 'opportunistic-fungal-infections', 'Opportunistic fungal infections', 4, 'GIT, TRANSFUSION & MYCOLOGY', 4),
  ('pharmacology', 'antifungal-drugs', 'Antifungal drugs', 4, 'GIT, TRANSFUSION & MYCOLOGY', 1),
  ('pharmacology', 'antiviral-drugs', 'Antiviral drugs', 4, 'GIT, TRANSFUSION & MYCOLOGY', 2),
  ('pharmacology', 'antituberculous-drugs', 'Antituberculous drugs', 4, 'GIT, TRANSFUSION & MYCOLOGY', 3),
  ('pharmacology', 'antimalarial-drugs', 'Antimalarial drugs', 4, 'GIT, TRANSFUSION & MYCOLOGY', 4),
  ('anatomical-pathology', 'genetic-disorders', 'Genetic disorders', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 1),
  ('anatomical-pathology', 'thyroid-diseases', 'Thyroid diseases', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 2),
  ('anatomical-pathology', 'diabetes-mellitus', 'Diabetes mellitus', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 3),
  ('anatomical-pathology', 'men-syndrome', 'MEN syndrome', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 4),
  ('anatomical-pathology', 'ovarian-tumours', 'Ovarian tumours', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 5),
  ('anatomical-pathology', 'leiomyoma', 'Leiomyoma', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 6),
  ('anatomical-pathology', 'endometrial-cancer', 'Endometrial cancer', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 7),
  ('anatomical-pathology', 'cervical-cancer', 'Cervical cancer', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 8),
  ('anatomical-pathology', 'gtd', 'GTD', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 9),
  ('anatomical-pathology', 'prostate-disorders', 'Prostate disorders', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 10),
  ('anatomical-pathology', 'bladder-cancers', 'Bladder cancers', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 11),
  ('anatomical-pathology', 'breast-pathology', 'Breast pathology', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 12),
  ('chemical-pathology', 'hormone-mechanisms', 'Hormone mechanisms', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 1),
  ('chemical-pathology', 'pituitary-gland', 'Pituitary gland', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 2),
  ('chemical-pathology', 'thyroid-axis', 'Thyroid axis', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 3),
  ('chemical-pathology', 'adrenal-axis', 'Adrenal axis', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 4),
  ('chemical-pathology', 'pregnancy-chemistry', 'Pregnancy chemistry', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 5),
  ('haematology-immunology', 'sickle-cell-anaemia', 'Sickle cell anaemia', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 1),
  ('haematology-immunology', 'alpha-thalassaemia', 'Alpha thalassaemia', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 2),
  ('haematology-immunology', 'beta-thalassaemia', 'Beta thalassaemia', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 3),
  ('haematology-immunology', 'haemoglobinopathies', 'Haemoglobinopathies', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 4),
  ('microbiology', 'parasitology', 'Parasitology', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 1),
  ('microbiology', 'malaria', 'Malaria', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 2),
  ('microbiology', 'protozoa', 'Protozoa', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 3),
  ('microbiology', 'helminths', 'Helminths', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 4),
  ('pharmacology', 'antidiabetic-drugs', 'Antidiabetic drugs', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 1),
  ('pharmacology', 'steroids', 'Steroids', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 2),
  ('pharmacology', 'thyroid-drugs', 'Thyroid drugs', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 3),
  ('pharmacology', 'reproductive-pharmacology', 'Reproductive pharmacology', 5, 'ENDOCRINE, REPRODUCTIVE & PARASITOLOGY', 4),
  ('anatomical-pathology', 'neoplasia', 'Neoplasia', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 1),
  ('anatomical-pathology', 'carcinogenesis', 'Carcinogenesis', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 2),
  ('anatomical-pathology', 'tumour-grading', 'Tumour grading', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 3),
  ('anatomical-pathology', 'tumour-staging', 'Tumour staging', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 4),
  ('anatomical-pathology', 'cns-infections', 'CNS infections', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 5),
  ('anatomical-pathology', 'meningitis', 'Meningitis', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 6),
  ('anatomical-pathology', 'encephalitis', 'Encephalitis', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 7),
  ('anatomical-pathology', 'prion-diseases', 'Prion diseases', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 8),
  ('anatomical-pathology', 'intracranial-haemorrhage', 'Intracranial haemorrhage', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 9),
  ('anatomical-pathology', 'hydrocephalus', 'Hydrocephalus', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 10),
  ('anatomical-pathology', 'cns-tumours', 'CNS tumours', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 11),
  ('anatomical-pathology', 'stroke', 'Stroke', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 12),
  ('anatomical-pathology', 'neurodegenerative-diseases', 'Neurodegenerative diseases', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 13),
  ('chemical-pathology', 'inborn-errors-of-metabolism', 'Inborn errors of metabolism', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 1),
  ('chemical-pathology', 'amino-acid-disorders', 'Amino acid disorders', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 2),
  ('chemical-pathology', 'csf-chemistry', 'CSF chemistry', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 3),
  ('chemical-pathology', 'clinical-chemistry-in-elderly', 'Clinical chemistry in elderly', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 4),
  ('haematology-immunology', 'leukaemogenesis', 'Leukaemogenesis', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 1),
  ('haematology-immunology', 'haematological-malignancies', 'Haematological malignancies', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 2),
  ('haematology-immunology', 'immunoproliferative-disorders', 'Immunoproliferative disorders', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 3),
  ('haematology-immunology', 'neutropenia', 'Neutropenia', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 4),
  ('haematology-immunology', 'thrombocytopenia', 'Thrombocytopenia', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 5),
  ('microbiology', 'infection-control', 'Infection control', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 1),
  ('microbiology', 'nosocomial-infections', 'Nosocomial infections', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 2),
  ('microbiology', 'antimicrobial-resistance', 'Antimicrobial resistance', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 3),
  ('pharmacology', 'anticancer-drugs', 'Anticancer drugs', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 1),
  ('pharmacology', 'immunosuppressants', 'Immunosuppressants', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 2),
  ('pharmacology', 'cns-pharmacology', 'CNS pharmacology', 6, 'NEOPLASIA, CNS & MALIGNANCIES', 3),
  ('anatomical-pathology', 'hypersensitivity-reactions', 'Hypersensitivity reactions', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 1),
  ('anatomical-pathology', 'autoimmune-diseases', 'Autoimmune diseases', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 2),
  ('anatomical-pathology', 'immunodeficiency-disorders', 'Immunodeficiency disorders', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 3),
  ('anatomical-pathology', 'amyloidosis', 'Amyloidosis', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 4),
  ('anatomical-pathology', 'osteomyelitis', 'Osteomyelitis', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 5),
  ('anatomical-pathology', 'bone-tumours', 'Bone tumours', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 6),
  ('anatomical-pathology', 'osteoarthritis', 'Osteoarthritis', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 7),
  ('anatomical-pathology', 'rheumatoid-arthritis', 'Rheumatoid arthritis', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 8),
  ('anatomical-pathology', 'soft-tissue-tumours', 'Soft tissue tumours', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 9),
  ('anatomical-pathology', 'skin-lesions', 'Skin lesions', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 10),
  ('anatomical-pathology', 'inflammatory-dermatoses', 'Inflammatory dermatoses', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 11),
  ('anatomical-pathology', 'skin-neoplasms', 'Skin neoplasms', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 12),
  ('anatomical-pathology', 'autopsy-pathology', 'Autopsy pathology', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 13),
  ('chemical-pathology', 'therapeutic-drug-monitoring', 'Therapeutic drug monitoring', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 1),
  ('chemical-pathology', 'trace-elements', 'Trace elements', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 2),
  ('chemical-pathology', 'vitamins', 'Vitamins', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 3),
  ('chemical-pathology', 'hypertension-chemistry', 'Hypertension chemistry', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 4),
  ('chemical-pathology', 'laboratory-quality-assurance', 'Laboratory quality assurance', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 5),
  ('haematology-immunology', 'complement-system', 'Complement system', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 1),
  ('haematology-immunology', 'plasma-cell-disorders', 'Plasma cell disorders', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 2),
  ('haematology-immunology', 'comprehensive-anaemia-revision', 'Comprehensive anaemia revision', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 3),
  ('haematology-immunology', 'integrated-immunology-revision', 'Integrated immunology revision', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 4),
  ('microbiology', 'organism-identification', 'Organism identification', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 1),
  ('microbiology', 'diagnostic-microbiology', 'Diagnostic microbiology', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 2),
  ('microbiology', 'clinical-microbiology-review', 'Clinical microbiology review', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 3),
  ('pharmacology', 'drug-adverse-effects', 'Drug adverse effects', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 1),
  ('pharmacology', 'contraindications', 'Contraindications', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 2),
  ('pharmacology', 'mechanism-revision', 'Mechanism revision', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 3),
  ('pharmacology', 'clinical-pharmacology-review', 'Clinical pharmacology review', 7, 'IMMUNE DISORDERS, SKIN & CONSOLIDATION', 4)
) as seed(course_slug, slug, title, day_number, day_title, order_index) on seed.course_slug = c.slug
on conflict (course_id, slug) do update set
  title = excluded.title,
  day_number = excluded.day_number,
  day_title = excluded.day_title,
  order_index = excluded.order_index,
  updated_at = now();

create index if not exists questions_search_tsv_idx on public.questions using gin (
  to_tsvector('simple'::regconfig, coalesce(question_text, '') || ' ' || coalesce(division, '') || ' ' || coalesce(topic, '') || ' ' || coalesce(source_flag, '') || ' ' || coalesce(model_answer, ''))
);

create or replace function public.search_question_bank(
  search_text text,
  subject_filter text default null,
  division_filter text default null,
  max_results integer default 40
)
returns table (
  id uuid, subject text, division text, topic text, type text, year integer,
  question_text text, image_url text, correct_answer text, model_answer text, relevance real
)
language sql stable set search_path = public
as $$
  with query_terms as (
    select websearch_to_tsquery('simple', trim(search_text)) as tsquery
  )
  select q.id, q.subject, q.division, q.topic, q.type, q.year, q.question_text, q.image_url,
    q.correct_answer, q.model_answer,
    ts_rank_cd(to_tsvector('simple', concat_ws(' ', q.question_text, q.division, q.topic, q.source_flag, q.model_answer)), query_terms.tsquery) as relevance
  from public.questions q
  cross join query_terms
  where length(trim(search_text)) > 0
    and (subject_filter is null or q.subject = subject_filter)
    and (division_filter is null or q.division = division_filter)
    and (to_tsvector('simple', concat_ws(' ', q.question_text, q.division, q.topic, q.source_flag, q.model_answer)) @@ query_terms.tsquery
      or q.question_text ilike '%' || trim(search_text) || '%'
      or coalesce(q.topic, '') ilike '%' || trim(search_text) || '%'
      or coalesce(q.division, '') ilike '%' || trim(search_text) || '%')
  order by relevance desc, q.created_at desc
  limit least(greatest(coalesce(max_results, 40), 1), 100);
$$;

revoke all on function public.search_question_bank(text, text, text, integer) from public;
grant execute on function public.search_question_bank(text, text, text, integer) to anon, authenticated, service_role;
