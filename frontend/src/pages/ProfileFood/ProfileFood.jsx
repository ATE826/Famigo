import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Button from "../../components/Button/Button";
import Chip from "../../components/Chip/Chip";
import FormScreen from "../../components/FormScreen/FormScreen";
import Icon from "../../components/Icon/Icon";
import Input from "../../components/Input/Input";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import { t } from "../../i18n";
import { foodGroups, foodLabel } from "./food";
import Checkbox from "../../components/Checkbox/Checkbox";
import LinkedText from "../../components/LinkedText/LinkedText";
import LegalLink from "../../components/LegalModal/LegalLink";
import styles from "./ProfileFood.module.css";

const CUSTOM_MAX = 30;

function ProfileFood() {
  const navigate = useNavigate();
  const location = useLocation();
  const { members, currentUserId, updateMember } = useData();
  const me = members.find((m) => m.id === currentUserId);
  const [selected, setSelected] = useState(me?.foodPrefs ?? []);
  const [note, setNote] = useState(me?.foodNote ?? "");
  const [agreed, setAgreed] = useState(Boolean(me?.consents?.food));
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const groups = foodGroups
    .map((group) => ({
      ...group,
      options: group.options.filter((option) => !needle || foodLabel(option).toLowerCase().includes(needle)),
    }))
    .filter((group) => group.options.length > 0);

  const typed = query.trim();
  const known = [...foodGroups.flatMap((g) => g.options.map(foodLabel)), ...selected.map(foodLabel)];
  const canAdd = typed.length > 0 && !known.some((label) => label.toLowerCase() === typed.toLowerCase());

  function addCustom() {
    if (!canAdd) return;
    setSelected([...selected, typed]);
    setQuery("");
  }

  function toggle(option) {
    setSelected(selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const hasData = selected.length > 0 || note.trim().length > 0;
    if (hasData && !agreed) {
      setError(t("food.consentRequired"));
      return;
    }
    updateMember(currentUserId, {
      foodPrefs: selected,
      foodNote: note.trim(),
      consents: { ...me?.consents, food: hasData ? me?.consents?.food ?? new Date().toISOString() : null },
    });
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

      <input
        type="search"
        className={styles.search}
        placeholder={t("food.search")}
        aria-label={t("food.search")}
        maxLength={CUSTOM_MAX}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          addCustom();
        }}
      />

      {canAdd && (
        <button type="button" className={styles.addCustom} onClick={addCustom}>
          <Icon name="plus" size={18} />
          {t("food.addCustom", { name: typed })}
        </button>
      )}

      {selected.length > 0 && !needle && (
        <section className={styles.group}>
          <h2 className={styles.groupTitle}>{t("food.selected", { count: selected.length })}</h2>
          <div className={styles.options}>
            {selected.map((option) => (
              <Chip key={option} active aria-pressed onClick={() => toggle(option)}>
                {foodLabel(option)}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {groups.map((group) => (
        <section key={group.id} className={styles.group}>
          <h2 className={styles.groupTitle}>{t(`food.groups.${group.id}`)}</h2>
          <div className={styles.options} role="group" aria-label={t(`food.groups.${group.id}`)}>
            {group.options.map((option) => (
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
        </section>
      ))}
      {groups.length === 0 && !canAdd && <p className={styles.empty}>{t("food.noResults")}</p>}

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
      <Checkbox
        checked={agreed}
        error={error}
        onChange={(e) => {
          setAgreed(e.target.checked);
          setError("");
        }}
      >
        <LinkedText
          template={t("food.consent")}
          links={{
            consent: <LegalLink doc="consent">{t("legal.linkConsent")}</LegalLink>,
          }}
        />
      </Checkbox>
    </FormScreen>
  );
}

export default ProfileFood;
