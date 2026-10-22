export function pointsOf(quests, redemptions, memberId) {
  const earned = quests.filter((q) => q.to === memberId && q.status === "approved").reduce((sum, q) => sum + q.points, 0);
  const spent = redemptions.filter((r) => r.memberId === memberId).reduce((sum, r) => sum + r.cost, 0);
  return earned - spent;
}
