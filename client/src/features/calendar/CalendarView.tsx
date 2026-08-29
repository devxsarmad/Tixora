import { useMemo, useState } from 'react';
import type { TaskSummary } from '../tasks/types.js';

type CalendarViewProps = {
  tasks: TaskSummary[];
  statusLabels: Record<TaskSummary['status'], string>;
  onOpenTask: (taskId: string) => void;
};

type CalendarDay = {
  date: Date;
  key: string;
  inMonth: boolean;
  isToday: boolean;
};

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function parseDueDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildCalendarDays(month: Date): CalendarDay[] {
  const firstDay = startOfMonth(month);
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - firstDay.getDay());
  const todayKey = toDateKey(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const key = toDateKey(date);
    return {
      date,
      key,
      inMonth: date.getMonth() === month.getMonth(),
      isToday: key === todayKey,
    };
  });
}

function getPriorityLabel(priority: TaskSummary['priority']) {
  if (priority === 'urgent') return 'Urgent priority';
  return priority[0].toUpperCase() + priority.slice(1) + ' priority';
}

function getAssigneeLabel(task: TaskSummary) {
  if (task.assignees.length === 0) return 'Unassigned';
  if (task.assignees.length <= 2) {
    return task.assignees.map((assignee) => assignee.displayName || assignee.email).join(', ');
  }

  const visibleNames = task.assignees
    .slice(0, 2)
    .map((assignee) => assignee.displayName || assignee.email)
    .join(', ');
  return visibleNames + ' +' + (task.assignees.length - 2);
}

function sortTasks(left: TaskSummary, right: TaskSummary) {
  const leftDue = parseDueDate(left.dueAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightDue = parseDueDate(right.dueAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  if (leftDue !== rightDue) return leftDue - rightDue;
  return left.title.localeCompare(right.title);
}

export function CalendarView({ tasks, statusLabels, onOpenTask }: CalendarViewProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const firstDatedTask = [...tasks].sort(sortTasks).find((task) => task.dueAt);
    return startOfMonth(parseDueDate(firstDatedTask?.dueAt ?? null) ?? new Date());
  });

  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  const { tasksByDate, unscheduledTasks, visibleTaskCount } = useMemo(() => {
    const byDate: Record<string, TaskSummary[]> = {};
    const unscheduled: TaskSummary[] = [];
    let monthCount = 0;

    [...tasks].sort(sortTasks).forEach((task) => {
      const dueDate = parseDueDate(task.dueAt);
      if (!dueDate) {
        unscheduled.push(task);
        return;
      }

      const key = toDateKey(dueDate);
      byDate[key] = [...(byDate[key] ?? []), task];
      if (dueDate.getMonth() === visibleMonth.getMonth() && dueDate.getFullYear() === visibleMonth.getFullYear()) {
        monthCount += 1;
      }
    });

    return { tasksByDate: byDate, unscheduledTasks: unscheduled, visibleTaskCount: monthCount };
  }, [tasks, visibleMonth]);

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() + offset, 1)));
  };

  const goToToday = () => setVisibleMonth(startOfMonth(new Date()));

  return (
    <section className="workspace-module calendar-module">
      <div className="module-heading calendar-heading">
        <div>
          <p className="section-kicker">Calendar</p>
          <h2>{monthFormatter.format(visibleMonth)}</h2>
          <p>{visibleTaskCount} scheduled tasks in this month.</p>
        </div>
        <div className="calendar-controls" aria-label="Calendar navigation">
          <button type="button" className="icon-button calendar-nav-button" onClick={() => moveMonth(-1)} aria-label="Previous month">
            <span aria-hidden="true">{'<'}</span>
          </button>
          <button type="button" className="secondary-button calendar-today-button" onClick={goToToday}>
            Today
          </button>
          <button type="button" className="icon-button calendar-nav-button" onClick={() => moveMonth(1)} aria-label="Next month">
            <span aria-hidden="true">{'>'}</span>
          </button>
        </div>
      </div>

      <div className="calendar-shell" aria-label={monthFormatter.format(visibleMonth) + ' task calendar'}>
        <div className="calendar-weekdays" role="row">
          {weekdayLabels.map((day) => (
            <span key={day} role="columnheader">
              {day}
            </span>
          ))}
        </div>
        <div className="calendar-month-grid">
          {calendarDays.map((day) => {
            const dayTasks = tasksByDate[day.key] ?? [];
            const visibleTasks = dayTasks.slice(0, 3);
            const hiddenTaskCount = dayTasks.length - visibleTasks.length;

            return (
              <div
                key={day.key}
                className={[
                  'calendar-day',
                  day.inMonth ? 'in-month' : 'outside-month',
                  day.isToday ? 'is-today' : '',
                  dayTasks.length > 0 ? 'has-tasks' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="calendar-day-head">
                  <span className="calendar-day-number">{day.date.getDate()}</span>
                  {dayTasks.length > 0 ? <span className="calendar-day-count">{dayTasks.length}</span> : null}
                </div>

                <div className="calendar-task-list">
                  {visibleTasks.map((task) => {
                    const dueDate = parseDueDate(task.dueAt);
                    return (
                      <button
                        key={task.id}
                        type="button"
                        className={'calendar-task status-' + task.status.replace('_', '-')}
                        onClick={() => onOpenTask(task.id)}
                        aria-label={'Open ' + task.title + ', ' + statusLabels[task.status]}
                      >
                        <span className="calendar-task-title">{task.title}</span>
                        <span className={'priority-icon ' + task.priority} aria-label={getPriorityLabel(task.priority)} />
                        {dueDate ? <span className="calendar-task-time">{timeFormatter.format(dueDate)}</span> : null}
                        <span className="calendar-task-tooltip" role="tooltip">
                          <strong>{task.title}</strong>
                          <span>Status: {statusLabels[task.status]}</span>
                          <span>Priority: {getPriorityLabel(task.priority).replace(' priority', '')}</span>
                          <span>Due: {dueDate ? timeFormatter.format(dueDate) : 'No due time'}</span>
                          <span>Assignees: {getAssigneeLabel(task)}</span>
                          <span>Comments: {task.commentCount}</span>
                        </span>
                      </button>
                    );
                  })}
                  {hiddenTaskCount > 0 ? <span className="calendar-more">+{hiddenTaskCount} more</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {tasks.length === 0 ? <div className="soft-empty module-empty calendar-empty">No tasks to schedule yet.</div> : null}

      {unscheduledTasks.length > 0 ? (
        <section className="unscheduled-panel" aria-label="Tasks without due dates">
          <div className="unscheduled-heading">
            <div>
              <h3>Unscheduled tasks</h3>
              <p>Add due dates to place these on the calendar.</p>
            </div>
            <span className="count-badge">{unscheduledTasks.length}</span>
          </div>
          <div className="unscheduled-list">
            {unscheduledTasks.map((task) => (
              <button key={task.id} type="button" className="unscheduled-task" onClick={() => onOpenTask(task.id)}>
                <span>
                  <strong>{task.title}</strong>
                  <small>{statusLabels[task.status]}</small>
                </span>
                <span className={'priority-icon ' + task.priority} aria-label={getPriorityLabel(task.priority)} />
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
