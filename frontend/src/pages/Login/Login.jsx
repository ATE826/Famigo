import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Input from "../../components/Input/Input";
import Button from "../../components/Button/Button";
import { t } from "../../i18n";
import styles from "./Login.module.css";

function Login() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    const { name, value } = e.target;
    setValues({ ...values, [name]: value });
    setErrors({ ...errors, [name]: "" });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const found = {};
    if (!values.email.trim()) found.email = t("validation.emailRequired");
    else if (!/^\S+@\S+\.\S+$/.test(values.email)) found.email = t("validation.emailInvalid");
    if (!values.password) found.password = t("auth.passwordRequired");
    setErrors(found);
    if (Object.keys(found).length === 0) {
      navigate("/verify", { state: { next: "/main" } });
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.bigLetter} aria-hidden="true">F</span>
        <div className={styles.brand}>
          <span className={styles.logo}>F</span>
          <span className={styles.brandName}>Famigo</span>
        </div>
        <p className={styles.slogan}>{t("auth.slogan")}</p>
      </header>

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
          <a href="#" className={styles.link}>{t("auth.forgot")}</a>
        }/>
        <Button type="submit">{t("auth.signIn")}</Button>
        <p className={styles.signup}>
          {t("auth.noAccount")}{" "}
          <Link to="/register" className={styles.link}>
            {t("auth.createAccount")}
          </Link>
        </p>
      </form>
    </main>
  );
}

export default Login;
