import { useState } from "react";
import { unitStep } from "../pages/Fridge/products";
import { DataContext } from "./DataContext";
import { initialHomes, initialMembers, initialProducts } from "./initialData";
import { initialOperations } from "./operations";

export default function DataProvider({ children }) {
  const [homes, setHomes] = useState(initialHomes);
  const [products, setProducts] = useState(initialProducts);
  const [operations, setOperations] = useState(initialOperations);
  const [fridgeHomeId, setFridgeHomeId] = useState(initialHomes[0].id);
  const [members, setMembers] = useState(initialMembers);
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
        if (h.id !== homeId || h.residents.includes(memberId)) return h;
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

  function updateMemberRole(id, role) {
    setMembers((current) => current.map((m) => (m.id === id ? { ...m, role } : m)));
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
        currentUserId,
        products,
        operations,
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
