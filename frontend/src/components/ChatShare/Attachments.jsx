import {t} from '../../i18n';
import {useEffect,useRef,useState} from 'react';
import Icon from '../Icon/Icon';
import styles from './Attachments.module.css';

export default function Attachments({disabled,onUpload}) {
 const [open,setOpen]=useState(false);
 const root=useRef(null),files=useRef(null),photo=useRef(null),video=useRef(null),trigger=useRef(null);
 useEffect(()=>{if(!open)return;const pointer=e=>{if(!root.current?.contains(e.target))setOpen(false);};const key=e=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}};document.addEventListener('pointerdown',pointer);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',pointer);document.removeEventListener('keydown',key);};},[open]);
 function pick(ref){setOpen(false);ref.current?.click();}
 return <div className={styles.root} ref={root}>
  <button ref={trigger} type="button" className={styles.trigger} disabled={disabled} onClick={()=>setOpen(!open)} aria-label={t("chatRich.attach")} aria-expanded={open} aria-haspopup="menu"><Icon name="paperclip" size={23}/></button>
  {open&&!disabled&&<div className={styles.menu} role="menu" aria-label={t("chatRich.addAttachment")}>
   <button type="button" role="menuitem" onClick={()=>pick(files)}><Icon name="image" size={21}/><span>{t("chatRich.gallery")}</span></button>
   <button type="button" role="menuitem" onClick={()=>pick(photo)}><Icon name="camera" size={21}/><span>{t("chatRich.photo")}</span></button>
   <button type="button" role="menuitem" onClick={()=>pick(video)}><Icon name="video" size={21}/><span>{t("chatRich.video")}</span></button>
   <small>{t("chatRich.limit")}</small>
  </div>}
  <input ref={files} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,video/mp4,video/webm,video/quicktime" multiple hidden onChange={onUpload}/>
  <input ref={photo} type="file" accept="image/*" capture="environment" hidden onChange={onUpload}/>
  <input ref={video} type="file" accept="video/*" capture="environment" hidden onChange={onUpload}/>
 </div>;
}
