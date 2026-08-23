-- Correct practical metadata and answers without deleting any Supabase Storage image bytes.
-- The two misclassified FGT rows duplicate verified records already stored in their
-- correct organ/system divisions, so only the erroneous metadata rows are removed.

-- Reclassify the exact image records shown as Q7 and Q15 by the user.
-- Their existing image_url values are retained so the Storage objects are not
-- replaced or deleted; only the database metadata and organ/system assignment change.
update public.questions
set topic = 'Massive Splenomegaly',
    division = 'Lymphoreticular / Haematopoietic',
    image_url = 'https://hixvbcrrklyajhkyliay.supabase.co/storage/v1/object/public/practical-images/matched_images/Q009_massive_splenomegaly.jpg',
    question_text = 'A. Describe the morphological appearance. B. List five causes in Nigeria. C. List two complications.',
    model_answer = $$Identification: Massive splenomegaly.

Gross and morphological features: the spleen is markedly enlarged, firm, and usually dark red, with a preserved or prominent notched outline. The cut surface may show expansion of the red and white pulp.

Causes in Nigeria and comparable settings include chronic malaria, chronic myeloid leukaemia, lymphoma, portal-hypertension-related congestion, chronic lymphocytic leukaemia, visceral leishmaniasis, and Gaucher disease.

Complications include hypersplenism with anaemia, leucopenia, and thrombocytopenia; splenic rupture with haemorrhage; abdominal discomfort or early satiety; and increased susceptibility to infection.$$,
    source_flag = 'reviewed_practical_answer_2026_08_23'
where id = 'be024fad-3488-4055-8719-b27405e09267'
  and subject = 'Pathology' and division = 'Female Genital Tract' and type = 'practical';

update public.questions
set topic = 'Hepatocellular Carcinoma',
    division = 'Hepatobiliary System',
    image_url = 'https://hixvbcrrklyajhkyliay.supabase.co/storage/v1/object/public/practical-images/matched_images/Q016_liver_cell_carcinoma.jpg',
    question_text = 'A. Describe the morphological and histological features. B. List five aetiological agents. C. List clinicopathological variants. D. List two benign liver tumours. E. List three causes of death.',
    model_answer = $$Identification: Hepatocellular carcinoma, also called hepatoma or liver-cell carcinoma.

Gross features: the tumour may be unifocal, multifocal, or diffusely infiltrative. It is often a pale yellow or white, soft-to-firm mass with haemorrhage and necrosis. It may invade hepatic and portal veins.

Histology: malignant hepatocytes form trabeculae, cords, nests, or solid sheets and may show variable differentiation, bile production, cytological atypia, and vascular invasion.

Aetiological agents and risk factors include chronic hepatitis B virus infection, chronic hepatitis C virus infection, chronic alcohol-related liver disease, aflatoxin exposure, and iron overload or haemochromatosis. Cirrhosis and other chronic liver diseases are important background conditions.

Clinicopathological variants include the conventional trabecular or nodular form, fibrolamellar carcinoma, scirrhous or fibrous-stroma-rich carcinoma, and diffuse or infiltrative carcinoma.

Two benign liver tumours are hepatocellular adenoma and hepatic haemangioma.

Causes of death include progressive liver failure, tumour rupture with massive haemorrhage, and metastatic or diffuse carcinomatosis.$$,
    source_flag = 'reviewed_practical_answer_2026_08_23'
where id = '8e9e3267-f0c3-4f34-816e-6156960bc740'
  and subject = 'Pathology' and division = 'Female Genital Tract' and type = 'practical';

-- Remove the old correctly categorized duplicate rows from the question bank.
-- Their Storage image objects remain intact and are not deleted by this migration.
delete from public.questions
where id in (
  '831da631-1ee4-41da-8371-02339c405488', -- duplicate Massive Splenomegaly source row
  '3a58348a-09f9-4ec2-bda0-64347c6005d4'  -- duplicate Liver Cell Carcinoma source row
)
and subject = 'Pathology'
and type = 'practical';

update public.questions
set model_answer = $$Identification: Adenomyosis.

Definition: benign ectopic endometrial glands and stroma within the myometrium, often accompanied by surrounding smooth-muscle hyperplasia.

Gross features: a diffusely enlarged, globular uterus with a thickened, trabeculated myometrium containing small haemorrhagic or cystic foci. The lesion is usually poorly circumscribed.

Microscopy: endometrial glands and stroma are present within the myometrium, commonly with cyclic haemorrhage, hemosiderin, and smooth-muscle hypertrophy.

Clinical features: dysmenorrhoea, menorrhagia or abnormal uterine bleeding, chronic pelvic pain, and sometimes subfertility. The condition may coexist with endometriosis or leiomyomas.$$,
    source_flag = 'reviewed_practical_answer_2026_08_23'
where id = '41cb7f6b-56eb-41b0-a2c8-f491e55a5d07'
  and subject = 'Pathology' and division = 'Female Genital Tract' and type = 'practical';

update public.questions
set model_answer = $$Identification: Immature teratoma.

Nature and origin: a malignant ovarian germ-cell tumour derived from pluripotent germ cells and containing immature embryonal tissues, especially immature neuroepithelial tissue.

Gross features: usually a large, predominantly solid or partly cystic ovarian mass. Necrosis, haemorrhage, and areas containing cartilage, bone, or other tissues may be present.

Microscopy: immature neuroepithelium or primitive neuroectodermal tissue is the key diagnostic component, together with immature tissues from one or more germ-cell layers. Grading is based mainly on the amount of immature neuroepithelium.

Clinical features and complications: it occurs most often in adolescents and young adults and may present with an enlarging abdominal mass, pelvic pain, or abdominal distension. Serum alpha-fetoprotein may be raised, particularly when yolk-sac elements coexist. Complications include rupture, haemorrhage, torsion, peritoneal spread, and recurrence.$$,
    source_flag = 'reviewed_practical_answer_2026_08_23'
where id = '0ad2347a-a334-4ffd-ade3-bd1c172c4aa9'
  and subject = 'Pathology' and division = 'Female Genital Tract' and type = 'practical';

update public.questions
set model_answer = $$Identification: Missed abortion, also called missed miscarriage.

Definition: retention of a nonviable intrauterine pregnancy without expulsion of the products of conception.

Typical findings: the uterus is usually smaller than expected for the period of amenorrhoea. The retained gestational tissue may show degenerative or macerative change, depending on the duration of retention.

Clinical features: cessation of previously experienced pregnancy symptoms, absent fetal cardiac activity, and sometimes scanty brown vaginal discharge or no bleeding at all.

Complications: infection, incomplete evacuation, haemorrhage, psychological distress, and, in prolonged retention, consumptive coagulopathy or disseminated intravascular coagulation. Management requires confirmation of nonviability and appropriate medical, surgical, or expectant treatment.$$,
    source_flag = 'reviewed_practical_answer_2026_08_23'
where id = 'c9c8999f-1c3d-4b1b-ac9a-171c006d331f'
  and subject = 'Pathology' and division = 'Female Genital Tract' and type = 'practical';

update public.questions
set model_answer = $$Identification: Carcinoma of the vulva, most commonly vulvar squamous-cell carcinoma.

Gross features: an irregular exophytic, ulcerated, or infiltrative vulvar mass that may bleed or become secondarily infected.

Risk factors and associations: persistent high-risk HPV infection, vulvar intraepithelial neoplasia, smoking, immunosuppression, and chronic dermatoses such as lichen sclerosus. HPV-independent tumours are more common in older women.

Clinical features: pruritus, pain, a vulvar lump or ulcer, bleeding, discharge, dysuria, and dyspareunia. Regional spread is primarily to the superficial and deep inguinal and femoral lymph nodes, followed by pelvic nodes in advanced disease.

Complications: local destruction, infection, haemorrhage, urinary or sexual dysfunction, and metastatic disease. Diagnosis requires biopsy and treatment is based on stage.$$,
    source_flag = 'reviewed_practical_answer_2026_08_23'
where id = 'd9edb297-b1bf-4860-b5b9-e9f061679ad0'
  and subject = 'Pathology' and division = 'Female Genital Tract' and type = 'practical';

update public.questions
set model_answer = $$Identification: Ovarian cyst with torsion.

Gross features: an enlarged cystic ovary rotated around its vascular pedicle, with venous and lymphatic obstruction causing congestion, oedema, haemorrhage, and, in advanced cases, a dark red or necrotic appearance.

Clinical presentation: sudden severe unilateral lower-abdominal or pelvic pain, nausea and vomiting, adnexal tenderness, and sometimes fever or tachycardia.

Predisposing lesions: ovarian cysts and tumours, especially mobile benign cystic lesions such as a mature cystic teratoma or a functional cyst. Torsion may also occur in a normal ovary, particularly in children and adolescents.

Complications: haemorrhagic infarction, necrosis, rupture, peritonitis, adhesions, loss of ovarian function, and sepsis. Urgent gynaecological assessment is required.$$,
    source_flag = 'reviewed_practical_answer_2026_08_23'
where id = '1e351a99-c9f3-4463-b258-0a343627ef2c'
  and subject = 'Pathology' and division = 'Female Genital Tract' and type = 'practical';
