import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Input from "../../components/Input/Input";
import Button from "../../components/Button/Button";
import { t } from "../../i18n";
import styles from "./Verify.module.css";

const CODE_LENGTH = 6;

function Verify() {
  const navigate = useNavigate();
  const location = useLocation();
  const next = location.state?.next ?? "/main";
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function handleChange(e) {
    setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH));
    setError("");
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (code.length === CODE_LENGTH) {
      navigate(next);
    } else {
      setError(t("auth.codeDigits", { count: CODE_LENGTH }));
    }
  }

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
          </p>
        </div>

        <Input
          id="code"
          label={t("auth.code")}
          type="text"
          inputMode="numeric"
          numeric
          autoComplete="one-time-code"
          placeholder="000000"
          value={code}
          onChange={handleChange}
          hint={error}
        />

        <Button type="submit">{t("common.confirm")}</Button>
        <p className={styles.back}>
          <Link to="/" className={styles.link}>
            {t("auth.backToLogin")}
          </Link>
        </p>
      </form>
    </main>
  );
}

export default Verify;
