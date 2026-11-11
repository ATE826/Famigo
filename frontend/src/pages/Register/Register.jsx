import { useState } from "react";
import { Link } from "react-router-dom";
import Input from "../../components/Input/Input";
import Button from "../../components/Button/Button";
import { useData } from "../../store/DataContext";
import { birthdayError, formatDate } from "../../utils/validation";
import { t } from "../../i18n";
import { errorText } from "../../api/client";
import Checkbox from "../../components/Checkbox/Checkbox";
import LinkedText from "../../components/LinkedText/LinkedText";
import LegalLink from "../../components/LegalModal/LegalLink";
import styles from "./Register.module.css";

const Register = () => {
  const { register } = useData();
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState({ name: "", email: "", birthday: "", password: "", password2: "" });
  const [agreed, setAgreed] = useState({ terms: false, data: false });
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    const { name, value } = e.target;
    setValues({ ...values, [name]: name === "birthday" ? formatDate(value) : value });
    setErrors({ ...errors, [name]: "" });
    setFormError("");
  }

  function validate() {
    const found = {};
    if (!values.name.trim()) found.name = t("auth.nameRequired");
    if (!values.email.trim()) found.email = t("validation.emailRequired");
    else if (!/^\S+@\S+\.\S+$/.test(values.email)) found.email = t("validation.emailInvalid");
    const birthday = values.birthday.trim() ? birthdayError(values.birthday) : t("auth.birthdayRequired");
    if (birthday) found.birthday = birthday;
    if (!values.password) found.password = t("auth.passwordRequired");
    else if (values.password.length < 8) found.password = t("auth.passwordShort", { count: 8 });
    if (!values.password2) found.password2 = t("auth.confirmRequired");
    else if (values.password2 !== values.password) found.password2 = t("auth.passwordsMismatch");
    if (!agreed.terms) found.terms = t("auth.agreeRequired");
    if (!agreed.data) found.data = t("auth.consentRequired");
    return found;
  }

  // После регистрации AuthLayout перекинет на создание семьи.
  async function handleSubmit(e) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || busy) return;
    setBusy(true);
    try {
      await register({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        birthday: values.birthday.trim(),
      });
    } catch (error) {
      if (error.code === "email_taken") setErrors({ email: errorText(error) });
      else if (Object.keys(error.fields ?? {}).length > 0) setErrors(error.fields);
      else setFormError(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.intro}>
        <h1 className={styles.title}>{t("auth.createAccount")}</h1>
        <p className={styles.subtitle}>{t("auth.registerSubtitle")}</p>
      </div>

      <Input
        id="name"
        name="name"
        label={t("auth.name")}
        type="text"
        placeholder={t("auth.namePlaceholder")}
        maxLength={30}
        value={values.name}
        onChange={handleChange}
        hint={errors.name}
      />
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
        id="birthday"
        name="birthday"
        label={t("personal.birthday")}
        type="text"
        inputMode="numeric"
        numeric
        placeholder={t("personal.datePlaceholder")}
        maxLength={10}
        value={values.birthday}
        onChange={handleChange}
        hint={errors.birthday}
      />
      <Input
        id="password"
        name="password"
        label={t("auth.password")}
        type="password"
        placeholder={t("auth.newPasswordPlaceholder")}
        value={values.password}
        onChange={handleChange}
        hint={errors.password}
      />
      <Input
        id="password2"
        name="password2"
        label={t("auth.confirmPassword")}
        type="password"
        placeholder={t("auth.repeatPassword")}
        value={values.password2}
        onChange={handleChange}
        hint={errors.password2}
      />

      <div className={styles.consents}>
        <Checkbox
          checked={agreed.terms}
          error={errors.terms}
          onChange={(e) => {
            setAgreed({ ...agreed, terms: e.target.checked });
            setErrors({ ...errors, terms: "" });
          }}
        >
          <LinkedText
            template={t("auth.agreeTerms")}
            links={{
              terms: <LegalLink doc="terms">{t("legal.linkTerms")}</LegalLink>,
              privacy: <LegalLink doc="privacy">{t("legal.linkPrivacy")}</LegalLink>,
            }}
          />
        </Checkbox>
        <Checkbox
          checked={agreed.data}
          error={errors.data}
          onChange={(e) => {
            setAgreed({ ...agreed, data: e.target.checked });
            setErrors({ ...errors, data: "" });
          }}
        >
          <LinkedText
            template={t("auth.agreeData")}
            links={{
              consent: <LegalLink doc="consent">{t("legal.linkConsent")}</LegalLink>,
            }}
          />
        </Checkbox>
      </div>

      {formError && (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={busy}>{t("common.continue")}</Button>
      <p className={styles.login}>
        {t("auth.haveAccount")}{" "}
        <Link to="/" className={styles.link}>
          {t("auth.signIn")}
        </Link>
      </p>

    </form>
  );
};

export default Register;
