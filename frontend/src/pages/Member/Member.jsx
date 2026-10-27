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
import { t } from "../../i18n";
import { memberNote } from "../../utils/members";
import { foodLabel } from "../ProfileFood/food";
import styles from "./Member.module.css";

function Member() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { members, homes, currentUserId, removeMember, updateMemberRole, showError } = useData();
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

  async function handleRemove() {
    try {
      await removeMember(member.id);
      navigate("/more/family", { replace: true });
    } catch (error) {
      showError(error);
    }
  }

  return (
    <Page>
      <PageHeader title={member.name} subtitle={isMe ? t("member.itsYou") : memberNote(member, currentUserId)} to="/more/family" />

      <div className={styles.top}>
        <Avatar letter={member.letter} tone={member.tone} photo={member.photo} size={72} />
        <div className={styles.topText}>
          <span className={styles.name}>{member.name}</span>
          <span className={`${styles.role} ${styles[member.role]}`}>{roleLabels[member.role]}</span>
        </div>
      </div>

      {canChange && (
        <Card className={styles.card}>
          <h2 className={styles.cardTitle}>{t("member.role")}</h2>
          <Segmented
            options={roleOptions}
            value={member.role}
            onChange={(role) => updateMemberRole(member.id, role)}
            label={t("member.roleLabel")}
          />
        </Card>
      )}

      <Card flush className={styles.homes}>
        <h2 className={styles.homesTitle}>{t("member.livesIn")}</h2>
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
        {memberHomes.length === 0 && <p className={styles.empty}>{t("member.noHome")}</p>}
      </Card>

      {(member.birthday || member.foodPrefs?.length > 0 || member.foodNote) && (
        <Card className={styles.card}>
          {member.birthday && (
            <p className={styles.text}>
              {t("member.birthday")} <b>{member.birthday.slice(0, 5)}</b>
            </p>
          )}
          {(member.foodPrefs?.length > 0 || member.foodNote) && (
            <>
              <h2 className={styles.cardTitle}>{t("profile.food")}</h2>
              <div className={styles.prefs}>
                {member.foodPrefs.map((pref) => (
                  <span key={pref} className={styles.pref}>
                    {foodLabel(pref)}
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
          {t("member.openProfile")}
        </Link>
      )}

      {canRemove && !confirming && (
        <button type="button" className={styles.remove} onClick={() => setConfirming(true)}>
          {t("member.remove")}
        </button>
      )}

      {canRemove && confirming && (
        <div className={styles.confirm} role="alert">
          <p className={styles.confirmText}>
            {t("member.removeConfirm", { name: member.name })}
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

      {!canRemove && blockedReason && <p className={styles.blocked}>{blockedReason}</p>}
    </Page>
  );
}

export default Member;
