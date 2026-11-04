/** Exact source ranges, split at structural boundaries without summarization. */
export function sourceChunks(text:string,target=2400){
 const chunks:Array<{content:string;start:number;end:number}>=[];
 let start=0;
 while(start<text.length){
  let end=Math.min(text.length,start+target);
  if(end<text.length){const slice=text.slice(start,end);const boundaries=[slice.lastIndexOf('\n\n'),slice.lastIndexOf('\n'),slice.lastIndexOf('. ')];const boundary=boundaries.find(at=>at>=target*.55);if(boundary!==undefined)end=start+boundary+1;}
  if(end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1])&&/[\uDC00-\uDFFF]/.test(text[end]))end--;
  chunks.push({content:text.slice(start,end),start,end});start=end;
 }
 return chunks;
}
