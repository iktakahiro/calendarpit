import type { Calendar } from '@calendarpit/server';
import { useRegisterCommands } from '../../command/hooks/use-commands';
import type { Command } from '../../command/models/command';
import { parseDateQuery } from '../models/date-query';
import { longDate, shiftDate, today } from '../models/dates';

/** Suggestions the date prompt offers before anything is typed. */
const suggestions = ['today', 'tomorrow', '+1w'];

/**
 * Registers the schedule's commands while it is shown: today, the previous
 * and next day or week, the day and week views, and a date prompt.
 */
export function useScheduleCommands({
  calendar,
  date,
  view,
  showDate,
  showView,
}: {
  calendar?: Calendar;
  date: string;
  view: 'day' | 'week';
  showDate: (date: string) => void;
  showView: (view: 'day' | 'week') => void;
}) {
  const period = view === 'week' ? 'week' : 'day';
  const step = view === 'week' ? 7 : 1;
  const todayDate = () => today(new Date(), calendar?.timeZone);
  const commands: Command[] = [
    {
      id: 'schedule.today',
      label: 'Today',
      group: 'schedule',
      icon: 'calendar',
      shortcut: 't',
      run: () => showDate(todayDate()),
    },
    {
      id: 'schedule.previous',
      label: `Previous ${period}`,
      group: 'schedule',
      icon: 'chevronLeft',
      keywords: ['back', 'earlier'],
      shortcut: 'p',
      run: () => showDate(shiftDate(date, -step)),
    },
    {
      id: 'schedule.next',
      label: `Next ${period}`,
      group: 'schedule',
      icon: 'chevronRight',
      keywords: ['forward', 'later'],
      shortcut: 'n',
      run: () => showDate(shiftDate(date, step)),
    },
    {
      id: 'schedule.day',
      label: 'Day view',
      group: 'schedule',
      icon: 'calendar',
      shortcut: 'd',
      current: view === 'day',
      run: () => showView('day'),
    },
    {
      id: 'schedule.week',
      label: 'Week view',
      group: 'schedule',
      icon: 'calendar',
      shortcut: 'w',
      current: view === 'week',
      run: () => showView('week'),
    },
    {
      id: 'schedule.date',
      label: 'Go to date…',
      group: 'schedule',
      icon: 'calendar',
      keywords: ['jump'],
      shortcut: 'g',
      page: {
        title: 'Go to date',
        placeholder: 'YYYY-MM-DD, today, tomorrow, +3, -1w…',
        empty:
          'Type a date as YYYY-MM-DD, today, tomorrow, yesterday, or an offset from the shown date such as +3 or -1w.',
        answersQuery: true,
        commands: (query) => {
          const context = { shown: date, today: todayDate() };
          const targets = (query.trim() ? [query] : suggestions).flatMap(
            (text) => parseDateQuery(text, context) ?? [],
          );
          return [...new Set(targets)].map((target) => ({
            id: `date.${target}`,
            // The palette is English-only, whatever the interface language.
            label: longDate(target, 'en'),
            description: target,
            group: 'schedule',
            icon: 'calendar',
            run: () => showDate(target),
          }));
        },
      },
    },
  ];
  useRegisterCommands(commands);
}
