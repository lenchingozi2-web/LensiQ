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
page.on('response',res=>{
  if(res.url().includes('/storage/v1/object/public/medical-models/') && res.url().endsWith('.glb') && res.status()===200) {
    loadedGlb=true;console.log('REAL_GLB_HTTP_200',res.url());
  }
});
try {
  const url=origin+'/visual-lab';
  let loaded=false;
  for(let i=0;i<14;i++){
    const res=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000}).catch(()=>null);
    if(res?.status()===200 && await page.getByRole('heading',{name:'Hands-on medical learning'}).count()) {
      loaded=true;break;
    }
    await page.waitForTimeout(12000);
  }
  if(!loaded)throw new Error('Production visual laboratory route could not be reached');
  await page.locator('canvas').first().waitFor({state:'visible',timeout:70000});
  await page.waitForFunction(()=>!document.body.innerText.includes('Preparing 3D medical model'),{timeout:70000});
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
  await page.locator('#lab-visual').selectOption('simulation:acid_base_balance');
  await page.getByText('Calculated arterial pH').waitFor({timeout:20000});
  const range=page.getByRole('slider',{name:'Plasma bicarbonate'});
  await range.focus();
  await page.keyboard.press('ArrowRight');
  const changed=await range.inputValue();
  if(Number(changed)<=24)throw new Error('Clinical slider did not respond to input');
  await page.getByRole('button',{name:'Ask tutor to explain my result'}).click();
  const observation=await page.locator('[data-testid="simulator-observation"]').innerText();
  if(!observation.includes('Calculated arterial pH'))throw new Error('Simulator did not emit structured tutor context');
  console.log('PASS_SIMULATION_TUTOR_FEEDBACK',changed);
  await page.screenshot({path:output+'/desktop-acid-base.png',fullPage:true});
  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const mob=await mobile.newPage();
  await mob.goto(url,{waitUntil:'domcontentloaded',timeout:50000});
  await mob.getByRole('heading',{name:'Hands-on medical learning'}).waitFor();
  await mob.locator('#lab-visual').selectOption('simulation:drug_half_life');
  await mob.getByText('Drug amount remaining').waitFor();
  await mob.screenshot({path:output+'/mobile-half-life.png',fullPage:true});
  if((await mob.locator('input[type="range"]').count())<2)throw new Error('Mobile simulation sliders missing');
  console.log('PASS_MOBILE_LAB');
  await mobile.close();
  if(errors.length)throw new Error('Runtime exceptions: '+errors.slice(0,4).join(' | '));
  console.log('ALL_VISUAL_LAB_REAL_BROWSER_TESTS_PASSED');
}finally{
  await browser.close();
}
