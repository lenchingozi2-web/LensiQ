'use client';

import type { SyllabusTreeNode } from '@/hooks/useHybridStudyRAG';
type Props={nodes:SyllabusTreeNode[];activeNodeId?:string|null;onJump:(id:string)=>void;disabled?:boolean};
export default function SyllabusNavigatorRail({nodes,activeNodeId,onJump,disabled=false}:Props){
  if(!nodes.length)return null;
  const modules=nodes.filter(n=>n.node_type==='module');
  const topics=nodes.filter(n=>n.node_type==='topic');
  const concepts=nodes.filter(n=>n.node_type==='concept');
  return <details className="pointer-events-auto absolute right-3 top-[4.4rem] z-40 w-[min(88vw,20rem)] rounded-2xl border border-white/15 bg-[#0c1523]/95 text-white shadow-2xl backdrop-blur-xl sm:right-6">
    <summary className="cursor-pointer select-none rounded-2xl px-4 py-3 text-xs font-black text-[#ffd68d]">
      Master syllabus · {concepts.length} concepts
    </summary>
    <nav className="max-h-[min(68dvh,34rem)] overflow-y-auto overscroll-contain px-2 pb-3" aria-label="Master syllabus navigation">
      {modules.map(module=><div key={module.id} className="mt-2">
        <h3 className="px-2 py-2 text-xs font-black uppercase tracking-[.1em] text-white/70">{module.title}</h3>
        {topics.filter(topic=>topic.parent_id===module.id).map(topic=><div key={topic.id} className="ml-2 border-l border-white/10 pl-2">
          <p className="px-2 py-2 text-xs font-bold text-white/70">{topic.title}</p>
          {concepts.filter(item=>item.parent_id===topic.id).map(item=><button type="button" key={item.id}
            disabled={disabled} onClick={()=>onJump(item.id)}
            aria-current={activeNodeId===item.id?'step':undefined}
            className={'my-0.5 block w-full truncate rounded-lg px-3 py-2 text-left text-xs transition hover:bg-white/10 disabled:opacity-50 '
              +(activeNodeId===item.id?'bg-[#E8A23D]/20 font-bold text-[#ffd68d]':'text-white/70')}>
            {item.title}
            {Array.isArray(item.source_citations_json)&&item.source_citations_json.length>0&&
              <span className="ml-1 font-normal text-white/40">· {item.source_citations_json.length} sources</span>}
          </button>)}
        </div>)}
      </div>)}
      {!modules.length&&concepts.map(item=><button key={item.id} type="button" onClick={()=>onJump(item.id)} disabled={disabled}
        className="block w-full truncate rounded-lg px-3 py-2 text-left text-xs text-white/70 hover:bg-white/10">{item.title}</button>)}
    </nav>
  </details>;
}
