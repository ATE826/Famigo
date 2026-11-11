import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import Icon from "../../components/Icon/Icon";
import Page from "../../components/Page/Page";
import FutureNotice from "../../components/FutureNotice/FutureNotice";
import PageHeader from "../../components/PageHeader/PageHeader";
import Segmented from "../../components/Segmented/Segmented";
import { getLocale, t } from "../../i18n";
import { useData } from "../../store/DataContext";
import { PLANS } from "../../utils/plans";
import { downloadMany } from "../../utils/download";
import { prepareMedia } from "../../utils/media";
import { canManageHomes } from "../../utils/permissions";
import { formatBytes } from "../../utils/storage";
import Lightbox from "./Lightbox";
import styles from "./Gallery.module.css";

const WARN_AT = 0.8;
const FULL_AT = 0.95;

function Gallery() {
  const { gallery, addGalleryItems, removeGalleryItem, plan, members, currentUserId } = useData();
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef(null);
  const pressTimer = useRef(null);
  const longPressed = useRef(false);

  useEffect(() => {
    if (!selecting) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape" && !confirmDelete) stopSelecting();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const used = gallery.reduce((sum, item) => sum + item.size, 0);
  const share = Math.min(used / plan.storage, 1);
  const level = share >= FULL_AT ? "full" : share >= WARN_AT ? "warn" : "ok";
  const visible = gallery.filter((item) => filter === "all" || item.type === (filter === "photos" ? "image" : "video"));
  const canUpgrade = plan.id !== "premiumPlus";
  const nextPlan = plan.id === "free" ? PLANS.premium : PLANS.premiumPlus;
  const dateFormat = new Intl.DateTimeFormat(getLocale(), { day: "numeric", month: "short", year: "numeric" });

  const filters = [
    { value: "all", label: t("gallery.filters.all") },
    { value: "photos", label: t("gallery.filters.photos") },
    { value: "videos", label: t("gallery.filters.videos") },
  ];

  async function handleFiles(e) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (files.length === 0) return;

    setBusy(true);
    setNotice(null);
    let total = used;
    const added = [];
    let skippedType = 0;
    let skippedSpace = 0;
    let failed = 0;

    for (const original of files) {
      let prepared;
      try {
        prepared = await prepareMedia(original);
      } catch {
        failed += 1;
        continue;
      }
      if (!prepared) {
        skippedType += 1;
      } else if (total + prepared.file.size > plan.storage) {
        skippedSpace += 1;
      } else {
        total += prepared.file.size;
        added.push({
          id: `g-${Date.now()}-${added.length}`,
          type: prepared.type,
          mime: prepared.file.type,
          name: prepared.file.name,
          url: URL.createObjectURL(prepared.file),
          size: prepared.file.size,
          by: currentUserId,
          at: new Date().toISOString(),
        });
      }
    }

    if (added.length > 0) addGalleryItems(added);
    setBusy(false);
    if (skippedSpace > 0) setNotice({ kind: "space", count: skippedSpace });
    else if (failed > 0) setNotice({ kind: "failed", count: failed });
    else if (skippedType > 0) setNotice({ kind: "type" });
  }

  const openIndex = visible.findIndex((item) => item.id === openId);
  const me = members.find((m) => m.id === currentUserId);
  const canDelete = (item) => item.by === currentUserId || canManageHomes(me);
  const selectedItems = visible.filter((item) => selected.includes(item.id));
  const deletable = selectedItems.filter(canDelete);
  const allSelected = visible.length > 0 && selectedItems.length === visible.length;

  function stopSelecting() {
    setSelecting(false);
    setSelected([]);
  }

  function toggle(id) {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function startPress(id) {
    longPressed.current = false;
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setSelecting(true);
      setSelected((current) => (current.includes(id) ? current : [...current, id]));
    }, 450);
  }

  function endPress() {
    clearTimeout(pressTimer.current);
  }

  function handleTile(id) {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    if (selecting) toggle(id);
    else setOpenId(id);
  }

  function removeSelected() {
    deletable.forEach((item) => removeGalleryItem(item.id));
    setConfirmDelete(false);
    stopSelecting();
  }

  return (
    <Page wide>
      <PageHeader
        title={t("gallery.title")}
        subtitle={t("gallery.subtitle")}
        right={
          <div className={styles.headActions}>
            {gallery.length > 0 && (
              <button
                type="button"
                className={styles.selectButton}
                aria-pressed={selecting}
                onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
              >
                {selecting ? t("common.cancel") : t("gallery.select")}
              </button>
            )}
            <button
              type="button"
              className={styles.addButton}
              disabled={busy}
              aria-label={t("gallery.add")}
              onClick={() => inputRef.current?.click()}
            >
              <Icon name="plus" size={18} />
              <span className={styles.addLabel}>{t("gallery.add")}</span>
            </button>
          </div>
        }
      />

      <FutureNotice />

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className={styles.fileInput}
        onChange={handleFiles}
        aria-label={t("gallery.add")}
      />

      <section className={styles.storage} aria-label={t("gallery.storage")}>
        <div className={styles.storageHead}>
          <span className={styles.storageTitle}>{t("gallery.storage")}</span>
          <span className={styles.planChip}>{t(`premium.plans.${plan.id}.name`)}</span>
        </div>
        <div className={styles.storageNumbers}>
          <span className={styles.used}>{t("gallery.usedOf", { used: formatBytes(used), limit: formatBytes(plan.storage) })}</span>
          <span className={styles.free}>{t("gallery.free", { free: formatBytes(Math.max(plan.storage - used, 0)) })}</span>
        </div>
        <div
          className={styles.track}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(share * 100)}
        >
          <div className={`${styles.fill} ${styles[level]}`} style={{ width: `${Math.max(share * 100, used > 0 ? 1.5 : 0)}%` }} />
        </div>
        {canUpgrade && (
          <Link to="/premium" state={{ reason: "storage" }} className={styles.upgrade}>
            <Icon name="crown" size={16} strokeWidth={1.8} />
            {t("gallery.upgrade", { size: formatBytes(nextPlan.storage) })}
          </Link>
        )}
      </section>

      {busy && (
        <p className={styles.busy} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          {t("gallery.processing")}
        </p>
      )}

      {notice && (
        <p className={styles.notice} role="alert">
          <Icon name="upload" size={18} strokeWidth={1.8} />
          <span>
            {notice.kind === "space"
              ? t("gallery.noSpace", { count: notice.count })
              : notice.kind === "failed"
                ? t("gallery.convertFailed", { count: notice.count })
                : t("gallery.unsupported")}
            {notice.kind === "space" && canUpgrade && (
              <>
                {" "}
                <Link to="/premium" state={{ reason: "storage" }} className={styles.noticeLink}>
                  {t("gallery.noSpaceCta")}
                </Link>
              </>
            )}
          </span>
          <button type="button" className={styles.noticeClose} aria-label={t("common.close")} onClick={() => setNotice(null)}>
            <Icon name="close" size={16} />
          </button>
        </p>
      )}

      {selecting ? (
        <div className={styles.selectBar} role="toolbar" aria-label={t("gallery.selected", { count: selectedItems.length })}>
          <span className={styles.selectCount}>{t("gallery.selected", { count: selectedItems.length })}</span>
          <button
            type="button"
            className={styles.barButton}
            onClick={() => setSelected(allSelected ? [] : visible.map((item) => item.id))}
          >
            {allSelected ? t("gallery.clear") : t("gallery.selectAll")}
          </button>
          <button
            type="button"
            className={styles.barButton}
            disabled={selectedItems.length === 0}
            onClick={() => downloadMany(selectedItems)}
          >
            <Icon name="download" size={18} strokeWidth={1.8} />
            {t("gallery.download")}
          </button>
          {deletable.length > 0 && (
            <button type="button" className={`${styles.barButton} ${styles.barDanger}`} onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" size={18} strokeWidth={1.8} />
              {t("common.delete")}
            </button>
          )}
        </div>
      ) : (
        <div className={styles.filterRow}>
          <Segmented size="sm" options={filters} value={filter} onChange={setFilter} label={t("gallery.title")} />
        </div>
      )}

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <Icon name="image" size={28} strokeWidth={1.6} />
          </span>
          <h2 className={styles.emptyTitle}>{t("gallery.empty")}</h2>
          <p className={styles.emptyText}>{t("gallery.emptyHint")}</p>
        </div>
      ) : (
        <ul className={styles.grid}>
          {visible.map((item) => {
            const author = members.find((m) => m.id === item.by);
            const isSelected = selected.includes(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`${styles.tile} ${isSelected ? styles.tileSelected : ""}`}
                  aria-pressed={selecting ? isSelected : undefined}
                  onPointerDown={() => startPress(item.id)}
                  onPointerUp={endPress}
                  onPointerLeave={endPress}
                  onPointerCancel={endPress}
                  onContextMenu={(e) => selecting && e.preventDefault()}
                  aria-label={t("gallery.open", {
                    kind: t(item.type === "video" ? "gallery.viewer.video" : "gallery.viewer.photo"),
                    date: dateFormat.format(new Date(item.at)),
                  })}
                  onClick={() => handleTile(item.id)}
                >
                  {item.type === "video" ? (
                    <video src={item.url} className={styles.media} preload="metadata" muted playsInline />
                  ) : (
                    <img src={item.url} alt="" className={styles.media} loading="lazy" />
                  )}
                  {item.type === "video" && (
                    <span className={styles.play}>
                      <Icon name="play" size={18} strokeWidth={0} />
                    </span>
                  )}
                  {selecting && (
                    <span className={`${styles.check} ${isSelected ? styles.checkOn : ""}`} aria-hidden="true">
                      {isSelected && <Icon name="check" size={16} strokeWidth={3} />}
                    </span>
                  )}
                  <span className={styles.author}>{author?.name ?? t("common.formerMember")}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {confirmDelete && (
        <ConfirmDialog
          icon="trash"
          title={t("gallery.deleteDialog.title", { count: deletable.length })}
          text={`${t("gallery.deleteDialog.text")}${
            deletable.length < selectedItems.length
              ? " " + t("gallery.deleteDialog.partial", { count: selectedItems.length - deletable.length })
              : ""
          }`}
          cancelLabel={t("common.cancel")}
          confirmLabel={t("common.delete")}
          onConfirm={removeSelected}
          onClose={() => setConfirmDelete(false)}
        />
      )}

      {openIndex >= 0 && !selecting && (
        <Lightbox items={visible} index={openIndex} onOpen={setOpenId} onClose={() => setOpenId(null)} />
      )}
    </Page>
  );
}

export default Gallery;
