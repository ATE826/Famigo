import { t } from "../i18n";
import { joinedLabel } from "../pages/Calendar/data";

export function memberNote(member, currentUserId) {
  if (member.id === currentUserId) return t("family.you");
  return member.joined ? t("family.since", { month: joinedLabel(member.joined) }) : "";
}
