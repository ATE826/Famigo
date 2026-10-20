import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Button from "../../components/Button/Button";
import FormScreen from "../../components/FormScreen/FormScreen";
import Input from "../../components/Input/Input";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import { todayStart } from "../../utils/dates";
import { dateError, formatDate } from "../../utils/validation";
import { t } from "../../i18n";

function birthdayError(value) {
  if (!value.trim()) return "";
  const error = dateError(value);
  if (error) return error;
  const [day, month, year] = value.split(".").map(Number);
  return new Date(year, month - 1, day) > todayStart() ? t("validation.dateFuture") : "";
}

function ProfilePersonal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { members, currentUserId, updateMember } = useData();
  const me = members.find((m) => m.id === currentUserId);
  const [values, setValues] = useState({ name: me?.name ?? "", birthday: me?.birthday ?? "" });
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    const { name, value } = e.target;
    setValues({ ...values, [name]: name === "birthday" ? formatDate(value) : value });
    setErrors({ ...errors, [name]: "" });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const name = values.name.trim();
    const found = {
      name: name ? "" : t("auth.nameRequired"),
      birthday: birthdayError(values.birthday),
    };
    setErrors(found);
    if (found.name || found.birthday) return;

    updateMember(currentUserId, {
      name,
      letter: name[0].toUpperCase(),
      birthday: values.birthday.trim(),
    });
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate("/profile", { replace: true });
    }
  }

  return (
    <FormScreen onSubmit={handleSubmit} footer={<Button type="submit">{t("common.save")}</Button>}>
      <PageHeader title={t("profile.personal")} to="/profile" icon="close" />

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
        id="birthday"
        name="birthday"
        label={t("personal.birthday")}
        type="text"
        inputMode="numeric"
        placeholder={t("personal.datePlaceholder")}
        maxLength={10}
        value={values.birthday}
        onChange={handleChange}
        hint={errors.birthday || t("personal.birthdayHint")}
      />
    </FormScreen>
  );
}

export default ProfilePersonal;
