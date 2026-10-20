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
  const currentUserId = "anton";

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
