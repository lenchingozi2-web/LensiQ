#!/usr/bin/env python3
"""Specific, reviewed corrections to the LenxiQ medical question bank."""
import os
from repair_question_bank import query, quote, PROJECT

# These key combinations are independently confirmed by the complete answer
# explanations and the corresponding answer choices in the medical database.
KEYS = {
    '0e4efbc1-56e6-4a7d-81aa-0e7f33de7c12':('A,A,D,B','A,B'),
    '39421ae4-4ce6-40a6-bb91-2e28d01d2e12':('D,A,D,E','D,E'),
    '3a1c37b8-aeb5-4e30-acc9-bf317f42f705':('C,A,D,D','C,D'),
    '3ece34b2-78bd-4815-ae95-38b2e89a644a':('A,A,D,E','A,E'),
    '422ae78d-4b96-4c17-9e09-7b3353d17d2b':('A,A,D,C','A,C'),
    '4f8082af-d8b9-4138-a568-f9471253299a':('A,A,D,C','A,C'),
    'd18d6726-668b-4d5a-b927-8c1bbbbde77a':('A,A,D,E','A,E'),
    'd9b41999-ab42-48f8-9190-4ffe057c6369':('D,A,D,E','D,E'),
    'eb19ad52-36c3-4606-b2c6-80475790b6a8':('C,A,D,D','C,D'),
    'f2106dc8-d86b-40b2-9991-5f558cc003d7':('A,A,D,C','A,C'),
    'f4f69232-ce05-4467-a192-3141ead47b44':('C,A,D,D','C,D'),
    'ff28e7fa-c0f3-4610-a5fa-82b3423183e3':('C,A,D,D','C,D'),
}
# These are short-answer questions with no answer options; they are not MCQs.
OPEN_QUESTIONS = (
    '14222cfe-46c1-4f95-a66a-3e6b1299cb74',
    '2fc7b4bc-6de9-4901-9e5b-74ae94fe1f42',
    '317d2eb8-0be3-4fe5-948f-753d532631f1',
    '498739dd-ad7e-4da9-a23e-3b8caa5fa753',
    '4fb46cf0-db81-41de-ae00-28be18a2120c',
    '57b6604d-e045-457d-b845-7f7ee9381702',
    '74c1bc07-b9e7-4fd8-b318-d62dc4b47ef3',
    '94749034-fb8a-4021-baf5-467f7109c323',
    'b2387399-2935-4ec9-b565-8825dc7b5998',
    'bc0366c8-6d87-460f-86e8-27af7a0cad87',
    'c25d173f-b674-48cd-8dc2-dad4380f1030',
    'c5676142-5365-4f62-ba6e-2a022c45341d',
    'f4423f3d-6b5b-47d6-b961-1b58bc0ed4',
)
PENICILLIN_ANSWER = (
    'Penicillins are beta-lactam antibiotics that bind penicillin-binding proteins '
    '(transpeptidases) and inhibit cross-linking of bacterial cell-wall peptidoglycan. '
    'This weakens the cell wall and leads to osmotic lysis of susceptible growing bacteria.'
)
RED_CELL_ANSWER = (
    'The polychromatophilic normoblast (polychromatic erythroblast) is the first stage '
    'with cytoplasm visibly showing newly synthesised haemoglobin on a Romanowsky-stained '
    'smear. Basophilic normoblasts synthesise haemoglobin earlier, but their cytoplasm '
    'is still predominantly basophilic.'
)
EXACT = {
    '14222cfe-46c1-4f95-a66a-3e6b1299cb74':{
        'model_answer':(None,PENICILLIN_ANSWER),
    },
    '2a6f3b89-71df-465f-8e31-574a6a8ce460':{
        'model_answer':(None,PENICILLIN_ANSWER),
    },
    '498739dd-ad7e-4da9-a23e-3b8caa5fa753':{
        'model_answer':(
            'The basophilic normoblast: patches of newly synthesized haemoglobin appear pink against blue-staining RNA, giving a mixed (polychromatic) appearance in the next stage.',
            RED_CELL_ANSWER),
    },
}
TEXT_REPLACE = {
    '0cf244e9-b88e-49a0-b672-b2bfccee23af': {
        'model_answer': ('every 7 hours for P. malariae', 'every 72 hours for P. malariae'),
    },
    '4f155dd3-6845-485c-b4d4-157d6bd45d94': {
        'question_text': ('Alvimopam','Alvimopan'),
    },
    '82dd20a5-fb25-4134-bf85-6b68c571d7ea': {
        'question_text': ('Mifeprostone','mifepristone'),
    },
    'c7f795b3-c87b-4fbe-a817-18011c6a31fa': {
        'question_text': ("Chron’s Disease","Crohn's disease"),
    },
    '9e89b939-5d15-4aad-959b-3677d5dba88f': {
        'question_text': ('benzodiazepenes','benzodiazepines'),
    },
}
# Clinical correction: minoxidil OPENS ATP-sensitive potassium channels.
MINOXIDIL_ID = '2c05c07a-1c54-49b7-a785-67a70d3b2595'
MINOXIDIL_STEM = 'Potassium channel opener used for treating androgenetic alopecia'
MINOXIDIL_ANSWER = 'Minoxidil.'

FIELDS=('type','correct_answer','question_text','model_answer','option_a','option_b','option_c','option_d','option_e')
def snapshot(ident):
    rows=query('SELECT id::text as id,'+','.join(FIELDS)+
        ' FROM public.questions WHERE id='+quote(ident)+'::uuid',True)
    if len(rows)!=1:raise RuntimeError('Missing question '+ident)
    return rows[0]

def apply_one(ident,expected,updates):
    if not updates:return False
    row=snapshot(ident)
    for col,value in expected.items():
        if row.get(col)!=value:
            if all(row.get(k)==v for k,v in updates.items()):return False
            raise RuntimeError('Source has changed since medical review for '+ident+' column '+col)
    setters=', '.join(k+'='+('NULL' if v is None else quote(v)) for k,v in updates.items())
    guards=' AND '.join(
        k+' IS NOT DISTINCT FROM '+('NULL' if v is None else quote(v))
        for k,v in expected.items()
    )
    statement=("BEGIN; INSERT INTO lensiq_internal.question_repair_backup(question_id,original_record) "
        "SELECT id,to_jsonb(q) FROM public.questions q WHERE id="+quote(ident)+"::uuid "
        "ON CONFLICT (question_id) DO NOTHING; "
        "UPDATE public.questions SET "+setters+" WHERE id="+quote(ident)+"::uuid AND "+guards+"; COMMIT;")
    query(statement)
    current=snapshot(ident)
    if any(current.get(k)!=v for k,v in updates.items()):
        raise RuntimeError('Database verification did not match expected result for '+ident)
    return True

def main():
    if os.getenv('LENXIQ_PROJECT_REF')!=PROJECT:raise RuntimeError('Incorrect medical project')
    count=0
    for ident,(old,new) in KEYS.items():
        row=snapshot(ident)
        # Verify explanatory lead; do not adjust composite keys without the
        # source explanation identifying exactly the intended options.
        lead=str(row.get('model_answer') or '').split('\n',1)[0].lower()
        canonical=new.lower().replace(',',' and ')
        acceptable=(new.lower().replace(',',' and ') in lead or
                    new.lower().replace(',',' , ') in lead or
                    new.lower().replace(',',' , ') in lead.replace(', ', ' , '))
        if not acceptable:
            # "A and C." etc are present; if the text differs, stop.
            raise RuntimeError('Explanation differs from intended answer for '+ident)
        count+=apply_one(ident,{'correct_answer':old},{'correct_answer':new})
    for ident in OPEN_QUESTIONS:
        row=snapshot(ident)
        if any(row.get('option_'+letter) for letter in 'abcde'):
            raise RuntimeError('Open-ended item unexpectedly has options: '+ident)
        count+=apply_one(ident,{'type':'mcq'},{'type':'theory'})
    for ident,changes in EXACT.items():
        for field,(old,new) in changes.items():
            count+=apply_one(ident,{field:old},{field:new})
    for ident,replaces in TEXT_REPLACE.items():
        row=snapshot(ident)
        for field,(before,after) in replaces.items():
            old=row.get(field)
            if not isinstance(old,str):raise RuntimeError('Expected nonempty source '+ident)
            if before not in old:
                if after in old:continue
                raise RuntimeError('Source text does not match '+ident)
            changed=old.replace(before,after)
            count+=apply_one(ident,{field:old},{field:changed})
    # Targeted pharmacology correction; no arbitrary replacement of an option.
    row=snapshot(MINOXIDIL_ID)
    if row.get('question_text')=='Potassium channel blocker used for treating androgenic alopecia':
        count+=apply_one(MINOXIDIL_ID,{'question_text':row['question_text'],'model_answer':'Minoxidil'},
            {'question_text':MINOXIDIL_STEM,'model_answer':MINOXIDIL_ANSWER})
    elif row.get('question_text')!=MINOXIDIL_STEM:
        raise RuntimeError('Minoxidil source has changed')
    print('Reviewed question-bank records modified and verified:',count)
    if os.getenv('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'],'a',encoding='utf-8') as f:
            f.write('\n### Reviewed medical corrections\n- Verified record-field edits: **'+str(count)+'**\n'
                    '- Original question rows retained in private backup.\n')
if __name__=='__main__':main()
