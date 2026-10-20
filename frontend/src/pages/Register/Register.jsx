import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Input from "../../components/Input/Input";
import Button from "../../components/Button/Button";
import { useData } from "../../store/DataContext";
import { TODAY, dayTitle } from "../Calendar/data";
import styles from "./Register.module.css";

const Register = () => {
  const navigate = useNavigate();
  const { currentUserId, updateMember } = useData();
  const [values, setValues] = useState({ name: "", email: "", password: "", password2: "" });
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    const { name, value } = e.target;
    setValues({ ...values, [name]: value });
    setErrors({ ...errors, [name]: "" });
  }

  function validate() {
    const found = {};
    if (!values.name.trim()) found.name = "Введите имя";
    if (!values.email.trim()) found.email = "Введите email";
    else if (!/^\S+@\S+\.\S+$/.test(values.email)) found.email = "Некорректный email";
    if (!values.password) found.password = "Введите пароль";
    else if (values.password.length < 8) found.password = "Не короче 8 символов";
    if (!values.password2) found.password2 = "Подтвердите пароль";
    else if (values.password2 !== values.password) found.password2 = "Пароли не совпадают";
    return found;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length === 0) {
      const name = values.name.trim();
      updateMember(currentUserId, {
        name,
        letter: name[0].toUpperCase(),
        email: values.email.trim(),
        phone: "",
        phoneVerified: false,
        birthday: "",
        foodPrefs: [],
        foodNote: "",
        joined: dayTitle(TODAY).split(" ")[1],
      });
      navigate("/verify", { state: { next: "/family-create" } });
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.brand}>
        <span className={styles.logo}>F</span>
        <span className={styles.brandName}>Famigo</span>
      </header>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.intro}>
          <h1 className={styles.title}>Создать аккаунт</h1>
          <p className={styles.subtitle}>Один аккаунт для всех ваших семейных групп</p>
        </div>

        <Input
          id="name"
          name="name"
          label="Имя"
          type="text"
          placeholder="Ваше имя"
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
          placeholder="Ваш email"
          value={values.email}
          onChange={handleChange}
          hint={errors.email}
        />
        <Input
          id="password"
          name="password"
          label="Пароль"
          type="password"
          placeholder="Придумайте пароль"
          value={values.password}
          onChange={handleChange}
          hint={errors.password}
        />
        <Input
          id="password2"
          name="password2"
          label="Подтверждение пароля"
          type="password"
          placeholder="Повторите пароль"
          value={values.password2}
          onChange={handleChange}
          hint={errors.password2}
        />

        <Button type="submit">Продолжить</Button>
        <p className={styles.login}>
          Уже есть аккаунт? <Link to="/" className={styles.link}>Войти</Link>
        </p>

      </form>
    </main>
  );
};

export default Register;
