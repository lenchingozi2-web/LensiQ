export const LESSON_CHANNEL = 'lk-lesson-state' as const;
export type VisualMode = 'whiteboard' | 'whiteboard_scratchpad' | 'anatomy_3d' | 'molecule_3d' | 'physiology_sim' | 'source_diagram';
export type Citation = { file_name: string; page_number: number | null };
export type VisualCue = {
  id: string;
  mode: VisualMode;
  title: string;
  spoken_text: string;
  steps: string[];
  source_fact_ids?: number[];
  learning_activity?: string;
  comparison_table?: { columns: string[]; rows: string[][] };
  mechanism_flow_arrows?: string[];
  high_yield_pearl?: string;
  asset_url?: string;
  structure_id?: string;
  camera?: { target?: string; distance?: number };
  citations: Citation[];
};
export type TeachingPacket = {
  type: 'TEACHING_PACKET';
  session_id: string;
  syllabus_id: string;
  state_version: number;
  concept_node_id: string;
  title: string;
  visual_cues: VisualCue[];
  teaching_version?: number;
  practice_question_id?: string;
};
export type VisualSnapshot = { active_mode: VisualMode; concept_node_id: string; cue_index: number; whiteboard_snapshot: string[]; active_cue: VisualCue };
export type SyncVisualStage = {
  type: 'SYNC_VISUAL_STAGE';
  state_version: number;
  concept_node_id: string;
  cue_index: number;
  cue: VisualCue;
};
const VISUAL_MODES = new Set<VisualMode>(['whiteboard','whiteboard_scratchpad','anatomy_3d','molecule_3d','physiology_sim','source_diagram']);
const safeText = (value: unknown, max: number): string => typeof value === 'string' ? value.trim().slice(0,max) : '';
const safeStringArray = (value: unknown, limit: number, max: number) =>
  Array.isArray(value) ? value.filter((s): s is string => typeof s === 'string').slice(0,limit).map(s=>s.trim().slice(0,max)) : [];
export function parseVisualCue(raw: unknown): VisualCue {
  if (!raw || typeof raw !== 'object') throw new Error('Visual cue must be an object');
  const v = raw as Record<string, unknown>;
  if (typeof v.mode !== 'string' || !VISUAL_MODES.has(v.mode as VisualMode)) throw new Error('Unsupported visual cue mode');
  const id = safeText(v.id, 120), title=safeText(v.title, 200), spoken=safeText(v.spoken_text, 4500);
  if (!id || !title || !spoken) throw new Error('Cue requires ID, title and spoken checkpoint');
  const citations: Citation[] = [];
  for (const item of Array.isArray(v.citations) ? v.citations.slice(0,50) : []) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string,unknown>;
    const fileName = safeText(record.file_name, 180);
    const page = record.page_number;
    if (fileName) citations.push({ file_name: fileName, page_number: typeof page==='number' && Number.isSafeInteger(page) && page>0 ? page : null });
  }
  const asset = safeText(v.asset_url, 1200);
  if (asset) {
    const url = new URL(asset);
    if (url.protocol !== 'https:') throw new Error('Unsafe visual asset URL');
  }
  const table=v.comparison_table;
  let comparison_table: VisualCue['comparison_table'];
  if (table && typeof table==='object') {
    const t=table as Record<string,unknown>;
    const columns=safeStringArray(t.columns,8,180);
    const rows=Array.isArray(t.rows)?t.rows.slice(0,40).map(row=>safeStringArray(row,columns.length,400)):[];
    if (columns.length>0) comparison_table={columns,rows};
  }
  const c=v.camera && typeof v.camera==='object' ? v.camera as Record<string,unknown>:null;
  return { id,mode:v.mode as VisualMode,title,spoken_text:spoken,
    steps:safeStringArray(v.steps,30,1500),
    learning_activity:safeText(v.learning_activity,220)||undefined,
    source_fact_ids:Array.isArray(v.source_fact_ids)?v.source_fact_ids.filter((n):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0).slice(0,200):undefined,
    comparison_table,
    mechanism_flow_arrows:safeStringArray(v.mechanism_flow_arrows,30,240),
    high_yield_pearl:safeText(v.high_yield_pearl,500)||undefined,
    asset_url:asset||undefined,
    structure_id:safeText(v.structure_id,120)||undefined,
    camera:c?{target:safeText(c.target,120)||undefined,distance:typeof c.distance==='number'&&Number.isFinite(c.distance)?c.distance:undefined}:undefined,
    citations };
}
export function parseTeachingPacket(value: unknown): TeachingPacket {
  if (!value || typeof value!=='object') throw new Error('Teaching packet required');
  const v=value as Record<string,unknown>;
  const session=safeText(v.session_id,36),syllabus=safeText(v.syllabus_id,36),concept=safeText(v.concept_node_id,36);
  const version=v.state_version;
  if (v.type!=='TEACHING_PACKET'|| ![session,syllabus,concept].every(s=>/^[0-9a-f-]{36}$/i.test(s))
    ||typeof version!=='number'||!Number.isSafeInteger(version)||version<1
    ||!Array.isArray(v.visual_cues)||v.visual_cues.length<1||v.visual_cues.length>64) throw new Error('Malformed teaching packet');
  const cues=v.visual_cues.map(parseVisualCue);
  const ids=new Set(cues.map(c=>c.id));
  if (ids.size!==cues.length) throw new Error('Cue IDs must be unique');
  return {type:'TEACHING_PACKET',session_id:session,syllabus_id:syllabus,
    state_version:version,concept_node_id:concept,title:safeText(v.title,200),visual_cues:cues,
    teaching_version:v.teaching_version===3?3:undefined,practice_question_id:safeText(v.practice_question_id,100)||undefined};
}
export function syncVisualStage(packet: TeachingPacket, index: number): SyncVisualStage {
  if (!Number.isSafeInteger(index)||index<0||index>=packet.visual_cues.length) throw new Error('Checkpoint outside packet');
  return {type:'SYNC_VISUAL_STAGE',state_version:packet.state_version,
    concept_node_id:packet.concept_node_id,cue_index:index,cue:packet.visual_cues[index]};
}
export class VisualStateStack {
  private entries: VisualSnapshot[]=[];
  push(state: VisualSnapshot): void {
    if (this.entries.length>=12) throw new Error('Too many unresolved interrupts');
    this.entries.push(structuredClone(state));
  }
  pop(): VisualSnapshot | null { return this.entries.pop() ?? null; }
  peek(): VisualSnapshot | null { return this.entries.length ? structuredClone(this.entries[this.entries.length-1]):null; }
  get depth() { return this.entries.length; }
  clear() { this.entries=[]; }
}
