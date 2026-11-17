import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {getLang,t} from '../../i18n';
import styles from './SmartCaptcha.module.css';

let sdkPromise;
function loadSDK(){
 if(window.smartCaptcha)return Promise.resolve(window.smartCaptcha);
 if(!sdkPromise)sdkPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  const timer=setTimeout(()=>{script.remove();delete window.famigoSmartCaptchaReady;reject(new Error('captcha_timeout'));},15000);
  window.famigoSmartCaptchaReady=()=>{clearTimeout(timer);delete window.famigoSmartCaptchaReady;resolve(window.smartCaptcha);};
  script.src='https://smartcaptcha.yandexcloud.net/captcha.js?render=onload&onload=famigoSmartCaptchaReady';
  script.async=true;
  script.onerror=()=>{clearTimeout(timer);script.remove();delete window.famigoSmartCaptchaReady;reject(new Error('captcha_load'));};
  document.head.append(script);
 }).catch(error=>{sdkPromise=undefined;throw error;});
 return sdkPromise;
}

export function CaptchaLoadError({onRetry}){
 return <p className={styles.error} role="alert">{t('captcha.loadError')} <button type="button" onClick={onRetry}>{t('captcha.retry')}</button></p>;
}

export default function SmartCaptcha({sitekey,onToken}){
 const root=useRef(null);
 const viewport=useRef(null);
 const [error,setError]=useState(false),[retry,setRetry]=useState(0);
 const language=getLang()==='ru'?'ru':'en'; // The provider supports RU/EN, not DE/ES/ZH/JA.
 useLayoutEffect(()=>{
  const container=viewport.current,widget=root.current;
  const fit=()=>{
   const width=container.getBoundingClientRect().width;
   const scale=Math.min(1,width/300);
   widget.style.width=`${Math.max(300,width)}px`;
   widget.style.transform=`scale(${scale})`;
   container.style.height=`${widget.offsetHeight*scale}px`;
  };
  const observer=new ResizeObserver(fit);observer.observe(container);observer.observe(widget);fit();
  return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  let active=true,sdk,id;const unsubscribe=[];
  onToken('');
  loadSDK().then(api=>{
   if(!active)return;sdk=api;
   const theme=()=>document.documentElement.dataset.theme==='dark'?'dark':'light';
   id=api.render(root.current,{sitekey,hl:language,theme:theme(),callback:token=>{if(active){setError(false);onToken(token);}}});
   const themeObserver=new MutationObserver(()=>api.setTheme?.(id,theme()));
   themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
   unsubscribe.push(()=>themeObserver.disconnect());
   unsubscribe.push(api.subscribe(id,'token-expired',()=>{if(active)onToken('');}));
   for(const event of ['network-error','javascript-error'])unsubscribe.push(api.subscribe(id,event,()=>{if(active){onToken('');setError(true);}}));
  }).catch(()=>{if(active){onToken('');setError(true);}});
  return()=>{active=false;unsubscribe.forEach(fn=>fn());if(sdk&&id!==undefined)sdk.destroy(id);};
 },[sitekey,language,onToken,retry]);
 return <section className={styles.root} aria-label={t('captcha.title')}>
  <p className={styles.hint}>{t('captcha.prompt')}</p>
  <div className={styles.viewport} ref={viewport}><div className={styles.widget} ref={root}/></div>
  {error&&<CaptchaLoadError onRetry={()=>{setError(false);setRetry(n=>n+1);}}/>}
 </section>;
}
