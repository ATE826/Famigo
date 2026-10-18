import { useNavigate } from "react-router-dom";
import Input from "../../components/Input/Input";
import Button from "../../components/Button/Button";
import styles from "./FamilyCreate.module.css";

function FamilyCreate() {
  const navigate = useNavigate();

  function handleSubmit(event){
    event.preventDefault();
    navigate("/main");
  }

  return (
    <main className={styles.page}>
      <header className={styles.brand}>
        <span className={styles.logo}>F</span>
        <span className={styles.brandName}>Famigo</span>
      </header>
      <div className={styles.intro}>
        <h1 className={styles.title}>Воссоединитесь с вашей семьей</h1>
        <p className={styles.subtitle}>
          Создайте новую группу или присоединитесь к существующей.
        </p>
      </div>
      <form className={`${styles.card} ${styles.main}`} onSubmit={handleSubmit}>
        <h2 className={styles.cardTitle}>Создать семью</h2>
        <Input id="family" label="Название семьи" type="text" placeholder="Семья Ивановых" />
        <Button type="submit">Создать</Button>
      </form>

      <form className={styles.card} onSubmit={handleSubmit}>
        <h2 className={styles.cardTitle}>Присоединиться</h2>
        <Input id="invite" label="Код приглашения" type="text" placeholder="8X72K"/>
        <Button type="submit">Присоединиться</Button>
      </form>
    </main>
  );
}

export default FamilyCreate;
