import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Input from "../../components/Input/Input";
import Select from "../../components/Select/Select";
import Button from "../../components/Button/Button";
import Segmented from "../../components/Segmented/Segmented";
import FormScreen from "../../components/FormScreen/FormScreen";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import { todayString } from "../../utils/dates";
import { amountError, dateError, formatDate } from "../../utils/validation";
import styles from "./BudgetAdd.module.css";

const types = [
  { value: "expense", label: "Расход" },
  { value: "income", label: "Доход" },
];

const OTHER_CATEGORY = "Другое";
const TITLE_MAX = 20;

const categories = {
  expense: ["Продукты", "Дом", "Транспорт", "Развлечения", "Другое"],
  income: ["Зарплата", "Подарок", "Другое"],
};

function BudgetAdd() {
  const navigate = useNavigate();
  const { currentUserId, addOperation } = useData();
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState(categories.expense[0]);
  const [values, setValues] = useState({ sum: "", title: "", desc: "", date: "" });
  const [errors, setErrors] = useState({});

  const isOther = category === OTHER_CATEGORY;

  function handleChange(e) {
    const { name, value } = e.target;
    setValues({ ...values, [name]: name === "date" ? formatDate(value) : value });
    setErrors({ ...errors, [name]: "" });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const found = {
      sum: amountError(values.sum),
      date: dateError(values.date),
      title: isOther && !values.title.trim() ? "Введите название" : "",
    };
    setErrors(found);
    if (found.sum || found.date || found.title) return;

    const [day, month, year] = values.date.split(".");
    const isoDate = `${year}-${month}-${day}`;
    addOperation({
      date: isoDate,
      type,
      category,
      amount: Number(values.sum.replace(/[\s₽]/g, "").replace(",", ".")),
      title: isOther ? values.title.trim() : "",
      desc: values.desc.trim(),
      who: currentUserId,
    });
    navigate(`/budget?month=${isoDate.slice(0, 7)}`);
  }

  function handleTypeChange(value) {
    setType(value);
    setCategory(categories[value][0]);
  }

  return (
    <FormScreen
      onSubmit={handleSubmit}
      className={styles.body}
      footer={
        <Button type="submit">{type === "expense" ? "Добавить расход" : "Добавить доход"}</Button>
      }
    >
      <PageHeader title="Новая операция" to="/budget" icon="close" />

      <Segmented options={types} value={type} onChange={handleTypeChange} label="Тип операции" />

      <Input
        id="sum"
        name="sum"
        label="Сумма"
        type="text"
        inputMode="decimal"
        placeholder="0 ₽"
        inputClassName={styles.sum}
        value={values.sum}
        onChange={handleChange}
        hint={errors.sum}
      />

      <Select id="category" label="Категория" value={category} onChange={(e) => setCategory(e.target.value)}>
        {categories[type].map((c) => (
          <option key={c}>{c}</option>
        ))}
      </Select>

      {isOther && (
        <Input
          id="title"
          name="title"
          label={type === "expense" ? "Название расхода" : "Название дохода"}
          type="text"
          placeholder="Введите название"
          maxLength={TITLE_MAX}
          value={values.title}
          onChange={handleChange}
          hint={errors.title || `${values.title.length}/${TITLE_MAX}`}
        />
      )}

      <Input
        id="desc"
        name="desc"
        label="Описание"
        type="text"
        placeholder="Добавьте описание"
        maxLength={100}
        value={values.desc}
        onChange={handleChange}
      />
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
    </FormScreen>
  );
}

export default BudgetAdd;
