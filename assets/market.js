
const $ = id => document.getElementById(id);
let DATA = null, sortBy = 'kickoff', flip = false;

const dec = (v, d) => v === null || v === undefined ? '—' : Number(v).toFixed(d);
const signed = (v, d) => v === null || v === undefined ? '—'
  : (v > 0 ? '+' : '') + Number(v).toFixed(d);
const pct = v => v === null || v === undefined ? '—' : (v * 100).toFixed(0) + '%';

/** A line as people say it: the favorite and the number. */
function asLine(margin, home, away) {
  if (margin === null || margin === undefined) return '—';
  if (Math.abs(margin) < 0.05) return 'pick’em';
  return margin > 0 ? `${home} -${Math.abs(margin).toFixed(1)}`
                    : `${away} -${Math.abs(margin).toFixed(1)}`;
}

// (key, heading, the value sorted on, how the cell is drawn, class)
// The two gap columns sort on size rather than sign, because "show me the
// biggest disagreements" is the question people actually have, and a signed
// sort answers it only for whichever side happens to be positive.
const COLUMNS = [
  ['kickoff', 'Game', g => g.kickoff || '', null, 'name'],
  ['market_margin', 'Market', g => g.market_margin,
   g => asLine(g.market_margin, g.home_abbr, g.away_abbr), 'num'],
  ['our_margin', 'Us', g => g.our_margin,
   g => asLine(g.our_margin, g.home_abbr, g.away_abbr), 'num'],
  ['margin_gap', 'Gap', g => g.margin_gap === null ? null : Math.abs(g.margin_gap), null, 'num'],
  ['market_total', 'O/U', g => g.market_total, g => dec(g.market_total, 1), 'num'],
  ['our_total', 'Our total', g => g.our_total, g => dec(g.our_total, 1), 'num'],
  ['total_gap', 'Total gap', g => g.total_gap === null ? null : Math.abs(g.total_gap),
   g => signed(g.total_gap, 1), 'num'],
  ['our_win', 'Our win %', g => g.our_win, g => pct(g.our_win), 'num'],
  ['covered', '', g => g.covered === null || g.covered === undefined ? null : (g.covered ? 1 : 0),
   null, 'graded-cell'],
];

// Only these read better smallest-first; everything else is "most interesting
// at the top", which for a gap means the widest.
const ASCENDING = new Set(['kickoff', 'market_total', 'our_total']);

function nameCell(g) {
  return `${g.away_logo ? `<img src="../${g.away_logo}" alt="" loading="lazy">` : ''}${g.away}
    <span class="at">at</span>
    ${g.home_logo ? `<img src="../${g.home_logo}" alt="" loading="lazy">` : ''}${g.home}
    ${g.result ? `<span class="res">${g.result}</span>` : ''}`;
}

function gapCell(g) {
  const gap = g.margin_gap;
  if (gap === null || gap === undefined) return '—';
  const lean = gap > 0 ? g.home : g.away;
  return `${signed(gap, 1)}<em>${lean}</em>`;
}

function gradedCell(g) {
  if (g.covered === null || g.covered === undefined) return '';
  return `<span class="graded ${g.covered ? 'hit' : 'miss'}">`
       + `${g.covered ? 'our side covered' : 'our side did not'}</span>`;
}

function cellFor(col, g) {
  if (col[0] === 'kickoff') return nameCell(g);
  if (col[0] === 'margin_gap') return gapCell(g);
  if (col[0] === 'covered') return gradedCell(g);
  return col[3](g);
}

function classFor(col, g) {
  if (col[0] !== 'margin_gap') return col[4];
  const gap = Math.abs(g.margin_gap || 0);
  return col[4] + (gap >= 6 ? ' gap wide' : gap >= 3 ? ' gap some' : ' gap');
}

function draw() {
  const week = Number($('week').value);
  const col = COLUMNS.find(c => c[0] === sortBy) || COLUMNS[0];
  const games = DATA.games.filter(g => g.week === week && g.market_margin !== null).sort((a, b) => {
    const x = col[2](a), y = col[2](b);
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    const asc = ASCENDING.has(sortBy);
    const cmp = typeof x === 'string' ? x.localeCompare(y) : (asc ? x - y : y - x);
    return flip ? -cmp : cmp;
  });
  $('board').innerHTML = games.length
    ? `<table class="report market"><thead><tr>${COLUMNS.map(c =>
        `<th class="${c[4] === 'graded-cell' ? '' : c[4]}${sortBy === c[0] ? ' sorted' : ''}"
             data-key="${c[0]}">${c[1]}</th>`).join('')}</tr></thead>
       <tbody>${games.map(g => '<tr>' + COLUMNS.map(c =>
          `<td class="${classFor(c, g)}">${cellFor(c, g)}</td>`).join('') + '</tr>').join('')}
       </tbody></table>`
    : '<p class="sub">No games with a posted line in this week yet.</p>';
  $('board').querySelectorAll('th[data-key]').forEach(th => th.onclick = () => {
    const key = th.dataset.key;
    if (key === sortBy) flip = !flip; else { sortBy = key; flip = false; }
    draw();
  });
  const played = games.filter(g => g.completed).length;
  $('counts').textContent = games.length
    ? `${games.length} game${games.length === 1 ? '' : 's'} with a line`
      + (played ? `, ${played} played` : '')
    : '';
}

/** Weeks that have lines, opening on the one being played now. */
function fillWeeks() {
  const sel = $('week');
  sel.innerHTML = DATA.weeks.map(w =>
    `<option value="${w.week}">Week ${w.week}`
    + `${w.played === 0 ? ' (to come)' : w.played < w.games ? ' (in progress)' : ''}</option>`).join('');
  const asked = new URLSearchParams(location.search).get('week');
  if (asked && [...sel.options].some(o => o.value === asked)) { sel.value = asked; return; }
  const current = DATA.weeks.find(w => w.played < w.games)
    || DATA.weeks[DATA.weeks.length - 1];
  if (current) sel.value = String(current.week);
}

function record() {
  const R = DATA.record;
  $('record').innerHTML = R.buckets.map(b => `
    <div class="rec-card">
      <div class="k">Disagreed by ${b.threshold}+</div>
      <div class="v">${b.bets ? (b.rate * 100).toFixed(1) + '%' : '—'}</div>
      <div class="s">${b.won}–${b.bets - b.won} against the spread
        &middot; break-even is 52.4%</div>
    </div>`).join('');
}

async function load() {
  const season = $('season').value;
  DATA = await memberData(`market/${season}.json`);
  $('asof').textContent = `through week ${DATA.week}`;
  fillWeeks();
  record();
  draw();
}
$('season').onchange = load;
$('week').onchange = draw;
load();
