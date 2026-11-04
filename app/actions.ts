
'use server';
import {createClient} from '@/lib/supabase/server';
import {checkAccess} from '@/lib/gatekeeper';
export async function checkQuizAccess(){return checkAccess('quiz');}
export async function checkBrowseAccess(course:string){return checkAccess('browse',course);}
export async function startTimedMock(subject:string,division:string,count:number){
 const db=await createClient();const {data,error}=await db.rpc('begin_timed_mock',{p_subject:subject,p_division:division,p_count:count});
 if(error||!data) return {error:'Unable to start: check your paid plan, remaining mock allowance and selected question bank.'};
 return {attempt:data};
}
export async function submitTimedMock(attempt:string,answers:Record<string,string>){
 const db=await createClient();const {data,error}=await db.rpc('submit_timed_mock',{p_attempt:attempt,p_answers:answers});
 return error?{success:false,error:'Your result could not be saved. Please retry.'}:{success:true,...data};
}
