'use client';
import {useEffect,useRef,type ReactNode} from 'react';
/** Follow the visible mobile viewport, including browser bars and the keyboard. */
export function ClassroomViewport({active,className,children}:{active:boolean;className:string;children:ReactNode}){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{
   if(!active)return;
   const viewport=window.visualViewport;
   const update=()=>{if(root.current){root.current.style.height=(viewport?.height||window.innerHeight)+'px';root.current.style.top=(viewport?.offsetTop||0)+'px';}};
   update();viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);window.addEventListener('resize',update);
   return()=>{viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
 },[active]);
 return <div ref={root} data-live-class={active?'true':undefined} className={className}>{children}</div>;
}
export function ClassroomDock({children}:{children:ReactNode}){
 const dock=useRef<HTMLElement>(null);
 useEffect(()=>{
   const element=dock.current,root=element?.closest<HTMLElement>('[data-live-class]');
   if(!element||!root)return;
   const update=()=>root.style.setProperty('--class-dock-height',(element.getBoundingClientRect().height+40)+'px');
   const observer=new ResizeObserver(update);observer.observe(element);update();return()=>observer.disconnect();
 },[]);
 return <section ref={dock} aria-label="Live Class controls" className="classroom-dock">{children}</section>;
}
