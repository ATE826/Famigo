import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Input from "../../components/Input/Input";
import Button from "../../components/Button/Button";
import { useData } from "../../store/DataContext";
import { t } from "../../i18n";
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
      setFamilyError(t("familyCreate.nameRequired"));
      return;
    }
    renameFamily(familyName.trim());
    navigate("/main");
  }

  function handleJoin(event) {
    event.preventDefault();
    const code = inviteCode.trim();
    if (!code) {
      setInviteError(t("familyCreate.codeRequired"));
    } else if (code.length !== CODE_LENGTH) {
      setInviteError(t("familyCreate.codeLength", { count: CODE_LENGTH }));
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
        <h1 className={styles.title}>{t("familyCreate.title")}</h1>
        <p className={styles.subtitle}>
          {t("familyCreate.subtitle")}
        </p>
      </div>
      <form className={`${styles.card} ${styles.main}`} onSubmit={handleCreate} noValidate>
        <h2 className={styles.cardTitle}>{t("familyCreate.create")}</h2>
        <Input
          id="family"
          label={t("familyCreate.name")}
          type="text"
          placeholder={t("familyCreate.name")}
          value={familyName}
          onChange={(e) => {
            setFamilyName(e.target.value);
            setFamilyError("");
          }}
          hint={familyError}
        />
        <Button type="submit">{t("common.create")}</Button>
      </form>

      <form className={styles.card} onSubmit={handleJoin} noValidate>
        <h2 className={styles.cardTitle}>{t("familyCreate.join")}</h2>
        <Input
          id="invite"
          label={t("familyCreate.code")}
          type="text"
          placeholder={t("familyCreate.code")}
          maxLength={CODE_LENGTH}
          value={inviteCode}
          onChange={(e) => {
            setInviteCode(e.target.value);
            setInviteError("");
          }}
          hint={inviteError}
        />
        <Button type="submit">{t("familyCreate.join")}</Button>
      </form>
    </main>
  );
}

export default FamilyCreate;
