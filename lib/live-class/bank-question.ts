import type { SupabaseClient } from '@supabase/supabase-js';
import type { BankQuestion } from './lesson-author';
export async function relatedBankQuestion(db:SupabaseClient,course:string,topic:string):Promise<BankQuestion|null>{
  const subject=/pharmacology/i.test(course)?'Pharmacology':'Pathology';
  const {data,error}=await db.rpc('search_question_bank',{search_text:topic.slice(0,250),subject_filter:subject,division_filter:subject==='Pathology'?(/ha?ematology|haematology/i.test(course)?'Haematology/Immunology':course):null,max_results:5});
  if(error||!Array.isArray(data))return null;
  for(const q of data){
    if(!q.question_text||!(q.relevance>0))continue;
    const letter=String(q.correct_answer||'').trim().toLowerCase();
    const answer=q.model_answer||(/^[a-e]$/.test(letter)?q['option_'+letter]:q.correct_answer);
    if(typeof answer==='string'&&answer.trim().length>3)return{id:String(q.id),question:String(q.question_text).slice(0,800),answer:answer.trim().slice(0,1100)};
  }
  return null;
}
