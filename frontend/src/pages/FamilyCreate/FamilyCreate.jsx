import { useState } from "react";
import { Navigate } from "react-router-dom";
import Input from "../../components/Input/Input";
import Button from "../../components/Button/Button";
import { useData } from "../../store/DataContext";
import { t } from "../../i18n";
import { errorText } from "../../api/client";
import Splash from "../../components/Splash/Splash";
import styles from "./FamilyCreate.module.css";

// Код приглашения: 5 символов без похожих букв и цифр (как выдаёт сервер).
const CODE_LENGTH = 5;

function FamilyCreate() {
  const { status, createFamily, joinFamily } = useData();
  const [busy, setBusy] = useState(false);
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [familyError, setFamilyError] = useState("");
  const [inviteError, setInviteError] = useState("");

  async function handleCreate(event) {
    event.preventDefault();
    if (!familyName.trim()) {
      setFamilyError(t("familyCreate.nameRequired"));
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await createFamily(familyName.trim());
    } catch (error) {
      setFamilyError(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(event) {
    event.preventDefault();
    const code = inviteCode.trim();
    if (!code) {
      setInviteError(t("familyCreate.codeRequired"));
      return;
    }
    if (code.length !== CODE_LENGTH) {
      setInviteError(t("familyCreate.codeLength", { count: CODE_LENGTH }));
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await joinFamily(code);
    } catch (error) {
      setInviteError(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  // Экран нужен только тем, кто вошёл, но ещё не состоит в семье.
  if (status === "loading") return <Splash />;
  if (status === "guest") return <Navigate to="/" replace />;
  if (status === "ready") return <Navigate to="/main" replace />;

  return (
    <main className={styles.page}>
      <header className={styles.brand}>
        <span className={styles.logo}>F</span>
        <span className={styles.brandName}>Famigo</span>
      </header>
      <div className={styles.intro}>
        <h1 className={styles.title}>{t("familyCreate.title")}</h1>
        <p className={styles.subtitle}>
          {t("familyCreate.subtitle")}
        </p>
      </div>
      <form className={`${styles.card} ${styles.main}`} onSubmit={handleCreate} noValidate>
        <h2 className={styles.cardTitle}>{t("familyCreate.create")}</h2>
        <Input
          id="family"
          label={t("familyCreate.name")}
          type="text"
          placeholder={t("familyCreate.name")}
          value={familyName}
          onChange={(e) => {
            setFamilyName(e.target.value);
            setFamilyError("");
          }}
          hint={familyError}
        />
        <Button type="submit" disabled={busy}>{t("common.create")}</Button>
      </form>

      <form className={styles.card} onSubmit={handleJoin} noValidate>
        <h2 className={styles.cardTitle}>{t("familyCreate.join")}</h2>
        <Input
          id="invite"
          label={t("familyCreate.code")}
          type="text"
          placeholder={t("familyCreate.code")}
          maxLength={CODE_LENGTH}
          value={inviteCode}
          onChange={(e) => {
            setInviteCode(e.target.value);
            setInviteError("");
          }}
          hint={inviteError}
        />
        <Button type="submit" disabled={busy}>{t("familyCreate.join")}</Button>
      </form>
    </main>
  );
}

export default FamilyCreate;
