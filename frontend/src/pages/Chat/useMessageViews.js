import {useEffect,useRef} from 'react';

export default function useMessageViews({containerRef,chatKey,userId,messageIds,markMessagesSeen,blocked}) {
  const confirmed=useRef(new Map());
  useEffect(()=>{
    const root=containerRef.current;
    if(!root||!messageIds||blocked)return;
    const cacheKey=`${userId}:${chatKey}`;
    if(!confirmed.current.has(cacheKey))confirmed.current.set(cacheKey,new Set());
    const seen=confirmed.current.get(cacheKey);
    const visible=new Map();
    let disposed=false,inFlight=false,retryAt=0;
    async function flush(){
      if(disposed||inFlight||Date.now()<retryAt||document.visibilityState!=='visible'||!document.hasFocus()||document.querySelector('dialog[open]'))return;
      const ids=[...visible].filter(([id,node])=>{
        if(seen.has(id))return false;
        const box=node.getBoundingClientRect(),bounds=root.getBoundingClientRect();
        return box.bottom>Math.max(bounds.top,0)&&box.top<Math.min(bounds.bottom,window.innerHeight)&&box.right>0&&box.left<window.innerWidth;
      }).slice(0,100).map(([id])=>id);
      if(!ids.length)return;
      inFlight=true;
      try{await markMessagesSeen(chatKey,ids);ids.forEach(id=>seen.add(id));}
      catch{retryAt=Date.now()+2500;}
      finally{inFlight=false;}
    }
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){const id=entry.target.dataset.viewMessage;if(entry.isIntersecting&&entry.intersectionRect.height>0)visible.set(id,entry.target);else visible.delete(id);}
      flush();
    },{root,threshold:0});
    for(const node of root.querySelectorAll('[data-view-message]'))observer.observe(node);
    // Retry after transient failures and after closing a media viewer, and handle
    // returning to a tab without falsely reading background/covered messages.
    const timer=setInterval(flush,750);
    document.addEventListener('visibilitychange',flush);window.addEventListener('focus',flush);
    return()=>{disposed=true;observer.disconnect();clearInterval(timer);document.removeEventListener('visibilitychange',flush);window.removeEventListener('focus',flush);};
  },[containerRef,chatKey,userId,messageIds,markMessagesSeen,blocked]);
}
