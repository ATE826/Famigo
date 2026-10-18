import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Avatar from "../../components/Avatar/Avatar";
import Button from "../../components/Button/Button";
import Card from "../../components/Card/Card";
import FormScreen from "../../components/FormScreen/FormScreen";
import Input from "../../components/Input/Input";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useTheme } from "../../store/ThemeContext";
import { emailError, formatPhone, phoneError } from "../../utils/validation";
import styles from "./Profile.module.css";

const themes = [
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" },
  { value: "system", label: "Системная" },
];

function Profile() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [values, setValues] = useState({
    name: "Антон",
    email: "anton@example.com",
    phone: "+7(912)344-48-67",
  });
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    const { name, value } = e.target;
    setValues({ ...values, [name]: name === "phone" ? formatPhone(value) : value });
    setErrors({ ...errors, [name]: "" });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const found = {
      name: values.name.trim() ? "" : "Введите имя",
      email: emailError(values.email),
      phone: phoneError(values.phone),
    };
    setErrors(found);
    if (Object.values(found).every((message) => !message)) {
      navigate("/more");
    }
  }

  return (
    <FormScreen
      onSubmit={handleSubmit}
      footer={<Button type="submit">Сохранить</Button>}
    >
      <PageHeader title="Профиль" to="/more" />

      <div className={styles.me}>
        <Avatar letter="А" size={72} />
        <div className={styles.meText}>
          <span className={styles.meName}>Антон</span>
          <a href="#" className={styles.photo}>
            Сменить фото
          </a>
        </div>
      </div>

      <Input
        id="name"
        name="name"
        label="Имя"
        type="text"
        placeholder="Антон"
        maxLength={40}
        value={values.name}
        onChange={handleChange}
        hint={errors.name}
      />
      <Input
        id="email"
        name="email"
        label="Email"
        type="email"
        placeholder="anton@example.com"
        value={values.email}
        onChange={handleChange}
        hint={errors.email}
      />
      <Input
        id="phone"
        name="phone"
        label="Телефон"
        type="tel"
        placeholder="+7(000)000-00-00"
        value={values.phone}
        onChange={handleChange}
        hint={errors.phone}
      />

      <Card className={styles.theme}>
        <span className={styles.themeTitle}>Тема</span>
        <div className={styles.options}>
          {themes.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={theme === t.value}
              className={`${styles.option} ${theme === t.value ? styles.active : ""}`}
              onClick={() => setTheme(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Card>
    </FormScreen>
  );
}

export default Profile;
