import {t} from '../../i18n';
import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import Icon from '../Icon/Icon';
import styles from './MessageMenu.module.css';

export default function MessageMenu({x,y,onReply,onForward,onDelete,onSelect,onClose}) {
 const ref=useRef(null);
 useEffect(()=>{
  const node=ref.current;
  const previous=document.activeElement;
  node.style.left=`${Math.max(12,Math.min(x,window.innerWidth-node.offsetWidth-12))}px`;
  node.style.top=`${Math.max(12,Math.min(y,window.innerHeight-node.offsetHeight-12))}px`;
  node.querySelector('button')?.focus();
  const dismiss=e=>{if(e.key==='Escape')onClose();};
  window.addEventListener('keydown',dismiss);window.addEventListener('resize',onClose);window.addEventListener('scroll',onClose,true);
  return()=>{if(node.contains(document.activeElement))previous?.focus({preventScroll:true});window.removeEventListener('keydown',dismiss);window.removeEventListener('resize',onClose);window.removeEventListener('scroll',onClose,true);};
 },[x,y,onClose]);
 function navigate(e){const buttons=[...ref.current.querySelectorAll('button')];const index=buttons.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();buttons[(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();}if(e.key==='Tab')onClose();}
 return createPortal(<div className={styles.backdrop} onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}} onContextMenu={e=>{e.preventDefault();onClose();}}><div ref={ref} className={styles.menu} role="menu" aria-label={t("chatRich.actions")} onKeyDown={navigate}>
  <button type="button" role="menuitem" onClick={onReply}><Icon name="reply" size={19}/>{t("chatRich.reply")}</button>
  <button type="button" role="menuitem" onClick={onForward}><Icon name="forward" size={19}/>{t("chatRich.forward")}</button>
  {onSelect&&<button type="button" role="menuitem" onClick={onSelect}><Icon name="check" size={19}/>{t("chatRich.select")}</button>}
  {onDelete&&<button type="button" role="menuitem" onClick={onDelete}><Icon name="trash" size={19}/>{t("common.delete")}</button>}
 </div></div>,document.body);
}
