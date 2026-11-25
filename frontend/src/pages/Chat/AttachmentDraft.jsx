import Icon from '../../components/Icon/Icon';
import {t} from '../../i18n';
import styles from './AttachmentDraft.module.css';

export default function AttachmentDraft({items, disabled, onRemove, onClear}) {
  if (!items.length) return null;
  return <section className={styles.draft} aria-label={t('chatRich.attachments')}>
    <div className={styles.header}>
      <span>{t('chatRich.attachmentCount', {count: items.length})}</span>
      <button type="button" disabled={disabled} onClick={onClear}>{t('chatRich.clearAttachments')}</button>
    </div>
    <ul className={styles.list}>
      {items.map(item => <li key={item.id}>
        {item.type === 'video' ? <video src={item.url} muted playsInline preload="metadata"/> : <img src={item.url} alt={item.file.name}/>}
        {item.type === 'video' && <span className={styles.video}><Icon name="video" size={18}/></span>}
        <button type="button" disabled={disabled} onClick={() => onRemove(item.id)} aria-label={t('chatRich.removeAttachment', {name: item.file.name})}><Icon name="close" size={16}/></button>
      </li>)}
    </ul>
  </section>;
}
