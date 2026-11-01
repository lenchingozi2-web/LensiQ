"""Reviewed repairs for MCQs that lack valid choices or have leaked explanations."""
REPAIRS = {
  '00b1c927-2604-4543-a620-aaa455a5ac12':{
    'stem':'Still on Medical Mycology',
    'changes':{
      'option_e':'None of the above.',
      'correct_answer':'E',
      'model_answer':'None of statements A–D is universally correct. Fungi reproduce by different sexual and asexual mechanisms; not every fungal species has a known sexual state, and the presence of asexual reproduction varies among groups.',
    },
  },
  '1c5044f1-ff08-44d2-a0a2-32c8ce10eb7b':{
    'stem':'Concerning malaria, which is correct?',
    'changes':{
      'type':'theory',
      'question_text':'Name the principal human malaria parasites, state the usual fever periodicity of each, and identify the definitive host.',
      'option_a':None,'option_b':None,'option_c':None,'option_d':None,'option_e':None,
      'model_answer':'Plasmodium falciparum causes malignant tertian malaria and often produces irregular fever; P. vivax and P. ovale typically cause benign tertian malaria with approximately 48-hour periodicity. P. malariae causes quartan malaria with approximately 72-hour periodicity, while P. knowlesi commonly has a 24-hour erythrocytic cycle. Plasmodium species are apicomplexan protozoa. The female Anopheles mosquito is the definitive host because sexual reproduction occurs in the mosquito.',
    },
  },
  '316ae841-65f1-418e-8ca2-822fdc0a15b9':{
    'stem':'Which of the following is true?',
    'changes':{
      'question_text':'Which of these biochemical and immunological associations are correct? Select all that apply.',
      'correct_answer':'A,B,C,D',
    },
  },
  '689cc223-1413-4598-a32b-4581b73c453e':{
    'stem':'Which of these is correct?',
    'changes':{'option_e':'None of the above.','correct_answer':'E'},
  },
  '98304372-61bd-464d-ac54-233a7dce62cc':{
    'stem':'Which is associated with increased risk of hyperkalemia?',
    'changes':{
      'question_text':'Which of the following can increase the risk of hyperkalaemia? Select all that apply.',
      'correct_answer':'A,B,C,D',
    },
  },
  'c3f8592c-981e-4f86-9c54-55a70ccb1d9e':{
    'stem':'Antigenic drift refers to?',
    'changes':{
      'question_text':'What best describes antigenic drift?',
      'option_a':'An abrupt major antigenic change due to reassortment of segmented viral genomes.',
      'option_b':'Replacement of one entire viral subtype by another through genome reassortment.',
      'option_c':'Reversible switching of antigen expression without heritable sequence change.',
      'option_d':'Gradual accumulation of point mutations in genes encoding viral antigens.',
      'option_e':'Complete disappearance of all viral surface antigens.',
      'correct_answer':'D',
      'model_answer':'Antigenic drift is a gradual antigenic change caused by accumulating point mutations in viral antigen genes. In influenza, mutations affecting haemagglutinin and neuraminidase may help the virus evade pre-existing immunity. Antigenic shift is a sudden major change, classically through genome reassortment.',
    },
  },
  'fe9a1e02-e482-4f76-8553-21a3581ae756':{
    'stem':'The following are examples of maleficence by commission EXCEPT:',
    'changes':{
      'option_d':'Administering a prescribed infusion as a rapid bolus, causing harm.',
      'option_e':'Failing to provide indicated treatment despite recognising the need for it.',
      'correct_answer':'E',
      'model_answer':'Maleficence by commission refers to harm caused by an inappropriate action. Options A–D describe harmful acts. Option E is an omission: failure to take an indicated action.',
    },
  },
  'fa152587-f65b-4ebc-bcd6-2c50e8dc8416':{
    'stem':'This shows 5 serologic profiles of individuals screened for hepatitis B.',
    'changes':{
      'option_a':'Profile A','option_b':'Profile B','option_c':'Profile C','option_d':'Profile D','option_e':'Profile E',
      'model_answer':'Profile B has positive anti-HBs with negative HBsAg and negative anti-HBc, consistent with immunity after hepatitis B vaccination rather than current or previous natural infection. Such a profile is compatible with donation, subject to the complete blood-donor eligibility assessment and all required infectious-disease screening.',
    },
  },
  '0666ddaf-1ebb-4e19-8c33-c65206589ffe':{
    'stem':'In FAB classification of Acute myeloid leukemia',
    'changes':{'option_e':'Acute megakaryoblastic leukaemia (M7)'},
  },
  '345387ab-e12f-4156-b69f-ffbd096821ee':{
    'stem':'Counter stains in Gram',
    'changes':{'option_d':'Basic fuchsin'},
  },
  'd1450431-636f-4e20-9705-8caed79f2728':{
    'stem':'The following is true about opsonisation',
    'changes':{
      'option_a':'Opsonins bind only to neutrophils, not to microbial surfaces.',
      'option_d':'Complement fragment C3a is the major opsonin involved in phagocytosis.',
    },
  },
  'ea943d18-a040-48be-9084-9e24803b77bd':{
    'stem':'Constriction of iris sphincter by pilocarpine',
    'changes':{'option_c':'Decreased inositol trisphosphate (IP3) production'},
  },
  'd8d23359-b628-4b1b-8320-73fbdff20633':{
    'stem':'Mr. X with blood type A marries Mrs. Y with blood type AB',
    'changes':{'option_d':'A'},
  },
  'b660fb49-29f3-4cde-bd03-0d8492855302':{
    'stem':'The antipyretic effects of NSAIDs',
    'changes':{
      'question_text':'What mechanism best explains the antipyretic action of NSAIDs?',
      'option_a':'Inhibition of prostaglandin E2 synthesis in the hypothalamus.',
      'option_d':'Stimulation of hypothalamic cyclooxygenase activity.',
      'model_answer':'NSAIDs inhibit cyclooxygenase-dependent synthesis of prostaglandin E2 in the hypothalamus, reducing the elevated thermoregulatory set point produced by pyrogenic cytokines.',
    },
  },
  'bd1af79d-7dfe-4af4-8734-e22753c9fbf5':{
    'stem':'Chylomicrons is made up of:',
    'changes':{'option_c':'30% triglyceride and 30% apoprotein'},
  },
  'f9e90652-14fb-4ff4-aab3-fb1ceab3f5ee':{
    'stem':'VLDL is made up of:',
    'changes':{
      'option_c':'30% triglyceride and 30% apoprotein',
      'option_d':'50% triglyceride and approximately 10% apoprotein',
      'model_answer':'VLDL particles are triglyceride-rich lipoproteins synthesised primarily by the liver. Their composition is approximately 50–70% triglyceride and 7–10% protein by mass, with the remainder mainly cholesterol and phospholipids. Option D is the closest composition.',
    },
  },
  'eac3ca91-b90c-4644-aafe-98cf40e226dc':{
    'stem':'The Zygomycota: which is correct?',
    'changes':{'option_b':'Have regularly septate, dichotomously branching hyphae.'},
  },

  '4f155dd3-6845-485c-b4d4-157d6bd45d94':{
    'stem':'Alvimopan is indicated in which condition',
    'changes':{
      'question_text':'Alvimopan is used to accelerate gastrointestinal recovery after which procedure?',
      'option_a':'Partial large- or small-bowel resection with primary anastomosis.',
      'option_b':'Elective cataract extraction.',
      'option_c':'Percutaneous coronary intervention.',
      'option_d':'Treatment of acute opioid overdose.',
      'option_e':'Migraine prophylaxis.',
      'correct_answer':'A',
      'model_answer':'Alvimopan is a peripherally acting mu-opioid receptor antagonist used in hospital to accelerate gastrointestinal recovery after partial bowel resection with primary anastomosis.',
    },
  },
  '7474d845-a405-4526-85fc-61f3e9cf2a09':{
    'stem':'Prior to an operation to remove a pheochromocytoma',
    'changes':{
      'question_text':'Which drug class is ordinarily started before resection of a functional phaeochromocytoma?',
      'option_a':'Alpha-adrenergic agonist.',
      'option_b':'Alpha-adrenergic antagonist, such as phenoxybenzamine.',
      'option_c':'Beta-adrenergic agonist.',
      'option_d':'Beta-adrenergic antagonist without prior alpha blockade.',
      'option_e':'Muscarinic receptor agonist.',
      'correct_answer':'B',
      'model_answer':'Adequate alpha-adrenergic blockade is generally established before surgery to limit catecholamine-induced hypertension. A beta-blocker may then be added for tachycardia, but must not precede alpha blockade.',
    },
  },
  '82dd20a5-fb25-4134-bf85-6b68c571d7ea':{
    'stem':'Which of the following is untrue of mifepristone?',
    'changes':{
      'question_text':'Which of the following statements about mifepristone is FALSE?',
      'option_a':'It is a progesterone-receptor antagonist.',
      'option_b':'It can be combined with misoprostol for medication abortion.',
      'option_c':'It also has antiglucocorticoid activity.',
      'option_d':'It stimulates progesterone receptors to maintain pregnancy.',
      'option_e':'It has a role in selected cases of hyperglycaemia due to endogenous Cushing syndrome.',
      'correct_answer':'D',
      'model_answer':'Mifepristone antagonises progesterone receptors, rather than stimulating them. It is used with misoprostol for medication abortion and, at different doses, can antagonise glucocorticoid receptors in selected patients with Cushing syndrome.',
    },
  },
  'ba4be7bc-09f9-4b28-98c5-4d894e75b88f':{
    'stem':'These lipoprotein particles transport fat from digestive tract to the liver',
    'changes':{
      'question_text':'Which lipoprotein carries absorbed dietary triglycerides from the intestine and ultimately delivers its remnants to the liver?',
      'option_a':'Very-low-density lipoprotein (VLDL).',
      'option_b':'Chylomicron.',
      'option_c':'Intermediate-density lipoprotein (IDL).',
      'option_d':'High-density lipoprotein (HDL).',
      'option_e':'Low-density lipoprotein (LDL).',
      'correct_answer':'B',
      'model_answer':'Chylomicrons transport dietary triglycerides from the intestine through the lymph and blood to peripheral tissues. Lipoprotein lipase removes much of their triglyceride; the cholesterol-rich remnants are then taken up by the liver.',
    },
  },
  'c167fdbd-b6da-4502-affe-50d3ee9f5fca':{
    'stem':'Which of the following regarding carbemazepine is FALSE?',
    'changes':{
      'question_text':'Which of the following statements about carbamazepine is FALSE?',
      'option_a':'It is extensively bound to plasma proteins.',
      'option_b':'It has a pharmacologically active 10,11-epoxide metabolite.',
      'option_c':'It induces hepatic drug-metabolising enzymes.',
      'option_d':'It cannot cause hyponatraemia.',
      'option_e':'It is used to treat focal-onset seizures.',
      'correct_answer':'D',
      'model_answer':'Carbamazepine can cause hyponatraemia, often associated with inappropriate antidiuretic hormone action. It is enzyme-inducing, has an active epoxide metabolite, and is used for focal-onset seizures.',
    },
  },

  '2db65ca4-53e3-4262-85ce-d4331ad0e77a':{
    'stem':'Cutaneous flushing is caused by;',
    'changes':{
      'question_text':'Which lipid-lowering drug commonly produces cutaneous flushing?',
      'option_a':'Atorvastatin.',
      'option_b':'Niacin (nicotinic acid).',
      'option_c':'Ezetimibe.',
      'option_d':'Colestipol.',
      'option_e':'Evolocumab.',
      'correct_answer':'B',
      'model_answer':'Niacin causes dose-related cutaneous flushing, largely through prostaglandin-mediated vasodilation. This adverse effect often limits its use as a lipid-modifying drug.',
    },
  },
  '6be995f8-1a07-4dad-91f8-351e557cf8d0':{
    'stem':'Which of the following is used in Familial hypercholesterolemia',
    'changes':{
      'question_text':'Which of the following drugs is a statin that may be used to reduce LDL cholesterol in familial hypercholesterolaemia?',
      'option_a':'Colestipol.',
      'option_b':'Ezetimibe.',
      'option_c':'Simvastatin.',
      'option_d':'Fenofibrate.',
      'option_e':'Niacin.',
      'correct_answer':'C',
      'model_answer':'Simvastatin is an HMG-CoA reductase inhibitor that lowers LDL cholesterol. Adults with familial hypercholesterolaemia generally require intensive LDL reduction, often with a high-intensity statin such as atorvastatin or rosuvastatin; other agents may be added when indicated.',
    },
  },

  '91be96b0-cf70-4d0b-98e8-4ac5c57ec5e5':{
    'stem':'Candida albicans, which is false?',
    'changes':{
      'option_e':'May cause vulvovaginal candidiasis.',
      'correct_answer':'C',
      'model_answer':'Candida albicans is an opportunistic yeast that is part of normal mucosal flora, commonly causes oral thrush after broad-spectrum antibiotics and can cause vulvovaginal candidiasis. Germ-tube formation is a useful presumptive identification feature. Although candiduria and Candida urinary infection occur, especially in susceptible patients, C. albicans is not a common cause of urinary tract infection in otherwise healthy men. Option C is false.',
    },
  },
}
