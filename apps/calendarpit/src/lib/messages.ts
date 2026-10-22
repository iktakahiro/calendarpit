import type { Locale } from './locale';

/**
 * English interface text, the source every translation follows. Entries that
 * take values are functions so each language can order and inflect them.
 *
 * Only interface text belongs here. Protocol data stays verbatim in every
 * language: paths, HTTP methods and statuses, JSON, scopes, resource states,
 * and IDs.
 */
const en = {
  'meta.title': 'Calendarpit · Local calendar lab',
  'meta.description':
    'A local Google Calendar API-compatible server for development and repeatable tests.',
  'notFound.title': 'Nothing scheduled here.',
  'notFound.link': 'Return to the workspace',

  'shell.skip': 'Skip to content',
  'shell.refresh': 'Refresh',
  'shell.refreshed': 'Workspace refreshed.',
  'shell.loading': 'Loading your workspace…',
  'shell.yourSchedule': 'Your schedule',
  'shell.primary': 'primary',
  'shell.createUser': 'Create a test user to begin.',

  'section.schedule.label': 'Schedule',
  'section.schedule.eyebrow': 'Schedule',
  'section.history.label': 'API history',
  'section.history.eyebrow': 'Protocol log',
  'section.history.lede':
    'Calendar API and OAuth requests that your app sent to Calendarpit, with request and response headers and bodies.',
  'section.watch.label': 'Watch',
  'section.watch.eyebrow': 'Notifications',
  'section.watch.lede':
    'Inspect the watch channels your app created and the notifications Calendarpit sent to them, across all calendars.',
  'section.connections.label': 'Connections',
  'section.connections.eyebrow': 'Integration',
  'section.connections.lede':
    'A connection is an OAuth grant: which test user granted which scopes to which OAuth client. Revoking it invalidates its tokens, so your app must ask the user to authorize again.',
  'section.users.label': 'Users',
  'section.users.eyebrow': 'Directory',
  'section.users.lede':
    'Create and edit test users. They have no password; choose one on the local consent page to sign in.',
  'section.calendars.label': 'Calendars',
  'section.calendars.eyebrow': 'Directory',
  'section.calendars.lede': 'Manage calendars for the selected test user.',
  'section.settings.label': 'Settings',
  'section.settings.eyebrow': 'Configuration',
  'section.settings.lede':
    'Choose the theme and language, load or reset test data, and manage OAuth clients.',
  'group.activity': 'Activity',
  'group.workspace': 'Workspace',

  'rail.live': 'Live',
  'rail.disconnected': 'Disconnected',
  'rail.connecting': 'Connecting…',
  'rail.lastSynced': (time: string) => `Last synced ${time}`,
  'rail.testUser': 'Test user',
  'rail.calendar': 'Calendar',
  'rail.calendars': 'Calendars',
  'rail.primary': 'Primary',
  'rail.primaryTitle': 'Primary calendar',
  'rail.noCalendars': 'No calendars for this user yet.',
  'rail.sections': 'Workspace sections',
  'rail.sqlite': 'SQLite',
  'rail.memory': 'In-memory',
  'rail.sqliteNote': 'Changes are saved across restarts.',
  'rail.memoryNote': 'Changes live here until you reset or restart.',

  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.delete': 'Delete',
  'common.busy': 'Busy',
  'common.free': 'Free',
  'common.untitled': '(Untitled event)',
  'common.allDay': 'All day',
  'common.zoneBefore': 'Times shown in ',
  'common.events': (count: number) =>
    `${count} ${count === 1 ? 'event' : 'events'}`,

  'schedule.dateNavigation': 'Date navigation',
  'schedule.previousDay': 'Previous day',
  'schedule.nextDay': 'Next day',
  'schedule.date': (date: string) => `Schedule date: ${date}`,
  'schedule.today': 'Today',
  'schedule.view': 'Calendar view',
  'schedule.day': 'Day',
  'schedule.week': 'Week',
  'schedule.noCalendar': 'No calendar',
  'schedule.newEvent': 'New event',
  'schedule.dailyEvents': 'Daily events',
  'schedule.noCalendarSelected': 'No calendar selected',
  'schedule.userHasNoCalendars': (name: string) =>
    `${name} has no calendars yet. Add one in workspace settings.`,
  'schedule.createUserAndCalendar':
    'Create a test user and a calendar in workspace settings.',
  'schedule.openSettings': 'Open workspace settings',
  'schedule.eventSaved': 'Event saved.',
  'schedule.eventDeleted': 'Event deleted.',

  'day.busyCount': (count: number) => `${count} busy`,
  'day.freeCount': (count: number) => `${count} free`,
  'day.now': 'Now',
  'day.clockChange':
    'These events span a clock change. The 24-hour overview is hidden; refer to the event times and elapsed durations below.',
  'day.overview': (timed: number, allDay: number) =>
    `Day overview: ${timed} timed and ${allDay} all-day events.`,
  'day.until': (date: string) => `Until ${date}`,
  'day.deleteLabel': (name: string) => `Delete ${name}`,
  'day.deleteTitle': 'Delete this event?',
  'day.deleteDescription': (name: string, calendar: string) =>
    `${name} is removed from ${calendar}. Clients watching this calendar receive a notification.`,
  'day.deleteConfirm': 'Delete event',
  'day.emptyTitle': 'Nothing scheduled',
  'day.emptyDescription':
    'No events on this date. Add one here, or have your app create one through the Calendar API.',
  'day.zoneAfter':
    '. End times are exclusive. Free events do not block availability.',
  'day.durationDays': (days: number) => (days === 1 ? '1 day' : `${days} days`),
  'day.durationTime': (hours: number, minutes: number) =>
    hours ? (minutes ? `${hours}h ${minutes}m` : `${hours}h`) : `${minutes}m`,

  'week.weeklyEvents': 'Weekly events',
  'week.range': (first: string, last: string, year: string) =>
    `${first} – ${last}, ${year}`,
  'week.weekOf': (day: string) => `Week of ${day}`,
  'week.newEventAt': (time: string, weekday: string, date: string) =>
    `New event at ${time} on ${weekday} ${date}`,
  'week.zoneAfter': '. Click a slot to add an event.',
  'week.clockChange':
    ' A clock change this week shifts the grid by its offset; the day view reports exact times.',

  'event.editor': 'Event editor',
  'event.edit': 'Edit event',
  'event.new': 'New event',
  'event.newTitle': 'A new event',
  'event.saveFailed': 'Could not save event.',
  'event.summary': 'Summary',
  'event.when': 'When',
  'event.allDay': 'All-day event',
  'event.start': 'Start',
  'event.end': 'End',
  'event.endExclusive': 'End (exclusive)',
  'event.dateLabel': (name: string, date: string) => `${name} date: ${date}`,
  'event.timeLabel': (name: string) => `${name} time`,
  'event.availability': 'Availability',
  'event.location': 'Location',
  'event.description': 'Description',
  'event.extendedProperties': 'Extended properties (JSON)',
  'event.save': 'Save event',
  'event.escToClose': ' to close',
  'event.updated': 'Updated',
  'event.errorStart': 'Enter a start.',
  'event.errorStartTime': 'Enter a start time.',
  'event.errorEnd': 'Enter an end.',
  'event.errorEndTime': 'Enter an end time.',
  'event.errorOrder': 'End must be after start.',
  'event.errorProperties': 'Extended properties must be a JSON object.',

  'directory.userList': 'User directory',
  'directory.users': 'Test users',
  'directory.usersInWorkspace': (count: number) =>
    `${count} ${count === 1 ? 'user' : 'users'} in this workspace`,
  'directory.calendarCount': (count: number) =>
    `${count} ${count === 1 ? 'calendar' : 'calendars'}`,
  'directory.calendarList': 'Calendar directory',
  'directory.userCalendars': (name: string) => `${name}'s calendars`,
  'directory.calendarsForUser': (count: number) =>
    `${count} ${count === 1 ? 'calendar' : 'calendars'} for this user`,
  'directory.createUserFirst': 'Create a user first',
  'directory.calendarNeedsUser': 'Every calendar belongs to a test user.',
  'directory.addUser': 'Add user',
  'directory.primary': 'Primary',
  'directory.user.eyebrow': 'Test user',
  'directory.user.new': 'New user',
  'directory.user.edit': 'Edit user',
  'directory.user.empty': 'No users yet',
  'directory.user.emptyDescription': 'Add the first user using the form.',
  'directory.user.deleteTitle': 'Delete this user?',
  'directory.user.deleteDescription':
    'The user, their calendars, and their events are removed, and their OAuth connections are revoked. Reset restores the startup fixture.',
  'directory.user.deleteConfirm': 'Delete user',
  'directory.user.name': 'Name',
  'directory.user.email': 'Email',
  'directory.user.save': 'Save user',
  'directory.user.saved': 'User saved.',
  'directory.user.deleted': 'User and owned data deleted.',
  'directory.user.errorName': 'Enter a name.',
  'directory.user.errorEmail': 'Enter an email address.',
  'directory.calendar.eyebrow': 'Calendar',
  'directory.calendar.new': 'New calendar',
  'directory.calendar.edit': 'Edit calendar',
  'directory.calendar.empty': 'No calendars yet',
  'directory.calendar.emptyDescription':
    'Add the first calendar using the form.',
  'directory.calendar.deleteTitle': 'Delete this calendar?',
  'directory.calendar.deleteDescription':
    'The calendar and its events are removed, and its watch channels are stopped. Reset restores the startup fixture.',
  'directory.calendar.deleteConfirm': 'Delete calendar',
  'directory.calendar.name': 'Calendar name',
  'directory.calendar.timeZone': 'Time zone',
  'directory.calendar.primary': 'Primary calendar',
  'directory.calendar.save': 'Save calendar',
  'directory.calendar.saved': 'Calendar saved.',
  'directory.calendar.deleted': 'Calendar deleted.',
  'directory.calendar.errorName': 'Enter a calendar name.',
  'directory.calendar.errorTimeZone':
    'Enter an IANA time zone, such as Asia/Tokyo.',

  'connections.title': 'OAuth connections',
  'connections.summary': (active: number, revoked: number) =>
    `${active} active · ${revoked} revoked`,
  'connections.scopes': 'Granted scopes',
  'connections.granted': 'Granted ',
  'connections.revoked': 'Revoked',
  'connections.active': 'Active',
  'connections.revoke': 'Revoke',
  'connections.revokedNotice':
    'Connection revoked. Its tokens no longer work; authorize again from your app.',
  'connections.empty': 'No connections yet',
  'connections.emptyDescription':
    'A connection appears when a test user approves your app on the consent page. To try it, start the SDK sample:',

  'watch.channels': 'Watch channels',
  'watch.activeCount': (count: number) =>
    `${count} active ${count === 1 ? 'channel' : 'channels'}`,
  'watch.expires': 'Expires ',
  'watch.watching': 'Watching',
  'watch.emptyChannels': 'No active channels',
  'watch.emptyChannelsDescription':
    'Channels that your app creates with events.watch or calendarList.watch appear here until they expire or are stopped.',
  'watch.deliveries': 'Delivery log',
  'watch.deliveriesDescription':
    'Push notifications that Calendarpit sent to watch channel addresses, newest first.',
  'watch.columnChannel': 'Channel / message',
  'watch.columnState': 'State',
  'watch.columnAttempts': 'Attempts',
  'watch.columnTime': 'Time',
  'watch.columnStatus': 'Status',
  'watch.attempts': (count: number) =>
    `${count} ${count === 1 ? 'attempt' : 'attempts'}`,
  'watch.emptyDeliveries': 'No deliveries yet',
  'watch.emptyDeliveriesDescription': 'Notifications will appear here.',

  'history.filter': 'Filter requests',
  'history.filterPlaceholder': 'Filter by method, path, or status',
  'history.status': 'Request status',
  'history.all': 'All',
  'history.errors': 'Errors',
  'history.clear': 'Clear history',
  'history.cleared': 'History cleared.',
  'history.clearTitle': 'Clear history?',
  'history.clearDescription':
    'All recorded Calendar API and OAuth requests and responses are cleared.',
  'history.note':
    'The latest 200 Calendar API and OAuth requests, newest first. Credentials are masked.',
  'history.requests': 'API requests',
  'history.request': 'Request',
  'history.response': 'Response',
  'history.copyRequest': 'Copy request JSON',
  'history.copyResponse': 'Copy response JSON',
  'history.copy': 'Copy',
  'history.copied': 'Copied',
  'history.waiting': 'Waiting for your app.',
  'history.waitingDescription':
    'Requests that your app sends to the Calendar API and OAuth endpoints appear here.',
  'history.noMatches': 'No matching requests',
  'history.noMatchesDescription':
    'Change or reset the filters to see more of the log.',
  'history.clearFilters': 'Reset filters',
  'history.showing': (shown: number, total: number) =>
    `Showing ${shown} of ${total} ${total === 1 ? 'request' : 'requests'}. Credentials are masked.`,
  'history.matches': (count: number) =>
    `${count} matching ${count === 1 ? 'request' : 'requests'}`,

  'settings.sections': 'Settings sections',
  'settings.appearance': 'Appearance',
  'settings.developer': 'Developer',
  'settings.testData': 'Test data',
  'settings.clients': 'OAuth clients',
  'settings.appearanceDescription':
    'Choose a theme and a language, or follow your device settings.',
  'settings.theme': 'Theme',
  'settings.language': 'Language',
  'settings.light': 'Light',
  'settings.dark': 'Dark',
  'settings.system': 'System',
  'settings.mode': (mode: string) => `${mode} mode`,
  'settings.systemLanguage': 'System language',
  'settings.rateLimit': 'Calendar API rate limits',
  'settings.rateLimitMode': 'Mode',
  'settings.rateLimitDescription':
    'Choose how Calendar API requests are limited. The mode is saved with the workspace.',
  'settings.rateLimitOff': 'Off',
  'settings.rateLimitProduction': 'Production',
  'settings.rateLimitErrorTest': 'Error testing',
  'settings.rateLimitOffDescription': 'No simulated rate limiting.',
  'settings.rateLimitProductionDescription':
    "Limits roughly match Google's published quotas (approximate, not identical): 600 requests per minute per user, 10,000 per minute per project, and an estimated 60 writes per minute per calendar (not published by Google).",
  'settings.rateLimitErrorTestDescription':
    'Very low limits that trigger 403 and 429 errors quickly to test retry and backoff handling: 4 requests per minute per user, 12 per minute per project, 2 writes per minute per calendar, and 20 requests per day per user.',
  'settings.rateLimitLabelSeparator': '. ',
  'settings.rateLimitSaved': 'Rate limit mode saved.',
  'settings.storage': 'Storage',
  'settings.storageSqlite': 'Changes are saved automatically across restarts.',
  'settings.storageMemory': 'Temporary session. Restarting discards changes.',
  'settings.fixtures': 'Fixtures & reset',
  'settings.fixturesDescription':
    'Load JSON with users, calendars, events, and OAuth clients. Loading replaces the current state; reset restores the startup fixture.',
  'settings.fixtureJson': 'Fixture JSON',
  'settings.fixtureJsonError': 'Enter valid JSON.',
  'settings.fixtureLoadError':
    'Could not load the fixture. Check the fixture content.',
  'settings.openFile': 'Open JSON file…',
  'settings.loadFixture': 'Load fixture',
  'settings.loadTitle': 'Load this fixture?',
  'settings.loadDescription':
    'The fixture replaces the current users, calendars, events, and OAuth clients, and clears connections, request history, and watch channels.',
  'settings.fixtureLoaded': 'Fixture loaded.',
  'settings.reset': 'Reset workspace',
  'settings.resetDescription':
    'Restore the startup fixture and clear connections, request history, and watch channels.',
  'settings.resetTitle': 'Reset the workspace?',
  'settings.resetConfirmDescription':
    'The startup fixture is restored, and connections, request history, and watch channels are cleared.',
  'settings.resetDone': 'Startup state restored.',
  'settings.currentState': 'Current state',
  'settings.stateNote': (revision: string) =>
    `Credentials excluded · revision ${revision}`,

  'clients.title': 'Registered OAuth clients',
  'clients.description':
    'Edit secrets and redirect URIs. Users, events, and connections stay as they are.',
  'clients.new': 'New client',
  'clients.newForm': 'New OAuth client',
  'clients.redirectUris': 'Redirect URIs',
  'clients.edit': (id: string) => `Edit ${id}`,
  'clients.delete': (id: string) => `Delete ${id}`,
  'clients.deleteTitle': 'Delete this OAuth client?',
  'clients.deleteDescription':
    'The client is removed and its connections are revoked. Reset restores the startup fixture.',
  'clients.deleteConfirm': 'Delete client',
  'clients.empty': 'No OAuth clients',
  'clients.emptyDescription': 'Add a client to enable the consent flow.',
  'clients.id': 'Client ID',
  'clients.secret': 'Client secret',
  'clients.keepSecret': 'Leave blank to keep the current secret',
  'clients.redirectUrisField': 'Redirect URIs, one per line',
  'clients.save': 'Save client',
  'clients.saved': 'OAuth client saved.',
  'clients.deleted': 'OAuth client deleted.',
  'clients.errorId': 'Use 1–128 letters, digits, or @ . _ - characters.',
  'clients.errorSecret': 'Enter a client secret.',
  'clients.errorRedirectMissing': 'Enter at least one redirect URI.',
  'clients.errorRedirectInvalid':
    'Use absolute http or https URLs without a fragment or credentials.',
};

/** The shape every translation of the admin UI must match. */
export type Messages = typeof en;

/** Keys of {@link Messages} whose entries are plain text. */
export type TextKey = {
  [K in keyof Messages]: Messages[K] extends string ? K : never;
}[keyof Messages];

/** Japanese interface text. A missing or extra key fails type checking. */
const ja = {
  'meta.title': 'Calendarpit · ローカルカレンダーラボ',
  'meta.description':
    '開発とテストで使う、Google Calendar API 互換のローカルサーバー。',
  'notFound.title': 'ページが見つかりません。',
  'notFound.link': 'ワークスペースに戻る',

  'shell.skip': 'コンテンツへスキップ',
  'shell.refresh': '更新',
  'shell.refreshed': 'ワークスペースを更新しました。',
  'shell.loading': 'ワークスペースを読み込んでいます…',
  'shell.yourSchedule': 'スケジュール',
  'shell.primary': 'プライマリ',
  'shell.createUser': 'まずテストユーザーを作成してください。',

  'section.schedule.label': 'スケジュール',
  'section.schedule.eyebrow': 'スケジュール',
  'section.history.label': 'API 履歴',
  'section.history.eyebrow': 'プロトコルログ',
  'section.history.lede':
    'アプリが Calendar API と OAuth で Calendarpit に送ったリクエストと、そのレスポンスをヘッダーとボディを含めて確認します。',
  'section.watch.label': 'Watch',
  'section.watch.eyebrow': '通知',
  'section.watch.lede':
    'アプリが作成した watch チャネルと、Calendarpit がそのチャネルに送った通知を確認します。すべてのカレンダーが対象です。',
  'section.connections.label': '接続',
  'section.connections.eyebrow': '連携',
  'section.connections.lede':
    '接続は OAuth 認可で、どのテストユーザーがどの OAuth クライアントにどのスコープを許可したかを表します。取り消すとその接続のトークンが無効になり、アプリはユーザーにもう一度認可を求める必要があります。',
  'section.users.label': 'ユーザー',
  'section.users.eyebrow': 'ディレクトリ',
  'section.users.lede':
    'テストユーザーを作成・編集します。パスワードはなく、ローカルの同意画面でユーザーを選んでサインインします。',
  'section.calendars.label': 'カレンダー',
  'section.calendars.eyebrow': 'ディレクトリ',
  'section.calendars.lede': '選択中のテストユーザーのカレンダーを管理します。',
  'section.settings.label': '設定',
  'section.settings.eyebrow': '構成',
  'section.settings.lede':
    'テーマと言語の選択、テストデータの読み込みとリセット、OAuth クライアントの管理を行います。',
  'group.activity': 'アクティビティ',
  'group.workspace': 'ワークスペース',

  'rail.live': 'ライブ',
  'rail.disconnected': '切断',
  'rail.connecting': '接続中…',
  'rail.lastSynced': (time: string) => `最終同期 ${time}`,
  'rail.testUser': 'テストユーザー',
  'rail.calendar': 'カレンダー',
  'rail.calendars': 'カレンダー',
  'rail.primary': 'プライマリ',
  'rail.primaryTitle': 'プライマリカレンダー',
  'rail.noCalendars': 'このユーザーにはまだカレンダーがありません。',
  'rail.sections': 'ワークスペースのセクション',
  'rail.sqlite': 'SQLite',
  'rail.memory': 'インメモリ',
  'rail.sqliteNote': '変更は再起動後も保存されます。',
  'rail.memoryNote': '変更はリセットか再起動まで保持されます。',

  'common.cancel': 'キャンセル',
  'common.close': '閉じる',
  'common.delete': '削除',
  'common.busy': '予定あり',
  'common.free': '空き',
  'common.untitled': '（無題のイベント）',
  'common.allDay': '終日',
  'common.zoneBefore': '',
  'common.events': (count: number) => `${count}件のイベント`,

  'schedule.dateNavigation': '日付の移動',
  'schedule.previousDay': '前の日',
  'schedule.nextDay': '次の日',
  'schedule.date': (date: string) => `表示する日付: ${date}`,
  'schedule.today': '今日',
  'schedule.view': 'カレンダーの表示',
  'schedule.day': '日',
  'schedule.week': '週',
  'schedule.noCalendar': 'カレンダーなし',
  'schedule.newEvent': '新しいイベント',
  'schedule.dailyEvents': 'その日のイベント',
  'schedule.noCalendarSelected': 'カレンダーが選択されていません',
  'schedule.userHasNoCalendars': (name: string) =>
    `${name} にはまだカレンダーがありません。ワークスペースの設定で追加してください。`,
  'schedule.createUserAndCalendar':
    'ワークスペースの設定でテストユーザーとカレンダーを作成してください。',
  'schedule.openSettings': 'ワークスペースの設定を開く',
  'schedule.eventSaved': 'イベントを保存しました。',
  'schedule.eventDeleted': 'イベントを削除しました。',

  'day.busyCount': (count: number) => `予定あり ${count}`,
  'day.freeCount': (count: number) => `空き ${count}`,
  'day.now': '現在',
  'day.clockChange':
    'この日のイベントは夏時間などによる時刻の切り替えをまたぐため、24時間のトラックは表示しません。各イベントの時刻と所要時間は下の一覧で確認してください。',
  'day.overview': (timed: number, allDay: number) =>
    `その日の概要: 時刻指定のイベント${timed}件、終日のイベント${allDay}件。`,
  'day.until': (date: string) => `${date} まで`,
  'day.deleteLabel': (name: string) => `${name} を削除`,
  'day.deleteTitle': 'このイベントを削除しますか？',
  'day.deleteDescription': (name: string, calendar: string) =>
    `${name} を ${calendar} から削除します。このカレンダーの watch チャネルには通知が送られます。`,
  'day.deleteConfirm': 'イベントを削除',
  'day.emptyTitle': 'イベントはありません',
  'day.emptyDescription':
    'この日のイベントはありません。ここで追加するか、アプリから Calendar API で作成してください。',
  'day.zoneAfter':
    ' の時刻で表示しています。終了時刻はイベントの期間に含みません。「空き」のイベントは、空き時間の計算で予定として扱いません。',
  'day.durationDays': (days: number) => `${days}日`,
  'day.durationTime': (hours: number, minutes: number) =>
    hours
      ? minutes
        ? `${hours}時間${minutes}分`
        : `${hours}時間`
      : `${minutes}分`,

  'week.weeklyEvents': 'その週のイベント',
  'week.range': (first: string, last: string, year: string) =>
    `${year}年${first}～${last}`,
  'week.weekOf': (day: string) => `${day}曜日始まりの週`,
  'week.newEventAt': (time: string, weekday: string, date: string) =>
    `${date}（${weekday}）${time} に新しいイベント`,
  'week.zoneAfter':
    ' の時刻で表示しています。空いている枠を選ぶと、その時刻にイベントを追加できます。',
  'week.clockChange':
    'この週は夏時間などで時刻が切り替わるため、グリッド上の位置はその時差の分ずれます。正確な時刻は日表示で確認してください。',

  'event.editor': 'イベントエディタ',
  'event.edit': 'イベントを編集',
  'event.new': '新しいイベント',
  'event.newTitle': '新しいイベント',
  'event.saveFailed': 'イベントを保存できませんでした。',
  'event.summary': '件名',
  'event.when': '日時',
  'event.allDay': '終日のイベント',
  'event.start': '開始',
  'event.end': '終了',
  'event.endExclusive': '終了（この日を含まない）',
  'event.dateLabel': (name: string, date: string) => `${name}日: ${date}`,
  'event.timeLabel': (name: string) => `${name}時刻`,
  'event.availability': '空き状況',
  'event.location': '場所',
  'event.description': '説明',
  'event.extendedProperties': '拡張プロパティ（JSON）',
  'event.save': 'イベントを保存',
  'event.escToClose': ' で閉じる',
  'event.updated': '更新日時',
  'event.errorStart': '開始を入力してください。',
  'event.errorStartTime': '開始時刻を入力してください。',
  'event.errorEnd': '終了を入力してください。',
  'event.errorEndTime': '終了時刻を入力してください。',
  'event.errorOrder': '終了は開始より後にしてください。',
  'event.errorProperties':
    '拡張プロパティは JSON オブジェクトで入力してください。',

  'directory.userList': 'ユーザーディレクトリ',
  'directory.users': 'テストユーザー',
  'directory.usersInWorkspace': (count: number) =>
    `このワークスペースのユーザー${count}人`,
  'directory.calendarCount': (count: number) => `カレンダー${count}件`,
  'directory.calendarList': 'カレンダーディレクトリ',
  'directory.userCalendars': (name: string) => `${name} のカレンダー`,
  'directory.calendarsForUser': (count: number) =>
    `このユーザーのカレンダー${count}件`,
  'directory.createUserFirst': '先にユーザーを作成してください',
  'directory.calendarNeedsUser':
    'カレンダーはいずれかのテストユーザーに属します。',
  'directory.addUser': 'ユーザーを追加',
  'directory.primary': 'プライマリ',
  'directory.user.eyebrow': 'テストユーザー',
  'directory.user.new': '新しいユーザー',
  'directory.user.edit': 'ユーザーを編集',
  'directory.user.empty': 'ユーザーはまだいません',
  'directory.user.emptyDescription':
    'フォームから最初のユーザーを追加してください。',
  'directory.user.deleteTitle': 'このユーザーを削除しますか？',
  'directory.user.deleteDescription':
    'ユーザーと、そのユーザーのカレンダーとイベントを削除し、OAuth 接続を取り消します。リセットすると起動時の Fixture に戻ります。',
  'directory.user.deleteConfirm': 'ユーザーを削除',
  'directory.user.name': '名前',
  'directory.user.email': 'メールアドレス',
  'directory.user.save': 'ユーザーを保存',
  'directory.user.saved': 'ユーザーを保存しました。',
  'directory.user.deleted': 'ユーザーとそのデータを削除しました。',
  'directory.user.errorName': '名前を入力してください。',
  'directory.user.errorEmail': 'メールアドレスを入力してください。',
  'directory.calendar.eyebrow': 'カレンダー',
  'directory.calendar.new': '新しいカレンダー',
  'directory.calendar.edit': 'カレンダーを編集',
  'directory.calendar.empty': 'カレンダーはまだありません',
  'directory.calendar.emptyDescription':
    'フォームから最初のカレンダーを追加してください。',
  'directory.calendar.deleteTitle': 'このカレンダーを削除しますか？',
  'directory.calendar.deleteDescription':
    'カレンダーとそのイベントを削除し、このカレンダーの watch チャネルを停止します。リセットすると起動時の Fixture に戻ります。',
  'directory.calendar.deleteConfirm': 'カレンダーを削除',
  'directory.calendar.name': 'カレンダー名',
  'directory.calendar.timeZone': 'タイムゾーン',
  'directory.calendar.primary': 'プライマリカレンダー',
  'directory.calendar.save': 'カレンダーを保存',
  'directory.calendar.saved': 'カレンダーを保存しました。',
  'directory.calendar.deleted': 'カレンダーを削除しました。',
  'directory.calendar.errorName': 'カレンダー名を入力してください。',
  'directory.calendar.errorTimeZone':
    'Asia/Tokyo のような IANA タイムゾーンを入力してください。',

  'connections.title': 'OAuth 接続',
  'connections.summary': (active: number, revoked: number) =>
    `有効 ${active} · 取り消し済み ${revoked}`,
  'connections.scopes': '許可されたスコープ',
  'connections.granted': '認可日時 ',
  'connections.revoked': '取り消し済み',
  'connections.active': '有効',
  'connections.revoke': '取り消す',
  'connections.revokedNotice':
    '接続を取り消しました。この接続のトークンは使えなくなったため、アプリからもう一度認可してください。',
  'connections.empty': '接続はまだありません',
  'connections.emptyDescription':
    'テストユーザーが同意画面でアプリへのアクセスを許可すると、接続がここに表示されます。試すには SDK サンプルを起動します:',

  'watch.channels': 'Watch チャネル',
  'watch.activeCount': (count: number) => `有効なチャネル${count}件`,
  'watch.expires': '有効期限 ',
  'watch.watching': '監視中',
  'watch.emptyChannels': '有効なチャネルはありません',
  'watch.emptyChannelsDescription':
    'アプリが events.watch や calendarList.watch で作成したチャネルは、期限切れになるか停止されるまでここに表示されます。',
  'watch.deliveries': '配信ログ',
  'watch.deliveriesDescription':
    'Calendarpit が watch チャネルのアドレスに送ったプッシュ通知を、新しい順に表示します。',
  'watch.columnChannel': 'チャネル / メッセージ',
  'watch.columnState': '状態',
  'watch.columnAttempts': '試行回数',
  'watch.columnTime': '時刻',
  'watch.columnStatus': '結果',
  'watch.attempts': (count: number) => `${count}回`,
  'watch.emptyDeliveries': '配信はまだありません',
  'watch.emptyDeliveriesDescription': '通知はここに表示されます。',

  'history.filter': 'リクエストを絞り込む',
  'history.filterPlaceholder': 'メソッド、パス、ステータスで絞り込む',
  'history.status': 'リクエストのステータス',
  'history.all': 'すべて',
  'history.errors': 'エラー',
  'history.clear': '履歴を消去',
  'history.cleared': '履歴を消去しました。',
  'history.clearTitle': '履歴を消去しますか？',
  'history.clearDescription':
    '記録された Calendar API と OAuth のリクエストとレスポンスはすべて消去されます。',
  'history.note':
    '直近200件の Calendar API と OAuth のリクエストを新しい順に表示します。トークンなどの認証情報はマスクされます。',
  'history.requests': 'API リクエスト',
  'history.request': 'リクエスト',
  'history.response': 'レスポンス',
  'history.copyRequest': 'リクエストの JSON をコピー',
  'history.copyResponse': 'レスポンスの JSON をコピー',
  'history.copy': 'コピー',
  'history.copied': 'コピーしました',
  'history.waiting': 'アプリからのリクエストを待っています。',
  'history.waitingDescription':
    'アプリが Calendar API と OAuth のエンドポイントに送ったリクエストが、ここに表示されます。',
  'history.noMatches': '一致するリクエストはありません',
  'history.noMatchesDescription':
    '絞り込み条件を変更するか、解除してください。',
  'history.clearFilters': '絞り込みを解除',
  'history.showing': (shown: number, total: number) =>
    `リクエスト${total}件中${shown}件を表示します。トークンなどの認証情報はマスクされます。`,
  'history.matches': (count: number) => `一致するリクエスト ${count}件`,

  'settings.sections': '設定のセクション',
  'settings.appearance': '表示',
  'settings.developer': '開発者',
  'settings.testData': 'テストデータ',
  'settings.clients': 'OAuth クライアント',
  'settings.appearanceDescription':
    'テーマと言語を選ぶか、デバイスの設定に合わせます。',
  'settings.theme': 'テーマ',
  'settings.language': '言語',
  'settings.light': 'ライト',
  'settings.dark': 'ダーク',
  'settings.system': 'システム',
  'settings.mode': (mode: string) => `${mode}モード`,
  'settings.systemLanguage': 'システムの言語',
  'settings.rateLimit': 'Calendar API のレート制限',
  'settings.rateLimitMode': 'モード',
  'settings.rateLimitDescription':
    'Calendar API リクエストの制限方法を選びます。モードはワークスペースに保存されます。',
  'settings.rateLimitOff': 'オフ',
  'settings.rateLimitProduction': '本番相当',
  'settings.rateLimitErrorTest': 'エラー確認用',
  'settings.rateLimitOffDescription': 'レート制限をシミュレートしません。',
  'settings.rateLimitProductionDescription':
    'Google の公開クォータにほぼ準じた制限です（完全一致ではありません）。ユーザーごとに毎分600リクエスト、プロジェクトごとに毎分10,000リクエスト、1つのカレンダーへの書き込みは毎分60リクエスト（Google 非公開のため推定値）です。',
  'settings.rateLimitErrorTestDescription':
    'リトライやバックオフの処理を確認できるよう、403 / 429 エラーがすぐ発生する極端に低い制限です。ユーザーごとに毎分4リクエスト、プロジェクトごとに毎分12リクエスト、1つのカレンダーへの書き込みは毎分2リクエスト、ユーザーごとに1日20リクエストです。',
  'settings.rateLimitLabelSeparator': '：',
  'settings.rateLimitSaved': 'レート制限モードを保存しました。',
  'settings.storage': 'ストレージ',
  'settings.storageSqlite': '変更は自動で保存され、再起動後も残ります。',
  'settings.storageMemory':
    '一時的なセッションです。再起動すると変更は破棄されます。',
  'settings.fixtures': 'Fixture とリセット',
  'settings.fixturesDescription':
    'ユーザー、カレンダー、イベント、OAuth クライアントを含む JSON を読み込みます。読み込むと現在の状態が置き換わります。リセットすると起動時の Fixture に戻ります。',
  'settings.fixtureJson': 'Fixture JSON',
  'settings.fixtureJsonError': '有効な JSON を入力してください。',
  'settings.fixtureLoadError':
    'Fixture を読み込めませんでした。Fixture の内容を確認してください。',
  'settings.openFile': 'JSON ファイルを開く…',
  'settings.loadFixture': 'Fixture を読み込む',
  'settings.loadTitle': 'この Fixture を読み込みますか？',
  'settings.loadDescription':
    '現在のユーザー、カレンダー、イベント、OAuth クライアントを Fixture の内容で置き換え、接続、リクエスト履歴、watch チャネルを消去します。',
  'settings.fixtureLoaded': 'Fixture を読み込みました。',
  'settings.reset': 'ワークスペースをリセット',
  'settings.resetDescription':
    '起動時の Fixture に戻し、接続、リクエスト履歴、watch チャネルを消去します。',
  'settings.resetTitle': 'ワークスペースをリセットしますか？',
  'settings.resetConfirmDescription':
    '起動時の Fixture が復元され、接続、リクエスト履歴、watch チャネルが消去されます。',
  'settings.resetDone': '起動時の状態に戻しました。',
  'settings.currentState': '現在の状態',
  'settings.stateNote': (revision: string) =>
    `認証情報は除外 · リビジョン ${revision}`,

  'clients.title': '登録済みの OAuth クライアント',
  'clients.description':
    'シークレットとリダイレクト URI を編集します。ユーザー、イベント、接続はそのまま残ります。',
  'clients.new': '新しいクライアント',
  'clients.newForm': '新しい OAuth クライアント',
  'clients.redirectUris': 'リダイレクト URI',
  'clients.edit': (id: string) => `${id} を編集`,
  'clients.delete': (id: string) => `${id} を削除`,
  'clients.deleteTitle': 'この OAuth クライアントを削除しますか？',
  'clients.deleteDescription':
    'クライアントを削除し、その接続を取り消します。リセットすると起動時の Fixture に戻ります。',
  'clients.deleteConfirm': 'クライアントを削除',
  'clients.empty': 'OAuth クライアントはありません',
  'clients.emptyDescription':
    'クライアントを追加すると、アプリが OAuth の同意フローを使えるようになります。',
  'clients.id': 'クライアント ID',
  'clients.secret': 'クライアントシークレット',
  'clients.keepSecret': '空欄のままにすると現在のシークレットを維持します',
  'clients.redirectUrisField': 'リダイレクト URI（1行に1つ）',
  'clients.save': 'クライアントを保存',
  'clients.saved': 'OAuth クライアントを保存しました。',
  'clients.deleted': 'OAuth クライアントを削除しました。',
  'clients.errorId': '1～128文字の英数字、または @ . _ - を使ってください。',
  'clients.errorSecret': 'クライアントシークレットを入力してください。',
  'clients.errorRedirectMissing':
    'リダイレクト URI を1つ以上入力してください。',
  'clients.errorRedirectInvalid':
    'フラグメントや認証情報を含まない、http または https の絶対 URL を使ってください。',
} satisfies Messages;

/** Interface text for each supported locale. */
export const messages: Record<Locale, Messages> = { en, ja };
