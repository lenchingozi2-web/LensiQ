export async function inPool<T>(items: T[], work: (item:T,index:number)=>Promise<void>, concurrency=3) {
  let next=0;
  const results=await Promise.allSettled(Array.from({length:Math.min(concurrency,items.length)}, async()=>{
    while(next<items.length){const index=next++; await work(items[index],index);}
  }));
  const failed=results.find(result=>result.status==='rejected');
  if(failed?.status==='rejected')throw failed.reason;
}
export async function retryStep<T>(work:()=>Promise<T>, signal:AbortSignal, delay=400):Promise<T> {
  for(let attempt=0;;attempt++){
    signal.throwIfAborted();
    try{return await work();}
    catch(error){
      if(attempt===2 || signal.aborted)throw error;
      await new Promise(resolve=>setTimeout(resolve,delay*2**attempt));
    }
  }
}
