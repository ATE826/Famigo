import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import Avatar from "../../components/Avatar/Avatar";
import Card from "../../components/Card/Card";
import Chip, { ChipRow } from "../../components/Chip/Chip";
import Icon from "../../components/Icon/Icon";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import Select from "../../components/Select/Select";
import { useData } from "../../store/DataContext";
import { homeGradient, homeIcon } from "../../utils/homes";
import { canManageHomes } from "../../utils/permissions";
import { plural, productsLabel } from "../../utils/plural";
import styles from "./House.module.css";

function House() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { homes, members, products, currentUserId,
    addResident,
    removeResident,
    removeHome,
    toggleTask,
    removeTask,
  } = useData();
  const [candidate, setCandidate] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const home = homes.find((h) => h.id === id);

  if (!home) {
    return <Navigate to="/more/homes" replace />;
  }

  const productCount = products.filter((p) => p.homeId === home.id).length;
  const taskCount = home.tasks.length;
  const activeCount = home.tasks.filter((t) => !t.done).length;
  const residents = home.residents.map((rid) => members.find((m) => m.id === rid)).filter(Boolean);
  const available = members.filter((m) => !home.residents.includes(m.id));
  const selectedId = available.find((m) => m.id === candidate)?.id ?? available[0]?.id;
  const isOnlyHome = homes.length === 1;
  const canManage = canManageHomes(members.find((m) => m.id === currentUserId));

  function handleDeleteTask(taskId) {
    setRemovingId(taskId);
    setTimeout(() => {
      removeTask(home.id, taskId);
      setRemovingId(null);
    }, 350);
  }

  function handleRemove() {
    removeHome(home.id);
    navigate("/more/homes", { replace: true });
  }

  return (
    <Page>
      <PageHeader
        title={home.name}
        subtitle={home.place}
        to="/more/homes"
        right={
          <Link to={`/more/home/${home.id}/edit`} className={styles.edit} aria-label="Редактировать дом">
            <Icon name="edit" size={20} strokeWidth={1.8} />
          </Link>
        }
      />

      <div className={styles.hero} style={{ background: homeGradient(home.kind) }}>
        <Icon name={homeIcon(home.kind)} size={52} strokeWidth={1.1} />
      </div>

      <ChipRow>
        <Chip active to={`/more/home/${home.id}`}>Обзор</Chip>
        <Chip to={`/more/fridge?home=${home.id}`}>Холодильник</Chip>
      </ChipRow>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.value}>{home.people}</span>
          <span className={styles.label}>{plural(home.people, ["человек", "человека", "человек"])}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.value}>{home.rooms}</span>
          <span className={styles.label}>{plural(home.rooms, ["комната", "комнаты", "комнат"])}</span>
        </div>
        <Link to={`/more/fridge?home=${home.id}`} className={`${styles.stat} ${styles.wide}`}>
          <span className={styles.value}>{productCount}</span>
          <span className={styles.label}>{plural(productCount, ["продукт", "продукта", "продуктов"])}</span>
        </Link>
      </div>

      <Card className={styles.tasks}>
        <div className={styles.tasksHead}>
          <h2 className={styles.tasksTitle}>Жильцы</h2>
          {residents.length > 0 && <span className={styles.badge}>{residents.length}</span>}
        </div>
        {residents.map((m) => (
          <div key={m.id} className={styles.resident}>
            <Avatar letter={m.letter} tone={m.tone} size={40} />
            <div className={styles.residentText}>
              <span className={styles.residentName}>{m.name}</span>
              <span className={styles.residentNote}>{m.note}</span>
            </div>
            <button
              type="button"
              className={styles.remove}
              aria-label={`Убрать: ${m.name}`}
              onClick={() => removeResident(home.id, m.id)}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        ))}
        {residents.length === 0 && <p className={styles.noTasks}>Жильцов пока нет</p>}

        {available.length > 0 && (
          <div className={styles.addRow}>
            <div className={styles.addSelect}>
              <Select
                id="resident"
                label="Добавить жильца"
                value={selectedId}
                onChange={(e) => setCandidate(e.target.value)}
              >
                {available.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
            <button
              type="button"
              className={styles.addButton}
              onClick={() => addResident(home.id, selectedId)}
            >
              Добавить
            </button>
          </div>
        )}
      </Card>

      <Card className={styles.tasks}>
        <div className={styles.tasksHead}>
          <h2 className={styles.tasksTitle}>Задачи</h2>
          {taskCount > 0 && (
            <span className={styles.badge}>
              {activeCount > 0
                ? `${activeCount} ${plural(activeCount, ["активная", "активные", "активных"])}`
                : "Всё сделано"}
            </span>
          )}
        </div>
        {home.tasks.map((t) => {
          const open = expandedId === t.id && !t.done;
          return (
            <div
              key={t.id}
              className={`${styles.task} ${t.done ? styles.done : ""} ${
                removingId === t.id ? styles.removing : ""
              }`}
            >
              <div className={styles.taskInner}>
                <div className={styles.taskRow}>
                  <label className={styles.checkLabel}>
                    <input
                      type="checkbox"
                      className={styles.check}
                      checked={t.done}
                      aria-label={`Выполнено: ${t.text}`}
                      onChange={() => toggleTask(home.id, t.id)}
                    />
                    <span className={styles.box} aria-hidden="true">
                      <svg viewBox="0 0 24 24" className={styles.tick}>
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                  </label>
                  <button
                    type="button"
                    className={styles.taskButton}
                    aria-expanded={open}
                    disabled={t.done}
                    onClick={() => setExpandedId(open ? null : t.id)}
                  >
                    <span className={styles.titleText}>
                      <span className={styles.taskText}>{t.text}</span>
                    </span>
                    {!t.done && (
                      <Icon
                        name="chevron"
                        size={16}
                        className={`${styles.arrow} ${open ? styles.arrowOpen : ""}`}
                      />
                    )}
                  </button>
                  {t.done && (
                    <button
                      type="button"
                      className={styles.trash}
                      aria-label={`Удалить: ${t.text}`}
                      onClick={() => handleDeleteTask(t.id)}
                    >
                      <Icon name="trash" size={18} strokeWidth={1.8} />
                    </button>
                  )}
                </div>
                <div className={`${styles.details} ${open ? styles.open : ""}`}>
                  <div className={styles.detailsInner}>
                    <p className={styles.description}>{t.description || "Описание не добавлено"}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {taskCount === 0 && <p className={styles.noTasks}>Задач пока нет</p>}
        <Link to={`/more/home/${home.id}/tasks/add`} className={styles.addTask}>
          <Icon name="plus" size={18} />
          Добавить задачу
        </Link>
      </Card>

      {!canManage && (
        <p className={styles.blocked}>Удалять дома могут только владелец и администраторы</p>
      )}

      {canManage && isOnlyHome && (
        <p className={styles.blocked}>Это единственный дом, его нельзя удалить</p>
      )}

      {canManage && !isOnlyHome && !confirming && (
        <button type="button" className={styles.removeHome} onClick={() => setConfirming(true)}>
          Удалить дом
        </button>
      )}

      {canManage && !isOnlyHome && confirming && (
        <div className={styles.confirm} role="alert">
          <p className={styles.confirmText}>
            Удалить «{home.name}»?
            {productCount > 0
              ? ` Вместе с домом из холодильника удалятся ${productsLabel(productCount)}.`
              : ""}{" "}
            Это действие нельзя отменить.
          </p>
          <div className={styles.confirmButtons}>
            <button type="button" className={styles.cancel} onClick={() => setConfirming(false)}>
              Отмена
            </button>
            <button type="button" className={styles.confirmRemove} onClick={handleRemove}>
              Удалить
            </button>
          </div>
        </div>
      )}
    </Page>
  );
}

export default House;
