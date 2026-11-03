#!/usr/bin/env python3
"""Apply editor-reviewed medical database corrections in one guarded transaction."""
import os
import json
import hashlib
from repair_question_bank import PROJECT,query,quote
from repair_reviewed_medical_items import (
    KEYS,OPEN_QUESTIONS,EXACT,TEXT_REPLACE,
    MINOXIDIL_ID,MINOXIDIL_STEM,MINOXIDIL_ANSWER,
)
from repair_missing_medical_answers import ANSWERS
from reviewed_defective_mcqs import REPAIRS

SUPPLEMENTAL = json.loads(r'''[["02669888","67be1ff8364afaa4","Morphine is a strong opioid analgesic that acts mainly as a mu-opioid receptor agonist. Mu-receptor effects include analgesia, respiratory depression, euphoria, miosis, constipation and dependence. Kappa-receptor activation produces spinal analgesia, sedation and dysphoria."],["0c2649e4","4dc5c5606e3eb4c7","Tachyphylaxis is a rapid decrease in drug response after repeated doses given at short intervals. It may result from depletion of stored mediators or receptor desensitisation. Examples include ephedrine and repeated application of some topical nasal decongestants."],["0d011241","a4cebb029a7fb076","The classic opioid overdose triad is depressed consciousness, respiratory depression and pinpoint pupils. Bradycardia, hypotension and cyanosis may also occur. Management prioritises airway support, ventilation and naloxone when indicated."],["28063d5b","f021a54701d5816d","Paracetamol (acetaminophen) is a para-aminophenol derivative with analgesic and antipyretic actions and little peripheral anti-inflammatory activity. The principal serious toxicity in overdose is hepatic injury caused by accumulation of NAPQI. N-acetylcysteine is the antidote and is most effective when started early."],["2aaa934a","3817644cff32c979","Drug potency cannot be established from the listed tablet doses alone. Potency is compared using the dose or concentration required to achieve the same specified effect, often by an ED50 or EC50. A smaller prescribed dose does not by itself prove greater potency, because the drugs may differ in indication, formulation and maximum efficacy.","Which is more potent,400mg ibuprofen,40mg aspirin and 20mg Diclofenac","Can relative drug potency be determined solely by comparing 400 mg ibuprofen, 40 mg aspirin and 20 mg diclofenac? Explain."],["2ab7a4e5","bd9f4e251b4034ec","Triazole antifungals include fluconazole, itraconazole, voriconazole and posaconazole. Imidazoles include clotrimazole, miconazole and ketoconazole. Azoles inhibit fungal lanosterol 14-alpha-demethylase, reducing ergosterol synthesis in the fungal cell membrane."],["2ffd0ecf","4b06239c61e3f933","Beta-blockers such as propranolol are used to control tremor, tachycardia and other adrenergic symptoms while antithyroid drugs take effect. Iodide may be given briefly in selected situations, including preoperative preparation or thyroid storm, after appropriate thionamide treatment. Glucocorticoids and cholestyramine may be added in severe thyrotoxicosis or thyroid storm."],["34b5faa6","54fa4f9da9cecac5","Ketamine is a dissociative anaesthetic and an N-methyl-D-aspartate (NMDA) receptor antagonist. It produces analgesia, amnesia and a dissociative state; sympathetic stimulation often increases heart rate and blood pressure. Airway reflexes may be partly preserved, but airway obstruction and respiratory adverse events remain possible."],["50b15a44","8fa22e3970f8cc17","Leucovorin (folinic acid) rescue supplies reduced folate to normal cells following high-dose methotrexate treatment, limiting toxicity without requiring dihydrofolate reductase. Its timing and dosage depend on methotrexate exposure, serum levels and renal function. It is also used for selected forms of methotrexate toxicity."],["60c14c1a","4e204d96e70a23c9","Typical (first-generation) antipsychotics mainly antagonise dopamine D2 receptors and generally carry a higher risk of extrapyramidal adverse effects and hyperprolactinaemia. Atypical (second-generation) antipsychotics have varied dopamine and serotonin receptor actions and, on average, lower extrapyramidal risk, but they can still cause these effects. Several atypical drugs, particularly clozapine and olanzapine, have important metabolic adverse effects."],["670ac74f","65b02b2458c5ef62","Drugs active against asexual erythrocytic stages of malaria include artemisinin derivatives used in artemisinin-based combination therapy, chloroquine where parasites remain sensitive, quinine, mefloquine, lumefantrine and atovaquone-proguanil. Primaquine is used mainly against dormant liver hypnozoites of P. vivax and P. ovale and has gametocytocidal activity; it is not a routine stand-alone blood-stage treatment. Choice of regimen depends on parasite species, severity and resistance patterns."],["7073a514","5de0ef4193f3e9d8","The diuretic braking phenomenon is a diminished natriuretic response to continued diuretic therapy. Compensatory activation of sodium-retaining mechanisms, including the renin-angiotensin-aldosterone system and increased distal tubular sodium reabsorption, contributes to this effect. Management may require dietary sodium restriction, assessment of adherence and carefully selected combination diuretic therapy."],["8aae8a48","f1201878faf73dd0","Methotrexate is an antifolate antimetabolite that inhibits dihydrofolate reductase. Leucovorin (folinic acid) is used for rescue after high-dose methotrexate and in some cases of toxicity; hydration, urine alkalinisation and monitoring of renal function and methotrexate levels are also important. Severe delayed clearance with toxicity may require glucarpidase under specialist supervision."],["9aa995d4","2ef75ed9e4a6a99c","Vulvovaginal candidiasis usually occurs with a normal vaginal pH below 4.5. A raised pH suggests alternative or concurrent diagnoses such as bacterial vaginosis or trichomoniasis. Vaginal pH alone cannot confirm candidiasis; microscopy with saline or 10% KOH, culture or an appropriate molecular test is used when indicated."],["a0711fac","aa50a1f6839c772c","Indirect-acting cholinomimetics inhibit acetylcholinesterase, increasing acetylcholine at cholinergic synapses. Neostigmine and pyridostigmine are used in myasthenia gravis; neostigmine may reverse non-depolarising neuromuscular blockade and can be used in selected cases of postoperative ileus or urinary retention. Donepezil and rivastigmine are used for symptomatic treatment of some dementias. Their use depends on contraindications and the clinical setting."],["bf47fc4b","ce65d0483ea93994","Celecoxib is a selective cyclooxygenase-2 (COX-2) inhibitor. Aspirin irreversibly inhibits both COX-1 and COX-2; at low doses its antiplatelet effect arises mainly from suppression of platelet COX-1 and thromboxane A2 synthesis. COX-2 selectivity generally reduces some gastrointestinal adverse effects but does not eliminate cardiovascular or renal risks."],["f1af4657","87ae152e2465856b","OD is sometimes used to mean once daily, but it can also mean right eye in ophthalmic prescriptions, so writing the intended instruction in full is safer. QDS means four times daily; PRN means as needed; IM means intramuscular. Prescription instructions should avoid ambiguous abbreviations and specify the intended route, dose and frequency.","Prescription abbreviations O.D S PRN IM - what do they mean?","Explain the meanings of OD, QDS, PRN and IM in prescriptions, including the ambiguity of OD."],["f3285205","c9187797faf1048f","H2-receptor antagonists and proton-pump inhibitors (PPIs) are not generally contraindicated as drug classes. Their use depends on the patient's condition and interactions. Cimetidine inhibits several cytochrome P450 enzymes, while selected PPIs can affect absorption of drugs requiring gastric acidity; omeprazole and esomeprazole may also reduce activation of clopidogrel. Drug-specific contraindications and precautions should be checked.","why is use of H2 blockers and PPIs contraindicated","What important drug interactions and precautions should be considered when prescribing H2-receptor antagonists and proton-pump inhibitors?"],["ff506ced","950fab5259712753","Non-contraceptive benefits of combined oral contraceptives include more regular menstrual cycles, reduced dysmenorrhoea and menstrual blood loss, improvement in acne and some symptoms of hyperandrogenism, and reduced risks of endometrial and ovarian cancers. They do not protect against breast cancer; current or recent use is associated with a small increase in breast cancer risk in observational studies."],["0ca8b3ac","a08136ee3b82507a","A plethysmometer is used to measure paw oedema in experimental inflammation models. A cotton-pellet granuloma model may be used to study proliferative inflammation, with appropriate weighing instruments. An analgesymeter measures nociceptive responses and is primarily used in pain studies rather than as a direct measure of inflammation."],["2c05c07a","3b64aedc874172c7","Minoxidil is a potassium-channel opener and arteriolar vasodilator. Topical minoxidil is used to promote hair growth in androgenetic alopecia. Its precise effect on hair follicles is incompletely understood, but it can prolong the anagen growth phase. Hypertrichosis and scalp irritation are recognised adverse effects."],["55701982","460a72f050620720","Calcium disodium edetate (CaNa2EDTA) is a chelating agent used for significant lead poisoning. Other agents include succimer for selected patients and dimercaprol in combination with CaNa2EDTA for severe poisoning with encephalopathy. Treatment depends on the blood lead concentration, symptoms and specialist toxicology guidance."],["5689fff8","cd90f95efbcda44c","The Schaeffer–Fulton endospore stain uses malachite green with heat to drive dye into bacterial spores, followed by water rinsing and safranin counterstaining. Endospores stain green and vegetative cells stain pink or red. The test demonstrates spores in organisms such as Bacillus and Clostridium."],["86ae6b70","9f46f5880c507f6c","Bacterial capsules may be demonstrated using negative staining with India ink or nigrosin, or a capsule-staining method such as Anthony's technique. The capsule appears as a clear halo around the bacterial cell against the stained background. Capsule demonstration helps identify encapsulated organisms, but a negative result does not exclude capsule production."],["9e89b939","15b5af90d5727f61","Flumazenil is a competitive antagonist at the benzodiazepine binding site on the GABA-A receptor. It can reverse benzodiazepine sedation in selected situations but is not routinely given in undifferentiated overdose because it may provoke seizures, especially in benzodiazepine-dependent patients or mixed overdoses. Airway and respiratory support remain essential."],["aae773a0","9609d9aa222b7dbf","Ketamine produces dissociative anaesthesia, with profound analgesia and amnesia through NMDA receptor antagonism. It often stimulates the sympathetic nervous system and may preserve spontaneous breathing, although full airway monitoring and resuscitation capability are still required."],["c189623a","c9f6f28e0e9fe982","Benzodiazepines are positive allosteric modulators of GABA-A receptors. They are used for acute seizures or status epilepticus, anxiolysis, sedation, procedural anaesthesia adjuncts and selected sleep disorders. They can cause respiratory depression, especially with other sedatives, and long-term use may cause dependence."],["d3f481c1","037c877f3f9c38a2","Tolerance develops to many effects of morphine, but little or no tolerance usually develops to its constipation and pupillary constriction (miosis). Both may persist during chronic treatment. Respiratory depression and analgesic effects are more subject to tolerance, although overdose remains dangerous."],["d5d6b546","3d137581cb76f899","Deferoxamine (desferrioxamine) is an iron-chelating antidote used for severe acute iron poisoning, usually by intravenous infusion. Management also includes supportive care and appropriate gastrointestinal assessment. Oral iron chelators such as deferasirox are used mainly for chronic iron overload, not as the standard treatment of acute poisoning."],["fe0eea27","cc8c093b29d97b05","Ziehl–Neelsen staining demonstrates acid-fast bacilli such as Mycobacterium tuberculosis. Carbol fuchsin is applied with heat, the slide is decolourised with acid-alcohol, and a methylene-blue counterstain is added. Acid-fast organisms retain red staining while non-acid-fast material appears blue. Auramine-based fluorescent staining is another method."],["d2af62f5","NULL","A hydrocele is an abnormal collection of serous fluid within the tunica vaginalis surrounding the testis. The sac usually has a smooth fibrous wall and contains clear, straw-coloured fluid. A scrotal swelling may transilluminate, but ultrasound is useful if the diagnosis is uncertain or the testis cannot be examined. Causes include congenital persistence of the processus vaginalis and acquired inflammation or injury."],["a8cffe40","NULL","Conjoined twins arise from incomplete separation of a monozygotic embryonic disc, producing twins joined at part of the body. Major forms include thoracopagus, omphalopagus, pygopagus and craniopagus. The twins may share organs, particularly the heart or liver, depending on the site of union. Prenatal ultrasound and other imaging help define anatomy and assess whether surgical separation is feasible."],["b7ac9baa","NULL","Anaerobic culture is used to isolate organisms that grow poorly or not at all in oxygen. Appropriate deep tissue or aspirated specimens should be collected and transported in oxygen-limiting systems. Culture methods include anaerobic jars or chambers, reducing media such as thioglycollate broth and suitable pre-reduced agar. An anaerobic indicator verifies low-oxygen conditions, and incubation and identification follow the laboratory protocol."],["3459dab1","NULL","The eyepiece and objective lenses magnify the specimen; the revolving nosepiece selects objective magnification. The stage holds the slide, while the condenser focuses light onto it. The iris diaphragm controls the light cone and contrast. Coarse adjustment provides initial focus at low power, and fine adjustment sharpens the image. The illuminator supplies light. Oil immersion is used with the appropriate high-power objective."],["8e95cef1","NULL","A Jamshidi trephine biopsy needle is used to obtain a core of bone marrow, usually from the posterior iliac crest, for assessment of marrow cellularity, architecture, fibrosis and infiltration. Bone marrow aspiration, obtained with a suitable aspiration needle, is more useful for studying individual cell morphology. The two procedures provide complementary information."],["1c8c24d9","ece1711a73908c7d","Quantitative nucleic acid amplification tests measure pathogen nucleic acid levels, commonly reported as copies/mL or international units/mL. In HIV infection, serial plasma viral loads assess response to antiretroviral therapy, adherence and possible virological failure. Results must be interpreted using the assay's detection limit and the clinical context."],["07ac210f","67c42a2ec347308b","Important viral haemorrhagic fever agents include Lassa virus (Arenaviridae), Ebola and Marburg viruses (Filoviridae), Crimean–Congo haemorrhagic fever virus (Nairoviridae), and yellow fever and dengue viruses (Flaviviridae). The illnesses vary in transmission, organ involvement and bleeding risk; not every infected patient develops haemorrhage. Diagnosis generally relies on appropriate molecular or antigen testing with strict infection-prevention measures."],["1cd1d69b","51aa4608287db110","Candida albicans is a budding yeast that may form pseudohyphae and true hyphae and is part of normal mucosal flora. It causes oral thrush, vulvovaginal candidiasis and invasive infection, especially in susceptible hosts. Germ-tube formation is a useful presumptive identification feature, while culture and species identification are important in invasive disease. Some other Candida species differ in morphology and antifungal susceptibility."],["284e1dc0","9da68076ef0d2297","HIV gag encodes structural proteins including matrix p17 and capsid p24; pol encodes reverse transcriptase, integrase and protease; and env produces gp120 and gp41, responsible for receptor binding and membrane fusion. Regulatory proteins include Tat, which enhances transcription, and Rev, which regulates RNA export. Accessory proteins such as Nef, Vif, Vpr and Vpu contribute to immune evasion, viral replication or particle release."],["415fb34d","15f65cb6a071387c","Establishment of infection generally involves exposure through a portal of entry, adhesion to host tissues, colonisation or invasion, multiplication, and evasion of host defences. Virulence factors and host susceptibility influence whether disease develops. Some pathogens produce toxins or spread through blood, lymph or nerves. The infection may then be cleared, become persistent or be transmitted to another host."],["36def9df","952744090df2f5d5","Cystoisospora belli is an intestinal coccidian protozoan transmitted by ingestion of environmentally mature oocysts. It causes watery diarrhoea, weight loss and malabsorption, sometimes severe or prolonged in patients with advanced HIV infection. Diagnosis is by identifying relatively large oval oocysts in stool using concentration and modified acid-fast staining or molecular methods. Trimethoprim-sulfamethoxazole is the treatment of choice."],["8fe9c035","48cb8044a30419ec","Important opportunistic fungi include Candida species, Aspergillus species, Cryptococcus neoformans/gattii, Pneumocystis jirovecii and the Mucorales (such as Rhizopus). Histoplasma capsulatum and Talaromyces marneffei can also cause disseminated disease in susceptible patients. The manifestations depend on the organism and host immunity, ranging from mucosal infection to pneumonia, meningitis or disseminated fungal disease."],["b9fbc83a","1d732de206c33fd7","Major antiretroviral drug classes include nucleoside/nucleotide reverse transcriptase inhibitors (NRTIs), non-nucleoside reverse transcriptase inhibitors (NNRTIs), integrase strand transfer inhibitors (INSTIs), protease inhibitors, fusion inhibitors, CCR5 antagonists and post-attachment inhibitors. Examples include tenofovir and lamivudine (NRTIs), efavirenz (NNRTI), dolutegravir (INSTI) and darunavir (protease inhibitor). Combination antiretroviral therapy targets multiple stages of the viral life cycle."],["cd1d0b93","647edf4fed76b317","Vulvovaginal candidiasis is suggested by pruritus, vulval erythema and a thick discharge, often with normal vaginal pH below 4.5. Saline or 10% KOH microscopy may show budding yeast and pseudohyphae. Culture or an appropriate molecular assay is useful when microscopy is negative despite symptoms, for recurrent disease or for suspected non-albicans Candida. A positive culture without symptoms does not necessarily require treatment."],["d7b6c4ad","db9fed2834c6711b","D is false. HIV infection may increase the likelihood of recurrent vulvovaginal candidiasis, but not every woman living with HIV develops it. Oral thrush can form white mucosal plaques, and vulvovaginal candidiasis commonly causes itching and discharge. Oral fluconazole is an option for uncomplicated vulvovaginal candidiasis in appropriate nonpregnant patients, although susceptibility differs among Candida species.","On candidiasis:","Which statement about candidiasis is FALSE?"],["308623ed","cc210cebd802766f","B is false. Pneumocystis jirovecii is a fungus, not a protozoan. It causes opportunistic pneumonia in immunocompromised individuals and is acquired by inhalation of airborne organisms. Giemsa stain may demonstrate nuclear material, and mature cysts contain up to eight intracystic bodies."]]''')
MCQ_FIXES = json.loads(r'''[["4803501d","question_text","The following are part of the quadruple test:","Which of the following is NOT included in the second-trimester quadruple screening test?"],["55487e9c","question_text","On candidosis;","Which statement about candidiasis is FALSE?"],["55487e9c","option_d","HIV positive females suffer from recurrent vaginal candidiasis.","Women living with HIV may develop recurrent vulvovaginal candidiasis, particularly when immunity is impaired."],["67e7980f","question_text","Which of the following describes the arrangement of flagella in bacteria?","Which of the following is NOT a standard name for an arrangement of bacterial flagella?"],["83a687fe","question_text","Chickenpox","Which statement about chickenpox is FALSE?"],["d7b6c4ad","option_e","All candida infection can be easily treated with Fluconazole.","Oral fluconazole can treat uncomplicated vulvovaginal candidiasis in appropriate nonpregnant patients."],["db1f0dce","question_text","The spleen","Which statement correctly describes the white pulp of the spleen?"],["dcb0f522","question_text","Concerning Yersinia spp","Which statement concerning Yersinia pestis and plague is FALSE?"],["308623ed","option_c","Spreads from person to person face‑orally.","It is transmitted through inhalation of airborne organisms."]]''')

COLS=('type','correct_answer','question_text','model_answer','option_a','option_b','option_c','option_d','option_e')
ALL_IDS=sorted(set(KEYS)|set(OPEN_QUESTIONS)|set(EXACT)|set(TEXT_REPLACE)|set(ANSWERS)|set(REPAIRS)|{MINOXIDIL_ID})

def read_rows():
    ids=','.join(quote(ident)+'::uuid' for ident in ALL_IDS)
    results=query('SELECT id::text AS id,'+','.join(COLS)+' FROM public.questions WHERE id IN ('+ids+')',True)
    rows={str(row['id']):row for row in results}
    missing=set(ALL_IDS)-set(rows)
    if missing:raise RuntimeError('Missing reviewed records: '+','.join(sorted(missing)))
    # Retrieve only the explicitly reviewed supplementary question records.
    prefixes=sorted(set([entry[0] for entry in SUPPLEMENTAL]+[entry[0] for entry in MCQ_FIXES]))
    matched=query('SELECT id::text AS id,'+','.join(COLS)+' FROM public.questions WHERE left(id::text,8) IN ('+
                  ','.join(quote(p) for p in prefixes)+')',True)
    seen={}
    for item in matched:
        prefix=item['id'][:8]
        if prefix in seen:raise RuntimeError('Ambiguous supplementary question prefix: '+prefix)
        seen[prefix]=item
    if set(seen)!=set(prefixes):
        raise RuntimeError('Missing supplementary reviewed question records')
    rows.update({item['id']:item for item in matched})
    return rows

def main():
    if os.getenv('LENXIQ_PROJECT_REF')!=PROJECT:raise RuntimeError('Unexpected Supabase project')
    rows=read_rows()
    proposed={}
    def set_value(ident,column,old,new):
        current=rows[ident].get(column)
        if current==new:return
        if current!=old:
            raise RuntimeError('Source changed for '+ident+' '+column+'; no write performed')
        if column not in COLS:raise RuntimeError('Disallowed column')
        proposed.setdefault(ident,{})[column]=(old,new)

    for ident,(old,new) in KEYS.items():
        lead=str(rows[ident].get('model_answer') or '').split('\n',1)[0].lower()
        normalized=new.lower().replace(',',' and ')
        if normalized not in lead:
            raise RuntimeError('Answer explanation does not support corrected key: '+ident)
        set_value(ident,'correct_answer',old,new)

    for ident in OPEN_QUESTIONS:
        if any(rows[ident].get('option_'+letter) for letter in 'abcde'):
            raise RuntimeError('Expected optionless question: '+ident)
        set_value(ident,'type','mcq','theory')

    for ident,cols in EXACT.items():
        for col,(old,new) in cols.items():set_value(ident,col,old,new)

    for ident,cols in TEXT_REPLACE.items():
        for col,(before,after) in cols.items():
            current=rows[ident].get(col)
            if not isinstance(current,str):
                raise RuntimeError('Expected clinical text missing: '+ident)
            if before not in current:
                if after in current:continue
                raise RuntimeError('Expected clinical fragment missing: '+ident)
            set_value(ident,col,current,current.replace(before,after))

    stem='Potassium channel blocker used for treating androgenic alopecia'
    set_value(MINOXIDIL_ID,'question_text',stem,MINOXIDIL_STEM)
    set_value(MINOXIDIL_ID,'model_answer','Minoxidil',MINOXIDIL_ANSWER)

    for ident,answer in ANSWERS.items():
        existing=rows[ident].get('model_answer')
        if existing==answer:continue
        if existing is not None and len(existing.strip())>70:
            raise RuntimeError('Detailed source answer protected: '+ident)
        if existing is not None and existing.strip() and existing.strip()!=str(rows[ident].get('question_text') or '').strip():
            raise RuntimeError('Source answer is not a placeholder: '+ident)
        set_value(ident,'model_answer',existing,answer)

    for ident,repair in REPAIRS.items():
        current=rows[ident]
        stem=str(current.get('question_text') or '')
        target_stem=repair['changes'].get('question_text')
        if not stem.startswith(repair['stem']) and stem!=target_stem:
            raise RuntimeError('Question wording differs from reviewed source: '+ident)
        for field,new in repair['changes'].items():
            set_value(ident,field,current.get(field),new)

    for prefix,field,original,replacement in MCQ_FIXES:
        ident=next((ident for ident in rows if ident.startswith(prefix)),None)
        if ident is None:raise RuntimeError('MCQ repair question missing: '+prefix)
        set_value(ident,field,original,replacement)

    for entry in SUPPLEMENTAL:
        prefix,expected_hash,new_answer=entry[:3]
        ident=next((ident for ident in rows if ident.startswith(prefix)),None)
        if ident is None:raise RuntimeError('Supplementary question absent: '+prefix)
        old_answer=rows[ident].get('model_answer')
        fingerprint='NULL' if old_answer is None else hashlib.sha256(old_answer.encode('utf-8')).hexdigest()[:16]
        if old_answer != new_answer and fingerprint != expected_hash:
            raise RuntimeError('Source answer changed; refused to overwrite: '+prefix)
        set_value(ident,'model_answer',old_answer,new_answer)
        if len(entry)==5:
            set_value(ident,'question_text',entry[3],entry[4])

    if not proposed:
        print('No outstanding reviewed medical corrections; live rows already match.')
        return

    batch=[]
    for ident,columns in proposed.items():
        setters=[];guards=[]
        for field,(old,new) in columns.items():
            setters.append(field+'='+('NULL' if new is None else quote(new)))
            guards.append(field+' IS NOT DISTINCT FROM '+('NULL' if old is None else quote(old)))
        batch.append('UPDATE public.questions SET '+','.join(setters)+' WHERE id='+quote(ident)+
                     '::uuid AND '+' AND '.join(guards)+';')
    ids=','.join(quote(ident)+'::uuid' for ident in proposed)
    statements=(
        'BEGIN;\n'
        'INSERT INTO lensiq_internal.question_repair_backup(question_id, original_record) '
        'SELECT id,to_jsonb(q) FROM public.questions q WHERE id IN ('+ids+') '
        'ON CONFLICT (question_id) DO NOTHING;\n'
        +'\n'.join(batch)+'\nCOMMIT;'
    )
    query(statements)
    updated=read_rows()
    for ident,columns in proposed.items():
        for field,(_,new) in columns.items():
            if updated[ident].get(field)!=new:
                raise RuntimeError('Database verification failed: '+ident+' / '+field)
    fields=sum(len(v) for v in proposed.values())
    print('Supabase correction verified: '+str(len(proposed))+' records, '+str(fields)+' fields.')
    if os.getenv('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'],'a',encoding='utf-8') as f:
            f.write('\n### Confirmed medical content edits\n'+
                    '- Records changed and verified: **'+str(len(proposed))+'**\n'+
                    '- Corrected fields: **'+str(fields)+'**\n'+
                    '- Original records retained in the private backup table.\n')

if __name__=='__main__':main()
