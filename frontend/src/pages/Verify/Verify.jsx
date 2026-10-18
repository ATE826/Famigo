import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Input from "../../components/Input/Input";
import Button from "../../components/Button/Button";
import styles from "./Verify.module.css";

const CODE_LENGTH = 6;

function Verify() {
  const navigate = useNavigate();
  const location = useLocation();
  // куда вести после кода: из регистрации — создание семьи, из входа — главная
  const next = location.state?.next ?? "/main";
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function handleChange(e) {
    // оставляем только цифры
    setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH));
    setError("");
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Пока заглушка: подходит любой код из 6 цифр. Позже проверка уйдёт на сервер.
    if (code.length === CODE_LENGTH) {
      navigate(next);
    } else {
      setError(`Введите ${CODE_LENGTH} цифр`);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.brand}>
        <span className={styles.logo}>F</span>
        <span className={styles.brandName}>Famigo</span>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.intro}>
          <h1 className={styles.title}>Введите код</h1>
          <p className={styles.subtitle}>
            Мы отправили 6-значный код подтверждения на вашу почту
          </p>
        </div>

        <Input
          id="code"
          label="Код подтверждения"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          value={code}
          onChange={handleChange}
          hint={error}
        />

        <Button type="submit">Подтвердить</Button>
        <p className={styles.back}>
          <Link to="/" className={styles.link}>
            Вернуться ко входу
          </Link>
        </p>
      </form>
    </main>
  );
}

export default Verify;
