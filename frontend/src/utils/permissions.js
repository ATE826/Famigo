export function canRemoveMember(actor, target) {
  if (!actor || !target || actor.id === target.id) return false;
  if (actor.role === "Owner") return true;
  if (actor.role === "Admin") return target.role === "Member";
  return false;
}

export function removeBlockedReason(actor, target) {
  if (!actor || !target || actor.id === target.id) return "";
  if (actor.role === "Admin" && target.role !== "Member") {
    return "Администратор не может удалить другого администратора или владельца";
  }
  if (actor.role === "Member") {
    return "Удалять участников могут только владелец и администраторы";
  }
  return "";
}

const ranks = { Owner: 3, Admin: 2, Member: 1 };

export function canChangeRole(actor, target) {
  if (!actor || !target || actor.id === target.id) return false;
  return ranks[actor.role] > ranks[target.role];
}

export function assignableRoles(actor) {
  if (!actor || ranks[actor.role] < ranks.Admin) return [];
  return ["Admin", "Member"];
}

export function canManageHomes(actor) {
  return Boolean(actor) && (actor.role === "Owner" || actor.role === "Admin");
}
