import { useState } from "react";
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Button from "../../components/Button/Button";
import FormScreen from "../../components/FormScreen/FormScreen";
import Input from "../../components/Input/Input";
import PageHeader from "../../components/PageHeader/PageHeader";
import Select from "../../components/Select/Select";
import { useData } from "../../store/DataContext";
import { categories, units } from "../Fridge/products";
import { fullToShort, shortToFull, todayShort } from "../../utils/dates";
import { formatShortDate, quantityError, shortDateError } from "../../utils/validation";
import styles from "./FridgeProduct.module.css";

function FridgeProduct() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [params] = useSearchParams();
  const { homes, products, addProduct, updateProduct } = useData();
  const product = id ? products.find((p) => p.id === Number(id)) : null;
  const homeId = product?.homeId ?? homes.find((h) => h.id === params.get("home"))?.id ?? homes[0].id;
  const home = homes.find((h) => h.id === homeId);

  const [values, setValues] = useState({
    name: product?.name ?? "",
    cat: product?.cat ?? categories[0],
    qty: product ? String(product.qty) : "",
    unit: product?.unit ?? units[0],
    expires: product ? fullToShort(product.expires) : "",
    spoiled: product?.spoiled ?? false,
    low: product?.low ?? false,
  });
  const [errors, setErrors] = useState({});

  if (id && !product) {
    return <Navigate to="/more/fridge" replace />;
  }

  const isEdit = Boolean(product);

  function handleChange(e) {
    const { name, value } = e.target;
    setValues({ ...values, [name]: name === "expires" ? formatShortDate(value) : value });
    setErrors({ ...errors, [name]: "" });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const found = {
      name: values.name.trim() ? "" : "Введите название",
      qty: quantityError(values.qty),
      expires: shortDateError(values.expires),
    };
    setErrors(found);
    if (!Object.values(found).every((message) => !message)) return;

    const data = {
      homeId,
      name: values.name.trim(),
      cat: values.cat,
      qty: Number(values.qty.replace(/\s/g, "").replace(",", ".")),
      unit: values.unit,
      expires: shortToFull(values.expires),
      spoiled: values.spoiled,
      low: values.low,
    };
    if (isEdit) {
      updateProduct(product.id, data);
    } else {
      addProduct(data);
    }
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate(`/more/fridge?home=${homeId}`, { replace: true });
    }
  }

  return (
    <FormScreen
      onSubmit={handleSubmit}
      footer={<Button type="submit">{isEdit ? "Сохранить" : "Добавить продукт"}</Button>}
    >
      <PageHeader
        title={isEdit ? "Редактировать продукт" : "Новый продукт"}
        subtitle={home.name}
        to={`/more/fridge?home=${homeId}`}
        icon="close"
      />

      <Input
        id="name"
        name="name"
        label="Название"
        type="text"
        placeholder="Название продукта"
        maxLength={60}
        value={values.name}
        onChange={handleChange}
        hint={errors.name}
      />

      <Select id="cat" name="cat" label="Категория" value={values.cat} onChange={handleChange}>
        {categories.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </Select>

      <div className={styles.row}>
        <div className={styles.qty}>
          <Input
            id="qty"
            name="qty"
            label="Количество"
            type="text"
            inputMode="decimal"
            placeholder="0"
            maxLength={8}
            value={values.qty}
            onChange={handleChange}
            hint={errors.qty}
          />
        </div>
        <div className={styles.unit}>
          <Select id="unit" name="unit" label="Единица" value={values.unit} onChange={handleChange}>
            {units.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </Select>
        </div>
      </div>

      <Input
        id="expires"
        name="expires"
        label="Годен до"
        type="text"
        inputMode="numeric"
        placeholder={todayShort()}
        maxLength={8}
        value={values.expires}
        onChange={handleChange}
        hint={errors.expires}
      />

      <label className={styles.spoiled}>
        <input
          type="checkbox"
          checked={values.low}
          onChange={(e) => setValues({ ...values, low: e.target.checked })}
        />
        <span className={styles.spoiledText}>
          <span className={styles.spoiledTitle}>Продукт заканчивается</span>
          <span className={styles.spoiledHint}>Покажем напоминание на главном экране</span>
        </span>
      </label>

      {isEdit && (
        <label className={styles.spoiled}>
          <input
            type="checkbox"
            checked={values.spoiled}
            onChange={(e) => setValues({ ...values, spoiled: e.target.checked })}
          />
          <span className={styles.spoiledText}>
            <span className={styles.spoiledTitle}>Продукт испорчен</span>
            <span className={styles.spoiledHint}>
              Также отмечается автоматически, когда срок годности истёк
            </span>
          </span>
        </label>
      )}
    </FormScreen>
  );
}

export default FridgeProduct;
