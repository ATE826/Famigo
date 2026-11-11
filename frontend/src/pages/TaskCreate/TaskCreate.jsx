import { useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import Button from "../../components/Button/Button";
import FormScreen from "../../components/FormScreen/FormScreen";
import Input from "../../components/Input/Input";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import { errorText } from "../../api/client";
import { t } from "../../i18n";

const TITLE_MIN = 3;
const TITLE_MAX = 60;

function TaskCreate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { homes, addTask } = useData();
  const [text, setText] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const home = homes.find((h) => h.id === id);

  if (!home) {
    return <Navigate to="/more/homes" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const title = text.trim();
    if (!title) {
      setError(t("taskCreate.required"));
      return;
    }
    if (title.length < TITLE_MIN) {
      setError(t("taskCreate.tooShort", { count: TITLE_MIN }));
      return;
    }
    if (home.tasks.some((task) => task.text.toLowerCase() === title.toLowerCase())) {
      setError(t("taskCreate.duplicate"));
      return;
    }
    try {
      await addTask(home.id, title, description.trim());
    } catch (error) {
      setError(errorText(error));
      return;
    }
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate(`/more/home/${home.id}`, { replace: true });
    }
  }

  return (
    <FormScreen onSubmit={handleSubmit} footer={<Button type="submit">{t("house.addTask")}</Button>}>
      <PageHeader
        title={t("taskCreate.title")}
        subtitle={home.name}
        to={`/more/home/${home.id}`}
        icon="close"
      />

      <Input
        id="task"
        label={t("taskCreate.task")}
        type="text"
        placeholder={t("taskCreate.taskPlaceholder")}
        maxLength={TITLE_MAX}
        value={text}
        onChange={(e) => {
          setText(e.target.value.replace(/^\s+/, "").replace(/\s{2,}/g, " "));
          setError("");
        }}
        hint={error || `${text.length}/${TITLE_MAX}`}
      />

      <Input
        id="description"
        label={t("taskCreate.description")}
        type="text"
        placeholder={t("taskCreate.descriptionPlaceholder")}
        maxLength={300}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
    </FormScreen>
  );
}

export default TaskCreate;
