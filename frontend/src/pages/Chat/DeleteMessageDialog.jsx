import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {t} from '../../i18n';
import {errorText} from '../../api/client';
import styles from './DeleteMessageDialog.module.css';

export default function DeleteMessageDialog({title, canDeleteAll, onDelete, onClose}) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const previous = document.activeElement;
    const node = ref.current;
    node.showModal();
    return () => {node.close();previous?.focus({preventScroll:true});};
  }, []);
  async function remove(scope) {
    if (busy) return;
    setBusy(true);setError('');
    try {await onDelete(scope);} catch(e) {setError(errorText(e));setBusy(false);}
  }
  return createPortal(<dialog ref={ref} className={styles.dialog} aria-labelledby="delete-message-title"
    onCancel={e=>{e.preventDefault();if(!busy)onClose();}}
    onClick={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
    <h2 id="delete-message-title">{title??t('chatRich.deleteTitle')}</h2>
    {error&&<p role="alert">{error}</p>}
    <div className={styles.actions} aria-busy={busy}>
      <button type="button" disabled={busy} onClick={()=>remove('me')}>{t('chatRich.deleteMe')}</button>
      {canDeleteAll&&<button type="button" disabled={busy} onClick={()=>remove('all')}>{t('chatRich.deleteAll')}</button>}
      <button type="button" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
    </div>
  </dialog>, document.body);
}
