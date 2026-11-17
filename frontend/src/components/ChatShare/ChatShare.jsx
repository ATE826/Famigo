import {t} from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import { useData } from '../../store/DataContext';
import { errorText } from '../../api/client';
import styles from './ChatShare.module.css';

export default function ChatShare({ payload, onClose }) {
  const { members, currentUserId, sendRichMessage } = useData();
  const [target, setTarget] = useState('family');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef(null);
  useEffect(() => { const node=ref.current; node.showModal(); return () => node.close(); }, []);
  async function send() {
    setBusy(true); setError('');
    try { await sendRichMessage(target, payload); onClose(); }
    catch(e) {setError(errorText(e));}
    finally {setBusy(false);}
  }
  return <dialog ref={ref} className={styles.dialog} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget&&!busy)onClose();}} aria-labelledby="share-title">
    <h2 id="share-title">{t('recipeSaved.share')}</h2>
    <label>{t('recipeSaved.recipient')}<select value={target} onChange={e=>setTarget(e.target.value)} disabled={busy}>
      <option value="family">{t('recipeSaved.family')}</option>
      {members.filter(m=>m.id!==currentUserId).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
    </select></label>
    {error && <p role="alert">{error}</p>}
    <div className={styles.buttons}><button type="button" disabled={busy} onClick={onClose}>{t('common.cancel')}</button><button type="button" disabled={busy} onClick={send}>{busy?t('recipeSaved.sending'):t('recipeSaved.send')}</button></div>
  </dialog>;
}
