// Browser integration fixture. All document and indexing writes are intercepted.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:360,height:800},isMobile:true,hasTouch:true});
const origin='https://www.lenxiq.online';
page.on('pageerror',e=>console.error('Classroom JS error:',e.message));
const id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const docs=['fixture-a','fixture-b','fixture-c'];
const nodes=Array.from({length:42},(_,i)=>({id:'concept-'+i,title:'Cited passage '+(i+1),
  parent_id:null,node_type:'concept',sort_order:i,consolidated_notes:'Inflammatory cells migrate from blood into injured tissue, producing a protective response.',source_citations_json:[{file_name:'Lecture A.txt',page_number:i+1}]}));
let published=false,releaseIndex,treeReads=0,active=0,peak=0;
const attempts=new Map();
const gate=new Promise(resolve=>{releaseIndex=resolve;});
const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
try{
  await page.route('**/api/rag/ingest-batch',route=>{
    const body=route.request().postDataJSON();
    return json(route,body.action==='prepare'?{syllabusId:id,uploads:docs.map((d,i)=>({documentId:d,path:id+'/'+d+'.txt',token:'fixture',fileName:body.files[i].name}))}:{ok:true});
  });
  await page.route('**/storage/v1/object/upload/sign/study-documents/**',route=>json(route,{Key:'test'}));
  await page.route('**/rest/v1/study_syllabi?**',route=>json(route,{status:published?'ready':'compiling',staging_generation:published?null:1,active_generation:published?1:0}));
  await page.route('**/rest/v1/syllabus_concept_nodes?**',route=>{treeReads++;return json(route,published?nodes:nodes.slice(0,2));});
  await page.route('**/api/rag/compile-syllabus',async route=>{
    const {action,itemId,offset}=route.request().postDataJSON();
    if(action==='prepare')return json(route,{documents:docs.map(id=>({id,indexed:false})),published:false});
    if(action==='parse'){
      if(itemId===docs[0]&&!offset)return json(route,{done:false,next:2,ids:nodes.slice(0,2).map(n=>n.id)});
      await gate;return json(route,{done:true});
    }
    if(action==='publish'){published=true;return json(route,{done:true});}
    assert.equal(action,'node');active++;peak=Math.max(peak,active);
    const attempt=(attempts.get(itemId)||0)+1;attempts.set(itemId,attempt);
    await new Promise(resolve=>setTimeout(resolve,40));active--;
    if(itemId==='concept-2'&&attempt===1)return route.abort('connectionreset');
    if(itemId==='concept-11')return json(route,{error:'fixture timeout'},504);
    return json(route,{done:true});
  });
  await page.goto(origin+'/voice',{waitUntil:'domcontentloaded',timeout:45000});
  const enter=page.getByRole('button',{name:'Enter Live Class'});
  await enter.waitFor();
  await page.locator('input[type=file]:enabled').waitFor({state:'attached'});
  const history=page.getByRole('button',{name:/^History/});
  await history.click();
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByLabel('Choose study documents').setInputFiles(docs.map((_,i)=>({
    name:'Lecture '+String.fromCharCode(65+i)+'.txt',mimeType:'text/plain',buffer:Buffer.from('Source fixture.'),
  })));
  const prepare=page.getByRole('button',{name:'Prepare lecture notes'});
  await prepare.waitFor();assert.equal(await enter.isEnabled(),false);
  await prepare.click();
  await page.getByText(/Ready to enter/).waitFor({timeout:20000});
  assert.equal(await enter.isEnabled(),true);
  assert.equal(published,false);assert.ok(treeReads>=1);
  releaseIndex();
  await page.getByText('Source index ready',{exact:false}).waitFor({timeout:45000});
  assert.equal(attempts.size,42);assert.equal(attempts.get('concept-2'),2);assert.equal(attempts.get('concept-11'),3);
  assert.ok(peak<=3&&peak>1);assert.equal(await enter.isEnabled(),true);
  console.log('Passed 360px touch UI: entry after two cited passages, three concurrent requests, dropped response retried and exhausted node isolated.');
}catch(error){
  console.error('Classroom state at failure:',(await page.locator('body').innerText()).slice(-1600));
  console.error('Indexed requests:',attempts.size,'tree reads:',treeReads,'published:',published);
  throw error;
}finally{releaseIndex();await browser.close();}
