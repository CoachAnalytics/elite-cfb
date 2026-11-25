
const $ = id => document.getElementById(id);
let DATA = null, sortBy = 'rank', flip = false;

const dec = (v, d) => v === null || v === undefined ? '—' : Number(v).toFixed(d);
const signed = (v, d) => v === null || v === undefined ? '—'
  : (v > 0 ? '+' : '') + Number(v).toFixed(d);
const pct = v => v === null || v === undefined ? '—' : (v * 100).toFixed(1) + '%';

const COLUMNS = [
  ['rank', '#', t => t.rank, v => v, 'num'],
  ['school', 'Team', t => t.school, v => v, 'name'],
  ['record', 'Rec', t => t.record, v => v, 'num'],
  ['overall', 'Strength', t => t.overall, v => signed(v, 1), 'num key'],
  ['offense', 'Off', t => t.offense, v => signed(v, 1), 'num'],
  ['defense', 'Def', t => t.defense, v => signed(v, 1), 'num'],
  ['sos_rank', 'SOS', t => t.sos_rank, v => v || '—', 'num'],
  ['sor_rank', 'SOR', t => t.sor_rank, v => v || '—', 'num'],
  ['record_chance', 'Record odds', t => t.record_chance, pct, 'num'],
  ['vs_good', 'vs top 25', t => t.vs_good, v => signed(v, 1), 'num'],
  ['vs_poor', 'vs the rest', t => t.vs_poor, v => signed(v, 1), 'num'],
];

// Lower is better for these, so a sort on them runs the other way.
const ASCENDING = new Set(['rank', 'sos_rank', 'sor_rank', 'record_chance', 'school', 'record']);

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
    const v = c[3](c[2](t), t);
    if (c[0] === 'school') {
      return `<td class="name">${t.logo ? `<img src="../${t.logo}" alt="" loading="lazy">` : ''}` +
             `<a href="../teams/team.html?team=${t.team_id}&amp;season=${DATA.season}">${t.school}</a></td>`;
    }
    const tone = (c[0] === 'vs_good' || c[0] === 'vs_poor') && c[2](t) !== null
      ? (c[2](t) >= 0 ? ' good' : ' bad') : '';
    return `<td class="${c[4]}${tone}">${v}</td>`;
  }).join('') + '</tr>').join('');
  $('head').querySelectorAll('th').forEach(th => th.onclick = () => {
    const key = th.dataset.key;
    if (key === sortBy) flip = !flip; else { sortBy = key; flip = false; }
    draw();
  });
}

async function load() {
  const season = $('season').value;
  DATA = await fetch(`../data/strength/${season}.json`).then(r => r.json());
  $('asof').textContent = `through week ${DATA.week}`;
  draw();
}
$('season').onchange = load;
load();
