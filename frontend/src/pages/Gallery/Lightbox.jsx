import { useEffect, useState } from "react";
import Avatar from "../../components/Avatar/Avatar";
import Icon from "../../components/Icon/Icon";
import useSwipe from "../../hooks/useSwipe";
import { getLocale, t } from "../../i18n";
import { useData } from "../../store/DataContext";
import { canManageHomes } from "../../utils/permissions";
import { downloadItem } from "../../utils/download";
import { formatBytes } from "../../utils/storage";
import styles from "./Lightbox.module.css";

export default function Lightbox({ items, index, onOpen, onClose }) {
  const { members, currentUserId, removeGalleryItem } = useData();
  const [confirming, setConfirming] = useState(false);
  const item = items[index];
  const author = members.find((m) => m.id === item.by);
  const me = members.find((m) => m.id === currentUserId);
  const canDelete = item.by === currentUserId || canManageHomes(me);
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;
  const swipe = useSwipe({
    onLeft: () => hasNext && go(index + 1),
    onRight: () => hasPrev && go(index - 1),
  });
  const dateFormat = new Intl.DateTimeFormat(getLocale(), { day: "numeric", month: "long", year: "numeric" });

  function go(next) {
    setConfirming(false);
    onOpen(items[next].id);
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  function remove() {
    const nextId = (items[index + 1] ?? items[index - 1])?.id;
    removeGalleryItem(item.id);
    setConfirming(false);
    if (nextId) onOpen(nextId);
    else onClose();
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={t("gallery.title")} {...swipe}>
      <header className={styles.head}>
        <span className={styles.who}>
          <Avatar letter={author?.letter ?? "?"} tone={author?.tone ?? "cream"} photo={author?.photo} size={36} />
          <span className={styles.whoText}>
            <span className={styles.name}>{author?.name ?? t("common.formerMember")}</span>
            <span className={styles.meta}>
              {dateFormat.format(new Date(item.at))} · {formatBytes(item.size)}
            </span>
          </span>
        </span>
        <span className={styles.counter}>
          {index + 1} / {items.length}
        </span>
        <button type="button" className={styles.iconButton} aria-label={t("common.close")} onClick={onClose}>
          <Icon name="close" size={22} />
        </button>
      </header>

      <div className={styles.stage} onClick={onClose}>
        {hasPrev && (
          <button
            type="button"
            className={`${styles.nav} ${styles.prev}`}
            aria-label={t("gallery.viewer.prev")}
            onClick={(e) => {
              e.stopPropagation();
              go(index - 1);
            }}
          >
            <Icon name="back" size={24} />
          </button>
        )}

        {item.type === "video" ? (
          <video key={item.id} src={item.url} className={styles.media} controls autoPlay playsInline onClick={(e) => e.stopPropagation()} />
        ) : (
          <img key={item.id} src={item.url} alt="" className={styles.media} onClick={(e) => e.stopPropagation()} />
        )}

        {hasNext && (
          <button
            type="button"
            className={`${styles.nav} ${styles.next}`}
            aria-label={t("gallery.viewer.next")}
            onClick={(e) => {
              e.stopPropagation();
              go(index + 1);
            }}
          >
            <Icon name="chevron" size={24} />
          </button>
        )}
      </div>

      <footer className={styles.foot}>
        {confirming ? (
            <div className={styles.confirm} role="alert">
              <span>{t("gallery.viewer.deleteConfirm")}</span>
              <button type="button" className={styles.ghost} onClick={() => setConfirming(false)}>
                {t("common.cancel")}
              </button>
              <button type="button" className={styles.danger} onClick={remove}>
                {t("common.delete")}
              </button>
            </div>
        ) : (
          <>
            <button type="button" className={styles.ghost} onClick={() => downloadItem(item, index)}>
              <Icon name="download" size={18} strokeWidth={1.8} />
              {t("gallery.download")}
            </button>
            {canDelete && (
              <button type="button" className={styles.ghost} onClick={() => setConfirming(true)}>
                <Icon name="trash" size={18} strokeWidth={1.8} />
                {t("gallery.viewer.delete")}
              </button>
            )}
          </>
        )}
      </footer>
    </div>
  );
}
