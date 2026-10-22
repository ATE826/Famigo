export function ageOf(birthday, now = new Date()) {
  if (!birthday) return null;
  const [day, month, year] = birthday.split(".").map(Number);
  if (!day || !month || !year) return null;
  const hadBirthday = now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);
  return now.getFullYear() - year - (hadBirthday ? 0 : 1);
}

export function isMinor(member) {
  const age = ageOf(member?.birthday);
  return age !== null && age < 18;
}
