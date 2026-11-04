export const FINANCE_DEFAULTS = {
  usdToNaira: 1500, flutterwaveFeeRate: 0.02, feeVatRate: 0.075,
  supabaseMonthlyUsd: 25, vercelMonthlyUsd: 20, livekitMonthlyUsd: 50,
  livekitIncludedMinutes: 5000, livekitAgentUsdPerMinute: 0.01,
  livekitSpeechReserveUsdPerMinute: 0.03,
  unmeteredTextRequestUsd: 0.015, voiceBrainReserveUsdPerMinute: 0.002,
  voiceMouthReserveUsdPerMinute: 0.008,
};
export type FinanceSettings = typeof FINANCE_DEFAULTS;
export type UsageRow = {provider:string;feature:string;requests:number;input_tokens:number;output_tokens:number;cached_tokens:number;thinking_tokens:number;cost_usd:number;measured_requests:number;estimated_requests:number;charged_requests?:number};
export type FinanceInvoice = {provider:string;amount:number;currency:'USD'|'NGN';note?:string};
export type MonthlyFinance = {month:string;revenueNgn:number;paymentCount:number;voiceMinutes:number;textCredits:number;creditRefunds:number;pendingCheckouts:number;openSessions:number;subscribers:Array<{plan:string;label:string;accounts:number;price_ngn:number}>;usage:UsageRow[];settings:Partial<FinanceSettings>;invoices:FinanceInvoice[];meteringStartedAt:string|null};
const finite=(n:unknown,fallback=0)=>Number.isFinite(Number(n))?Number(n):fallback;
export function financeSettings(overrides:Partial<FinanceSettings>={}) : FinanceSettings {
 const result={...FINANCE_DEFAULTS};
 for(const key of Object.keys(result) as Array<keyof FinanceSettings>){const n=finite(overrides[key],result[key]);result[key]=n>=0?n:result[key];}
 if(result.usdToNaira<=0)result.usdToNaira=FINANCE_DEFAULTS.usdToNaira;
 result.flutterwaveFeeRate=Math.min(1,result.flutterwaveFeeRate);result.feeVatRate=Math.min(1,result.feeVatRate);
 return result;
}
export function estimateMonthlyFinancials(input:MonthlyFinance){
 const settings=financeSettings(input.settings);
 const usage=input.usage??[];const minutes=Math.max(0,finite(input.voiceMinutes));
 const sum=(provider:string,voice:boolean)=>usage.filter(r=>r.provider===provider&&r.feature.startsWith('voice_')===voice).reduce((n,r)=>n+Math.max(0,finite(r.cost_usd)),0);
 const covered=usage.reduce((n,r)=>n+Math.max(0,finite(r.charged_requests)),0);
 const unmeteredTextRequests=Math.max(0,finite(input.textCredits)-covered);
 const overageMinutes=Math.max(0,minutes-settings.livekitIncludedMinutes);
 const estimatesUsd:Record<string,number>={
  supabase:settings.supabaseMonthlyUsd,vercel:settings.vercelMonthlyUsd,
  livekit:settings.livekitMonthlyUsd+overageMinutes*settings.livekitAgentUsdPerMinute+minutes*settings.livekitSpeechReserveUsdPerMinute,
  gemini:sum('gemini',false)+Math.max(sum('gemini',true),minutes*settings.voiceBrainReserveUsdPerMinute)+unmeteredTextRequests*settings.unmeteredTextRequestUsd,
  groq:sum('groq',false)+Math.max(sum('groq',true),minutes*settings.voiceMouthReserveUsdPerMinute),other:0,
 };
 const invoiceNgn=(i:FinanceInvoice)=>Math.max(0,finite(i.amount))*(i.currency==='USD'?settings.usdToNaira:1);
 const costs=Object.entries(estimatesUsd).map(([provider,usd])=>{
  const invoice=input.invoices.find(i=>i.provider===provider);
  return {provider,amountNgn:invoice?invoiceNgn(invoice):usd*settings.usdToNaira,source:invoice?'invoice':'estimate',estimatedUsd:usd,note:invoice?.note??''};
 });
 const feeInvoice=input.invoices.find(i=>i.provider==='payment_fees');
 const paymentFeesNgn=feeInvoice?invoiceNgn(feeInvoice):Math.max(0,finite(input.revenueNgn))*settings.flutterwaveFeeRate*(1+settings.feeVatRate);
 const refundsNgn=input.invoices.filter(i=>i.provider==='refunds').reduce((n,i)=>n+invoiceNgn(i),0);
 const totalCostsNgn=costs.reduce((n,c)=>n+c.amountNgn,0)+paymentFeesNgn;
 const netReceiptsNgn=finite(input.revenueNgn)-refundsNgn;
 const contributionNgn=netReceiptsNgn-totalCostsNgn;
 return {settings,costs,paymentFeesNgn,feesSource:feeInvoice?'invoice':'estimate',refundsNgn,totalCostsNgn,netReceiptsNgn,contributionNgn,marginPercent:netReceiptsNgn>0?contributionNgn/netReceiptsNgn*100:null,overageMinutes,unmeteredTextRequests,
  currentMrrNgn:input.subscribers.reduce((n,s)=>n+finite(s.accounts)*finite(s.price_ngn),0),
  measuredRequests:usage.reduce((n,r)=>n+finite(r.measured_requests),0),estimatedRequests:usage.reduce((n,r)=>n+finite(r.estimated_requests),0),
  tokenCostEstimateUsd:usage.reduce((n,r)=>n+finite(r.cost_usd),0),
 };
}
