import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Input from "../../components/Input/Input";
import Button from "../../components/Button/Button";
import { api, errorText } from "../../api/client";
import { t } from "../../i18n";
import { emailError } from "../../utils/validation";
import styles from "../Verify/Verify.module.css";

export default function PasswordReset() {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState("");
  const token = useRef("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now);
  const titleRef = useRef(null);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { titleRef.current?.focus(); }, [step]);
  const seconds = Math.max(0, Math.ceil((Date.parse(challenge?.resendAt ?? "") - now) / 1000)) || 0;
  const expired = challenge && Date.parse(challenge.expiresAt) <= now;

  async function requestCode() {
    const result = await api("/auth/password/request", { method: "POST", body: { email: email.trim() } });
    setChallenge(result); setCode(""); token.current = ""; setStep("code"); setNow(Date.now());
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (step === "email") { const message = emailError(email); if (message) { setError(message); return; } }
    if (step === "code" && code.length !== 6) { setError(t("auth.codeDigits", {count:6})); return; }
    if (step === "password") {
      const length = new TextEncoder().encode(password).length;
      if ([...password].length < 8 || length > 72 || !password.trim()) { setError(t("reset.passwordHint")); return; }
      if (password !== confirm) { setError(t("reset.mismatch")); return; }
    }
    setBusy(true);
    try {
      if (step === "email") await requestCode();
      else if (step === "code") {
        const result = await api("/auth/password/verify", { method:"POST", body:{challengeId:challenge.challengeId, code} });
        token.current = result.resetToken; setCode(""); setStep("password");
      } else if (step === "password") {
        await api("/auth/password/reset", {method:"POST", body:{challengeId:challenge.challengeId, resetToken:token.current, password, confirmPassword:confirm}});
        token.current = ""; setPassword(""); setConfirm(""); setStep("done");
      }
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }

  async function resend() {
    if (busy || seconds > 0) return;
    setBusy(true); setError("");
    try { await requestCode(); } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  }

  return <main className={styles.page}>
    <header className={styles.brand}><span className={styles.logo}>F</span><span className={styles.brandName}>Famigo</span></header>
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.intro}>
        <h1 className={styles.title} ref={titleRef} tabIndex={-1}>{t(`reset.${step}Title`)}</h1>
        <p className={styles.subtitle}>{t(`reset.${step}Text`)}</p>
      </div>
      {step === "email" && <Input id="reset-email" type="email" label="Email" placeholder={t("auth.emailPlaceholder")} autoComplete="email" value={email} disabled={busy} required maxLength={254} onChange={e=>{setEmail(e.target.value);setError("");}} />}
      {step === "code" && <>
        <p className={styles.subtitle}>{email}</p>
        <Input id="reset-code" placeholder="XXXXXX" label={t("auth.code")} numeric autoComplete="one-time-code" maxLength={6} value={code} disabled={busy} onChange={e=>{setCode(e.target.value.slice(0,6));setError("");}} />
      </>}
      {step === "password" && <>
        <Input id="reset-password" type="password" label={t("reset.newPassword")} placeholder={t("auth.newPasswordPlaceholder")} autoComplete="new-password" value={password} disabled={busy} required onChange={e=>{setPassword(e.target.value);setError("");}} />
        <Input id="reset-confirm" type="password" label={t("reset.confirmPassword")} placeholder={t("auth.repeatPassword")} autoComplete="new-password" value={confirm} disabled={busy} required onChange={e=>{setConfirm(e.target.value);setError("");}} />
        <p className={styles.subtitle}>{t("reset.passwordHint")}</p>
      </>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {expired && step !== "done" && <p className={styles.error} role="alert">{t("reset.expired")}</p>}
      {step !== "done" && <Button type="submit" disabled={busy || ((step === "code" || step === "password") && expired)}>{busy ? t("reset.wait") : t(step === "email" ? "reset.send" : step === "code" ? "common.confirm" : "reset.save")}</Button>}
      {(step === "code" || (step === "password" && expired)) && <button className={styles.resend} type="button" disabled={busy || seconds > 0} onClick={resend}>{seconds > 0 ? t("phone.resendIn", {count:seconds}) : t("phone.resend")}</button>}
      {step === "code" && <button className={styles.resend} type="button" disabled={busy} onClick={()=>{setStep("email");setError("");setChallenge(null);}}>{t("reset.changeEmail")}</button>}
      <p className={styles.back}><Link className={styles.link} to="/">{t("auth.backToLogin")}</Link></p>
    </form>
  </main>;
}
