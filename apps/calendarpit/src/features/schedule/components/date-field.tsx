import { Button } from '@cloudflare/kumo/components/button';
import { DatePicker } from '@cloudflare/kumo/components/date-picker';
import { Popover } from '@cloudflare/kumo/components/popover';
import { useState } from 'react';
import { Icon } from '../../../components/icon';
import { fromPickerDate, toPickerDate } from '../models/dates';

/**
 * The shown date, with a themed month picker. It replaces `input[type=date]`,
 * whose popup is the browser's own calendar: unstyled by the design system and
 * labelled in the operating system's language.
 */
export function DateField({
  date,
  showDate,
}: {
  /** Shown date, `YYYY-MM-DD`. */
  date: string;
  showDate: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <Button
            className='date-trigger'
            variant='secondary'
            aria-label={`Schedule date: ${date}`}
            icon={<Icon name='calendar' />}
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
            showDate(fromPickerDate(selected));
            setOpen(false);
          }}
        />
      </Popover.Content>
    </Popover>
  );
}
