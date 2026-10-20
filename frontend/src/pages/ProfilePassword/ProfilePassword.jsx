import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button/Button";
import FormScreen from "../../components/FormScreen/FormScreen";
import Input from "../../components/Input/Input";
import PageHeader from "../../components/PageHeader/PageHeader";

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
    if (!values.current) found.current = "Введите текущий пароль";
    if (!values.next) found.next = "Введите новый пароль";
    else if (values.next.length < 8) found.next = "Не короче 8 символов";
    else if (values.next === values.current) found.next = "Новый пароль совпадает с текущим";
    if (!values.repeat) found.repeat = "Повторите пароль";
    else if (values.repeat !== values.next) found.repeat = "Пароли не совпадают";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    navigate("/profile", { replace: true, state: { notice: "Пароль изменён" } });
  }

  return (
    <FormScreen onSubmit={handleSubmit} footer={<Button type="submit">Сменить пароль</Button>}>
      <PageHeader title="Смена пароля" to="/profile" icon="close" />

      <Input
        id="current"
        name="current"
        label="Текущий пароль"
        type="password"
        autoComplete="current-password"
        placeholder="Ваш пароль"
        value={values.current}
        onChange={handleChange}
        hint={errors.current}
      />
      <Input
        id="next"
        name="next"
        label="Новый пароль"
        type="password"
        autoComplete="new-password"
        placeholder="Придумайте пароль"
        value={values.next}
        onChange={handleChange}
        hint={errors.next || "Не короче 8 символов"}
      />
      <Input
        id="repeat"
        name="repeat"
        label="Повторите новый пароль"
        type="password"
        autoComplete="new-password"
        placeholder="Повторите пароль"
        value={values.repeat}
        onChange={handleChange}
        hint={errors.repeat}
      />
    </FormScreen>
  );
}

export default ProfilePassword;
