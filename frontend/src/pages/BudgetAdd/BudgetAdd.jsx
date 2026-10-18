import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Input from "../../components/Input/Input";
import Select from "../../components/Select/Select";
import Button from "../../components/Button/Button";
import Segmented from "../../components/Segmented/Segmented";
import FormScreen from "../../components/FormScreen/FormScreen";
import PageHeader from "../../components/PageHeader/PageHeader";
import { todayString } from "../../utils/dates";
import { amountError, dateError, formatDate } from "../../utils/validation";
import styles from "./BudgetAdd.module.css";

const types = [
  { value: "expense", label: "Расход" },
  { value: "income", label: "Доход" },
];

const categories = {
  expense: ["Продукты", "Дом", "Транспорт", "Развлечения", "Другое"],
  income: ["Зарплата", "Перечисления", "Выигрыш", "Другое"],
};

function BudgetAdd() {
  const navigate = useNavigate();
  const [type, setType] = useState("expense");
  const [values, setValues] = useState({ sum: "", desc: "", date: "" });
  const [errors, setErrors] = useState({});

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
    };
    setErrors(found);
    if (!found.sum && !found.date) {
      navigate("/budget");
    }
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

      <Segmented options={types} value={type} onChange={setType} label="Тип операции" />

      <Input
        id="sum"
        name="sum"
        label="Сумма"
        type="text"
        inputMode="decimal"
        placeholder="2 500 ₽"
        inputClassName={styles.sum}
        value={values.sum}
        onChange={handleChange}
        hint={errors.sum}
      />

      <Select key={type} id="category" label="Категория">
        {categories[type].map((c) => (
          <option key={c}>{c}</option>
        ))}
      </Select>

      <Input
        id="desc"
        name="desc"
        label="Описание"
        type="text"
        placeholder="Продукты на неделю"
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
