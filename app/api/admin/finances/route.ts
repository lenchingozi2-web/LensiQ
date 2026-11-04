import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {estimateMonthlyFinancials,FINANCE_DEFAULTS,type FinanceSettings,type MonthlyFinance} from '@/lib/billing-costs';
export const dynamic='force-dynamic';
function month(value:string|null){const m=value??new Date().toISOString().slice(0,7);return /^(20\d{2})-(0[1-9]|1[0-2])$/.test(m)?m:null;}
async function admin(){const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return {db,status:401};const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();return {db,status:profile?.role==='admin'?200:403};}
export async function GET(request:Request){
 try{
  const {db,status}=await admin();if(status!==200)return NextResponse.json({error:'Admin access required.'},{status});
  const selected=month(new URL(request.url).searchParams.get('month'));if(!selected)return NextResponse.json({error:'Invalid month.'},{status:400});
  const {data,error}=await db.rpc('admin_monthly_financials',{p_month:selected+'-01'});
  if(error||!data)return NextResponse.json({error:'Financial data could not be loaded. No zero-cost or zero-revenue values have been substituted.'},{status:503});
  return NextResponse.json({raw:data,estimate:estimateMonthlyFinancials(data as MonthlyFinance),updatedAt:new Date().toISOString()},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({error:'Financial reporting is temporarily unavailable.'},{status:503});}
}
export async function PATCH(request:Request){
 try{
  const {db,status}=await admin();if(status!==200)return NextResponse.json({error:'Admin access required.'},{status});
  if(request.headers.get('origin')&&new URL(request.headers.get('origin')!).host!==new URL(request.url).host)return NextResponse.json({error:'Invalid request origin.'},{status:403});
  const body=await request.json();if(typeof body.month!=='string')return NextResponse.json({error:'Reporting month is required.'},{status:400});const selected=month(body.month);if(!selected)return NextResponse.json({error:'Invalid month.'},{status:400});
  if(body.kind==='settings'){
   if(!body.config||typeof body.config!=='object'||Array.isArray(body.config))return NextResponse.json({error:'Invalid assumptions.'},{status:400});
   const config:Partial<FinanceSettings>={};
   for(const [key,value] of Object.entries(body.config)){
    if(!(key in FINANCE_DEFAULTS)||typeof value!=='number'||!Number.isFinite(value)||value<0||value>1_000_000||(key==='usdToNaira'&&value===0)||(['flutterwaveFeeRate','feeVatRate'].includes(key)&&value>1))return NextResponse.json({error:'Enter valid, non-negative financial assumptions.'},{status:400});
    config[key as keyof FinanceSettings]=value;
   }
   const {error}=await db.from('finance_month_settings').upsert({month:selected+'-01',config,updated_at:new Date().toISOString()});if(error)throw error;
  }else if(body.kind==='invoice'){
   if(!['supabase','vercel','livekit','gemini','groq','other','refunds','payment_fees'].includes(body.provider)||!['NGN','USD'].includes(body.currency)||typeof body.amount!=='number'||!Number.isFinite(body.amount)||body.amount<0||body.amount>1_000_000_000||typeof body.note!=='string'||body.note.length>300)return NextResponse.json({error:'Enter a valid invoice total, currency and note.'},{status:400});
   const {error}=await db.from('finance_invoices').upsert({month:selected+'-01',provider:body.provider,amount:body.amount,currency:body.currency,note:body.note,updated_at:new Date().toISOString()});if(error)throw error;
  }else return NextResponse.json({error:'Unsupported financial update.'},{status:400});
  return NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({error:'Changes could not be saved. Your previous figures remain in effect.'},{status:503});}
}
