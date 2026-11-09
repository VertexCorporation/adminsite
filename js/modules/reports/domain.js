export function reportDepartment(department) {
  return department === 'Core' ? 'Senatus' : department;
}
export function reportDepartments(access, catalog) {
  const own = reportDepartment(access.primaryDepartment || access.departments[0]);
  const available = [...new Set((access.isCore ? catalog : access.departments).map(reportDepartment))];
  return available
    .filter((department) => catalog.includes(department) && department !== 'Core')
    .sort((a, b) => {
      if (a === own) return -1;
      if (b === own) return 1;
      return a.localeCompare(b, 'tr');
    });
}
export function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function addDays(day, count) {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + count);
  return d.toISOString().slice(0, 10);
}
export function monday(day = today()) {
  const d = new Date(day + 'T12:00:00Z');
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== day) return monday(today());
  return addDays(day, -((d.getUTCDay() + 6) % 7));
}
export function days(week) {
  return Array.from({ length: 7 }, (_, i) => addDays(week, i));
}
export function taskInWeek(task, week) {
  const end = addDays(week, 6);
  return [task.createdDate, task.completedDate].some((day) => day && day >= week && day <= end);
}
export function weekSummary(data, week) {
  const entries = data.entries.filter((entry) => entry.date >= week && entry.date <= addDays(week, 6));
  const tasks = data.tasks.filter((task) => taskInWeek(task, week));
  return {
    entries,
    tasks,
    reported: entries.filter((entry) => entry.status !== 'noreport').length,
    work: entries.filter((entry) => entry.status === 'done').length,
    created: tasks.filter((task) => task.createdDate >= week && task.createdDate <= addDays(week, 6)).length,
    completed: tasks.filter((task) => task.completedDate >= week && task.completedDate <= addDays(week, 6)).length,
  };
}
export const reportViews = ['overview', 'daily', 'people', 'tasks', 'weekly'];
