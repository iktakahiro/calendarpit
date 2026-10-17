/**
 * A recorded invitation email that Google would have sent. Calendarpit sends
 * no email; these records let tests assert `sendUpdates` behavior.
 */
export type Notification = {
  id: string;
  calendarId: string;
  eventId: string;
  method: 'REQUEST' | 'CANCEL' | 'REPLY';
  recipients: string[];
  sendUpdates: string;
  time: string;
};
