import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import Chip, { ChipRow } from "../../components/Chip/Chip";

import Paywall from "../../components/Paywall/Paywall";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import Switch from "../../components/Switch/Switch";
import { t } from "../../i18n";
import { useData } from "../../store/DataContext";

import { homeOf } from "../../utils/homes";
import AiSuggest from "./AiSuggest";
import Favorites from "./Favorites";

import styles from "./Recipes.module.css";



function Recipes() {
  const { homes, members, currentUserId, plan } = useData();
  const [params] = useSearchParams();
  const [homeId, setHomeId] = useState(
    () => homes.find((h) => h.id === params.get("home"))?.id ?? homeOf(homes, currentUserId)?.id ?? homes[0]?.id,
  );

  const [generating,setGenerating]=useState(false);
  const [allMembers, setAllMembers] = useState(true);
  const [selectedIds, setSelectedIds] = useState(() => members.map((member) => member.id));

  const selectedMembers = allMembers ? members : members.filter((member) => selectedIds.includes(member.id));
  const memberIds = selectedMembers.map((member) => member.id);

  function toggleMember(id) {
    if(generating)return;
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  return (
    <Page>
      <PageHeader title={t("recipes.title")} subtitle={t("recipes.subtitle")} to="/more/fridge" />

      {!plan.recipes ? (
        <Paywall
          title={t("recipes.lockedTitle")}
          text={t("recipes.lockedText")}
          cta={t("recipes.lockedCta")}
          reason="recipes"
        />
      ) : (
        <>
          {homes.length > 1 && (
            <ChipRow aria-label={t("fridge.home")}>
              {homes.map((h) => (
                <Chip key={h.id} active={h.id === homeId} disabled={generating} onClick={() => setHomeId(h.id)}>
                  {h.name}
                </Chip>
              ))}
            </ChipRow>
          )}

          <fieldset disabled={generating} aria-busy={generating} className={styles.preferences}>
            <legend className={styles.preferencesTitle}>{t("recipes.forWhom")}</legend>
            <label className={styles.preferenceToggle}>
              <span className={styles.fitText}>
                <span className={styles.fitTitle}>{t("recipes.onlyFit")}</span>
                <span className={styles.fitHint}>{t("recipes.onlyFitHint")}</span>
              </span>
              <Switch checked={allMembers} onChange={(event) => setAllMembers(event.target.checked)} />
            </label>
            {!allMembers && (
              <div className={styles.eaters}>
                <span>{t("recipes.selectedPeople")}</span>
                <ChipRow aria-label={t("recipes.selectedPeople")}>
                  {members.map((member) => (
                    <Chip key={member.id} active={selectedIds.includes(member.id)}
                      aria-pressed={selectedIds.includes(member.id)} onClick={() => toggleMember(member.id)}>
                      {member.name}
                    </Chip>
                  ))}
                </ChipRow>
                <p className={styles.aiText}>{t(memberIds.length ? "recipes.selectionHint" : "recipes.noPeopleHint")}</p>
              </div>
            )}
          </fieldset>

          {homeId && <AiSuggest onBusyChange={setGenerating} homeId={homeId} allMembers={allMembers} memberIds={memberIds} />}

          <Favorites />

        </>
      )}
    </Page>
  );
}

export default Recipes;
