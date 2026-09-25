
const fmt = {
  int: v => v === null ? '' : Number(v).toLocaleString(),
  dec2: v => v === null ? '' : Number(v).toFixed(2),
  dec3: v => v === null ? '' : Number(v).toFixed(3),
  pct: v => v === null ? '' : (Number(v) * 100).toFixed(1) + '%',
  text: v => v === null ? '' : v,
  rating: v => v === null || v === undefined ? '&mdash;' : '#' + v,
};
let DATA = null, sortKey = null, sortAsc = false;
const CONF = multi('conf', listSummary('conference', 'conferences'), () => draw());

async function load() {
  const season = document.getElementById('season').value;
  DATA = await (await fetch(`../data/teams/${season}.json`)).json();
  // conferences that season (teams moved between them); keep a partial choice across seasons
  const confs = [...new Set((DATA.splits.all || []).map(r => r.conference).filter(Boolean))].sort();
  CONF.fill(confs.map(c => [c, c]), CONF.options.length && !CONF.all() ? CONF.selected() : null);
  sortKey = null;
  draw();
}

function draw() {
  const split = document.getElementById('split').value;
  const confs = CONF.all() ? null : new Set(CONF.selected());
  const rows = (DATA.splits[split] || []).filter(r => !confs || confs.has(r.conference));
  const cols = DATA.columns, units = DATA.units;
  if (sortKey) {
    rows.sort((a, b) => {
      const x = a[sortKey], y = b[sortKey];
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      const d = typeof x === 'string' ? String(x).localeCompare(String(y)) : x - y;
      return sortAsc ? d : -d;
    });
  }
  const head1 = `<tr><th colspan="3"></th><th colspan="${units.length}" class="group">Ratings (rank among Power 4)</th>
                  <th colspan="${cols.length}" class="group">Results and efficiency</th><th></th></tr>`;
  const th = (key, label) => `<th data-k="${key}" class="${sortKey === key ? 'sorted ' + (sortAsc ? 'asc' : '') : ''}">${label}</th>`;
  const head2 = '<tr><th class="rank">#</th>' + th('school', 'Team').replace('<th', '<th class="name"') +
    th('conference', 'Conf').replace('<th', '<th class="name"') +
    units.map(u => th('r_' + u[0], u[1])).join('') + cols.map(c => th(c[0], c[1])).join('') + '<th></th></tr>';
  const body = rows.map((r, i) => `<tr><td class="rank">${i + 1}</td>
      <td class="name">${logo(r.logo, 20)}<a href="team.html?id=${r.team_id}&season=${DATA.season}">${r.school}</a></td>
      <td class="name">${r.conference || ''}</td>
      ${units.map(u => `<td class="rating-cell" title="average stat rank ${r['a_' + u[0]] ?? ''}">${fmt.rating(r['r_' + u[0]])}</td>`).join('')}
      ${cols.map(c => `<td>${fmt[c[2]](r[c[0]])}</td>`).join('')}
      <td><a href="team.html?id=${r.team_id}&season=${DATA.season}">Team page</a></td></tr>`).join('');
  const table = document.getElementById('grid');
  table.innerHTML = `<thead>${head1}${head2}</thead><tbody>${body}</tbody>`;
  table.querySelectorAll('th[data-k]').forEach(el => el.onclick = () => {
    const k = el.dataset.k;
    // ratings are ranks: the first click puts #1 on top
    if (sortKey === k) sortAsc = !sortAsc; else { sortKey = k; sortAsc = k.startsWith('r_'); }
    draw();
  });
  document.getElementById('count').textContent = `${rows.length} teams`;
}
document.getElementById('season').onchange = load;
document.getElementById('split').onchange = draw;
load();
