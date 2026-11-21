import { LIVE_CLASS_MODEL_CATALOG, LIVE_CLASS_MOLECULE_CATALOG } from '@/lib/voice/live-class-model-catalog';

export type MatchedClassVisual={mode:'anatomy_3d'|'molecule_3d'|'physiology_sim';
  asset_url?:string;structure_id?:string;title:string;source?:string};
const stop=new Set(['the','and','for','with','from','about','general','introduction','medical','clinical','normal','concept','system','cell']);
const tokens=(s:string)=>new Set((s.toLowerCase().match(/[a-z0-9]+/g)||[]).filter(w=>w.length>=4&&!stop.has(w)));
const presets=[
  {phrase:'cardiac output',preset:'cardiac_output'},
  {phrase:'mean arterial pressure',preset:'mean_arterial_pressure'},
  {phrase:'alveolar ventilation',preset:'alveolar_ventilation'},
  {phrase:'acid base balance',preset:'acid_base_balance'},
  {phrase:'anion gap',preset:'anion_gap'},
  {phrase:'drug half life',preset:'drug_half_life'},
  {phrase:'competitive antagonism',preset:'competitive_antagonism'},
  {phrase:'oxygen content',preset:'oxygen_content'},
  {phrase:'renal clearance',preset:'renal_clearance'},
];
/** Match only verified catalogue entries; weak semantic similarity never invents a 3D structure. */
export function matchCuratedClassVisual(heading:string):MatchedClassVisual|null{
  if(/\b(?:colorectal|colonic polyps|colon polyps)\b/i.test(heading))return matchCuratedClassVisual('colon anatomy');
  const title=heading.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const titleWords=tokens(title);
  for(const {phrase,preset} of presets)if(title.includes(phrase))return{mode:'physiology_sim',structure_id:preset,title:heading};
  let best:{score:number;visual:MatchedClassVisual}|null=null;
  for(const asset of LIVE_CLASS_MODEL_CATALOG){
    for(const topic of asset.topics){
      const term=String(topic).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
      const candidates=tokens(term);
      if(!candidates.size)continue;
      let score=0;
      if(title===term||title.includes(' '+term+' ')||title.startsWith(term+' ')||title.endsWith(' '+term))score=1;
      else{
        let matched=0;for(const word of candidates)if(titleWords.has(word))matched++;
        score=matched/Math.max(candidates.size,titleWords.size,2);
      }
      if(score>=(candidates.size===1?0.98:0.72)&&(!best||score>best.score))
        best={score,visual:{mode:'anatomy_3d',asset_url:asset.modelUrl,title:asset.title,source:asset.source}};
    }
  }
  for(const asset of LIVE_CLASS_MOLECULE_CATALOG){
    for(const topic of asset.topics){
      const term=String(topic).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
      if(!term||(!title.includes(term)&&term!==title))continue;
      const score=1.1;
      if(!best||score>best.score)best={score,visual:{
        mode:'molecule_3d',asset_url:asset.modelUrl,title:asset.title,source:asset.source,
      }};
    }
  }
  return best?.visual??null;
}
