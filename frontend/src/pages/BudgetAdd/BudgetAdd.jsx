import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Input from "../../components/Input/Input";
import Select from "../../components/Select/Select";
import Button from "../../components/Button/Button";
import Segmented from "../../components/Segmented/Segmented";
import Icon from "../../components/Icon/Icon";
import FormScreen from "../../components/FormScreen/FormScreen";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import { todayString } from "../../utils/dates";
import { amountError, dateError, formatDate } from "../../utils/validation";
import { t } from "../../i18n";
import { categoryLabel } from "../../utils/budget";
import styles from "./BudgetAdd.module.css";

const types = [
  { value: "expense", label: "expense" },
  { value: "income", label: "income" },
];

const OTHER_CATEGORY = "Другое";
const TITLE_MAX = 20;

const categories = {
  expense: ["Продукты", "Дом", "Транспорт", "Развлечения", "Другое"],
  income: ["Зарплата", "Подарок", "Другое"],
};

function BudgetAdd() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state?.prefill;
  const { currentUserId, addOperation, plan } = useData();
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState(categories.expense[0]);
  const [values, setValues] = useState({
    sum: prefill ? String(Math.round(prefill.amount)) : "",
    title: "",
    desc: "",
    date: prefill?.date ?? "",
  });
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
      title: isOther && !values.title.trim() ? t("budgetAdd.titleRequired") : "",
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
        <Button type="submit">{type === "expense" ? t("budgetAdd.addExpense") : t("budgetAdd.addIncome")}</Button>
      }
    >
      <PageHeader title={t("budgetAdd.title")} to="/budget" icon="close" />

      {prefill ? (
        <p className={styles.scanned} role="status">
          <Icon name="receipt" size={18} strokeWidth={1.8} />
          {t("receipt.filled")}
        </p>
      ) : (
        <Link
          to={plan.receipts ? "/budget/scan" : "/premium"}
          state={plan.receipts ? undefined : { reason: "receipts" }}
          className={styles.scan}
        >
          <Icon name="camera" size={18} strokeWidth={1.8} />
          {t("receipt.fromQr")}
          {!plan.receipts && <Icon name="crown" size={16} strokeWidth={1.8} />}
        </Link>
      )}

      <Segmented options={types.map((o) => ({ value: o.value, label: t(`budgetAdd.${o.label}`) }))} value={type} onChange={handleTypeChange} label={t("budgetAdd.typeLabel")} />

      <Input
        id="sum"
        name="sum"
        label={t("budgetAdd.amount")}
        type="text"
        inputMode="numeric"
        numeric
        placeholder="0 ₽"
        maxLength={12}
        inputClassName={styles.sum}
        value={values.sum}
        onChange={handleChange}
        hint={errors.sum}
      />

      <Select id="category" label={t("budgetAdd.category")} value={category} onChange={(e) => setCategory(e.target.value)}>
        {categories[type].map((c) => (
          <option key={c} value={c}>
            {categoryLabel(c)}
          </option>
        ))}
      </Select>

      {isOther && (
        <Input
          id="title"
          name="title"
          label={type === "expense" ? t("budgetAdd.expenseName") : t("budgetAdd.incomeName")}
          type="text"
          placeholder={t("budgetAdd.namePlaceholder")}
          maxLength={TITLE_MAX}
          value={values.title}
          onChange={handleChange}
          hint={errors.title || `${values.title.length}/${TITLE_MAX}`}
        />
      )}

      <Input
        id="desc"
        name="desc"
        label={t("budgetAdd.description")}
        type="text"
        placeholder={t("budgetAdd.descriptionPlaceholder")}
        maxLength={100}
        value={values.desc}
        onChange={handleChange}
      />
      <Input
        id="date"
        name="date"
        label={t("budgetAdd.date")}
        type="text"
        inputMode="numeric"
        numeric
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
