import { useEffect, useState } from "react";
import Card from "../../components/Card/Card";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import { copyText } from "../../utils/clipboard";
import { INVITE_HOURS, timeLeftUntil } from "../../utils/invite";
import { t } from "../../i18n";
import styles from "./Invite.module.css";

// Код приглашения выдаёт сервер. Новый участник вводит его на экране
// «Создайте семью или присоединитесь» после регистрации.
function Invite() {
  const { getInvite, showError } = useData();
  const [invite, setInvite] = useState(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    getInvite().then(setInvite).catch(showError);
  }, [getInvite, showError]);

  // Раз в 30 секунд обновляем «осталось …», а когда код истёк — берём новый.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (invite && new Date(invite.expiresAt) <= now) {
      getInvite().then(setInvite).catch(showError);
    }
  }, [invite, now, getInvite, showError]);

  async function handleCopy() {
    // invite?.code, а не invite.code: React Compiler заранее вычисляет зависимости
    // функции, и пока код не загружен, invite.code уронил бы страницу.
    const code = invite?.code;
    if (!code) return;
    const ok = await copyText(code);
    setCopyStatus(ok ? "done" : "failed");
    setTimeout(() => setCopyStatus(""), 2000);
  }

  return (
    <Page className={styles.body}>
      <PageHeader title={t("invite.title")} to="/more/family" />

      <Card className={styles.linkCard}>
        <div className={styles.linkHead}>
          <h2 className={styles.cardTitle}>{t("invite.byCode")}</h2>
          <span className={styles.linkNote}>{t("invite.codeHint")}</span>
          {invite && (
            <span className={styles.linkNote}>
              {t("invite.rotates", { count: INVITE_HOURS, left: timeLeftUntil(invite.expiresAt, now) })}
            </span>
          )}
        </div>
        <div className={`${styles.link} ${styles.code}`}>{invite?.code ?? "· · · · ·"}</div>
        <button type="button" className={styles.copy} disabled={!invite} onClick={handleCopy}>
          {copyStatus === "done" && t("invite.copied")}
          {copyStatus === "failed" && t("invite.copyFailed")}
          {copyStatus === "" && t("invite.copyCode")}
        </button>
      </Card>
    </Page>
  );
}

export default Invite;
