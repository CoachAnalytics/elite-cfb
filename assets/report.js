
const q = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
let DATA = null, sortIndex = null, sortAsc = false;
let group = q.get('pos') || 'ALL';
const BAR = filterBar(() => draw());

async function load() {
  const season = $('season').value;
  let games;
  [DATA, games] = await Promise.all([
    fetch(`../data/positions/${q.get('r')}/${season}.json`).then(r => r.json()),
    fetch(`../data/stats/games/${season}.json`).then(r => r.json())]);
  $('title').textContent = DATA.title;
  document.title = `${DATA.title} | CoachAnalytics`;
  $('key').innerHTML = '<summary>Key</summary><dl>' +
    DATA.glossary.map(k => `<dt>${k[0]}</dt><dd>${k[1]}</dd>`).join('') + '</dl>';
  $('desc').textContent = DATA.description;
  const buttons = [...DATA.groups, 'ALL'];
  if (!buttons.includes(group)) group = buttons[0];
  $('groups').innerHTML = buttons.map(g => `<button data-g="${g}">${g}</button>`).join('');
  $('groups').querySelectorAll('button').forEach(b => b.onclick = () => { group = b.dataset.g; draw(); });
  BAR.use(games);
  sortIndex = null;
  draw();
}

function draw() {
  const GAMES = BAR.games;
  $('groups').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.g === group));
  const { ok, teamGames } = BAR.filter();
  const { groups, ctx } = aggregate(DATA.rows, DATA.fields, ok, 3, row => row[2]);
  let rows = Object.entries(groups)
    .filter(([pid]) => group === 'ALL' || (DATA.players[pid] || [])[2] === group)
    .map(([pid, acc]) => ({ pid, acc, values: DATA.columns.map(c => evaluate(c.spec, acc, ctx)),
                            sort: evaluate(DATA.sort.spec, acc, ctx) }))
    .filter(r => qualifies(DATA.minimum, r.acc, teamGames));
  if (sortIndex === null) sortBy(rows, r => r.sort, DATA.sort.desc);
  else sortBy(rows, r => r.values[sortIndex], !sortAsc);
  rows = rows.slice(0, 400);
  const cols = DATA.columns;
  const head = '<tr><th class="rank">#</th><th class="name">Player</th><th class="name">Pos</th>' +
    '<th class="name">Team</th><th>Rating</th>' +
    cols.map((c, i) => `<th data-i="${i}" title="${c.help}" class="${sortIndex === i ? 'sorted ' + (sortAsc ? 'asc' : '') : ''}">${c.label}</th>`).join('') + '</tr>';
  const body = rows.map((r, i) => {
    const p = DATA.players[r.pid] || ['?', ''];
    const team = GAMES.teams[r.acc.team] || [''];
    return `<tr><td class="rank">${i + 1}</td>
      <td class="name"><a href="../players/player.html?id=${r.pid}">${p[0]}</a></td>
      <td class="name">${p[1] || ''}</td>
      <td class="name">${logo(team[2])}<a href="../teams/team.html?id=${r.acc.team}&season=${DATA.season}">${team[0]}</a></td>
      <td class="rating-cell">&mdash;</td>
      ${r.values.map((v, j) => `<td>${fmt[cols[j].format](v)}</td>`).join('')}</tr>`;
  }).join('');
  const table = $('board');
  table.innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
  table.querySelectorAll('th[data-i]').forEach(th => th.onclick = () => {
    const i = Number(th.dataset.i);
    if (sortIndex === i) sortAsc = !sortAsc; else { sortIndex = i; sortAsc = false; }
    draw();
  });
  $('count').textContent = `${rows.length} players · minimum: ${DATA.minimum_text} · ${ok.size} team-games in filter`;
}
$('season').onchange = load;
load();
