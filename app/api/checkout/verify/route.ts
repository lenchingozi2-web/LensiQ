import {NextResponse} from 'next/server';
import {settleFlutterwaveTransaction} from '@/lib/payment-recovery';
export async function GET(req:Request){
 const params=new URL(req.url).searchParams;
 const id=params.get('transaction_id');
 if(!id||!['successful','completed'].includes(params.get('status')||''))return NextResponse.redirect(new URL('/pricing?error=payment_failed',req.url));
 try {await settleFlutterwaveTransaction(id);return NextResponse.redirect(new URL('/subscription?upgrade=success',req.url));}
 catch {return NextResponse.redirect(new URL('/subscription?error=activation_pending',req.url));}
}
