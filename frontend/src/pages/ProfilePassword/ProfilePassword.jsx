import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button/Button";
import FormScreen from "../../components/FormScreen/FormScreen";
import Input from "../../components/Input/Input";
import PageHeader from "../../components/PageHeader/PageHeader";
import { t } from "../../i18n";

function ProfilePassword() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ current: "", next: "", repeat: "" });
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    const { name, value } = e.target;
    setValues({ ...values, [name]: value });
    setErrors({ ...errors, [name]: "" });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const found = {};
    if (!values.current) found.current = t("password.currentRequired");
    if (!values.next) found.next = t("password.newRequired");
    else if (values.next.length < 8) found.next = t("auth.passwordShort", { count: 8 });
    else if (values.next === values.current) found.next = t("password.same");
    if (!values.repeat) found.repeat = t("auth.repeatPassword");
    else if (values.repeat !== values.next) found.repeat = t("auth.passwordsMismatch");
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    navigate("/settings", { replace: true, state: { notice: t("password.changed") } });
  }

  return (
    <FormScreen onSubmit={handleSubmit} footer={<Button type="submit">{t("settings.changePassword")}</Button>}>
      <PageHeader title={t("password.title")} to="/settings" icon="close" />

      <Input
        id="current"
        name="current"
        label={t("password.current")}
        type="password"
        autoComplete="current-password"
        placeholder={t("auth.passwordPlaceholder")}
        value={values.current}
        onChange={handleChange}
        hint={errors.current}
      />
      <Input
        id="next"
        name="next"
        label={t("password.new")}
        type="password"
        autoComplete="new-password"
        placeholder={t("auth.newPasswordPlaceholder")}
        value={values.next}
        onChange={handleChange}
        hint={errors.next || t("auth.passwordShort", { count: 8 })}
      />
      <Input
        id="repeat"
        name="repeat"
        label={t("password.repeatNew")}
        type="password"
        autoComplete="new-password"
        placeholder={t("auth.repeatPassword")}
        value={values.repeat}
        onChange={handleChange}
        hint={errors.repeat}
      />
    </FormScreen>
  );
}

export default ProfilePassword;
