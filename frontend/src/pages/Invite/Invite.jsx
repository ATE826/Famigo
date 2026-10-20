import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card/Card";
import Input from "../../components/Input/Input";
import Select from "../../components/Select/Select";
import Button from "../../components/Button/Button";
import FormScreen from "../../components/FormScreen/FormScreen";
import PageHeader from "../../components/PageHeader/PageHeader";
import { copyText } from "../../utils/clipboard";
import styles from "./Invite.module.css";

const LINK = "famigo.app/invite/8X72K";

function Invite() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Введите email");
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Некорректный email");
    } else {
      navigate("/more/family");
    }
  }

  async function handleCopy() {
    const ok = await copyText(LINK);
    setCopyStatus(ok ? "done" : "failed");
    setTimeout(() => setCopyStatus(""), 2000);
  }

  return (
    <FormScreen
      onSubmit={handleSubmit}
      className={styles.body}
      footer={<Button type="submit">Отправить приглашение</Button>}
    >
      <PageHeader title="Пригласить в семью" to="/more/family" />

      <Card>
        <h2 className={styles.cardTitle}>По email</h2>
        <Input
          id="email"
          label="Email"
          type="email"
          placeholder="Email участника"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          hint={error}
        />
        <Select id="role" label="Роль">
          <option>Участник</option>
          <option>Администратор</option>
        </Select>
      </Card>

      <Card className={styles.linkCard}>
        <div className={styles.linkHead}>
          <h2 className={styles.cardTitle}>По ссылке</h2>
          <span className={styles.linkNote}>Ссылка действует 12 часов.</span>
        </div>
        <div className={styles.link}>{LINK}</div>
        <button type="button" className={styles.copy} onClick={handleCopy}>
          {copyStatus === "done" && "Скопировано"}
          {copyStatus === "failed" && "Не удалось скопировать"}
          {copyStatus === "" && "Скопировать ссылку"}
        </button>
      </Card>
    </FormScreen>
  );
}

export default Invite;
