import {useEffect, useRef, useState} from 'react';
import {prepareMedia} from '../../utils/media';
import {t} from '../../i18n';
import {errorText} from '../../api/client';

const MAX_FILE = 25 * 1024 * 1024;
const MAX_TOTAL = 100 * 1024 * 1024;

export default function useAttachmentDraft(onError) {
  const [items, setItems] = useState([]);
  const [preparing, setPreparing] = useState(false);
  const current = useRef([]);
  const running = useRef(false);
  const epoch = useRef({cancelled: false});
  const nextId = useRef(0);
  const urls = useRef(new Set());
  useEffect(() => {
    const resources = urls.current;
    const token = {cancelled: false};epoch.current = token;
    return () => {token.cancelled = true;for (const url of resources) URL.revokeObjectURL(url);resources.clear();};
  }, []);
  async function add(files) {
    if (!files.length || running.current) return;
    const token = epoch.current;
    running.current = true;setPreparing(true);onError('');
    try {
      if (current.current.length + files.length > 10) throw new Error(t('chatRich.albumLimit'));
      if (files.some(file => file.size > MAX_FILE)) throw new Error(t('chatRich.tooLarge'));
      const prepared = [];
      for (const file of files) {
        const media = await prepareMedia(file);
        if (token.cancelled) return;
        if (!media) throw new Error(t('chatRich.chooseMedia'));
        if (media.file.size > MAX_FILE) throw new Error(t('chatRich.tooLarge'));
        prepared.push(media);
      }
      const total = [...current.current, ...prepared].reduce((size, item) => size + item.file.size, 0);
      if (total > MAX_TOTAL) throw new Error(t('chatRich.albumLimit'));
      const added = prepared.map(media => {
        const url = URL.createObjectURL(media.file);urls.current.add(url);
        return {...media, url, id: ++nextId.current};
      });
      current.current = [...current.current, ...added];setItems(current.current);
    } catch (error) {if (!token.cancelled) onError(errorText(error));}
    finally {if (!token.cancelled) {running.current = false;setPreparing(false);}}
  }
  function remove(id) {
    const item = current.current.find(item => item.id === id);
    if (item) {URL.revokeObjectURL(item.url);urls.current.delete(item.url);}
    current.current = current.current.filter(item => item.id !== id);setItems(current.current);
  }
  function clear() {
    for (const item of current.current) URL.revokeObjectURL(item.url);
    urls.current.clear();current.current = [];setItems([]);
  }
  return {items, preparing, add, remove, clear};
}
