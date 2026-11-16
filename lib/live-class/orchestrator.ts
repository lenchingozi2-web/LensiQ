import { VisualStateStack, type VisualSnapshot } from './visual-protocol';

export type LessonPhase='IDLE'|'SYLLABUS_READY'|'TEACHING_NODE'|'HANDLING_INTERRUPT'|'CHECKPOINT_VERIFICATION'|'PAUSED'|'COMPLETED';
export type LessonEvent=
  | {type:'SYLLABUS_COMPILED';nodes:string[]}
  | {type:'START'}
  | {type:'NODE_DELIVERY_COMPLETE';state_version:number;concept_node_id:string;worker_verified:boolean}
  | {type:'STUDENT_BARGE_IN';visual_snapshot:VisualSnapshot}
  | {type:'INTERRUPT_ANSWER_COMPLETE'}
  | {type:'NEXT_CONCEPT'}
  | {type:'JUMP_TO_CONCEPT';concept_node_id:string}
  | {type:'PAUSE'}|{type:'RESUME'}|{type:'END'};
export type LessonState={phase:LessonPhase;state_version:number;nodes:string[];cursor:number;current_node_id:string|null;previous_phase:LessonPhase|null};
export function initialLessonState():LessonState{return{phase:'IDLE',state_version:0,nodes:[],cursor:-1,current_node_id:null,previous_phase:null};}
export function transitionLessonState(current:LessonState,event:LessonEvent):LessonState {
  if(current.phase==='COMPLETED')return current;
  const next={...current};
  const advance=(cursor:number)=>{
    if(cursor<0||cursor>=next.nodes.length){next.phase='COMPLETED';next.current_node_id=null;next.cursor=next.nodes.length;return;}
    next.cursor=cursor;next.current_node_id=next.nodes[cursor];next.phase='TEACHING_NODE';
  };
  switch(event.type){
    case 'SYLLABUS_COMPILED':
      if(current.phase!=='IDLE'||!event.nodes.length||new Set(event.nodes).size!==event.nodes.length)throw new Error('Invalid syllabus transition');
      next.nodes=[...event.nodes];next.phase='SYLLABUS_READY';break;
    case 'START':
      if(current.phase!=='SYLLABUS_READY')throw new Error('Syllabus not ready');
      advance(0);break;
    case 'NODE_DELIVERY_COMPLETE':
      if(!event.worker_verified || current.phase!=='TEACHING_NODE'
        ||event.state_version!==current.state_version||event.concept_node_id!==current.current_node_id)
        return current;
      next.phase='CHECKPOINT_VERIFICATION';
      // Verified end-of-playout is the only automatic advancement event.
      advance(current.cursor+1);
      break;
    case 'NEXT_CONCEPT':
      if(!['TEACHING_NODE','CHECKPOINT_VERIFICATION','PAUSED'].includes(current.phase))throw new Error('Cannot skip now');
      advance(current.cursor+1);break;
    case 'JUMP_TO_CONCEPT': {
      const at=current.nodes.indexOf(event.concept_node_id);
      if(at<0)throw new Error('Unknown syllabus concept');
      if(current.phase==='IDLE'||current.phase==='HANDLING_INTERRUPT')throw new Error('Cannot jump during interruption');
      advance(at);break;
    }
    case 'STUDENT_BARGE_IN':
      if(current.phase!=='TEACHING_NODE')return current;
      next.phase='HANDLING_INTERRUPT';break;
    case 'INTERRUPT_ANSWER_COMPLETE':
      if(current.phase!=='HANDLING_INTERRUPT')return current;
      next.phase='TEACHING_NODE';break;
    case 'PAUSE':
      if(!['TEACHING_NODE','CHECKPOINT_VERIFICATION'].includes(current.phase))return current;
      next.previous_phase=current.phase;next.phase='PAUSED';break;
    case 'RESUME':
      if(current.phase!=='PAUSED')return current;
      next.phase=current.previous_phase||'TEACHING_NODE';next.previous_phase=null;break;
    case 'END':next.phase='COMPLETED';next.current_node_id=null;break;
  }
  next.state_version=current.state_version+1;
  return next;
}
export class LessonOrchestrator {
  private state:LessonState;
  readonly visuals=new VisualStateStack();
  constructor(initial:LessonState=initialLessonState()){this.state=structuredClone(initial);}
  get snapshot():LessonState{return structuredClone(this.state);}
  dispatch(event:LessonEvent):LessonState{
    const before=this.state;
    const after=transitionLessonState(before,event);
    if(after===before)return this.snapshot;
    if(event.type==='STUDENT_BARGE_IN')this.visuals.push(event.visual_snapshot);
    if(event.type==='END')this.visuals.clear();
    this.state=after;
    return this.snapshot;
  }
  restoreAfterAnswer():{state:LessonState;visual:VisualSnapshot|null}{
    const state=this.dispatch({type:'INTERRUPT_ANSWER_COMPLETE'});
    return{state,visual:this.visuals.pop()};
  }
}
