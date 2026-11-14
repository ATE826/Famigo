import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import Input from "../../components/Input/Input";
import Button from "../../components/Button/Button";
import { t } from "../../i18n";
import styles from "./Verify.module.css";
import { useData } from "../../store/DataContext";
import { errorText } from "../../api/client";
import Splash from "../../components/Splash/Splash";

const CODE_LENGTH = 6;

function Verify() {
  const { status, pendingVerification, verifyEmail, resendEmail, cancelVerification } = useData();
  // Сохраняем сценарий: после проверки DataProvider очищает pendingVerification.
  const [flow] = useState(() => pendingVerification?.flow ?? null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function handleChange(e) {
    setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH));
    setError("");
  }

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (code.length === CODE_LENGTH) {
      if (busy) return;
      setBusy(true);
      try { await verifyEmail(code); } catch (error) { setError(errorText(error)); }
      finally { setBusy(false); }
    } else {
      setError(t("auth.codeDigits", { count: CODE_LENGTH }));
    }
  }

  async function resend() {
    if (busy) return;
    setBusy(true); setError("");
    try { await resendEmail(); setCode(""); setNow(Date.now()); } catch (error) { setError(errorText(error)); }
    finally { setBusy(false); }
  }

  if (status === "loading") return <Splash />;
  if (status === "ready" || status === "noFamily") {
    const next = flow === "login" ? "/main" : flow === "register" ? "/family-create"
      : status === "ready" ? "/main" : "/family-create";
    return <Navigate to={next} replace />;
  }
  if (!pendingVerification) return <Navigate to="/" replace />;
  const seconds = Math.max(0, Math.ceil((Date.parse(pendingVerification.resendAt) - now) / 1000));

  return (
    <main className={styles.page}>
      <header className={styles.brand}>
        <span className={styles.logo}>F</span>
        <span className={styles.brandName}>Famigo</span>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.intro}>
          <h1 className={styles.title}>{t("auth.enterCode")}</h1>
          <p className={styles.subtitle}>
            {t("auth.codeSent", { count: CODE_LENGTH })}
            <br /><b className={styles.email}>{pendingVerification.email}</b>
          </p>
        </div>

        <Input
          id="code"
          label={t("auth.code")}
          type="text"
          inputMode="numeric"
          numeric
          autoComplete="one-time-code"
          placeholder="XXXXXX"
          value={code}
          disabled={busy}
          onChange={handleChange}
        />

        {error && <p className={styles.error} role="alert">{error}</p>}
        <Button type="submit" disabled={busy || code.length !== CODE_LENGTH}>{t("common.confirm")}</Button>
        <button type="button" className={styles.resend} disabled={busy || seconds > 0} onClick={resend}>
          {seconds > 0 ? t("phone.resendIn", { count: seconds }) : t("phone.resend")}
        </button>
        <p className={styles.back}>
          <Link to="/" className={styles.link} onClick={cancelVerification}>
            {t("auth.backToLogin")}
          </Link>
        </p>
      </form>
    </main>
  );
}

export default Verify;
