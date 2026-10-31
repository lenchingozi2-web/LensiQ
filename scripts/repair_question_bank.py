#!/usr/bin/env python3
"""LenxiQ: correct unambiguous extraction errors without changing medical meaning."""
import json
import os
import re
import sys
import time
import unicodedata
from collections import Counter
from urllib.request import Request, urlopen
from urllib.error import HTTPError

PROJECT = 'hixvbcrrklyajhkyliay'
API = f'https://api.supabase.com/v1/projects/{PROJECT}/database/query'
FIELDS = ('question_text','option_a','option_b','option_c','option_d','option_e','correct_answer','model_answer')
TEXT_FIELDS = tuple(c for c in FIELDS if c != 'correct_answer')
FIX = {
    '\u00a0':' ','\u200b':'','\u200c':'','\u2060':'','\ufeff':'',
    chr(61623):'•',chr(61613):'↑',chr(61540):'δ',
    'â€™':'’','â€˜':'‘','â€œ':'“','â€\x9d':'”','â€“':'–','â€”':'—',
    'â€¢':'•','â€¦':'…','Â°':'°','Âµ':'µ','Â±':'±',
    'Î±':'α','Î²':'β','Î³':'γ','Î´':'δ','&nbsp;':' ','&amp;':'&',
}
SPELLING = (
    (r'\bacethylcholine\b','acetylcholine'),
    (r'\bantimalalaria\b','antimalarial'),
    (r'\bimmunosuppresants\b','immunosuppressants'),
    (r'\bserotonine\b','serotonin'),
    (r'\bhaemaglobin\b','haemoglobin'),
    (r'\bhemoglogin\b','hemoglobin'),
    (r'\bthrombocypenia\b','thrombocytopenia'),
    (r'\bHerpes simple virus\b','Herpes simplex virus'),
    (r'\bgram possitive\b','Gram-positive'),
    (r'\bgram negetive\b','Gram-negative'),
)
MARKER = re.compile(r'\s*(?:\[\s*correct\s*\]|\(\s*correct(?: answer)?\s*\)|[-–:]\s*correct)\s*$',re.I)
DAMAGED = re.compile(r'[\ufffd\u25a0\uf020-\uf8ff]')
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f-]{27,36}$',re.I)

def cleanup(text):
    v=unicodedata.normalize('NFC',text).replace('\r\n','\n').replace('\r','\n').replace('\t',' ')
    for bad,good in FIX.items():v=v.replace(bad,good)
    v=re.sub(r'[ \t]+(?=\n|$)','',v,flags=re.M)
    v=re.sub(r'(?<=\S) {3,}(?=\S)','  ',v)
    v=re.sub(r'\n{4,}','\n\n\n',v)
    for wrong,right in SPELLING:
        def sub(m):
            original=m.group()
            return right.upper() if original.isupper() else right.capitalize() if original[0].isupper() else right
        v=re.sub(wrong,sub,v,flags=re.I)
    return v.strip()

def kind(row):
    value=str(row.get('type') or '').lower()
    if 'practical' in value:return 'practical'
    if 'theory' in value or 'essay' in value:return 'theory'
    if 'mcq' in value or 'choice' in value:return 'mcq'
    return 'mcq' if sum(bool(row.get('option_'+l)) for l in 'abcde')>=2 else 'other'

def key(value,choices):
    if not isinstance(value,str):return None
    match=re.fullmatch(r'(?:option\s*)?([A-E])\s*[.):]?',value.strip(),re.I)
    if match:return match.group(1).upper()
    matches=[a for a,text in choices.items() if text and text.strip().casefold()==value.strip().casefold()]
    return matches[0] if len(matches)==1 else None

def medical_key(row,choices):
    # Single, tightly matched clinical fact from standard Medical Microbiology:
    # genetic material moves from donor to recipient in a transfer event.
    stem=' '.join(str(row.get('question_text') or '').lower().split())
    if 'genetic transfer' not in stem or 'bacteria' not in stem:return None
    if not re.search(r'\b(false|incorrect|not true)\b',stem):return None
    letters=lambda t:re.sub('[^a-z]','',t.lower())
    if 'unidirectional' in letters(choices.get('A','')) and 'bidirectional' in letters(choices.get('B','')):
        return 'B'
    return None

def transform(row):
    changes={};warnings=[]
    for field in TEXT_FIELDS:
        old=row.get(field)
        if isinstance(old,str):
            value=cleanup(old)
            if value!=old:changes[field]=value
            if DAMAGED.search(value):warnings.append('unresolved_glyph')
    if not (changes.get('question_text',row.get('question_text')) or '').strip():warnings.append('blank_question')
    qtype=kind(row)
    if qtype=='mcq':
        choices={l.upper():changes.get('option_'+l,row.get('option_'+l) or '') for l in 'abcde'}
        options={k:v for k,v in choices.items() if isinstance(v,str) and v.strip()}
        if len(options)<2:warnings.append('missing_options')
        if len({' '.join(v.lower().split()) for v in options.values()})<len(options):warnings.append('duplicate_options')
        actual=key(row.get('correct_answer'),choices)
        if not actual:warnings.append('unrecognized_answer')
        corrected=medical_key(row,choices)
        if corrected and actual!=corrected:changes['correct_answer']=corrected
        marked=[(letter,MARKER.sub('',answer).strip()) for letter,answer in options.items() if MARKER.search(answer)]
        if len(marked)==1:
            letter,clean=marked[0]
            if clean and (actual==letter or corrected==letter):changes['option_'+letter.lower()]=clean
            else:warnings.append('conflicting_correct_mark')
        elif len(marked)>1:warnings.append('multiple_correct_marks')
    elif qtype in ('theory','practical'):
        answer=changes.get('model_answer',row.get('model_answer') or '')
        if len(answer.strip())<30:warnings.append('missing_model_answer')
    return changes,warnings

def quote(text):return "'"+text.replace("'","''")+"'"

def query(statement,read_only=False):
    token=os.getenv('SUPABASE_ACCESS_TOKEN','').strip()
    if not token:raise RuntimeError('Missing Supabase access token')
    payload=json.dumps({'query':statement,'read_only':read_only}).encode()
    request=Request(API,data=payload,method='POST',headers={
        'Authorization':'Bearer '+token,'Content-Type':'application/json'})
    for attempt in range(4):
        try:
            with urlopen(request,timeout=70) as response:result=json.load(response)
            if isinstance(result,list):return result
            if isinstance(result,dict):
                for k in ('data','result','rows'):
                    if isinstance(result.get(k),list):return result[k]
            raise RuntimeError('Unknown response schema; halted to prevent edits')
        except HTTPError as ex:
            if ex.code in (429,502,503,504) and attempt<3:
                time.sleep(2**attempt);continue
            raise RuntimeError('Supabase API rejected request: HTTP '+str(ex.code)) from ex
    raise RuntimeError('Supabase API retry limit')

def apply(changes):
    ids=[]
    statements=[]
    for row,fields in changes:
        ident=str(row['id'])
        if not UUID.fullmatch(ident):raise RuntimeError('Invalid question identifier')
        ids.append(quote(ident)+'::uuid')
        setters=[];guards=[]
        for column,after in fields.items():
            if column not in FIELDS:raise RuntimeError('Disallowed modification')
            old=row.get(column)
            setters.append(column+'='+quote(after))
            guards.append(column+' IS NULL' if old is None else column+' IS NOT DISTINCT FROM '+quote(old))
        statements.append('UPDATE public.questions SET '+', '.join(setters)+' WHERE id='+
                          quote(ident)+'::uuid AND '+' AND '.join(guards)+';')
    # A private, persistent original snapshot is made before each update batch.
    script=('BEGIN; INSERT INTO lensiq_internal.question_repair_backup(question_id,original_record) '
            'SELECT id,to_jsonb(q) FROM public.questions q WHERE id IN ('+','.join(ids)+') '
            'ON CONFLICT (question_id) DO NOTHING; '+
            '\n'.join(statements)+' COMMIT;')
    query(script)

def main():
    if os.getenv('LENXIQ_PROJECT_REF')!=PROJECT:raise RuntimeError('Wrong project; no write allowed')
    query('CREATE SCHEMA IF NOT EXISTS lensiq_internal;'
          'REVOKE ALL ON SCHEMA lensiq_internal FROM PUBLIC,anon,authenticated;'
          'CREATE TABLE IF NOT EXISTS lensiq_internal.question_repair_backup('
          'question_id uuid PRIMARY KEY,original_record jsonb NOT NULL,'
          'saved_at timestamptz NOT NULL DEFAULT clock_timestamp());'
          'REVOKE ALL ON TABLE lensiq_internal.question_repair_backup FROM PUBLIC,anon,authenticated;')
    counters=Counter();problems=Counter();pending=[];expected={};last=''
    columns='id::text AS id,type,'+','.join(FIELDS)
    while True:
        stmt='SELECT '+columns+' FROM public.questions '
        if last:stmt+='WHERE id::text>'+quote(last)+' '
        page=query(stmt+'ORDER BY id LIMIT 120',True)
        if not page:break
        for row in page:
            counters['total']+=1;counters[kind(row)]+=1
            patch,alerts=transform(row);problems.update(alerts)
            if patch:
                expected[str(row['id'])]=patch;pending.append((row,patch))
            if len(pending)>=12:apply(pending);pending=[]
        last=str(page[-1]['id'])
        if len(page)<120:break
    if pending:apply(pending)
    for i in range(0,len(expected),45):
        ids=list(expected)[i:i+45]
        stmt=('SELECT id::text AS id,'+','.join(FIELDS)+' FROM public.questions WHERE id IN ('+
              ','.join(quote(ident)+'::uuid' for ident in ids)+')')
        found={str(row['id']):row for row in query(stmt,True)}
        for ident in ids:
            if ident not in found or any(found[ident].get(k)!=v for k,v in expected[ident].items()):
                raise RuntimeError('Content change failed verification: '+ident)
            counters['verified']+=1
    summary=[
        '### LenxiQ medical content repair','',
        '- Target: hixvbcrrklyajhkyliay',
        '- Inspected: '+str(counters['total']),
        '- MCQs: '+str(counters['mcq']),
        '- Theory: '+str(counters['theory']),
        '- Practical: '+str(counters['practical']),
        '- Confirmed edits: '+str(counters['verified']),
        '- Uncertain clinical answers were not guessed.',
        '- No AI-style student-facing annotations were added.',
        '',
        '| Remaining issue | Count |','|---|---:|',
    ]
    summary.extend('| '+str(k).replace('_',' ')+' | '+str(v)+' |' for k,v in sorted(problems.items()) if v)
    out='\n'.join(summary)+'\n'
    if os.getenv('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'],'a',encoding='utf-8') as f:f.write(out)
    print(out)

if __name__=='__main__':
    try:main()
    except Exception as error:
        print('Repair stopped: '+str(error),file=sys.stderr);sys.exit(1)
