import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import Avatar from "../../components/Avatar/Avatar";
import Card from "../../components/Card/Card";
import Icon from "../../components/Icon/Icon";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import Segmented from "../../components/Segmented/Segmented";
import { useData } from "../../store/DataContext";
import { useTheme } from "../../store/ThemeContext";
import { homeOf } from "../../utils/homes";
import { roleLabels } from "../../utils/roles";
import styles from "./Profile.module.css";

const themes = [
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" },
  { value: "system", label: "Системная" },
];

const tones = [
  { value: "green", label: "Зелёный", color: "#667A55" },
  { value: "terra", label: "Терракотовый", color: "#D38A62" },
  { value: "mint", label: "Светло-зелёный", color: "#E5EBE0", outlined: true },
  { value: "cream", label: "Кремовый", color: "#F5F3EE", outlined: true },
  { value: "graphite", label: "Графитовый", color: "#20221F", outlined: true },
];

const legacyTones = { sage: "mint", gray: "cream" };
const MAX_PHOTO_MB = 5;

const NOTIFICATION_KINDS = 5;

function MenuRow({ to, onClick, icon, label, sub, danger = false }) {
  const content = (
    <>
      <span className={`${styles.rowIcon} ${danger ? styles.rowIconDanger : ""}`}>
        <Icon name={icon} size={20} strokeWidth={1.8} />
      </span>
      <span className={styles.rowText}>
        <span className={`${styles.rowLabel} ${danger ? styles.rowLabelDanger : ""}`}>{label}</span>
        {sub && <span className={styles.rowSub}>{sub}</span>}
      </span>
      {to && <Icon name="chevron" size={18} className={styles.chevron} />}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={styles.row}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={styles.row} onClick={onClick}>
      {content}
    </button>
  );
}

function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { members, homes, currentUserId, updateMember, familyName, notificationSettings } = useData();
  const [confirm, setConfirm] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const me = members.find((m) => m.id === currentUserId);

  if (!me) {
    return <Navigate to="/" replace />;
  }

  const myHome = homeOf(homes, me.id);
  const enabledCount = Object.values(notificationSettings).filter(Boolean).length;
  const notice = location.state?.notice;
  const currentTone = legacyTones[me.tone] ?? me.tone;
  const toneInfo = tones.find((t) => t.value === currentTone);
  const ringColor = toneInfo?.outlined ? "var(--field-border)" : toneInfo?.color;

  function handlePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Выберите изображение");
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setPhotoError(`Файл больше ${MAX_PHOTO_MB} МБ`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateMember(me.id, { photo: reader.result });
      setPhotoError("");
    };
    reader.readAsDataURL(file);
  }

  return (
    <Page className={styles.page}>
      <PageHeader title="Профиль" to="/more" />

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      <div className={styles.hero}>
        <span className={styles.ring} style={{ borderColor: ringColor }}>
          <Avatar letter={me.letter} tone={me.tone} photo={me.photo} size={88} />
        </span>
        <div className={styles.photoActions}>
          <label className={styles.photoButton}>
            {me.photo ? "Сменить фото" : "Загрузить фото"}
            <input type="file" accept="image/*" className={styles.fileInput} onChange={handlePhoto} />
          </label>
          {me.photo && (
            <button
              type="button"
              className={styles.photoRemove}
              onClick={() => updateMember(me.id, { photo: "" })}
            >
              Удалить фото
            </button>
          )}
        </div>
        {photoError && <span className={styles.photoError}>{photoError}</span>}
        <span className={styles.heroName}>{me.name}</span>
        <span className={`${styles.role} ${styles[me.role]}`}>{roleLabels[me.role]}</span>
        <span className={styles.heroFamily}>
          {familyName}
          {me.joined && ` · В семье с ${me.joined}`}
        </span>
        <span className={styles.heroEmail}>{me.email}</span>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Аккаунт</h2>
        <Card flush>
          <MenuRow
            to="/profile/personal"
            icon="user"
            label="Личные данные"
            sub={me.birthday ? `День рождения: ${me.birthday}` : "Имя и день рождения"}
          />
          <MenuRow
            to={myHome ? `/more/home/${myHome.id}` : "/more/homes"}
            icon="home"
            label="Мой дом"
            sub={myHome ? `Сейчас: ${myHome.name}${myHome.place ? `, ${myHome.place}` : ""}` : "Не выбран"}
          />
          <MenuRow to="/profile/phone" icon="phone" label="Телефон" sub={me.phone || "Не указан"} />
          <MenuRow
            to="/profile/food"
            icon="food"
            label="Предпочтения в еде"
            sub={me.foodPrefs?.length ? me.foodPrefs.join(", ") : "Не указаны"}
          />
          <MenuRow
            to="/profile/notifications"
            icon="bell"
            label="Уведомления"
            sub={`Включено ${enabledCount} из ${NOTIFICATION_KINDS}`}
          />
        </Card>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Оформление</h2>
        <Card className={styles.appearance}>
          <span className={styles.label}>Тема</span>
          <Segmented options={themes} value={theme} onChange={setTheme} label="Тема оформления" />

          <span className={styles.label}>Цвет аватара</span>
          <div className={styles.tones} role="group" aria-label="Цвет аватара">
            {tones.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`${styles.tone} ${t.outlined ? styles.toneOutlined : ""} ${
                  currentTone === t.value ? styles.toneActive : ""
                }`}
                style={{ background: t.color }}
                aria-label={t.label}
                aria-pressed={currentTone === t.value}
                onClick={() => updateMember(me.id, { tone: t.value })}
              />
            ))}
          </div>
        </Card>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Безопасность</h2>
        <Card flush>
          <MenuRow to="/profile/password" icon="lock" label="Сменить пароль" />
          <MenuRow icon="logout" label="Выйти на всех устройствах" onClick={() => setConfirm("logout")} />
          <MenuRow icon="trash" label="Удалить аккаунт" danger onClick={() => setConfirm("delete")} />
        </Card>

        {confirm && (
          <div className={styles.confirm} role="alert">
            <p className={styles.confirmText}>
              {confirm === "logout"
                ? "Выйти из аккаунта на всех устройствах? Понадобится войти заново."
                : "Удалить аккаунт? Ваши данные будут удалены, а вы покинете семью. Это действие нельзя отменить."}
            </p>
            <div className={styles.confirmButtons}>
              <button type="button" className={styles.cancel} onClick={() => setConfirm(null)}>
                Отмена
              </button>
              <button
                type="button"
                className={styles.confirmAction}
                onClick={() => navigate("/", { replace: true })}
              >
                {confirm === "logout" ? "Выйти" : "Удалить"}
              </button>
            </div>
          </div>
        )}
      </section>
    </Page>
  );
}

export default Profile;
