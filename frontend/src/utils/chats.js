import { t } from "../i18n";

export const GROUP_CHAT_ID = "family";

export function chatList(members, currentUserId, chatSettings) {
  const personal = members
    .filter((m) => m.id !== currentUserId)
    .map((m) => ({ id: m.id, name: m.name, letter: m.letter, tone: m.tone, photo: m.photo, personal: true }));
  const name = t("chats.family");
  const group = { id: GROUP_CHAT_ID, name, letter: name[0], tone: "green", personal: false };
  return chatSettings[GROUP_CHAT_ID]?.pinned === false ? [...personal, group] : [group, ...personal];
}

export function lastMessageOf(chat, messages) {
  const list = messages[chat.id] ?? [];
  return list[list.length - 1];
}

export function lastMessageText(chat, messages, members, currentUserId) {
  const last = lastMessageOf(chat, messages);
  if (!last) return t("chats.noMessages");
  const mine = last.from === currentUserId;
  if (chat.personal) return mine ? `${t("chats.you")}: ${last.text}` : last.text;
  const author = mine ? t("chats.you") : (members.find((m) => m.id === last.from)?.name ?? t("common.formerMember"));
  return `${author}: ${last.text}`;
}
