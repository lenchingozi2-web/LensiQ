import { parseTeachingPacket, parseVisualCue, type TeachingPacket, type Citation, type VisualCue } from './visual-protocol';

type SourceFact={text?:string;sourceFile?:string;pageNumber?:number|null};
export type ConceptRecord={
  id:string;title:string;consolidated_notes:string;
  key_details_json:unknown;source_citations_json:unknown;visual_spec_json:unknown;
};
export function makeTeachingPacket(sessionId:string,syllabusId:string,version:number,record:ConceptRecord):TeachingPacket {
  const facts:SourceFact[]=Array.isArray(record.key_details_json)?record.key_details_json:[];
  const lines=facts.filter(f=>typeof f?.text==='string'&&f.text.trim());
  if(!lines.length)lines.push({text:record.consolidated_notes||record.title});
  const spec=record.visual_spec_json&&typeof record.visual_spec_json==='object'?record.visual_spec_json as Record<string,unknown>:{};
  const refs:Citation[]=Array.isArray(record.source_citations_json)?record.source_citations_json.filter(r=>typeof r?.file_name==='string'):[];
  const cues:VisualCue[]=[];
  let steps:string[]=[],citations:Citation[]=[];
  function flush(){
    if(!steps.length)return;
    const text=steps.join('\n');
    const rows=text.split('\n').map(line=>line.split('\t'));
    const flow=/→|⟶|->/.test(text)?text.split(/\s*(?:→|⟶|->)\s*/):spec.layout==='flow'?steps:[];
    const table=rows.length>=2&&rows[0].length>=2&&rows.every(r=>r.length===rows[0].length);
    const showModel=cues.length===1&&['anatomy_3d','molecule_3d','physiology_sim','source_diagram'].includes(String(spec.mode));
    cues.push(parseVisualCue({id:record.id+'-'+cues.length,title:record.title,spoken_text:text,steps,
      mode:showModel?spec.mode:'whiteboard',asset_url:showModel?spec.asset_url:undefined,structure_id:showModel?spec.structure_id:undefined,
      comparison_table:table?{columns:rows[0],rows:rows.slice(1)}:undefined,
      mechanism_flow_arrows:flow.length>1?flow:undefined,
      citations:citations.length?citations:refs.slice(0,2)}));
    steps=[];citations=[];
  }
  for(const fact of lines){
    for(const part of fact.text!.match(/[\s\S]{1,550}/gu)||[]){
      if(steps.length>=3 || steps.join(' ').length+part.length>620)flush();
      steps.push(part);
      if(fact.sourceFile&&!citations.some(c=>c.file_name===fact.sourceFile&&c.page_number===(fact.pageNumber??null)))
        citations.push({file_name:fact.sourceFile,page_number:fact.pageNumber??null});
    }
  }
  flush();
  return parseTeachingPacket({type:'TEACHING_PACKET',session_id:sessionId,syllabus_id:syllabusId,state_version:version,
    concept_node_id:record.id,title:record.title,visual_cues:cues});
}
