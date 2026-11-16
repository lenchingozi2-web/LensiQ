import { parseTeachingPacket, parseVisualCue, type TeachingPacket, type Citation, type VisualCue } from './visual-protocol';

type SourceFact={text?:string;sourceFile?:string;pageNumber?:number|null};
type SourceCitation={file_name?:string;page_number?:number|null};
export type ConceptRecord={
  id:string;title:string;consolidated_notes:string;
  key_details_json:unknown;source_citations_json:unknown;visual_spec_json:unknown;
};
function citation(value:SourceCitation):Citation|null{
  if(typeof value.file_name!=='string'||!value.file_name)return null;
  return {file_name:value.file_name.slice(0,180),page_number:typeof value.page_number==='number'?value.page_number:null};
}
function sourceCitations(record:ConceptRecord):Citation[]{
  const citations=Array.isArray(record.source_citations_json)?record.source_citations_json:[];
  return citations.map((value:SourceCitation)=>citation(value||{})).filter((value:Citation|null):value is Citation=>Boolean(value)).slice(0,20);
}
function textFacts(record:ConceptRecord):string[]{
  const source=Array.isArray(record.key_details_json)?record.key_details_json:[];
  const facts=source.map((fact:SourceFact)=>typeof fact?.text==='string'?fact.text.trim():'').filter(Boolean);
  return facts.length?facts:record.consolidated_notes.split(/\n\n+/).map(v=>v.trim()).filter(Boolean);
}
function checkpoint(id:string,title:string,text:string,refs:Citation[],index:number):VisualCue{
  return parseVisualCue({
    id:id+'-'+index,mode:'whiteboard',title,spoken_text:text||title,
    steps:text.split(/(?<=[.;])\s+/).filter(Boolean).slice(0,6),
    citations:refs,
  });
}
/** A small, cited packet deliberately references a bounded source window; the full notes remain indexed. */
export function makeTeachingPacket(sessionId:string,syllabusId:string,version:number,record:ConceptRecord,offset=0):TeachingPacket{
  const facts=textFacts(record);
  const segment=facts.slice(offset,offset+6);
  const refs=sourceCitations(record);
  const first=segment.slice(0,2).join(' ').slice(0,1000);
  const second=segment.slice(2,4).join(' ').slice(0,1000);
  const final=segment.slice(4,6).join(' ').slice(0,650);
  const cues:VisualCue[]=[
    checkpoint(record.id,record.title,first||record.title,refs,0),
  ];
  const visual=record.visual_spec_json && typeof record.visual_spec_json==='object'
    ? record.visual_spec_json as Record<string,unknown>:{};
  const stage=typeof visual.mode==='string'?visual.mode:'';
  if(second){
    if(['anatomy_3d','molecule_3d','physiology_sim','source_diagram'].includes(stage)
      && typeof visual.asset_url==='string' && visual.asset_url.startsWith('https://')){
      cues.push(parseVisualCue({
        id:record.id+'-1',mode:stage,title:record.title,spoken_text:second,steps:[],
        asset_url:visual.asset_url,structure_id:visual.structure_id,citations:refs,
      }));
    }else cues.push(checkpoint(record.id,record.title,second,refs,1));
  }
  if(final)cues.push(checkpoint(record.id,record.title,final,refs,2));
  return parseTeachingPacket({type:'TEACHING_PACKET',session_id:sessionId,syllabus_id:syllabusId,
    state_version:version,concept_node_id:record.id,title:record.title,visual_cues:cues});
}
