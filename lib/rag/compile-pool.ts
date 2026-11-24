export type RetryableFailure = Error & { retryAfterMs?: number };
const MAX_CONCURRENCY = 3;
const MAX_RETRY_WAIT_MS = 30_000;

export async function inPool<T>(items: T[], work: (item:T,index:number)=>Promise<void>, concurrency=2) {
  let next=0;
  const workers=Math.min(MAX_CONCURRENCY,Math.max(1,Math.floor(concurrency)||1),items.length);
  const results=await Promise.allSettled(Array.from({length:workers},async()=>{
    while(next<items.length){const index=next++;await work(items[index],index);}
  }));
  const failed=results.find(result=>result.status==='rejected');
  if(failed?.status==='rejected')throw failed.reason;
}

function waitForRetry(milliseconds:number,signal:AbortSignal):Promise<void>{
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const finish=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);};
    const abort=()=>{finish();reject(signal.reason??new DOMException('Aborted','AbortError'));};
    const timer=setTimeout(()=>{finish();resolve();},milliseconds);
    signal.addEventListener('abort',abort,{once:true});
    if(signal.aborted)abort();
  });
}

export async function retryStep<T>(work:()=>Promise<T>,signal:AbortSignal,delay=400):Promise<T>{
  for(let attempt=0;;attempt++){
    signal.throwIfAborted();
    try{return await work();}
    catch(error){
      if(attempt===2||signal.aborted)throw error;
      const retryAfter=Number((error as RetryableFailure|null)?.retryAfterMs||0);
      const exponential=Math.min(MAX_RETRY_WAIT_MS,Math.max(0,delay)*2**attempt);
      const wait=Math.max(exponential,Number.isFinite(retryAfter)?retryAfter:0);
      // If a provider asks for a longer pause, don't violate it with an early retry.
      // Let the caller surface the saved-source error rather than hold a browser open.
      if(wait>MAX_RETRY_WAIT_MS)throw error;
      await waitForRetry(wait,signal);
    }
  }
}
