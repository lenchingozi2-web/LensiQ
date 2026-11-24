/** Teaching selection only. Raw text and its citations remain in the source index. */
const administrative=/\b(?:learning objectives?|learning outcomes?|orientation|course (?:outline|objectives)|table of contents|bibliography|references|acknowledg(?:e)?ments?|lecture objectives?|source attribution|document information)\b/i;
export function teachingLines(title:string,text:string):string[]{
  if(administrative.test(title))return[];
  return text.split(/\n+/).map(s=>s.trim()).filter(s=>s&&
    !/^\d{1,4}$/.test(s)&&!/^\[?(?:page|slide)\s+\d+\]?$/i.test(s)&&s.toLowerCase()!==title.toLowerCase()&&
    !/^[A-Z][A-Z'’-]{2,}[.,\s]+(?:[A-Z]\.?[.,\s]*){1,4}$/.test(s)&&
    !/^(?:orientation|learning objectives?|year\s*\d+\s*(?:medicine|medical)|department of|faculty of|lecturer\s*:|presented by|prepared by|compiled by|written by|edited by|(?:dr|prof|professor)\s*[:.]\s*\S|copyright|©|https?:\/\/|\S+@\S+)/i.test(s));
}
export function isTeachable(title:string,text:string):boolean{return teachingLines(title,text).some(s=>s.split(/\s+/).length>=4);}
