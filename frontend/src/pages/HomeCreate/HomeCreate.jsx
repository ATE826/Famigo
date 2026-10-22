import { useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import Button from "../../components/Button/Button";
import FormScreen from "../../components/FormScreen/FormScreen";
import Input from "../../components/Input/Input";
import PageHeader from "../../components/PageHeader/PageHeader";
import Select from "../../components/Select/Select";
import { useData } from "../../store/DataContext";
import { kinds } from "../../utils/homes";
import { canManageHomes } from "../../utils/permissions";
import { countError } from "../../utils/validation";
import { t } from "../../i18n";
import styles from "./HomeCreate.module.css";

const NAME_MAX = 20;

function HomeCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { homes, members, currentUserId, addHome, updateHome, plan } = useData();
  const home = id ? homes.find((h) => h.id === id) : null;

  const [values, setValues] = useState({
    name: home?.name ?? "",
    kind: home?.kind ?? kinds[0].value,
    place: home?.place ?? "",
    rooms: home ? String(home.rooms) : "",
    people: home ? String(home.people) : "",
  });
  const [errors, setErrors] = useState({});

  if (id && !home) {
    return <Navigate to="/more/homes" replace />;
  }

  if (!id && !canManageHomes(members.find((m) => m.id === currentUserId))) {
    return <Navigate to="/more/homes" replace />;
  }

  if (!id && homes.length >= plan.homes) {
    return <Navigate to="/premium" replace state={{ reason: "homes" }} />;
  }

  const isEdit = Boolean(home);

  function handleChange(e) {
    const { name, value } = e.target;
    setValues({ ...values, [name]: value });
    setErrors({ ...errors, [name]: "" });
  }

  function peopleError() {
    const error = countError(values.people, 0, 30);
    if (error) return error;
    const residents = home?.residents.length ?? 0;
    return Number(values.people) < residents ? t("homeCreate.residentsAlready", { count: residents }) : "";
  }

  function handleSubmit(e) {
    e.preventDefault();
    const found = {
      name: values.name.trim() ? "" : t("homeCreate.nameRequired"),
      place: values.place.trim() ? "" : t("homeCreate.placeRequired"),
      rooms: countError(values.rooms, 1, 99),
      people: peopleError(),
    };
    setErrors(found);
    if (!Object.values(found).every((message) => !message)) return;

    const data = {
      name: values.name.trim(),
      kind: values.kind,
      place: values.place.trim(),
      rooms: Number(values.rooms),
      people: Number(values.people),
    };

    if (isEdit) {
      updateHome(home.id, data);
      if (location.key !== "default") {
        navigate(-1);
      } else {
        navigate(`/more/home/${home.id}`, { replace: true });
      }
    } else {
      addHome(data);
      navigate("/more/homes");
    }
  }

  return (
    <FormScreen
      onSubmit={handleSubmit}
      footer={<Button type="submit">{isEdit ? t("common.save") : t("homes.add")}</Button>}
    >
      <PageHeader
        title={isEdit ? t("house.edit") : t("homeCreate.newTitle")}
        to={isEdit ? `/more/home/${home.id}` : "/more/homes"}
        icon="close"
      />

      <Input
        id="name"
        name="name"
        label={t("homeCreate.name")}
        type="text"
        placeholder={t("homeCreate.namePlaceholder")}
        maxLength={NAME_MAX}
        value={values.name}
        onChange={handleChange}
        hint={errors.name || `${values.name.length}/${NAME_MAX}`}
      />

      <Select id="kind" name="kind" label={t("homeCreate.kind")} value={values.kind} onChange={handleChange}>
        {kinds.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </Select>

      <Input
        id="place"
        name="place"
        label={t("homeCreate.place")}
        type="text"
        placeholder={t("homeCreate.place")}
        maxLength={80}
        value={values.place}
        onChange={handleChange}
        hint={errors.place}
      />

      <div className={styles.row}>
        <div className={styles.col}>
          <Input
            id="rooms"
            name="rooms"
            label={t("homeCreate.rooms")}
            type="text"
            inputMode="numeric"
            numeric
            placeholder="0"
            maxLength={2}
            value={values.rooms}
            onChange={handleChange}
            hint={errors.rooms}
          />
        </div>
        <div className={styles.col}>
          <Input
            id="people"
            name="people"
            label={t("homeCreate.people")}
            type="text"
            inputMode="numeric"
            numeric
            placeholder="0"
            maxLength={2}
            value={values.people}
            onChange={handleChange}
            hint={errors.people}
          />
        </div>
      </div>
    </FormScreen>
  );
}

export default HomeCreate;
