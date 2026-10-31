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
  'eac3ca91-b90c-4644-aafe-98cf40e226dc':{
    'stem':'The Zygomycota: which is correct?',
    'changes':{'option_b':'Have regularly septate, dichotomously branching hyphae.'},
  },
}
