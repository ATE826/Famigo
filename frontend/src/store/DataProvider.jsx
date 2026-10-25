import { useState } from "react";
import { unitStep } from "../pages/Fridge/products";
import { canManageHomes } from "../utils/permissions";
import { DataContext } from "./DataContext";
import {
  initialChatSettings,
  initialHomes,
  initialMembers,
  initialMessages,
  initialProducts,
  initialUnread,
} from "./initialData";
import { initialOperations } from "./operations";
import { initialLocations, initialSharing } from "./locations";
import { initialGallery } from "./gallery";
import {
  initialPlaceEvents,
  initialWatchedPlaces,
} from "./safety";
import { t } from "../i18n";
import { FREE_SUBSCRIPTION, PLANS, activePlanId, renewalDate } from "../utils/plans";

export default function DataProvider({ children }) {
  const [homes, setHomes] = useState(initialHomes);
  const [products, setProducts] = useState(initialProducts);
  const [operations, setOperations] = useState(initialOperations);
  const [messages, setMessages] = useState(initialMessages);
  const [unread, setUnread] = useState(initialUnread);
  const [chatSettings, setChatSettings] = useState(initialChatSettings);
  const [fridgeHomeId, setFridgeHomeId] = useState(null);
  const [members, setMembers] = useState(initialMembers);
  const [familyName, setFamilyName] = useState("Семья Ивановых");
  const [notificationSettings, setNotificationSettings] = useState({
    budget: true,
    calendar: true,
    fridge: true,
    chat: true,
    family: true,
  });
  const [locations] = useState(initialLocations);
  const [subscription, setSubscription] = useState(FREE_SUBSCRIPTION);
  const [gallery, setGallery] = useState(initialGallery);
  const [sharing, setSharingState] = useState(initialSharing);
  const [alerts, setAlerts] = useState([]);
  const [checkIns, setCheckIns] = useState({});
  const [watchedPlaces, setWatchedPlaces] = useState(initialWatchedPlaces);
  const [placeEvents] = useState(initialPlaceEvents);
  const currentUserId = "anton";
  const plan = PLANS[activePlanId(subscription)];

  function addHome(home) {
    const id = `home-${Date.now()}`;
    setHomes((current) => [...current, { ...home, id, tasks: [], residents: [] }]);
    return id;
  }

  function updateHome(id, patch) {
    setHomes((current) => current.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  }

  function removeHome(id) {
    if (!canManageHomes(members.find((m) => m.id === currentUserId))) return;
    const rest = homes.filter((h) => h.id !== id);
    setHomes(rest);
    setProducts((current) => current.filter((p) => p.homeId !== id));
    if (fridgeHomeId === id && rest.length > 0) setFridgeHomeId(rest[0].id);
  }

  function addTask(homeId, text, description = "") {
    const task = { id: `task-${Date.now()}`, text, description, done: false };
    setHomes((current) =>
      current.map((h) => (h.id === homeId ? { ...h, tasks: [...h.tasks, task] } : h)),
    );
  }

  function removeTask(homeId, taskId) {
    setHomes((current) =>
      current.map((h) =>
        h.id === homeId ? { ...h, tasks: h.tasks.filter((t) => t.id !== taskId) } : h,
      ),
    );
  }

  function toggleTask(homeId, taskId) {
    setHomes((current) =>
      current.map((h) =>
        h.id === homeId
          ? { ...h, tasks: h.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)) }
          : h,
      ),
    );
  }

  function addResident(homeId, memberId) {
    setHomes((current) =>
      current.map((h) => {
        if (h.id !== homeId) {
          return h.residents.includes(memberId)
            ? { ...h, residents: h.residents.filter((r) => r !== memberId) }
            : h;
        }
        if (h.residents.includes(memberId)) return h;
        const residents = [...h.residents, memberId];
        return { ...h, residents, people: Math.max(h.people, residents.length) };
      }),
    );
  }

  function removeResident(homeId, memberId) {
    setHomes((current) =>
      current.map((h) =>
        h.id === homeId ? { ...h, residents: h.residents.filter((r) => r !== memberId) } : h,
      ),
    );
  }

  function removeMember(id) {
    setMembers((current) => current.filter((m) => m.id !== id));
    setHomes((current) =>
      current.map((h) => ({ ...h, residents: h.residents.filter((r) => r !== id) })),
    );
  }

  function renameFamily(name) {
    setFamilyName(name);
  }

  function setNotificationSetting(key, value) {
    setNotificationSettings((current) => ({ ...current, [key]: value }));
  }

  function subscribe(planId, period) {
    setSubscription({
      planId,
      period,
      renewsAt: renewalDate(period),
      cancelAtPeriodEnd: false,
      payerId: currentUserId,
    });
  }

  function setAutoRenew(on) {
    setSubscription((current) => ({ ...current, cancelAtPeriodEnd: !on }));
  }

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
    const alert = { id: `sos-${Date.now()}`, from: currentUserId, place, at: new Date().toISOString(), resolved: false, seenBy: [] };
    setAlerts((current) => [alert, ...current]);
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

  function updateMember(id, patch) {
    setMembers((current) => current.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function updateMemberRole(id, role) {
    setMembers((current) => current.map((m) => (m.id === id ? { ...m, role } : m)));
  }

  function sendMessage(chatId, text) {
    const time = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    const message = { id: Date.now(), from: currentUserId, text, time };
    setMessages((current) => ({ ...current, [chatId]: [...(current[chatId] ?? []), message] }));
  }

  function markChatRead(chatId) {
    setUnread((current) => (current[chatId] ? { ...current, [chatId]: 0 } : current));
  }

  function setChatSetting(chatId, key, value) {
    setChatSettings((current) => ({
      ...current,
      [chatId]: { ...current[chatId], [key]: value },
    }));
  }

  function addOperation(operation) {
    setOperations((current) => [...current, { ...operation, id: Date.now() }]);
  }

  function addProduct(product) {
    setProducts((current) => [...current, { ...product, id: Date.now() }]);
  }

  function updateProduct(id, patch) {
    setProducts((current) => current.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function changeQty(id, direction) {
    setProducts((current) =>
      current.flatMap((p) => {
        if (p.id !== id) return [p];
        const qty = p.qty + direction * unitStep(p.unit);
        return qty > 0 ? [{ ...p, qty }] : [];
      }),
    );
  }

  return (
    <DataContext.Provider
      value={{
        homes,
        members,
        familyName,
        renameFamily,
        notificationSettings,
        setNotificationSetting,
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
        messages,
        unread,
        chatSettings,
        sendMessage,
        markChatRead,
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
