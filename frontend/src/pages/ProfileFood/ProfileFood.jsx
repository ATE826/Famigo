import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Button from "../../components/Button/Button";
import Chip from "../../components/Chip/Chip";
import FormScreen from "../../components/FormScreen/FormScreen";
import Input from "../../components/Input/Input";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import { t } from "../../i18n";
import { foodLabel, foodOptions } from "./food";
import styles from "./ProfileFood.module.css";

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
    <FormScreen onSubmit={handleSubmit} footer={<Button type="submit">{t("common.save")}</Button>}>
      <PageHeader title={t("profile.food")} to="/profile" icon="close" />
      <p className={styles.intro}>{t("food.intro")}</p>

      <div className={styles.options} role="group" aria-label={t("profile.food")}>
        {foodOptions.map((option) => (
          <Chip
            key={option}
            active={selected.includes(option)}
            aria-pressed={selected.includes(option)}
            onClick={() => toggle(option)}
          >
            {foodLabel(option)}
          </Chip>
        ))}
      </div>

      <Input
        id="note"
        label={t("food.other")}
        type="text"
        placeholder={t("food.otherPlaceholder")}
        maxLength={60}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        hint={`${note.length}/60`}
      />
    </FormScreen>
  );
}

export default ProfileFood;
