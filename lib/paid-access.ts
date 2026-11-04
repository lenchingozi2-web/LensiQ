import { createClient } from '@/lib/supabase/server';
export async function checkPaidAccess() {
 const db=await createClient(); const {data,error}=await db.rpc('authorize_study_feature',{p_feature:'paid'});
 return {allowed:!error&&data?.allowed===true,status:error?503:403,message:data?.message||'A paid plan is required.'};
}
