import {t} from '../../i18n';
import {useEffect,useRef} from 'react';
import Icon from '../Icon/Icon';
import styles from './MessageContent.module.css';

export default function MediaViewer({url,media,onClose}) {
 const ref=useRef(null);
 useEffect(()=>{const node=ref.current;node.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{node.close();document.body.style.overflow=overflow;};},[]);
 return <dialog ref={ref} className={styles.viewer} onContextMenu={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}} aria-label={t("chatRich.viewer")}>
  <header className={styles.viewerHeader}><span>{media.name}</span><button type="button" onClick={onClose} aria-label={t("chatRich.closeViewer")}><Icon name="close" size={24}/></button></header>
  <div className={styles.viewerStage} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
   {media.mime.startsWith('video/')?<video src={url} controls playsInline autoPlay/>:<img src={url} alt={media.name}/>}
  </div>
 </dialog>;
}
