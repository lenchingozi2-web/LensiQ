'use client';
import {useEffect,useTransition} from 'react';
import {useRouter} from 'next/navigation';
export default function SubscriptionRefresh({pending}:{pending:boolean}){
 const router=useRouter();const [refreshing,start]=useTransition();
 useEffect(()=>{let count=0;const focus=()=>start(()=>router.refresh());window.addEventListener('focus',focus);const timer=pending?window.setInterval(()=>{if(++count<=6)start(()=>router.refresh());},15000):undefined;return()=>{window.removeEventListener('focus',focus);if(timer)clearInterval(timer);};},[pending,router]);
 return <div className="mt-5 flex flex-wrap items-center gap-3"><button disabled={refreshing} onClick={()=>start(()=>router.refresh())} className="rounded-xl border bg-white px-4 py-3 font-bold disabled:opacity-50">{refreshing?'Refreshing…':'Refresh subscription'}</button>{pending&&<p role="status" className="text-sm text-amber-800">Checking your payment. Access activates only after payment is verified.</p>}</div>;
}
