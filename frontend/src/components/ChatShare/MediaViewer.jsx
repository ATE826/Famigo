import {t} from '../../i18n';
import {useEffect,useEffectEvent,useRef,useState} from 'react';
import {useData} from '../../store/DataContext';
import {mediaBlob} from '../../api/client';
import Icon from '../Icon/Icon';
import styles from './MessageContent.module.css';

export default function MediaViewer({media,items,chatId,initialResource,onChange,onClose}) {
 const {familyId}=useData();
 const ref=useRef(null);
 const playback=useRef(null);
 const [loaded,setLoaded]=useState(null);
 const initialId=initialResource?.id,initialUrl=initialResource?.url;
 const index=items.findIndex(item=>item.id===media.id);
 const resource=initialId===media.id&&initialUrl?{url:initialUrl}:loaded?.id===media.id?loaded:null;
 const activeUrl=resource?.url;
 function navigate(step){
  const next=items[index+step];
  if(next)onChange(next.id);
 }
 const navigateWithKeyboard=useEffectEvent(step=>navigate(step));
 useEffect(()=>{
  const node=ref.current,previous=document.activeElement;
  node.showModal();
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const keydown=e=>{
   if(e.defaultPrevented||e.isComposing||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||!node.open)return;
   if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
   e.preventDefault();e.stopPropagation();navigateWithKeyboard(e.key==='ArrowLeft'?-1:1);
  };
  document.addEventListener('keydown',keydown,true);
  return()=>{document.removeEventListener('keydown',keydown,true);node.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[]);
 useEffect(()=>{
  if(initialId===media.id&&initialUrl)return;
  const controller=new AbortController();let url;
  mediaBlob(`/families/${familyId}/chats/${chatId}/media/${media.id}`,{signal:controller.signal}).then(blob=>{
   if(controller.signal.aborted)return;
   url=URL.createObjectURL(blob);setLoaded({id:media.id,url});
  }).catch(()=>{if(!controller.signal.aborted)setLoaded({id:media.id,error:true});});
  return()=>{controller.abort();if(url)URL.revokeObjectURL(url);};
 },[familyId,chatId,media.id,initialId,initialUrl]);
 useEffect(()=>{
  const video=playback.current;
  return()=>video?.pause();
 },[media.id,activeUrl]);
 return <dialog ref={ref} className={styles.viewer} onContextMenu={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}} aria-label={t('chatRich.viewer')}>
  <header className={styles.viewerHeader}>
   <span className={styles.viewerFilename}>{media.name}</span>
   <span className={styles.viewerCounter} role="status" aria-live="polite">{index+1} / {items.length}</span>
   <button type="button" onClick={onClose} aria-label={t('chatRich.closeViewer')} autoFocus><Icon name="close" size={24}/></button>
  </header>
  <div className={styles.viewerStage} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
   {items.length>1&&<button type="button" className={`${styles.viewerNav} ${styles.viewerPrev}`} disabled={index<=0} onClick={()=>navigate(-1)} aria-label={t('chatRich.previousMedia')}><Icon name="back" size={26}/></button>}
   <div className={styles.viewerContent} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    {resource?.error?<p role="alert">{t('chatRich.loadFailed')}</p>:!resource?.url?<p role="status">{t('chatRich.loading')}</p>:media.mime.startsWith('video/')?<video ref={playback} key={media.id} src={resource.url} controls playsInline autoPlay/>:<img key={media.id} src={resource.url} alt={media.name}/>}
   </div>
   {items.length>1&&<button type="button" className={`${styles.viewerNav} ${styles.viewerNext}`} disabled={index>=items.length-1} onClick={()=>navigate(1)} aria-label={t('chatRich.nextMedia')}><Icon name="chevron" size={26}/></button>}
  </div>
 </dialog>;
}
