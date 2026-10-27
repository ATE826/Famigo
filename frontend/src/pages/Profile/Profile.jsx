import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import Avatar from "../../components/Avatar/Avatar";
import Card from "../../components/Card/Card";
import Icon from "../../components/Icon/Icon";
import MenuRow from "../../components/MenuRow/MenuRow";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import { homeOf } from "../../utils/homes";
import { roleLabels } from "../../utils/roles";
import { t } from "../../i18n";
import { joinedLabel } from "../Calendar/data";
import { foodLabel } from "../ProfileFood/food";
import { prepareMedia } from "../../utils/media";
import { errorText } from "../../api/client";
import styles from "./Profile.module.css";

const tones = [
  { value: "green", color: "#667A55" },
  { value: "terra", color: "#D38A62" },
  { value: "mint", color: "#E5EBE0", outlined: true },
  { value: "cream", color: "#F5F3EE", outlined: true },
  { value: "graphite", color: "#20221F", outlined: true },
];

const legacyTones = { sage: "mint", gray: "cream" };
const MAX_PHOTO_MB = 5;

function Profile() {
  const { members, homes, currentUserId, familyName, uploadAvatar, removeAvatar, updateProfile, showError } = useData();
  const [photoError, setPhotoError] = useState("");
  const [uploading, setUploading] = useState(false);
  const me = members.find((m) => m.id === currentUserId);

  if (!me) {
    return <Navigate to="/" replace />;
  }

  const myHome = homeOf(homes, me.id);
  const currentTone = legacyTones[me.tone] ?? me.tone;
  const toneInfo = tones.find((tone) => tone.value === currentTone);
  const ringColor = toneInfo?.outlined ? "var(--field-border)" : toneInfo?.color;

  // Фото отправляется на сервер, там его проверят и перекодируют. Снимки iPhone (HEIC)
  // сначала переводим в JPEG прямо в браузере: сервер принимает JPEG, PNG, GIF и WebP.
  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setPhotoError(t("profile.fileTooBig", { count: MAX_PHOTO_MB }));
      return;
    }
    setUploading(true);
    try {
      const prepared = await prepareMedia(file);
      if (!prepared || prepared.type !== "image") {
        setPhotoError(t("profile.chooseImage"));
        return;
      }
      await uploadAvatar(prepared.file);
      setPhotoError("");
    } catch (error) {
      setPhotoError(errorText(error));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Page className={styles.page}>
      <PageHeader
        title={t("nav.profile")}
        to="/more"
        right={
          <Link to="/settings" className={styles.settings} aria-label={t("nav.settings")}>
            <Icon name="settings" size={20} strokeWidth={1.8} />
          </Link>
        }
      />

      <div className={styles.hero}>
        <span className={styles.ring} style={{ borderColor: ringColor }}>
          <Avatar letter={me.letter} tone={me.tone} photo={me.photo} size={88} />
        </span>
        <div className={styles.photoActions}>
          <label className={styles.photoButton}>
            {me.photo ? t("profile.changePhoto") : t("profile.uploadPhoto")}
            <input type="file" accept="image/*,.heic,.heif" className={styles.fileInput} disabled={uploading} onChange={handlePhoto} />
          </label>
          {me.photo && (
            <button
              type="button"
              className={styles.photoRemove}
              onClick={() => removeAvatar().catch(showError)}
            >
              {t("profile.removePhoto")}
            </button>
          )}
        </div>
        {photoError && <span className={styles.photoError}>{photoError}</span>}
        <span className={styles.heroName}>{me.name}</span>
        <span className={`${styles.role} ${styles[me.role]}`}>{roleLabels[me.role]}</span>
        <span className={styles.heroFamily}>
          {familyName}
          {me.joined && ` · ${t("profile.inFamilySince", { month: joinedLabel(me.joined) })}`}
        </span>
        <span className={styles.heroEmail}>{me.email}</span>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("profile.aboutMe")}</h2>
        <Card flush>
          <MenuRow
            to="/profile/personal"
            icon="user"
            label={t("profile.personal")}
            sub={me.birthday ? `${t("member.birthday")} ${me.birthday}` : t("profile.personalSub")}
          />
          <MenuRow
            to={myHome ? `/more/home/${myHome.id}` : "/more/homes"}
            icon="home"
            label={t("profile.myHome")}
            sub={
              myHome
                ? t("common.nowAt", { name: `${myHome.name}${myHome.place ? `, ${myHome.place}` : ""}` })
                : t("profile.notChosen")
            }
          />
          <MenuRow to="/profile/phone" icon="phone" label={t("profile.phone")} sub={me.phone || t("profile.notSet")} />
          <MenuRow
            to="/profile/checkin"
            icon="shield"
            label={t("safety.checkin.title")}
            sub={me.checkin?.enabled ? t("safety.checkin.on", { time: me.checkin.time }) : t("safety.checkin.off")}
          />
          <MenuRow
            to="/profile/food"
            icon="food"
            label={t("profile.food")}
            sub={me.foodPrefs?.length ? me.foodPrefs.map(foodLabel).join(", ") : t("profile.notSetPlural")}
          />
        </Card>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("profile.avatar")}</h2>
        <Card className={styles.appearance}>
          <span className={styles.label}>{t("profile.avatarColor")}</span>
          <div className={styles.tones} role="group" aria-label={t("profile.avatarColor")}>
            {tones.map((tone) => (
              <button
                key={tone.value}
                type="button"
                className={`${styles.tone} ${tone.outlined ? styles.toneOutlined : ""} ${
                  currentTone === tone.value ? styles.toneActive : ""
                }`}
                style={{ background: tone.color }}
                aria-label={t(`profile.tones.${tone.value}`)}
                aria-pressed={currentTone === tone.value}
                onClick={() => updateProfile({ tone: tone.value }).catch(showError)}
              />
            ))}
          </div>
        </Card>
      </section>
    </Page>
  );
}

export default Profile;
