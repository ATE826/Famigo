import { useState } from "react";
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Button from "../../components/Button/Button";
import FormScreen from "../../components/FormScreen/FormScreen";
import Input from "../../components/Input/Input";
import PageHeader from "../../components/PageHeader/PageHeader";
import Select from "../../components/Select/Select";
import { useData } from "../../store/DataContext";
import { categories, categoryLabel, unitLabel, units } from "../Fridge/products";
import { fullToShort, shortToFull, todayShort } from "../../utils/dates";
import { formatShortDate, quantityError, shortDateError } from "../../utils/validation";
import { t } from "../../i18n";
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
      name: values.name.trim() ? "" : t("fridgeProduct.nameRequired"),
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
      footer={<Button type="submit">{isEdit ? t("common.save") : t("fridge.add")}</Button>}
    >
      <PageHeader
        title={isEdit ? t("fridgeProduct.editTitle") : t("fridgeProduct.newTitle")}
        subtitle={home.name}
        to={`/more/fridge?home=${homeId}`}
        icon="close"
      />

      <Input
        id="name"
        name="name"
        label={t("fridgeProduct.name")}
        type="text"
        placeholder={t("fridgeProduct.namePlaceholder")}
        maxLength={60}
        value={values.name}
        onChange={handleChange}
        hint={errors.name}
      />

      <Select id="cat" name="cat" label={t("fridgeProduct.category")} value={values.cat} onChange={handleChange}>
        {categories.map((c) => (
          <option key={c} value={c}>
            {categoryLabel(c)}
          </option>
        ))}
      </Select>

      <div className={styles.row}>
        <div className={styles.qty}>
          <Input
            id="qty"
            name="qty"
            label={t("fridgeProduct.quantity")}
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
          <Select id="unit" name="unit" label={t("fridgeProduct.unit")} value={values.unit} onChange={handleChange}>
            {units.map((u) => (
              <option key={u} value={u}>
                {unitLabel(u)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Input
        id="expires"
        name="expires"
        label={t("fridgeProduct.expires")}
        type="text"
        inputMode="numeric"
        placeholder={todayShort()}
        maxLength={8}
        value={values.expires}
        onChange={handleChange}
        hint={errors.expires}
      />

      {isEdit && (
        <label className={styles.spoiled}>
          <input
            type="checkbox"
            checked={values.spoiled}
            onChange={(e) => setValues({ ...values, spoiled: e.target.checked })}
          />
          <span className={styles.spoiledText}>
            <span className={styles.spoiledTitle}>{t("fridgeProduct.spoiled")}</span>
            <span className={styles.spoiledHint}>
              {t("fridgeProduct.spoiledHint")}
            </span>
          </span>
        </label>
      )}
    </FormScreen>
  );
}

export default FridgeProduct;
