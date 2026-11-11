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
import { homeIcon, homeOf, homeStyle } from "../../utils/homes";
import { canManageHomes } from "../../utils/permissions";
import { productsLabel } from "../../utils/plural";
import { t } from "../../i18n";
import { memberNote } from "../../utils/members";
import styles from "./House.module.css";

function House() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { homes, members, products, currentUserId,
    addResident,
    removeResident,
    removeHome,
    showError,
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
  const activeCount = home.tasks.filter((task) => !task.done).length;
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

  async function handleRemove() {
    try {
      await removeHome(home.id);
      navigate("/more/homes", { replace: true });
    } catch (error) {
      showError(error);
    }
  }

  return (
    <Page>
      <PageHeader
        title={home.name}
        subtitle={home.place}
        to="/more/homes"
        right={
          <Link to={`/more/home/${home.id}/edit`} className={styles.edit} aria-label={t("house.edit")}>
            <Icon name="edit" size={20} strokeWidth={1.8} />
          </Link>
        }
      />

      <div className={styles.hero} style={homeStyle(home.kind)}>
        <Icon name={homeIcon(home.kind)} size={52} strokeWidth={1.1} />
      </div>

      <ChipRow>
        <Chip active to={`/more/home/${home.id}`}>{t("house.overview")}</Chip>
        <Chip to={`/more/fridge?home=${home.id}`}>{t("fridge.title")}</Chip>
      </ChipRow>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.value}>{home.people}</span>
          <span className={styles.label}>{t("house.peopleWord", { count: home.people })}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.value}>{home.rooms}</span>
          <span className={styles.label}>{t("house.roomsWord", { count: home.rooms })}</span>
        </div>
        <Link to={`/more/fridge?home=${home.id}`} className={`${styles.stat} ${styles.wide}`}>
          <span className={styles.value}>{productCount}</span>
          <span className={styles.label}>{t("house.productsWord", { count: productCount })}</span>
        </Link>
      </div>

      <Card className={styles.tasks}>
        <div className={styles.tasksHead}>
          <h2 className={styles.tasksTitle}>{t("house.residents")}</h2>
          {residents.length > 0 && <span className={styles.badge}>{residents.length}</span>}
        </div>
        {residents.map((m) => (
          <div key={m.id} className={styles.resident}>
            <Avatar letter={m.letter} tone={m.tone} photo={m.photo} size={40} />
            <div className={styles.residentText}>
              <span className={styles.residentName}>{m.name}</span>
              <span className={styles.residentNote}>{memberNote(m, currentUserId)}</span>
            </div>
            <button
              type="button"
              className={styles.remove}
              aria-label={t("house.removeResident", { name: m.name })}
              onClick={() => removeResident(home.id, m.id)}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        ))}
        {residents.length === 0 && <p className={styles.noTasks}>{t("house.noResidents")}</p>}

        {available.length > 0 && (
          <div className={styles.addRow}>
            <div className={styles.addSelect}>
              <Select
                id="resident"
                label={t("house.addResident")}
                value={selectedId}
                onChange={(e) => setCandidate(e.target.value)}
              >
                {available.map((m) => {
                  const current = homeOf(homes, m.id);
                  return (
                    <option key={m.id} value={m.id}>
                      {current ? t("house.residentNow", { name: m.name, home: current.name }) : m.name}
                    </option>
                  );
                })}
              </Select>
            </div>
            <button
              type="button"
              className={styles.addButton}
              onClick={() => addResident(home.id, selectedId)}
            >
              {t("common.add")}
            </button>
          </div>
        )}
        {available.length > 0 && homeOf(homes, selectedId) && (
          <p className={styles.moveHint}>
            {t("house.moveHint", {
              name: members.find((m) => m.id === selectedId)?.name,
              home: homeOf(homes, selectedId).name,
            })}
          </p>
        )}
      </Card>

      <Card className={styles.tasks}>
        <div className={styles.tasksHead}>
          <h2 className={styles.tasksTitle}>{t("house.tasks")}</h2>
          {taskCount > 0 && (
            <span className={styles.badge}>
              {activeCount > 0
                ? t("house.activeTasks", { count: activeCount })
                : t("house.allDone")}
            </span>
          )}
        </div>
        {home.tasks.map((task) => {
          const open = expandedId === task.id && !task.done;
          return (
            <div
              key={task.id}
              className={`${styles.task} ${task.done ? styles.done : ""} ${
                removingId === task.id ? styles.removing : ""
              }`}
            >
              <div className={styles.taskInner}>
                <div className={styles.taskRow}>
                  <label className={styles.checkLabel}>
                    <input
                      type="checkbox"
                      className={styles.check}
                      checked={task.done}
                      aria-label={t("house.taskDone", { name: task.text })}
                      onChange={() => toggleTask(home.id, task.id)}
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
                    disabled={task.done}
                    onClick={() => setExpandedId(open ? null : task.id)}
                  >
                    <span className={styles.titleText}>
                      <span className={styles.taskText}>{task.text}</span>
                    </span>
                    {!task.done && (
                      <Icon
                        name="chevron"
                        size={16}
                        className={`${styles.arrow} ${open ? styles.arrowOpen : ""}`}
                      />
                    )}
                  </button>
                  {task.done && (
                    <button
                      type="button"
                      className={styles.trash}
                      aria-label={t("house.taskDelete", { name: task.text })}
                      onClick={() => handleDeleteTask(task.id)}
                    >
                      <Icon name="trash" size={18} strokeWidth={1.8} />
                    </button>
                  )}
                </div>
                <div className={`${styles.details} ${open ? styles.open : ""}`}>
                  <div className={styles.detailsInner}>
                    <p className={styles.description}>{task.description || t("house.noDescription")}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {taskCount === 0 && <p className={styles.noTasks}>{t("house.noTasks")}</p>}
        <Link to={`/more/home/${home.id}/tasks/add`} className={styles.addTask}>
          <Icon name="plus" size={18} />
          {t("house.addTask")}
        </Link>
      </Card>

      {!canManage && (
        <p className={styles.blocked}>{t("house.cannotDelete")}</p>
      )}

      {canManage && isOnlyHome && (
        <p className={styles.blocked}>{t("house.onlyHome")}</p>
      )}

      {canManage && !isOnlyHome && !confirming && (
        <button type="button" className={styles.removeHome} onClick={() => setConfirming(true)}>
          {t("house.delete")}
        </button>
      )}

      {canManage && !isOnlyHome && confirming && (
        <div className={styles.confirm} role="alert">
          <p className={styles.confirmText}>
            {t("house.deleteConfirm", { name: home.name })}
            {productCount > 0
              ? ` ${t("house.deleteProducts", { items: productsLabel(productCount) })}`
              : ""}{" "}
            {t("common.irreversible")}
          </p>
          <div className={styles.confirmButtons}>
            <button type="button" className={styles.cancel} onClick={() => setConfirming(false)}>
              {t("common.cancel")}
            </button>
            <button type="button" className={styles.confirmRemove} onClick={handleRemove}>
              {t("common.delete")}
            </button>
          </div>
        </div>
      )}
    </Page>
  );
}

export default House;
