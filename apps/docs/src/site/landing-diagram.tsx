import en from '../components/landing/diagram.en.json';
import ja from '../components/landing/diagram.ja.json';
import './landing-diagram.css';

/** Illustrates local API requests and returning watch notifications. */
export function LandingDiagram({ japanese }: { japanese: boolean }) {
  const copy = japanese ? ja : en;
  const flows = copy.flows.map((label, index) => ({
    label,
    direction: index === copy.flows.length - 1 ? 'in' : 'out',
  }));
  return (
    <figure className='diagram'>
      <div className='stage'>
        <div className='node app'>
          <p className='node-label'>{copy.yourApp.label}</p>
          <p className='node-sub'>{copy.yourApp.sub}</p>
          <svg
            className='glyph'
            viewBox='0 0 160 132'
            aria-hidden='true'
            focusable='false'
          >
            <rect
              className='g-panel'
              x='0.5'
              y='0.5'
              width='159'
              height='131'
              rx='6'
            />
            <path className='g-rule' d='M0.5 20.5h159' />
            <circle className='g-faint' cx='10' cy='10.5' r='2.5' />
            <rect
              className='g-ink'
              x='17'
              y='8.5'
              width='34'
              height='4'
              rx='2'
            />
            <rect
              className='g-faint'
              x='56'
              y='8.5'
              width='22'
              height='4'
              rx='2'
            />
            <path className='g-check' d='M8 32.5l2.5 2.5 5-5' />
            <rect
              className='g-ink'
              x='22'
              y='30.5'
              width='54'
              height='4'
              rx='2'
            />
            <rect
              className='g-faint'
              x='81'
              y='30.5'
              width='30'
              height='4'
              rx='2'
            />
            <path className='g-check' d='M8 46.5l2.5 2.5 5-5' />
            <rect
              className='g-ink'
              x='22'
              y='44.5'
              width='40'
              height='4'
              rx='2'
            />
            <rect
              className='g-faint'
              x='67'
              y='44.5'
              width='44'
              height='4'
              rx='2'
            />
            <path className='g-check' d='M8 60.5l2.5 2.5 5-5' />
            <rect
              className='g-ink'
              x='22'
              y='58.5'
              width='62'
              height='4'
              rx='2'
            />
            <rect
              className='g-faint'
              x='89'
              y='58.5'
              width='18'
              height='4'
              rx='2'
            />
            <path className='g-check' d='M8 74.5l2.5 2.5 5-5' />
            <rect
              className='g-ink'
              x='22'
              y='72.5'
              width='48'
              height='4'
              rx='2'
            />
            <rect
              className='g-faint'
              x='75'
              y='72.5'
              width='34'
              height='4'
              rx='2'
            />
            <path className='g-check' d='M8 88.5l2.5 2.5 5-5' />
            <rect
              className='g-ink'
              x='22'
              y='86.5'
              width='30'
              height='4'
              rx='2'
            />
            <rect
              className='g-faint'
              x='57'
              y='86.5'
              width='52'
              height='4'
              rx='2'
            />
            <path className='g-check' d='M8 102.5l2.5 2.5 5-5' />
            <rect
              className='g-ink'
              x='22'
              y='100.5'
              width='44'
              height='4'
              rx='2'
            />
            <rect
              className='g-faint'
              x='71'
              y='100.5'
              width='26'
              height='4'
              rx='2'
            />
            <path className='g-rule' d='M0.5 114.5h159' />
            <rect
              className='g-ink'
              x='8'
              y='120.5'
              width='26'
              height='4'
              rx='2'
            />
            <rect
              className='g-faint'
              x='39'
              y='120.5'
              width='40'
              height='4'
              rx='2'
            />
          </svg>
        </div>

        <div className='google-lane'>
          <div className='bypass' aria-hidden='true'>
            <svg className='bypass-mark' viewBox='0 0 18 18' focusable='false'>
              <circle cx='9' cy='9' r='9' />
              <path d='M6 6l6 6M12 6l-6 6' />
            </svg>
          </div>
          <div className='google'>
            <p className='google-label'>{copy.google.label}</p>
            <p className='google-sub'>{copy.google.sub}</p>
          </div>
        </div>

        <ul className='flows'>
          {flows.map((flow, index) => (
            <li
              key={flow.label}
              className='flow'
              data-direction={flow.direction}
              style={{ '--flow': index }}
            >
              <span className='flow-packet' aria-hidden='true' />
              <span className='flow-label'>{flow.label}</span>
            </li>
          ))}
        </ul>

        <div className='node pit'>
          <div className='pit-head'>
            <svg
              className='mark'
              viewBox='4 4 56 56'
              aria-hidden='true'
              focusable='false'
            >
              <rect className='mark-cell' x='4' y='4' width='16' height='16' />
              <rect className='mark-cell' x='24' y='4' width='16' height='16' />
              <rect className='mark-cell' x='44' y='4' width='16' height='16' />
              <rect className='mark-cell' x='4' y='24' width='16' height='16' />
              <rect
                className='mark-cell'
                x='44'
                y='24'
                width='16'
                height='16'
              />
              <rect className='mark-cell' x='4' y='44' width='16' height='16' />
              <rect
                className='mark-cell'
                x='24'
                y='44'
                width='16'
                height='16'
              />
              <rect
                className='mark-cell mark-signal'
                x='44'
                y='44'
                width='16'
                height='16'
              />
            </svg>
            <div>
              <p className='node-label'>{copy.calendarpit.label}</p>
              <p className='node-sub'>{copy.calendarpit.sub}</p>
            </div>
          </div>
          <svg
            className='glyph screen'
            viewBox='0 0 240 128'
            aria-hidden='true'
            focusable='false'
          >
            <rect
              className='g-canvas'
              x='0.5'
              y='0.5'
              width='239'
              height='127'
              rx='6'
            />
            <path
              className='g-rail'
              d='M6.5 0.5H58.5V127.5H6.5a6 6 0 0 1-6-6V6.5a6 6 0 0 1 6-6z'
            />
            <path className='g-rule' d='M58.5 0.5v127' />
            <rect className='g-ink' x='7' y='8' width='8' height='8' rx='2' />
            <rect
              className='g-ink'
              x='19'
              y='10'
              width='28'
              height='4'
              rx='2'
            />
            <rect
              className='g-faint'
              x='7'
              y='25'
              width='18'
              height='2.5'
              rx='1.25'
            />
            <rect
              className='g-card'
              x='5.5'
              y='31.5'
              width='47'
              height='15'
              rx='3'
            />
            <rect
              className='g-signal'
              x='9'
              y='37'
              width='4'
              height='4'
              rx='1'
            />
            <rect
              className='g-ink'
              x='16'
              y='37.5'
              width='24'
              height='3'
              rx='1.5'
            />
            <rect
              className='g-select'
              x='5'
              y='54'
              width='48'
              height='11'
              rx='3'
            />
            <rect
              className='g-signal'
              x='9'
              y='57.5'
              width='4'
              height='4'
              rx='1'
            />
            <rect
              className='g-paper'
              x='16'
              y='58'
              width='22'
              height='3'
              rx='1.5'
            />
            <rect
              className='g-faint'
              x='9'
              y='71.5'
              width='4'
              height='4'
              rx='1'
            />
            <rect
              className='g-faint'
              x='16'
              y='72'
              width='18'
              height='3'
              rx='1.5'
            />
            <rect
              className='g-faint'
              x='9'
              y='83.5'
              width='4'
              height='4'
              rx='1'
            />
            <rect
              className='g-faint'
              x='16'
              y='84'
              width='24'
              height='3'
              rx='1.5'
            />
            <rect
              className='g-faint'
              x='9'
              y='95.5'
              width='4'
              height='4'
              rx='1'
            />
            <rect
              className='g-faint'
              x='16'
              y='96'
              width='14'
              height='3'
              rx='1.5'
            />

            <rect
              className='g-signal-ink'
              x='68'
              y='10'
              width='22'
              height='2.5'
              rx='1.25'
            />
            <rect
              className='g-ink'
              x='68'
              y='17'
              width='58'
              height='5'
              rx='2.5'
            />
            <rect
              className='g-faint'
              x='68'
              y='27'
              width='42'
              height='2.5'
              rx='1.25'
            />
            <rect
              className='g-card'
              x='66.5'
              y='38.5'
              width='166'
              height='72'
              rx='4'
            />
            <rect
              className='g-ink'
              x='73'
              y='45'
              width='48'
              height='3.5'
              rx='1.75'
            />
            <rect
              className='g-faint'
              x='73'
              y='52'
              width='28'
              height='2.5'
              rx='1.25'
            />
            <rect
              className='g-track'
              x='73.5'
              y='60.5'
              width='152'
              height='12'
              rx='2'
            />
            <path
              className='g-tick'
              d='M92.5 60.5v12M111.5 60.5v12M130.5 60.5v12M149.5 60.5v12M168.5 60.5v12M187.5 60.5v12M206.5 60.5v12'
            />
            <rect
              className='g-ink'
              x='134'
              y='63'
              width='14'
              height='7'
              rx='1.5'
            />
            <path className='g-now' d='M172.5 57v18.5' />
            <circle className='g-signal' cx='172.5' cy='57' r='2.5' />
            <path className='g-rule' d='M66.5 82.5h166' />
            <rect
              className='g-ink'
              x='73'
              y='90'
              width='14'
              height='3'
              rx='1.5'
            />
            <rect
              className='g-faint'
              x='73'
              y='97'
              width='14'
              height='2.5'
              rx='1.25'
            />
            <rect
              className='g-ink'
              x='94'
              y='88'
              width='1.5'
              height='14'
              rx='0.75'
            />
            <rect
              className='g-ink'
              x='100'
              y='89.5'
              width='54'
              height='3.5'
              rx='1.75'
            />
            <rect
              className='g-faint'
              x='100'
              y='97'
              width='30'
              height='2.5'
              rx='1.25'
            />
            <rect
              className='g-chip'
              x='204'
              y='91'
              width='22'
              height='8'
              rx='4'
            />
            <rect
              className='g-faint'
              x='68'
              y='117'
              width='96'
              height='2.5'
              rx='1.25'
            />
          </svg>
        </div>
      </div>
    </figure>
  );
}
