import { useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import Button from "../../components/Button/Button";
import FormScreen from "../../components/FormScreen/FormScreen";
import Input from "../../components/Input/Input";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";

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

  function handleSubmit(e) {
    e.preventDefault();
    const title = text.trim();
    if (!title) {
      setError("Введите название задачи");
      return;
    }
    if (title.length < TITLE_MIN) {
      setError(`Не короче ${TITLE_MIN} символов`);
      return;
    }
    if (home.tasks.some((t) => t.text.toLowerCase() === title.toLowerCase())) {
      setError("Такая задача уже есть");
      return;
    }
    addTask(home.id, title, description.trim());
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate(`/more/home/${home.id}`, { replace: true });
    }
  }

  return (
    <FormScreen onSubmit={handleSubmit} footer={<Button type="submit">Добавить задачу</Button>}>
      <PageHeader
        title="Новая задача"
        subtitle={home.name}
        to={`/more/home/${home.id}`}
        icon="close"
      />

      <Input
        id="task"
        label="Задача"
        type="text"
        placeholder="Название задачи"
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
        label="Описание"
        type="text"
        placeholder="Описание задачи"
        maxLength={300}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
    </FormScreen>
  );
}

export default TaskCreate;
