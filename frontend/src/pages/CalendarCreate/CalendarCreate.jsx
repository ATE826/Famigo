import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Avatar from "../../components/Avatar/Avatar";
import Button from "../../components/Button/Button";
import FormScreen from "../../components/FormScreen/FormScreen";
import Input from "../../components/Input/Input";
import PageHeader from "../../components/PageHeader/PageHeader";
import Select from "../../components/Select/Select";
import { todayString } from "../../utils/dates";
import { dateError, formatDate, formatTime, timeError } from "../../utils/validation";
import styles from "./CalendarCreate.module.css";

const members = [
  { name: "Антон", tone: "green" },
  { name: "Мама", tone: "terra" },
  { name: "Папа", tone: "sage" },
  { name: "Сестра", tone: "gray" },
];

function CalendarCreate() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ title: "", date: "", time: "", desc: "" });
  const [selected, setSelected] = useState(["Антон", "Мама", "Папа"]);
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    const { name, value } = e.target;
    const formatted =
      name === "date" ? formatDate(value) : name === "time" ? formatTime(value) : value;
    setValues({ ...values, [name]: formatted });
    setErrors({ ...errors, [name]: "" });
  }

  function toggleMember(name) {
    setSelected(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);
    setErrors({ ...errors, members: "" });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const found = {
      title: values.title.trim() ? "" : "Введите название",
      date: dateError(values.date),
      time: timeError(values.time),
      members: selected.length ? "" : "Выберите хотя бы одного участника",
    };
    setErrors(found);
    if (Object.values(found).every((message) => !message)) {
      navigate("/calendar");
    }
  }

  return (
    <FormScreen
      onSubmit={handleSubmit}
      footer={<Button type="submit">Создать событие</Button>}
    >
      <PageHeader title="Новое событие" to="/calendar" icon="close" />

      <Input
        id="title"
        name="title"
        label="Название"
        type="text"
        placeholder="Семейный ужин"
        maxLength={60}
        value={values.title}
        onChange={handleChange}
        hint={errors.title}
      />

      <div className={styles.row}>
        <div className={styles.date}>
          <Input
            id="date"
            name="date"
            label="Дата"
            type="text"
            inputMode="numeric"
            placeholder={todayString()}
            maxLength={10}
            value={values.date}
            onChange={handleChange}
            hint={errors.date}
          />
        </div>
        <div className={styles.time}>
          <Input
            id="time"
            name="time"
            label="Время"
            type="text"
            inputMode="numeric"
            placeholder="19:00"
            maxLength={5}
            value={values.time}
            onChange={handleChange}
            hint={errors.time}
          />
        </div>
      </div>

      <div className={styles.members}>
        <span className={styles.label}>Участники</span>
        <div className={styles.chips}>
          {members.map((m) => {
            const on = selected.includes(m.name);
            return (
              <button
                key={m.name}
                type="button"
                className={`${styles.member} ${on ? styles.on : ""}`}
                aria-pressed={on}
                onClick={() => toggleMember(m.name)}
              >
                <Avatar letter={m.name[0]} tone={m.tone} size={26} />
                {m.name}
              </button>
            );
          })}
        </div>
        {errors.members && <span className={styles.error}>{errors.members}</span>}
      </div>

      <Select id="place" label="Место">
        <option>Квартира</option>
        <option>Дача</option>
        <option>Кафе</option>
        <option>Ресторан</option>
        <option>Другое</option>
      </Select>

      <Select id="reminder" label="Напоминание">
        <option>За 30 минут</option>
        <option>За 1 час</option>
      </Select>

      <Input
        id="desc"
        name="desc"
        label="Описание"
        type="text"
        placeholder="Каждый приносит одно блюдо"
        maxLength={200}
        value={values.desc}
        onChange={handleChange}
      />
    </FormScreen>
  );
}

export default CalendarCreate;
