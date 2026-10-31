#!/usr/bin/env python3
"""One-day, access-controlled GitHub Actions review export of MEDICAL QUESTIONS ONLY.
No user identities, account records, payments, or authentication data are exported.
"""
import json, os
from collections import Counter
from repair_question_bank import query, quote, kind, transform, PROJECT

FIELDS=('id::text AS id','type','subject','division','topic','question_text',
        'option_a','option_b','option_c','option_d','option_e','correct_answer','model_answer','image_url')
def main():
    if os.getenv('LENXIQ_PROJECT_REF')!=PROJECT:raise RuntimeError('Incorrect project')
    pages=[];count=Counter();last=''
    while True:
        sql='SELECT '+','.join(FIELDS)+' FROM public.questions '
        if last:sql+='WHERE id::text>'+quote(last)+' '
        rows=query(sql+'ORDER BY id LIMIT 120',True)
        if not rows:break
        for row in rows:
            k=kind(row);count[k]+=1
            _,issues=transform(row)
            # No destructive changes. Preserve source text and answer key for clinical review.
            pages.append({'id':row['id'],'kind':k,'subject':row.get('subject'),
                'division':row.get('division'),'topic':row.get('topic'),
                'stem':row.get('question_text'),
                'options':{l:row.get('option_'+l.lower()) for l in 'ABCDE'},
                'answer':row.get('correct_answer'),
                'model_answer':row.get('model_answer'),
                'image_url':row.get('image_url') if k=='practical' else None,
                'issues':issues})
        last=str(rows[-1]['id'])
        if len(rows)<120:break
    temp=os.environ.get('RUNNER_TEMP','/tmp')
    path=os.path.join(temp,'lenxiq-medical-review.json')
    with open(path,'w',encoding='utf-8') as f:
        json.dump({'project':PROJECT,'counts':dict(count),'items':pages},f,ensure_ascii=False)
    print('Saved medical question review records:',len(pages))
    print('No student accounts or private user data exported.')
if __name__=='__main__':main()
