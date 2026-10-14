
const $ = id => document.getElementById(id);
let DATA = null, sortBy = 'seconds', flip = false;

const dec = (v, d) => v === null || v === undefined ? '—' : Number(v).toFixed(d);
const pct = v => v === null || v === undefined ? '—' : (v * 100).toFixed(1) + '%';
const signed = (v, d) => v === null || v === undefined ? '—'
  : (v > 0 ? '+' : '') + Number(v).toFixed(d);

const COLUMNS = [
  ['rank', '#', t => t.rank, v => v, 'num'],
  ['school', 'Team', t => t.school, v => v, 'name'],
  ['seconds', 'Sec/snap', t => t.seconds, v => dec(v, 1), 'num key'],
  ['snaps_per_game', 'Plays run', t => t.snaps_per_game, v => dec(v, 1), 'num'],
  ['faced_per_game', 'Plays faced', t => t.faced_per_game, v => dec(v, 1), 'num'],
  ['game_plays', 'Game total', t => t.game_plays, v => dec(v, 1), 'num'],
  ['no_huddle', 'No huddle', t => t.no_huddle, pct, 'num'],
  ['hurry_share', 'Hurry %', t => t.hurry_share, pct, 'num'],
  ['hurry_epa', 'EPA hurrying', t => t.hurry && t.hurry.epa, v => signed(v, 3), 'num'],
  ['slow_epa', 'EPA deliberate', t => t.deliberate && t.deliberate.epa, v => signed(v, 3), 'num'],
  ['edge', 'Difference', t => t.edge, v => signed(v, 3), 'num'],
];
const ASCENDING = new Set(['rank', 'school', 'seconds']);

function draw() {
  const get = COLUMNS.find(c => c[0] === sortBy)[2];
  const rows = [...DATA.teams].sort((a, b) => {
    const x = get(a), y = get(b);
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    const asc = ASCENDING.has(sortBy);
    const cmp = typeof x === 'string' ? x.localeCompare(y) : (asc ? x - y : y - x);
    return flip ? -cmp : cmp;
  });
  $('head').innerHTML = '<tr>' + COLUMNS.map(c =>
    `<th class="${c[4]} ${sortBy === c[0] ? 'sorted' : ''}" data-key="${c[0]}">${c[1]}</th>`).join('') + '</tr>';
  $('body').innerHTML = rows.map(t => '<tr>' + COLUMNS.map(c => {
    if (c[0] === 'school') {
      return `<td class="name">${t.logo ? `<img src="../${t.logo}" alt="" loading="lazy">` : ''}${t.school}</td>`;
    }
    const raw = c[2](t);
    const tone = c[0] === 'edge' && raw !== null && raw !== undefined
      ? (raw > 0 ? ' good' : ' bad') : '';
    let note = '';
    if (c[0] === 'hurry_epa' && t.hurry) note = `${t.hurry.snaps} snaps`;
    if (c[0] === 'slow_epa' && t.deliberate) note = `${t.deliberate.snaps} snaps`;
    if (c[0] === 'edge' && t.hurry && t.deliberate) {
      note = `${t.hurry.snaps} hurried, ${t.deliberate.snaps} deliberate`;
    }
    const thin = (c[0] === 'edge' && t.hurry && t.deliberate
                  && Math.min(t.hurry.snaps, t.deliberate.snaps) < 25) ? ' thin' : '';
    return `<td class="${c[4]}${tone}${thin}"${note ? ` title="${note}"` : ''}>${c[3](raw, t)}</td>`;
  }).join('') + '</tr>').join('');
  $('head').querySelectorAll('th').forEach(th => th.onclick = () => {
    const key = th.dataset.key;
    if (key === sortBy) flip = !flip; else { sortBy = key; flip = false; }
    draw();
  });
  const L = DATA.league;
  $('league').innerHTML = ['hurry', 'normal', 'deliberate'].map(k => `
    <div class="tempo-card">
      <div class="k">${k === 'hurry' ? `Hurrying (${DATA.fast_at}s or less)`
                     : k === 'deliberate' ? `Deliberate (${DATA.slow_at}s or more)` : 'In between'}</div>
      <div class="v">${pct(L[k].success)}</div>
      <div class="s">success rate &middot; ${signed(L[k].epa, 3)} EPA a play &middot;
        ${L[k].snaps.toLocaleString()} snaps</div>
    </div>`).join('');
}

async function load() {
  const season = $('season').value;
  DATA = await memberData(`pace/${season}.json`);
  $('asof').textContent = `through week ${DATA.week}`;
  $('nohuddle-note').hidden = DATA.no_huddle_usable;
  draw();
}
$('season').onchange = load;
load();
