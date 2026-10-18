import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Input from "../../components/Input/Input";
import Button from "../../components/Button/Button";
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
    if (!values.email.trim()) found.email = "Введите email";
    else if (!/^\S+@\S+\.\S+$/.test(values.email)) found.email = "Некорректный email";
    if (!values.password) found.password = "Введите пароль";
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
        <p className={styles.slogan}>Вся семья, дом и бюджет в одном месте</p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h1 className={styles.title}>Добро пожаловать!</h1>
        <Input
          id="email"
          name="email"
          label="Email"
          type="email"
          placeholder="email@my.ru"
          value={values.email}
          onChange={handleChange}
          hint={errors.email}
        />
        <Input
          id="password"
          name="password"
          label="Пароль"
          type="password"
          placeholder="********"
          value={values.password}
          onChange={handleChange}
          hint={errors.password}
          action={
          <a href="#" className={styles.link}>Забыли пароль?</a>
        }/>
        <Button type="submit">Войти</Button>
        <p className={styles.signup}>
          Нет аккаунта? <Link to="/register" className={styles.link}>Создать аккаунт</Link>
        </p>
      </form>
    </main>
  );
}

export default Login;
