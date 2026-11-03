import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const origin='https://www.lenxiq.online';
const output=process.env.SCREENSHOT_DIR || './visual-test-evidence';
mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const errors=[];
const context=await browser.newContext({viewport:{width:1365,height:900},deviceScaleFactor:1});
const page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
let loadedGlb=false;
let loadedRealHra=false;
page.on('response',res=>{
  if(res.url().includes('/storage/v1/object/public/medical-models/') && res.url().endsWith('.glb') && res.status()===200) {
    loadedGlb=true;console.log('REAL_GLB_HTTP_200',res.url());
    if(res.url().includes('/hra-v25/heart.glb')) loadedRealHra=true;
  }
});
try {
  const url=origin+'/visual-lab';
  let loaded=false;
  for(let i=0;i<14;i++){
    const res=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000}).catch(()=>null);
    if(res?.status()===200 && await page.getByRole('heading',{name:'Hands-on medical learning'}).count()
       && await page.locator('[data-tutor-contract="v3"]').count()) {
      loaded=true;break;
    }
    await page.waitForTimeout(12000);
  }
  if(!loaded)throw new Error('Production visual laboratory route could not be reached');
  try {
    await page.locator('canvas').first().waitFor({state:'visible',timeout:55000});
  } catch (failure) {
    await page.screenshot({path:output+'/diagnostic-no-canvas.png',fullPage:true}).catch(()=>undefined);
    console.log('DIAGNOSTIC_URL',page.url());
    console.log('DIAGNOSTIC_PAGE_TEXT',(await page.locator('body').innerText().catch(()=>'' )).slice(0,3000));
    console.log('DIAGNOSTIC_ERRORS',JSON.stringify(errors.slice(0,8)));
    throw failure;
  }
  await page.locator('[data-testid="model-loading"]').waitFor({state:'hidden',timeout:70000});
  if(await page.getByText('3D model unavailable').count())throw new Error('Actual 3D model failed to render');
  await page.waitForTimeout(1600);
  if(!loadedGlb)throw new Error('No confirmed successful public GLB fetch inside real browser');
  const webgl=await page.locator('canvas').first().evaluate((canvas)=>{
    const g=canvas.getContext('webgl2')||canvas.getContext('webgl');
    return Boolean(g)&&!g.isContextLost();
  });
  if(!webgl)throw new Error('Live WebGL canvas context not available');
  console.log('PASS_REAL_WEBGL_CONTEXT');
  await page.screenshot({path:output+'/desktop-3d.png',fullPage:true});
  await page.getByRole('button',{name:'X-ray'}).click();
  if(await page.getByRole('button',{name:'X-ray'}).getAttribute('aria-pressed')!=='true')throw new Error('X-ray toggle failed');
  console.log('PASS_XRAY_MODE');
  // Click multiple visible locations because parts are different shapes.
  const canvas=page.locator('canvas').first(),bounds=await canvas.boundingBox();
  if(!bounds)throw new Error('3D canvas not measurable');
  let selected='';
  for(const [x,y] of [[.5,.5],[.44,.52],[.55,.47],[.42,.58],[.57,.55],[.5,.42],[.48,.62]]){
    await page.mouse.click(bounds.x+bounds.width*x,bounds.y+bounds.height*y);
    await page.waitForTimeout(300);
    selected=(await page.locator('[data-testid="selected-structure"]').innerText()).trim();
    if(selected&&!selected.includes('Tap a part of the 3D model'))break;
  }
  if(!selected || selected.includes('Tap a part of the 3D model'))throw new Error('3D structure picking failed');
  console.log('PASS_PICKED_STRUCTURE',selected);
  const isolate=page.getByRole('button',{name:'Isolate'});
  if(await isolate.isDisabled())throw new Error('Isolate remains disabled after structure selection');
  await isolate.click();
  if(await isolate.getAttribute('aria-pressed')!=='true')throw new Error('Structure isolation failed');
  console.log('PASS_ISOLATION');
  await page.locator('#lab-visual').selectOption('model:https://hixvbcrrklyajhkyliay.supabase.co/storage/v1/object/public/medical-models/hra-v25/heart.glb');
  await page.locator('[data-testid="model-loading"]').waitFor({state:'hidden',timeout:90000});
  if(await page.locator('[data-testid="model-failed"]').count())throw new Error('Real HRA organ failed 3D rendering');
  if(!loadedRealHra)throw new Error('Browser did not fetch the real HRA heart GLB');
  await page.waitForTimeout(1400);
  await page.screenshot({path:output+'/desktop-real-hra-heart.png',fullPage:true});
  console.log('PASS_HRA_HEART_REAL_WEBGL');
  const heartCanvas=page.locator('canvas').first();
  const heartBounds=await heartCanvas.boundingBox();
  if(!heartBounds)throw new Error('HRA heart canvas missing after rendering');
  let heartPicked='';
  for(const [x,y] of [[.50,.55],[.55,.5],[.48,.48],[.6,.55],[.45,.6],[.52,.42]]){
    await page.mouse.click(heartBounds.x+heartBounds.width*x,heartBounds.y+heartBounds.height*y);
    await page.waitForTimeout(240);
    heartPicked=(await page.locator('[data-testid="selected-structure"]').innerText()).trim();
    if(heartPicked && !heartPicked.includes('Tap a part of the 3D model'))break;
  }
  if(!heartPicked || heartPicked.includes('Tap a part of the 3D model'))throw new Error('Real HRA heart structure was not selectable');
  console.log('PASS_HRA_ANATOMICAL_STRUCTURE_SELECTION',heartPicked);
  await page.locator('#lab-visual').selectOption('simulation:acid_base_balance');
  await page.getByText('Calculated arterial pH').waitFor({timeout:20000});
  const range=page.getByRole('slider',{name:'Plasma bicarbonate'});
  await range.focus();
  await page.keyboard.press('ArrowRight');
  const changed=await range.inputValue();
  if(Number(changed)<=24)throw new Error('Clinical slider did not respond to input');
  await page.getByRole('button',{name:'Ask tutor to explain my result'}).click();
  const observation=await page.locator('[data-testid="simulator-observation"]').innerText();
  if(!observation.startsWith('Ask tutor: ') || !observation.includes('"preset":"acid_base_balance"') || !observation.includes('"result":'))
    throw new Error('Simulator did not emit typed numerical tutor feedback');
  const packet=JSON.parse(observation.slice('Ask tutor: '.length));
  if(!packet.variables || packet.variables.bicarbonate!==Number(changed) || packet.preset!=='acid_base_balance' || !Number.isFinite(packet.result))
    throw new Error('Simulation feedback lost selected values or computed result');
  console.log('PASS_TYPED_SIMULATION_TUTOR_FEEDBACK',changed,packet.result);
  await page.screenshot({path:output+'/desktop-acid-base.png',fullPage:true});
  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const mob=await mobile.newPage();
  await mob.goto(url,{waitUntil:'domcontentloaded',timeout:50000});
  await mob.getByRole('heading',{name:'Hands-on medical learning'}).waitFor();
  const mobileErrors=[];
  mob.on('pageerror',e=>mobileErrors.push(e.message));
  await mob.locator('#lab-visual').selectOption('simulation:drug_half_life');
  try {
    await mob.getByText('Drug amount remaining').waitFor({timeout:45000});
  } catch (failure) {
    await mob.screenshot({path:output+'/mobile-diagnostic.png',fullPage:true}).catch(()=>undefined);
    console.log('MOBILE_DIAGNOSTIC_URL',mob.url());
    console.log('MOBILE_DIAGNOSTIC_TEXT',(await mob.locator('body').innerText().catch(()=>'' )).slice(0,2800));
    console.log('MOBILE_DIAGNOSTIC_ERRORS',JSON.stringify(mobileErrors));
    throw failure;
  }
  const heading=mob.locator('[data-testid="visual-lab-stage"]').getByRole('heading',{name:'Drug elimination lab'});
  const headingBounds=await heading.boundingBox();
  const mobileStage=await mob.locator('[data-testid="visual-lab-stage"]').boundingBox();
  if(!headingBounds || !mobileStage || headingBounds.y<mobileStage.y-5)
    throw new Error('Mobile simulator heading is clipped above the stage scroll container');
  await mob.screenshot({path:output+'/mobile-half-life.png',fullPage:true});
  if((await mob.locator('input[type="range"]').count())<2)throw new Error('Mobile simulation sliders missing');
  console.log('PASS_MOBILE_LAB');
  await mobile.close();
  if(mobileErrors.length)throw new Error('Mobile runtime exceptions: '+mobileErrors.slice(0,4).join(' | '));
  if(errors.length)throw new Error('Runtime exceptions: '+errors.slice(0,4).join(' | '));
  console.log('ALL_VISUAL_LAB_REAL_BROWSER_TESTS_PASSED');
}finally{
  await browser.close();
}
