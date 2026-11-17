import { useState } from "react";
import { Link } from "react-router-dom";
import Input from "../../components/Input/Input";
import Button from "../../components/Button/Button";
import { t } from "../../i18n";
import { useData } from "../../store/DataContext";
import { errorText } from "../../api/client";
import styles from "./Login.module.css";
import SmartCaptcha, {CaptchaLoadError} from '../../components/SmartCaptcha/SmartCaptcha';
import useCaptcha from '../../components/SmartCaptcha/useCaptcha';

function Login() {
  const { login } = useData();
  const captcha=useCaptcha();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setValues({ ...values, [name]: value });
    setErrors({ ...errors, [name]: "" });
    setFormError("");
  }

  // После входа AuthLayout сам перекинет в приложение (или на создание семьи).
  async function handleSubmit(e) {
    e.preventDefault();
    const found = {};
    if (!values.email.trim()) found.email = t("validation.emailRequired");
    else if (!/^\S+@\S+\.\S+$/.test(values.email)) found.email = t("validation.emailInvalid");
    if (!values.password) found.password = t("auth.passwordRequired");
    setErrors(found);
    if (Object.keys(found).length > 0 || busy || captcha.blocked) return;
    setBusy(true);
    try {
      await login(values.email.trim(), values.password,captcha.token);
    } catch (error) {
      setFormError(error.code==='unauthorized'?t('captcha.loginFailed'):errorText(error));
      captcha.reset();
      await captcha.reload().catch(()=>{});
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h1 className={styles.title}>{t("auth.welcome")}</h1>
      <Input
        id="email"
        name="email"
        label="Email"
        type="email"
        placeholder={t("auth.emailPlaceholder")}
        value={values.email}
        onChange={handleChange}
        hint={errors.email}
      />
      <Input
        id="password"
        name="password"
        label={t("auth.password")}
        type="password"
        placeholder={t("auth.passwordPlaceholder")}
        value={values.password}
        onChange={handleChange}
        hint={errors.password}
        action={
        <Link to="/password-reset" className={styles.link}>{t("auth.forgot")}</Link>
      }/>
      {formError && (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      )}
      {captcha.required&&<SmartCaptcha key={captcha.revision} sitekey={captcha.config.clientKey} onToken={captcha.setToken}/>}
      {captcha.failed&&<CaptchaLoadError onRetry={()=>captcha.reload().catch(()=>{})}/>}
      <Button type="submit" disabled={busy||captcha.blocked}>{t("auth.signIn")}</Button>
      <p className={styles.signup}>
        {t("auth.noAccount")}{" "}
        <Link to="/register" className={styles.link}>
          {t("auth.createAccount")}
        </Link>
      </p>
      <p className={styles.legal}>
        <Link to="/legal/privacy" className={styles.legalLink}>
          {t("legal.docs.privacy")}
        </Link>
        <span aria-hidden="true">·</span>
        <Link to="/legal/terms" className={styles.legalLink}>
          {t("legal.docs.terms")}
        </Link>
      </p>
    </form>
  );
}

export default Login;
