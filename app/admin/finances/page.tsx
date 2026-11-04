import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import FinancialPanel from './FinancialPanel';
export const dynamic='force-dynamic';
export default async function FinancePage(){const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();if(profile?.role!=='admin')redirect('/dashboard');return <FinancialPanel/>;}
