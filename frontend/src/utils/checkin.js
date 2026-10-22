const minutesOf = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export function checkedToday(checkIns, memberId, now = new Date()) {
  const last = checkIns[memberId];
  return Boolean(last) && new Date(last).toDateString() === now.toDateString();
}

// Участники, которые включили «Я в порядке», но до выбранного времени не отметились
export function overdueMembers(members, checkIns, now = new Date()) {
  const current = now.getHours() * 60 + now.getMinutes();
  return members.filter(
    (m) => m.checkin?.enabled && current >= minutesOf(m.checkin.time) && !checkedToday(checkIns, m.id, now),
  );
}
