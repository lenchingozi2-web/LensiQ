#!/usr/bin/env python3
"""Apply editor-reviewed medical database corrections in one guarded transaction."""
import os
from repair_question_bank import PROJECT,query,quote
from repair_reviewed_medical_items import (
    KEYS,OPEN_QUESTIONS,EXACT,TEXT_REPLACE,
    MINOXIDIL_ID,MINOXIDIL_STEM,MINOXIDIL_ANSWER,
)
from repair_missing_medical_answers import ANSWERS

COLS=('type','correct_answer','question_text','model_answer','option_a','option_b','option_c','option_d','option_e')
ALL_IDS=sorted(set(KEYS)|set(OPEN_QUESTIONS)|set(EXACT)|set(TEXT_REPLACE)|set(ANSWERS)|{MINOXIDIL_ID})

def read_rows():
    ids=','.join(quote(ident)+'::uuid' for ident in ALL_IDS)
    results=query('SELECT id::text AS id,'+','.join(COLS)+' FROM public.questions WHERE id IN ('+ids+')',True)
    rows={str(row['id']):row for row in results}
    missing=set(ALL_IDS)-set(rows)
    if missing:raise RuntimeError('Missing reviewed records: '+','.join(sorted(missing)))
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
