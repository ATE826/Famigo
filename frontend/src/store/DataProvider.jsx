import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { unitStep } from "../pages/Fridge/products";
import { DataContext } from "./DataContext";
import { initialLocations, initialSharing } from "./locations";
import { initialGallery } from "./gallery";
import { initialPlaceEvents, initialWatchedPlaces } from "./safety";
import { getLang, t } from "../i18n";
import { FREE_SUBSCRIPTION, PLANS, activePlanId } from "../utils/plans";
import { api, ApiError, errorText, refreshSession, setAccessToken, setSessionLostHandler } from "../api/client";
import { connectChatSocket } from "../api/chatSocket";
import {
  homeToApi,
  kopecksToRubles,
  localDateKey,
  mapEvent,
  mapHome,
  mapMember,
  mapMessage,
  mapOperation,
  mapProduct,
  mapSettings,
  mapSubscription,
  mergeMe,
  operationToApi,
  productToApi,
  ruDateToIso,
  settingsToApi,
  toApi,
} from "../api/mappers";

// Хранилище данных приложения. Экраны получают данные и действия в том же виде,
// что и раньше, а под капотом — запросы к API и WebSocket чата.
//
// status:
//   loading  — проверяем, есть ли сессия (кука refresh-токена);
//   guest    — не вошли: показываем вход и регистрацию;
//   noFamily — вошли, но ещё нет семьи: экран создания семьи;
//   ready    — всё загружено.
//
// Разделы «в будущих версиях» (карта, SOS, «Я в порядке», галерея) на сервере пока нет —
// их данные остаются локальными демонстрационными.

const HISTORY_MONTHS = 24;
const DAY = 86_400_000;

const monthParam = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

function newClientId() {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function DataProvider({ children }) {
  const [status, setStatus] = useState("loading");
  const [me, setMe] = useState(null);
  const [family, setFamily] = useState(null);
  const [apiMembers, setApiMembers] = useState([]);
  const [homes, setHomes] = useState([]);
  const [products, setProducts] = useState([]);
  const [operations, setOperations] = useState([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [events, setEvents] = useState([]);
  const [chatIds, setChatIds] = useState({});
  const [messages, setMessages] = useState({});
  const [unread, setUnread] = useState({});
  const [chatSettings, setChatSettings] = useState({});
  const [othersReadAt, setOthersReadAt] = useState({});
  const [subscription, setSubscription] = useState(FREE_SUBSCRIPTION);
  const [notificationSettings, setNotificationSettings] = useState({
    budget: true,
    calendar: true,
    fridge: true,
    chat: true,
    family: true,
  });
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [toast, setToast] = useState(null);
  const [fridgeHomeId, setFridgeHomeId] = useState(null);

  // Локальные демо-данные разделов, которых нет в MVP.
  const [memberLocal, setMemberLocal] = useState({});
  const [locations] = useState(initialLocations);
  const [gallery, setGallery] = useState(initialGallery);
  const [sharing, setSharingState] = useState(initialSharing);
  const [alerts, setAlerts] = useState([]);
  const [checkIns, setCheckIns] = useState({});
  const [watchedPlaces, setWatchedPlaces] = useState(initialWatchedPlaces);
  const [placeEvents] = useState(initialPlaceEvents);

  const currentUserId = me?.id ?? null;
  const familyId = family?.id ?? null;
  const plan = PLANS[activePlanId(subscription)];

  // Ссылки для обработчиков WebSocket: им нужны свежие значения без переподключения.
  const familyRef = useRef(null);
  const meRef = useRef(null);
  const chatIdsRef = useRef({});
  const activeChatRef = useRef(null);
  const loadedChatsRef = useRef(new Set());
  const socketRef = useRef(null);

  useEffect(() => {
    familyRef.current = familyId;
    meRef.current = currentUserId;
    chatIdsRef.current = chatIds;
  }, [familyId, currentUserId, chatIds]);

  const showError = useCallback((error) => {
    setToast({ id: Date.now(), text: errorText(error) });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  // Мелкие действия (галочка, ±1, закрепить чат): не ждём ответа, при ошибке — всплывающее сообщение.
  const quietly = useCallback(
    (promise) => {
      promise.catch(showError);
    },
    [showError],
  );

  // ---------- Загрузка ----------

  const base = (path = "") => `/families/${familyRef.current}${path}`;

  async function loadDetails(fid) {
    const details = await api(`/families/${fid}`);
    setFamily({ id: details.id, name: details.name, role: details.role });
    setApiMembers(details.members.map(mapMember));
    return details;
  }

  async function loadHomes(fid) {
    const { items } = await api(`/families/${fid}/homes`);
    const full = await Promise.all(
      items.map(async (h) => {
        const [details, list] = await Promise.all([
          api(`/families/${fid}/homes/${h.id}`),
          api(`/families/${fid}/homes/${h.id}/products`),
        ]);
        return { home: mapHome(details, details.tasks), products: list.items.map(mapProduct) };
      }),
    );
    setHomes(full.map((x) => x.home));
    setProducts(full.flatMap((x) => x.products));
  }

  async function loadBudget(fid) {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - (HISTORY_MONTHS - 1), 1);
    const before = new Date(from.getFullYear(), from.getMonth() - 1, 1);
    const [list, summary] = await Promise.all([
      api(`/families/${fid}/transactions?from=${monthParam(from)}&to=${monthParam(now)}&limit=3000`),
      // Остаток на конец месяца перед загруженной историей — точка отсчёта для графиков.
      api(`/families/${fid}/budget/summary?month=${monthParam(before)}`),
    ]);
    setOperations(list.items.map(mapOperation));
    setOpeningBalance(kopecksToRubles(summary.balance));
  }

  async function loadEvents(fid) {
    const today = new Date();
    const past = localDateKey(new Date(today.getTime() - 365 * DAY));
    const now = localDateKey(today);
    const future = localDateKey(new Date(today.getTime() + 365 * DAY));
    const [before, after] = await Promise.all([
      api(`/families/${fid}/events?from=${past}&to=${now}`),
      api(`/families/${fid}/events?from=${now}&to=${future}`),
    ]);
    setEvents([...before.items, ...after.items].map(mapEvent));
  }

  function applyChats(items) {
    const ids = {};
    const unreadMap = {};
    const settings = {};
    const readAt = {};
    const seed = {};
    for (const chat of items) {
      const key = chat.kind === "family" ? "family" : chat.peerId;
      if (!key) continue; // собеседник покинул семью
      ids[key] = chat.id;
      unreadMap[key] = chat.unread;
      settings[key] = { muted: chat.muted, pinned: chat.pinned };
      readAt[key] = chat.othersReadAt;
      if (chat.lastMessage) seed[key] = [mapMessage(chat.lastMessage)];
    }
    setChatIds(ids);
    chatIdsRef.current = ids;
    setUnread(unreadMap);
    setChatSettings(settings);
    setOthersReadAt(readAt);
    // Для чатов, история которых ещё не загружена, показываем хотя бы последнее сообщение.
    setMessages((current) => {
      const next = { ...current };
      for (const [key, list] of Object.entries(seed)) {
        if (!loadedChatsRef.current.has(key)) next[key] = list;
      }
      return next;
    });
  }

  async function loadChats(fid) {
    const { items } = await api(`/families/${fid}/chats`);
    applyChats(items);
  }

  async function loadFamily(fid) {
    familyRef.current = fid;
    loadedChatsRef.current = new Set();
    setMessages({});
    const [, , , , , sub, notes] = await Promise.all([
      loadDetails(fid),
      loadHomes(fid),
      loadBudget(fid),
      loadEvents(fid),
      loadChats(fid),
      api(`/families/${fid}/subscription`),
      api("/notifications/unread-count"),
    ]);
    setSubscription(mapSubscription(sub));
    setUnreadNotifications(notes.count);
  }

  async function loadAll() {
    const profile = await api("/me");
    setMe(profile);
    meRef.current = profile.id;
    setNotificationSettings(mapSettings(profile.settings));
    const { items } = await api("/families");
    if (items.length === 0) {
      setStatus("noFamily");
      return;
    }
    await loadFamily(items[0].id);
    setStatus("ready");
  }

  function resetSession() {
    setAccessToken(null);
    socketRef.current?.close();
    socketRef.current = null;
    familyRef.current = null;
    setMe(null);
    setFamily(null);
    setApiMembers([]);
    setHomes([]);
    setProducts([]);
    setOperations([]);
    setEvents([]);
    setChatIds({});
    setMessages({});
    setUnread({});
    setSubscription(FREE_SUBSCRIPTION);
    setStatus("guest");
  }

  // При запуске пробуем восстановить сессию по куке. Нет куки (401) — человек не вошёл.
  // Нет сети или сервер перегружен — не выкидываем из аккаунта, а пробуем снова через 3 секунды.
  useEffect(() => {
    setSessionLostHandler(resetSession);
    let timer;
    let cancelled = false;
    function start() {
      refreshSession()
        .then(loadAll)
        .catch((error) => {
          if (cancelled) return;
          if (error.status === 401) setStatus("guest");
          else timer = setTimeout(start, 3000);
        });
    }
    start();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только при первом запуске
  }, []);

  // ---------- Вход и аккаунт ----------

  async function login(email, password) {
    const session = await api("/auth/login", { method: "POST", body: { email, password } });
    setAccessToken(session.accessToken);
    await loadAll();
  }

  async function register({ name, email, password, birthday }) {
    const session = await api("/auth/register", {
      method: "POST",
      body: { name, email, password, birthday: ruDateToIso(birthday), acceptTerms: true, acceptData: true },
    });
    setAccessToken(session.accessToken);
    await loadAll();
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    resetSession();
  }

  async function logoutAll() {
    await api("/auth/logout-all", { method: "POST" });
    resetSession();
  }

  async function deleteAccount(password) {
    await api("/me", { method: "DELETE", body: { password } });
    resetSession();
  }

  async function changePassword(currentPassword, newPassword) {
    const session = await api("/me/password", { method: "PUT", body: { currentPassword, newPassword } });
    setAccessToken(session.accessToken);
  }

  async function createFamily(name) {
    const details = await api("/families", { method: "POST", body: { name } });
    await loadFamily(details.id);
    setStatus("ready");
  }

  async function joinFamily(code) {
    const details = await api("/families/join", { method: "POST", body: { code } });
    await loadFamily(details.id);
    setStatus("ready");
  }

  // ---------- Профиль ----------

  async function updateProfile({ name, birthday, phone, tone }) {
    const body = {};
    if (name !== undefined) body.name = name;
    if (birthday !== undefined) body.birthday = birthday ? ruDateToIso(birthday) : "";
    // На сервер — только «+» и цифры: +7 (999) 123-45-67 → +79991234567.
    if (phone !== undefined) body.phone = phone.replace(/[^\d+]/g, "");
    if (tone !== undefined) body.avatarTone = tone;
    setMe(await api("/me", { method: "PATCH", body }));
    await loadDetails(familyRef.current);
  }

  async function uploadAvatar(file) {
    const form = new FormData();
    form.append("avatar", file);
    setMe(await api("/me/avatar", { method: "PUT", form }));
    await loadDetails(familyRef.current);
  }

  async function removeAvatar() {
    setMe(await api("/me/avatar", { method: "DELETE" }));
    await loadDetails(familyRef.current);
  }

  async function saveFood(prefs, note, consent) {
    setMe(await api("/me/food", { method: "PUT", body: { prefs, note: note || null, consent } }));
    await loadDetails(familyRef.current);
  }

  function setNotificationSetting(key, value) {
    const next = { ...notificationSettings, [key]: value };
    setNotificationSettings(next);
    quietly(api("/me/settings", { method: "PUT", body: settingsToApi(next, getLang()) }).then(setMe));
  }

  // Только локальные поля разделов «в будущих версиях» («Я в порядке», согласие на геолокацию).
  function updateMember(id, patch) {
    setMemberLocal((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  // ---------- Семья ----------

  async function renameFamily(name) {
    await api(base(), { method: "PATCH", body: { name } });
    setFamily((current) => ({ ...current, name }));
  }

  const getInvite = useCallback(() => api(`/families/${familyRef.current}/invite`, { method: "POST" }), []);

  function updateMemberRole(id, role) {
    quietly(
      api(base(`/members/${id}`), { method: "PATCH", body: { role: toApi.role(role) } }).then(() =>
        loadDetails(familyRef.current),
      ),
    );
  }

  async function removeMember(id) {
    await api(base(`/members/${id}`), { method: "DELETE" });
    await Promise.all([loadDetails(familyRef.current), loadHomes(familyRef.current)]);
  }

  function setResidence(memberId, homeId) {
    quietly(
      api(base(`/members/${memberId}/home`), { method: "PUT", body: { homeId } }).then(() =>
        Promise.all([loadDetails(familyRef.current), loadHomes(familyRef.current)]),
      ),
    );
  }

  const addResident = (homeId, memberId) => setResidence(memberId, homeId);
  const removeResident = (_homeId, memberId) => setResidence(memberId, null);

  // ---------- Дома, дела, холодильник ----------

  async function addHome(home) {
    const created = await api(base("/homes"), { method: "POST", body: homeToApi(home) });
    await loadHomes(familyRef.current);
    return created.id;
  }

  async function updateHome(id, patch) {
    const current = homes.find((h) => h.id === id);
    await api(base(`/homes/${id}`), { method: "PUT", body: homeToApi({ ...current, ...patch }) });
    await loadHomes(familyRef.current);
  }

  async function removeHome(id) {
    await api(base(`/homes/${id}`), { method: "DELETE" });
    if (fridgeHomeId === id) setFridgeHomeId(null);
    await Promise.all([loadHomes(familyRef.current), loadDetails(familyRef.current)]);
  }

  async function addTask(homeId, text, description = "") {
    const task = await api(base(`/homes/${homeId}/tasks`), {
      method: "POST",
      body: { text, description: description || null },
    });
    setHomes((current) =>
      current.map((h) =>
        h.id === homeId
          ? { ...h, tasks: [...h.tasks, { id: task.id, text: task.text, description: task.description ?? "", done: false }] }
          : h,
      ),
    );
  }

  function patchTasks(homeId, fn) {
    setHomes((current) => current.map((h) => (h.id === homeId ? { ...h, tasks: fn(h.tasks) } : h)));
  }

  function removeTask(homeId, taskId) {
    patchTasks(homeId, (tasks) => tasks.filter((x) => x.id !== taskId));
    quietly(api(base(`/homes/${homeId}/tasks/${taskId}`), { method: "DELETE" }));
  }

  function toggleTask(homeId, taskId) {
    const task = homes.find((h) => h.id === homeId)?.tasks.find((x) => x.id === taskId);
    if (!task) return;
    patchTasks(homeId, (tasks) => tasks.map((x) => (x.id === taskId ? { ...x, done: !x.done } : x)));
    quietly(api(base(`/homes/${homeId}/tasks/${taskId}`), { method: "PATCH", body: { done: !task.done } }));
  }

  async function addProduct(product) {
    const created = await api(base(`/homes/${product.homeId}/products`), { method: "POST", body: productToApi(product) });
    setProducts((current) => [...current, mapProduct(created)]);
  }

  async function updateProduct(id, patch) {
    const current = products.find((p) => p.id === id);
    const next = { ...current, ...patch };
    const saved = await api(base(`/homes/${current.homeId}/products/${id}`), { method: "PUT", body: productToApi(next) });
    setProducts((list) => list.map((p) => (p.id === id ? mapProduct(saved) : p)));
  }

  function changeQty(id, direction) {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    const qty = Math.round((product.qty + direction * unitStep(product.unit)) * 1000) / 1000;
    if (qty > 0) {
      setProducts((list) => list.map((p) => (p.id === id ? { ...p, qty } : p)));
      quietly(api(base(`/homes/${product.homeId}/products/${id}`), { method: "PUT", body: productToApi({ ...product, qty }) }));
    } else {
      setProducts((list) => list.filter((p) => p.id !== id));
      quietly(api(base(`/homes/${product.homeId}/products/${id}`), { method: "DELETE" }));
    }
  }

  // ---------- Бюджет и календарь ----------

  async function addOperation(operation) {
    const created = await api(base("/transactions"), { method: "POST", body: operationToApi(operation) });
    setOperations((current) => [...current, mapOperation(created)]);
  }

  async function addEvent({ title, date, time, description, place, memberIds }) {
    const startsAt = new Date(`${ruDateToIso(date)}T${time}:00`).toISOString();
    const created = await api(base("/events"), {
      method: "POST",
      body: { title, description: description || null, startsAt, place, memberIds },
    });
    setEvents((current) => [...current, mapEvent(created)]);
  }

  // ---------- Подписка и уведомления ----------

  async function subscribe(planId, period) {
    const sub = await api(base("/subscription"), { method: "POST", body: { plan: toApi.plan(planId), period } });
    setSubscription(mapSubscription(sub));
  }

  function setAutoRenew(on) {
    quietly(
      api(base(on ? "/subscription/resume" : "/subscription/cancel"), { method: "POST" }).then((sub) =>
        setSubscription(mapSubscription(sub)),
      ),
    );
  }

  const loadNotifications = useCallback(async () => {
    const { items } = await api("/notifications?limit=50");
    return items;
  }, []);

  function markNotificationRead(id) {
    setUnreadNotifications((n) => Math.max(0, n - 1));
    quietly(api(`/notifications/${id}/read`, { method: "POST" }));
  }

  function markAllNotificationsRead() {
    setUnreadNotifications(0);
    quietly(api("/notifications/read-all", { method: "POST" }));
  }

  // ---------- Чаты (WebSocket) ----------

  const keyOfChat = (chatId) => Object.keys(chatIdsRef.current).find((key) => chatIdsRef.current[key] === chatId);

  // Добавляет сообщение в ленту, не допуская дублей: одно и то же сообщение может прийти
  // и ответом на запрос, и событием WebSocket. Временное «отправляется…» заменяется настоящим.
  function upsertMessage(key, message, clientId) {
    setMessages((current) => {
      const list = current[key] ?? [];
      if (list.some((m) => m.id === message.id)) return current;
      const pending = clientId ? list.findIndex((m) => m.id === clientId) : -1;
      const next = pending >= 0 ? list.map((m, i) => (i === pending ? message : m)) : [...list, message];
      return { ...current, [key]: next };
    });
  }

  function markPendingFailed(clientId) {
    setMessages((current) => {
      const next = {};
      for (const [key, list] of Object.entries(current)) {
        next[key] = list.map((m) => (m.id === clientId ? { ...m, pending: false, failed: true } : m));
      }
      return next;
    });
  }

  function sendRead(key) {
    const chatId = chatIdsRef.current[key];
    if (!chatId) return;
    const sent = socketRef.current?.send({ type: "read", familyId: familyRef.current, chatId });
    if (!sent) quietly(api(base(`/chats/${chatId}/read`), { method: "POST" }));
  }

  async function handleSocketEvent(event) {
    if (event.familyId && event.familyId !== familyRef.current) return;
    let key = keyOfChat(event.chatId);
    if (!key && event.type === "message") {
      // Новый личный чат, о котором мы ещё не знали.
      await loadChats(familyRef.current);
      key = keyOfChat(event.chatId);
    }
    if (!key && event.type !== "error") return;

    switch (event.type) {
      case "message": {
        upsertMessage(key, mapMessage(event.message), event.clientId);
        const mine = event.message.userId === meRef.current;
        if (!mine && activeChatRef.current === key) sendRead(key);
        if (!mine && activeChatRef.current !== key) {
          setUnread((current) => ({ ...current, [key]: (current[key] ?? 0) + 1 }));
        }
        break;
      }
      case "read":
        if (event.userId !== meRef.current) setOthersReadAt((current) => ({ ...current, [key]: event.at }));
        break;
      case "deleted":
        setMessages((current) => ({
          ...current,
          [key]: (current[key] ?? []).map((m) => (m.id === event.messageId ? { ...m, text: "", deleted: true } : m)),
        }));
        break;
      case "error":
        if (event.clientId) markPendingFailed(event.clientId);
        showError(new ApiError(0, event.code, event.message));
        break;
      default:
    }
  }

  const handleSocketEventRef = useRef(handleSocketEvent);
  useEffect(() => {
    handleSocketEventRef.current = handleSocketEvent;
  });

  // Подключаемся к WebSocket, когда семья загружена. После переподключения
  // догружаем список чатов: за время обрыва могли прийти сообщения.
  useEffect(() => {
    if (status !== "ready" || !familyId) return undefined;
    const socket = connectChatSocket({
      onEvent: (event) => handleSocketEventRef.current(event),
      onOpen: () => {
        loadChats(familyRef.current).catch(() => {});
        if (activeChatRef.current) loadHistory(activeChatRef.current, true).catch(() => {});
      },
    });
    socketRef.current = socket;
    return () => {
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- переподключаемся только при смене семьи
  }, [status, familyId]);

  async function loadHistory(key, force = false) {
    const chatId = chatIdsRef.current[key];
    if (!chatId || (loadedChatsRef.current.has(key) && !force)) return;
    const { items } = await api(base(`/chats/${chatId}/messages?limit=100`));
    loadedChatsRef.current.add(key);
    const history = items.map(mapMessage).reverse();
    setMessages((current) => {
      const pending = (current[key] ?? []).filter((m) => m.pending || m.failed);
      return { ...current, [key]: [...history, ...pending] };
    });
  }

  // Экран чата открыт: грузим историю, снимаем счётчик, отмечаем прочитанным.
  const openChat = useCallback(
    (key) => {
      activeChatRef.current = key;
      setUnread((current) => ({ ...current, [key]: 0 }));
      loadHistory(key).catch(showError);
      sendRead(key);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- работает через ref-ы
    [showError],
  );

  const closeChat = useCallback((key) => {
    if (activeChatRef.current === key) activeChatRef.current = null;
  }, []);

  async function ensureChat(key) {
    if (chatIdsRef.current[key]) return chatIdsRef.current[key];
    const { chatId } = await api(base("/chats/direct"), { method: "POST", body: { userId: key } });
    chatIdsRef.current = { ...chatIdsRef.current, [key]: chatId };
    setChatIds(chatIdsRef.current);
    loadedChatsRef.current.add(key);
    return chatId;
  }

  async function sendMessage(key, text) {
    const clientId = newClientId();
    const now = new Date();
    upsertMessage(key, {
      id: clientId,
      from: currentUserId,
      text,
      pending: true,
      createdAt: now.toISOString(),
      day: localDateKey(now),
      time: mapMessage({ createdAt: now.toISOString() }).time,
    });
    try {
      const chatId = await ensureChat(key);
      const sent = socketRef.current?.send({ type: "send", familyId: familyRef.current, chatId, text, clientId });
      if (!sent) {
        const message = await api(base(`/chats/${chatId}/messages`), { method: "POST", body: { text } });
        upsertMessage(key, mapMessage(message), clientId);
      }
    } catch (error) {
      markPendingFailed(clientId);
      showError(error);
    }
  }

  function setChatSetting(key, field, value) {
    setChatSettings((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));
    quietly(ensureChat(key).then((chatId) => api(base(`/chats/${chatId}`), { method: "PATCH", body: { [field]: value } })));
  }

  // Отметка «прочитано» у своих сообщений: собеседники открывали чат позже, чем оно отправлено.
  const messagesView = useMemo(() => {
    const view = {};
    for (const [key, list] of Object.entries(messages)) {
      const readAt = othersReadAt[key];
      view[key] = list.map((m) => {
        if (m.from !== currentUserId) return m;
        if (m.failed) return { ...m, status: t("chats.failed") };
        if (m.pending) return { ...m, status: t("chats.sending") };
        if (readAt && m.createdAt <= readAt) return { ...m, status: t("chats.read") };
        return m;
      });
    }
    return view;
  }, [messages, othersReadAt, currentUserId]);

  // ---------- Локальные разделы «в будущих версиях» ----------

  function addGalleryItems(items) {
    setGallery((current) => [...items, ...current]);
  }

  function removeGalleryItem(id) {
    setGallery((current) => {
      const item = current.find((g) => g.id === id);
      if (item?.url.startsWith("blob:")) URL.revokeObjectURL(item.url);
      return current.filter((g) => g.id !== id);
    });
  }

  function setSharing(value) {
    setSharingState((current) => ({ ...current, [currentUserId]: value }));
  }

  function sendSos() {
    const place = plan.geo ? (locations[currentUserId]?.place ?? null) : null;
    setAlerts((current) => [
      { id: `sos-${Date.now()}`, from: currentUserId, place, at: new Date().toISOString(), resolved: false, seenBy: [] },
      ...current,
    ]);
    sendMessage("family", t("safety.sos.chatMessage", { place: place ? t(`map.places.${place}`) : t("safety.sos.unknownPlace") }));
  }

  function resolveSos(id) {
    setAlerts((current) => current.map((a) => (a.id === id ? { ...a, resolved: true } : a)));
  }

  function seeSos(id) {
    setAlerts((current) => current.map((a) => (a.id === id ? { ...a, seenBy: [...a.seenBy, currentUserId] } : a)));
  }

  function checkIn() {
    setCheckIns((current) => ({ ...current, [currentUserId]: new Date().toISOString() }));
  }

  function watchPlace(id, value) {
    setWatchedPlaces((current) => ({ ...current, [id]: value }));
  }

  // Участники: данные с сервера + свои личные поля из /me + локальные поля будущих разделов.
  const members = useMemo(
    () =>
      apiMembers.map((m) => {
        const local = memberLocal[m.id] ? { ...m, ...memberLocal[m.id] } : m;
        return m.id === currentUserId ? mergeMe(local, me) : local;
      }),
    [apiMembers, me, memberLocal, currentUserId],
  );

  return (
    <DataContext.Provider
      value={{
        status,
        login,
        register,
        logout,
        logoutAll,
        deleteAccount,
        changePassword,
        createFamily,
        joinFamily,
        me,
        updateProfile,
        uploadAvatar,
        removeAvatar,
        saveFood,
        familyId,
        familyName: family?.name ?? "",
        renameFamily,
        getInvite,
        homes,
        members,
        notificationSettings,
        setNotificationSetting,
        unreadNotifications,
        loadNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        toast,
        dismissToast,
        showError,
        locations,
        alerts,
        sendSos,
        resolveSos,
        seeSos,
        checkIns,
        checkIn,
        watchedPlaces,
        watchPlace,
        placeEvents,
        sharing,
        setSharing,
        subscription,
        plan,
        subscribe,
        setAutoRenew,
        gallery,
        addGalleryItems,
        removeGalleryItem,
        currentUserId,
        products,
        operations,
        openingBalance,
        events,
        addEvent,
        messages: messagesView,
        unread,
        chatSettings,
        sendMessage,
        openChat,
        closeChat,
        setChatSetting,
        addOperation,
        fridgeHomeId,
        setFridgeHomeId,
        addHome,
        updateHome,
        removeHome,
        addTask,
        removeTask,
        toggleTask,
        addResident,
        removeResident,
        removeMember,
        updateMember,
        updateMemberRole,
        addProduct,
        updateProduct,
        changeQty,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
