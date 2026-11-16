/** Stateless serverless handlers can reuse this bounded buffer during one invocation.
 * Callers own persistence of the canonical cursor and cannot advance from a cache miss. */
export class LookaheadBuffer<T> {
  private readonly cached=new Map<string,Promise<T>>();
  constructor(private readonly load:(id:string)=>Promise<T>,private readonly maxEntries=3){}
  warm(id:string): Promise<T> {
    const existing=this.cached.get(id);
    if(existing)return existing;
    const current=this.load(id).catch(error=>{this.cached.delete(id);throw error;});
    this.cached.set(id,current);
    while(this.cached.size>this.maxEntries){
      const oldest=this.cached.keys().next().value;
      if(oldest!==undefined)this.cached.delete(oldest);
    }
    return current;
  }
  get(id:string):Promise<T>{ return this.warm(id); }
  has(id:string):boolean {return this.cached.has(id);}
  clear():void{this.cached.clear();}
}
