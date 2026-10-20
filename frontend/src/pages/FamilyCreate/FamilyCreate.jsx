import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Input from "../../components/Input/Input";
import Button from "../../components/Button/Button";
import { useData } from "../../store/DataContext";
import styles from "./FamilyCreate.module.css";

const CODE_LENGTH = 6;

function FamilyCreate() {
  const navigate = useNavigate();
  const { renameFamily } = useData();
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [familyError, setFamilyError] = useState("");
  const [inviteError, setInviteError] = useState("");

  function handleCreate(event) {
    event.preventDefault();
    if (!familyName.trim()) {
      setFamilyError("Введите название семьи");
      return;
    }
    renameFamily(familyName.trim());
    navigate("/main");
  }

  function handleJoin(event) {
    event.preventDefault();
    const code = inviteCode.trim();
    if (!code) {
      setInviteError("Введите код приглашения");
    } else if (code.length !== CODE_LENGTH) {
      setInviteError(`Код состоит из ${CODE_LENGTH} символов`);
    } else {
      navigate("/main");
    }
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
      <form className={`${styles.card} ${styles.main}`} onSubmit={handleCreate} noValidate>
        <h2 className={styles.cardTitle}>Создать семью</h2>
        <Input
          id="family"
          label="Название семьи"
          type="text"
          placeholder="Название семьи"
          value={familyName}
          onChange={(e) => {
            setFamilyName(e.target.value);
            setFamilyError("");
          }}
          hint={familyError}
        />
        <Button type="submit">Создать</Button>
      </form>

      <form className={styles.card} onSubmit={handleJoin} noValidate>
        <h2 className={styles.cardTitle}>Присоединиться</h2>
        <Input
          id="invite"
          label="Код приглашения"
          type="text"
          placeholder="Код приглашения"
          maxLength={CODE_LENGTH}
          value={inviteCode}
          onChange={(e) => {
            setInviteCode(e.target.value);
            setInviteError("");
          }}
          hint={inviteError}
        />
        <Button type="submit">Присоединиться</Button>
      </form>
    </main>
  );
}

export default FamilyCreate;
