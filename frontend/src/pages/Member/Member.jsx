import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import Avatar from "../../components/Avatar/Avatar";
import Card from "../../components/Card/Card";
import Icon from "../../components/Icon/Icon";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import Segmented from "../../components/Segmented/Segmented";
import { useData } from "../../store/DataContext";
import { homeIcon } from "../../utils/homes";
import {
  assignableRoles,
  canChangeRole,
  canRemoveMember,
  removeBlockedReason,
} from "../../utils/permissions";
import { roleLabels } from "../../utils/roles";
import styles from "./Member.module.css";

function Member() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { members, homes, currentUserId, removeMember, updateMemberRole } = useData();
  const [confirming, setConfirming] = useState(false);

  const member = members.find((m) => m.id === id);
  const actor = members.find((m) => m.id === currentUserId);

  if (!member) {
    return <Navigate to="/more/family" replace />;
  }

  const isMe = member.id === currentUserId;
  const memberHomes = homes.filter((h) => h.residents.includes(member.id));
  const canRemove = canRemoveMember(actor, member);
  const canChange = canChangeRole(actor, member);
  const roleOptions = assignableRoles(actor).map((role) => ({ value: role, label: roleLabels[role] }));
  const blockedReason = removeBlockedReason(actor, member);

  function handleRemove() {
    removeMember(member.id);
    navigate("/more/family", { replace: true });
  }

  return (
    <Page>
      <PageHeader title={member.name} subtitle={isMe ? "Это вы" : member.note} to="/more/family" />

      <div className={styles.top}>
        <Avatar letter={member.letter} tone={member.tone} photo={member.photo} size={72} />
        <div className={styles.topText}>
          <span className={styles.name}>{member.name}</span>
          <span className={`${styles.role} ${styles[member.role]}`}>{roleLabels[member.role]}</span>
        </div>
      </div>

      {canChange && (
        <Card className={styles.card}>
          <h2 className={styles.cardTitle}>Роль</h2>
          <Segmented
            options={roleOptions}
            value={member.role}
            onChange={(role) => updateMemberRole(member.id, role)}
            label="Роль участника"
          />
        </Card>
      )}

      <Card flush className={styles.homes}>
        <h2 className={styles.homesTitle}>Живёт в</h2>
        {memberHomes.map((h) => (
          <Link key={h.id} to={`/more/home/${h.id}`} className={styles.home}>
            <span className={styles.homeIcon}>
              <Icon name={homeIcon(h.kind)} size={20} strokeWidth={1.8} />
            </span>
            <div className={styles.homeText}>
              <span className={styles.homeName}>{h.name}</span>
              <span className={styles.homePlace}>{h.place}</span>
            </div>
            <Icon name="chevron" size={18} className={styles.chevron} />
          </Link>
        ))}
        {memberHomes.length === 0 && <p className={styles.empty}>Не указан ни в одном доме</p>}
      </Card>

      {(member.birthday || member.foodPrefs?.length > 0 || member.foodNote) && (
        <Card className={styles.card}>
          {member.birthday && (
            <p className={styles.text}>
              День рождения: <b>{member.birthday.slice(0, 5)}</b>
            </p>
          )}
          {(member.foodPrefs?.length > 0 || member.foodNote) && (
            <>
              <h2 className={styles.cardTitle}>Предпочтения в еде</h2>
              <div className={styles.prefs}>
                {member.foodPrefs.map((pref) => (
                  <span key={pref} className={styles.pref}>
                    {pref}
                  </span>
                ))}
              </div>
              {member.foodNote && <p className={styles.text}>{member.foodNote}</p>}
            </>
          )}
        </Card>
      )}

      {isMe && (
        <Link to="/profile" className={styles.profileLink}>
          Открыть мой профиль
        </Link>
      )}

      {canRemove && !confirming && (
        <button type="button" className={styles.remove} onClick={() => setConfirming(true)}>
          Удалить из семьи
        </button>
      )}

      {canRemove && confirming && (
        <div className={styles.confirm} role="alert">
          <p className={styles.confirmText}>
            Удалить участника «{member.name}» из семьи? Он перестанет быть жильцом и потеряет доступ к
            данным семьи.
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

      {!canRemove && blockedReason && <p className={styles.blocked}>{blockedReason}</p>}
    </Page>
  );
}

export default Member;
