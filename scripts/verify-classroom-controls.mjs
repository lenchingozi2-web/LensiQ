// Actual mobile controls, bundled from their production components. No service writes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const require=createRequire(import.meta.url);
const {build}=require('esbuild');
const {chromium}=require('playwright');
const dir=await mkdtemp(join(tmpdir(),'classroom-controls-'));
let browser,server;
try{
 const css=await readFile('app/globals.css','utf8');
 const dockCss=css.slice(css.indexOf('.classroom-dock {'));
 const harness=`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
 import {ClassroomViewport,ClassroomDock} from '${resolve('components/voice/ClassroomViewport.tsx')}';
 import HoldToAsk from '${resolve('components/voice/HoldToAsk.tsx')}';
 import ClassAudioOptions from '${resolve('components/voice/ClassAudioOptions.tsx')}';
 window.calls=[];window.contextBlocked=false;
 function App(){const [phase,setPhase]=useState('idle'),[pace,setPace]=useState(.94);
 return <ClassroomViewport active={true} className="fixture-root"><div style={{height:900}}>Lecture board</div><ClassroomDock><p role="status">{phase}</p><div className="dock-actions"><button>Pause</button><button>Notes</button><HoldToAsk phase={phase} onHold={(on,cancel)=>{window.calls.push({on,cancel:Boolean(cancel)});setPhase(on?'holding':'idle');}}/>
 <ClassAudioOptions pace={pace} onPaceChange={v=>{setPace(v);window.lastPace=v;}} muted={false} blocked={false} onSound={()=>{}} pressToTalk={true} onMode={()=>{}}/></div></ClassroomDock></ClassroomViewport>}
 createRoot(document.getElementById('root')).render(<App/>);`;
 const compiled=await build({stdin:{contents:harness,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},nodePaths:[resolve('node_modules')]});
 const js=compiled.outputFiles[0].text;
 server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>.fixture-root{position:fixed;inset:0;overflow:hidden}.dock-actions{display:flex;flex-wrap:wrap;gap:6px}@media(max-width:639px){.dock-actions [data-testid]{flex-basis:100%}}'+dockCss+'</style><div id="root"></div><script>'+js+'</script>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
 const page=await browser.newPage({viewport:{width:360,height:800},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 const button=page.getByTestId('hold-to-ask');await button.waitFor();
 const box=await button.boundingBox();assert.ok(box);
 for(const viewport of [{width:360,height:640},{width:412,height:732},{width:740,height:360}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(100);
   for(const control of [button,page.getByText('Voice & pace',{exact:true}),page.getByText('Pause',{exact:true})]){const rect=await control.boundingBox();assert.ok(rect&&rect.y>=0&&rect.y+rect.height<=viewport.height-10,'Every control must fit the visible mobile viewport');}
 }
 await page.setViewportSize({width:360,height:800});await page.waitForTimeout(100);
 console.log('PASS_COMPLETE_MOBILE_DOCK_PORTRAIT_LANDSCAPE_AND_VIEWPORT_RESIZE');
 const actual=await button.boundingBox();const cdp=await page.context().newCDPSession(page),point={x:actual.x+actual.width/2,y:actual.y+actual.height/2};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
 await page.getByRole('status').filter({hasText:'holding'}).waitFor();
 await page.waitForTimeout(1100);
 const suppressed=await button.evaluate(el=>{const event=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});el.dispatchEvent(event);return event.defaultPrevented&&getComputedStyle(el).touchAction==='none';});
 assert.equal(suppressed,true);
 assert.equal(await button.getAttribute('aria-pressed'),'true');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.deepEqual(await page.evaluate(()=>window.calls),[{on:true,cancel:false},{on:false,cancel:false}]);
 console.log('PASS_ANDROID_SIZE_LONG_HOLD_NO_CONTEXT_MENU_LISTENING_AND_SINGLE_RELEASE');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 assert.equal((await page.evaluate(()=>window.calls)).at(-1).cancel,true);
 console.log('PASS_TOUCH_CANCELLATION_NEVER_SUBMITS');
 await button.focus();await page.keyboard.down('Space');await page.keyboard.up('Space');
 assert.equal((await page.evaluate(()=>window.calls)).length,6);
 await page.getByText('Voice & pace',{exact:true}).click();
 const slider=page.getByRole('slider',{name:'Teaching pace'});await slider.focus();await slider.press('ArrowLeft');
 assert.ok(Math.abs(await page.evaluate(()=>window.lastPace)-.93)<.001);
 assert.equal(await page.getByRole('slider').count(),1);
 assert.deepEqual(errors,[]);
 console.log('PASS_COMPACT_NATIVE_PACING_CONTROL_AND_KEYBOARD');
}finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
