import { Button } from '@cloudflare/kumo/components/button';
import { DatePicker } from '@cloudflare/kumo/components/date-picker';
import { Input } from '@cloudflare/kumo/components/input';
import { Popover } from '@cloudflare/kumo/components/popover';
import { useState } from 'react';
import { Icon } from '../../../components/icon';
import { useMessages } from '../../../components/language';
import { fromPickerDate, toPickerDate } from '../models/dates';
import { datePart, timePart, withDate, withTime } from '../models/event-form';

/**
 * One end of an event: a themed month picker for the date and, unless the
 * event is all-day, a time field beside it.
 *
 * It replaces `input[type=datetime-local]`, whose popup is the browser's own
 * calendar: unstyled by the design system and labelled in the operating
 * system's language. Kumo has no time picker, so the time half stays a native
 * `input[type=time]` that Kumo's `Input` themes; it keeps minute precision,
 * which a list of preset slots would lose.
 *
 * The two halves are announced as `<name> date` and `<name> time` in English.
 */
export function DateTimeField({
  name,
  value,
  allDay,
  change,
  blur,
}: {
  /** Names the two controls, for example `Start`. */
  name: string;
  /** `YYYY-MM-DD` when all-day, else `YYYY-MM-DDTHH:mm`. */
  value: string;
  allDay: boolean;
  change: (value: string) => void;
  blur: () => void;
}) {
  const [open, setOpen] = useState(false);
  const t = useMessages();
  const date = datePart(value);
  return (
    <div className='date-time'>
      <Popover open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          render={
            <Button
              className='date-time-trigger'
              variant='secondary'
              aria-label={t['event.dateLabel'](name, date)}
              icon={<Icon name='calendar' />}
              onBlur={blur}
            >
              {date}
            </Button>
          }
        />
        <Popover.Content align='start'>
          <DatePicker
            mode='single'
            required
            selected={toPickerDate(date)}
            defaultMonth={toPickerDate(date)}
            onChange={(selected: Date) => {
              change(withDate(value, fromPickerDate(selected)));
              setOpen(false);
            }}
          />
        </Popover.Content>
      </Popover>
      {!allDay && (
        <Input
          type='time'
          aria-label={t['event.timeLabel'](name)}
          value={timePart(value)}
          onBlur={blur}
          onChange={(e) => change(withTime(value, e.target.value))}
        />
      )}
    </div>
  );
}
