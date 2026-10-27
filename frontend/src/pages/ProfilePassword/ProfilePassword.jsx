import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button/Button";
import FormScreen from "../../components/FormScreen/FormScreen";
import Input from "../../components/Input/Input";
import PageHeader from "../../components/PageHeader/PageHeader";
import { t } from "../../i18n";
import { useData } from "../../store/DataContext";
import { errorText } from "../../api/client";

function ProfilePassword() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ current: "", next: "", repeat: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const { changePassword } = useData();

  function handleChange(e) {
    const { name, value } = e.target;
    setValues({ ...values, [name]: value });
    setErrors({ ...errors, [name]: "" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const found = {};
    if (!values.current) found.current = t("password.currentRequired");
    if (!values.next) found.next = t("password.newRequired");
    else if (values.next.length < 8) found.next = t("auth.passwordShort", { count: 8 });
    else if (values.next === values.current) found.next = t("password.same");
    if (!values.repeat) found.repeat = t("auth.repeatPassword");
    else if (values.repeat !== values.next) found.repeat = t("auth.passwordsMismatch");
    setErrors(found);
    if (Object.keys(found).length > 0 || busy) return;

    setBusy(true);
    try {
      await changePassword(values.current, values.next);
      navigate("/settings", { replace: true, state: { notice: t("password.changed") } });
    } catch (error) {
      if (error.code === "wrong_password") setErrors({ current: errorText(error) });
      else setErrors({ next: errorText(error) });
      setBusy(false);
    }
  }

  return (
    <FormScreen onSubmit={handleSubmit} footer={<Button type="submit" disabled={busy}>{t("settings.changePassword")}</Button>}>
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
