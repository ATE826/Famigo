import { useState } from "react";
import { Link } from "react-router-dom";
import Avatar from "../../components/Avatar/Avatar";
import Button from "../../components/Button/Button";
import Card from "../../components/Card/Card";
import Icon from "../../components/Icon/Icon";
import Input from "../../components/Input/Input";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import Select from "../../components/Select/Select";
import { t } from "../../i18n";
import { useData } from "../../store/DataContext";
import { isMinor } from "../../utils/age";
import { pointsOf } from "../../utils/quests";
import styles from "./Quests.module.css";

const TITLE_MAX = 40;
const MAX_POINTS = 9999;

function Points({ value }) {
  return (
    <span className={styles.points}>
      <Icon name="star" size={14} strokeWidth={1.8} />
      {value}
    </span>
  );
}

function AddQuest({ kids }) {
  const { addQuest } = useData();
  const [values, setValues] = useState({ title: "", points: "", to: kids[0]?.id ?? "" });
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    const points = Number(values.points);
    if (!values.title.trim() || !(points > 0)) {
      setError(t("quests.formError"));
      return;
    }
    addQuest({ title: values.title.trim(), points, to: values.to });
    setValues({ ...values, title: "", points: "" });
    setError("");
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <h3 className={styles.formTitle}>{t("quests.addTitle")}</h3>
      <Input
        id="quest-title"
        label={t("quests.name")}
        maxLength={TITLE_MAX}
        value={values.title}
        onChange={(e) => setValues({ ...values, title: e.target.value })}
      />
      <Input
        id="quest-points"
        label={t("quests.pointsLabel")}
        type="text"
        inputMode="numeric"
        numeric
        maxLength={String(MAX_POINTS).length}
        value={values.points}
        onChange={(e) => setValues({ ...values, points: e.target.value })}
        hint={error}
      />
      <Select id="quest-to" label={t("quests.forWho")} value={values.to} onChange={(e) => setValues({ ...values, to: e.target.value })}>
        {kids.map((kid) => (
          <option key={kid.id} value={kid.id}>
            {kid.name}
          </option>
        ))}
      </Select>
      <Button type="submit">{t("quests.add")}</Button>
    </form>
  );
}

function AddReward() {
  const { addReward } = useData();
  const [values, setValues] = useState({ title: "", cost: "" });

  function submit(e) {
    e.preventDefault();
    const cost = Number(values.cost);
    if (!values.title.trim() || !(cost > 0)) return;
    addReward({ title: values.title.trim(), cost });
    setValues({ title: "", cost: "" });
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <Input
        id="reward-title"
        label={t("quests.rewardName")}
        maxLength={TITLE_MAX}
        value={values.title}
        onChange={(e) => setValues({ ...values, title: e.target.value })}
      />
      <Input
        id="reward-cost"
        label={t("quests.cost")}
        type="text"
        inputMode="numeric"
        numeric
        maxLength={String(MAX_POINTS).length}
        value={values.cost}
        onChange={(e) => setValues({ ...values, cost: e.target.value })}
      />
      <Button type="submit" disabled={!values.title.trim() || !values.cost}>
        {t("quests.add")}
      </Button>
    </form>
  );
}

function ParentView({ kids }) {
  const { quests, rewards, redemptions, setQuestStatus, removeQuest, removeReward } = useData();

  if (kids.length === 0) return <p className={styles.empty}>{t("quests.noKids")}</p>;

  return (
    <>
      {kids.map((kid) => {
        const list = quests.filter((q) => q.to === kid.id);
        return (
          <Card key={kid.id} className={styles.kid}>
            <div className={styles.kidHead}>
              <Avatar letter={kid.letter} tone={kid.tone} photo={kid.photo} size={44} />
              <span className={styles.kidName}>{kid.name}</span>
              <Points value={pointsOf(quests, redemptions, kid.id)} />
            </div>
            {list.length === 0 && <p className={styles.empty}>{t("quests.empty")}</p>}
            {list.map((quest) => (
              <div key={quest.id} className={styles.quest}>
                <div className={styles.questText}>
                  <span className={styles.questTitle}>{quest.title}</span>
                  <span className={styles.questSub}>
                    <Points value={quest.points} /> · {t(`quests.status.${quest.status}`)}
                  </span>
                </div>
                {quest.status === "done" && (
                  <div className={styles.actions}>
                    <button type="button" className={styles.primary} onClick={() => setQuestStatus(quest.id, "approved")}>
                      {t("quests.approve")}
                    </button>
                    <button type="button" className={styles.secondary} onClick={() => setQuestStatus(quest.id, "open")}>
                      {t("quests.reject")}
                    </button>
                  </div>
                )}
                <button type="button" className={styles.remove} aria-label={t("common.delete")} onClick={() => removeQuest(quest.id)}>
                  <Icon name="trash" size={16} strokeWidth={1.8} />
                </button>
              </div>
            ))}
            {redemptions
              .filter((r) => r.memberId === kid.id)
              .map((r) => (
                <p key={r.id} className={styles.redeemed}>
                  <Icon name="gift" size={14} strokeWidth={1.8} />
                  {t("quests.received", { title: r.title })}
                </p>
              ))}
          </Card>
        );
      })}

      <Card className={styles.card}>
        <AddQuest kids={kids} />
      </Card>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("quests.rewards")}</h2>
        <Card className={styles.card}>
          {rewards.length === 0 && <p className={styles.empty}>{t("quests.noRewards")}</p>}
          {rewards.map((reward) => (
            <div key={reward.id} className={styles.quest}>
              <div className={styles.questText}>
                <span className={styles.questTitle}>{reward.title}</span>
                <Points value={reward.cost} />
              </div>
              <button type="button" className={styles.remove} aria-label={t("common.delete")} onClick={() => removeReward(reward.id)}>
                <Icon name="trash" size={16} strokeWidth={1.8} />
              </button>
            </div>
          ))}
          <AddReward />
        </Card>
      </section>
    </>
  );
}

function KidView({ me }) {
  const { quests, rewards, redemptions, setQuestStatus, redeemReward } = useData();
  const balance = pointsOf(quests, redemptions, me.id);
  const mine = quests.filter((q) => q.to === me.id);

  return (
    <>
      <Card className={styles.balance}>
        <span className={styles.balanceIcon}>
          <Icon name="star" size={24} strokeWidth={1.8} />
        </span>
        <span className={styles.balanceValue}>{balance}</span>
        <span className={styles.balanceLabel}>{t("quests.balance")}</span>
      </Card>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("quests.myTitle")}</h2>
        <Card className={styles.card}>
          {mine.length === 0 && <p className={styles.empty}>{t("quests.empty")}</p>}
          {mine.map((quest) => (
            <div key={quest.id} className={styles.quest}>
              <div className={styles.questText}>
                <span className={styles.questTitle}>{quest.title}</span>
                <span className={styles.questSub}>
                  <Points value={quest.points} /> · {t(`quests.status.${quest.status}`)}
                </span>
              </div>
              {quest.status === "open" && (
                <button type="button" className={styles.primary} onClick={() => setQuestStatus(quest.id, "done")}>
                  {t("quests.markDone")}
                </button>
              )}
              {quest.status === "approved" && <Icon name="check" size={20} className={styles.ok} />}
            </div>
          ))}
        </Card>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("quests.rewards")}</h2>
        <Card className={styles.card}>
          {rewards.length === 0 && <p className={styles.empty}>{t("quests.noRewards")}</p>}
          {rewards.map((reward) => (
            <div key={reward.id} className={styles.quest}>
              <div className={styles.questText}>
                <span className={styles.questTitle}>{reward.title}</span>
                <Points value={reward.cost} />
              </div>
              <button
                type="button"
                className={styles.primary}
                disabled={balance < reward.cost}
                onClick={() => redeemReward(reward.id, me.id)}
              >
                {balance < reward.cost ? t("quests.notEnough") : t("quests.redeem")}
              </button>
            </div>
          ))}
        </Card>
      </section>
    </>
  );
}

function Quests() {
  const { members, currentUserId, plan } = useData();
  const me = members.find((m) => m.id === currentUserId);
  const kids = members.filter(isMinor);

  return (
    <Page>
      <PageHeader title={t("quests.title")} subtitle={t("quests.subtitle")} to="/more" />

      {!plan.quests ? (
        <Card className={styles.locked}>
          <span className={styles.lockIcon}>
            <Icon name="crown" size={24} strokeWidth={1.8} />
          </span>
          <h2 className={styles.lockTitle}>{t("quests.lockedTitle")}</h2>
          <p className={styles.lockText}>{t("quests.lockedText")}</p>
          <Link to="/premium" state={{ reason: "quests" }} className={styles.cta}>
            {t("quests.lockedCta")}
          </Link>
        </Card>
      ) : isMinor(me) ? (
        <KidView me={me} />
      ) : (
        <ParentView kids={kids} />
      )}
    </Page>
  );
}

export default Quests;
