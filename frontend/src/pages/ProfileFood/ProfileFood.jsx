import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Button from "../../components/Button/Button";
import Chip from "../../components/Chip/Chip";
import FormScreen from "../../components/FormScreen/FormScreen";
import Input from "../../components/Input/Input";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import styles from "./ProfileFood.module.css";

const options = [
  "Без лактозы",
  "Без глютена",
  "Без сахара",
  "Вегетарианство",
  "Веганство",
  "Аллергия на орехи",
  "Аллергия на морепродукты",
  "Халяль",
];

function ProfileFood() {
  const navigate = useNavigate();
  const location = useLocation();
  const { members, currentUserId, updateMember } = useData();
  const me = members.find((m) => m.id === currentUserId);
  const [selected, setSelected] = useState(me?.foodPrefs ?? []);
  const [note, setNote] = useState(me?.foodNote ?? "");

  function toggle(option) {
    setSelected(selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    updateMember(currentUserId, { foodPrefs: selected, foodNote: note.trim() });
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate("/profile", { replace: true });
    }
  }

  return (
    <FormScreen onSubmit={handleSubmit} footer={<Button type="submit">Сохранить</Button>}>
      <PageHeader title="Предпочтения в еде" to="/profile" icon="close" />
      <p className={styles.intro}>Это увидят все участники семьи. Пригодится для покупок и холодильника.</p>

      <div className={styles.options} role="group" aria-label="Предпочтения в еде">
        {options.map((option) => (
          <Chip
            key={option}
            active={selected.includes(option)}
            aria-pressed={selected.includes(option)}
            onClick={() => toggle(option)}
          >
            {option}
          </Chip>
        ))}
      </div>

      <Input
        id="note"
        label="Другое"
        type="text"
        placeholder="Например, не ест острое"
        maxLength={60}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        hint={`${note.length}/60`}
      />
    </FormScreen>
  );
}

export default ProfileFood;
