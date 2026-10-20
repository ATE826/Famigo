import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card/Card";
import Input from "../../components/Input/Input";
import Select from "../../components/Select/Select";
import Button from "../../components/Button/Button";
import FormScreen from "../../components/FormScreen/FormScreen";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import { copyText } from "../../utils/clipboard";
import { INVITE_HOURS, inviteCode, timeLeftLabel } from "../../utils/invite";
import { t } from "../../i18n";
import { roleLabels } from "../../utils/roles";
import styles from "./Invite.module.css";

function Invite() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [now, setNow] = useState(() => new Date());
  const { familyName } = useData();
  const link = `famigo.app/invite/${inviteCode(familyName, now)}`;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) {
      setError(t("validation.emailRequired"));
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(t("validation.emailInvalid"));
    } else {
      navigate("/more/family");
    }
  }

  async function handleCopy() {
    const ok = await copyText(link);
    setCopyStatus(ok ? "done" : "failed");
    setTimeout(() => setCopyStatus(""), 2000);
  }

  return (
    <FormScreen
      onSubmit={handleSubmit}
      className={styles.body}
      footer={<Button type="submit">{t("invite.send")}</Button>}
    >
      <PageHeader title={t("invite.title")} to="/more/family" />

      <Card>
        <h2 className={styles.cardTitle}>{t("invite.byEmail")}</h2>
        <Input
          id="email"
          label="Email"
          type="email"
          placeholder={t("invite.emailPlaceholder")}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          hint={error}
        />
        <Select id="role" label={t("member.role")}>
          <option value="Member">{roleLabels.Member}</option>
          <option value="Admin">{roleLabels.Admin}</option>
        </Select>
      </Card>

      <Card className={styles.linkCard}>
        <div className={styles.linkHead}>
          <h2 className={styles.cardTitle}>{t("invite.byLink")}</h2>
          <span className={styles.linkNote}>
            {t("invite.rotates", { count: INVITE_HOURS, left: timeLeftLabel(now) })}
          </span>
        </div>
        <div className={styles.link}>{link}</div>
        <button type="button" className={styles.copy} onClick={handleCopy}>
          {copyStatus === "done" && t("invite.copied")}
          {copyStatus === "failed" && t("invite.copyFailed")}
          {copyStatus === "" && t("invite.copy")}
        </button>
      </Card>
    </FormScreen>
  );
}

export default Invite;
