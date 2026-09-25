
let BOARD = null, sortCol = null, sortAsc = false;
let cubeSort = 6, cubeAsc = false;          // EPA per play, best first
const $ = id => document.getElementById(id);
const BAR = filterBar(() => draw());
const SITU = situationBar(() => draw());

// A down or a field position only exists in a play, so the cube can answer
// for scrimmage boards and nothing else. Special teams and the individual
// defensive boards keep their season numbers and say so.
const cubeCanAnswer = () => BOARD && BOARD.scope === 'team'
  && (window.BOARD_SECTION === 'offense' || window.BOARD_SECTION === 'defense');

/** The leaderboard for the chosen down and field position. */
async function drawSituational() {
  $('count').textContent = 'Reading the situational data…';
  try {
    await CUBE.load(BOARD.season, '../../');
  } catch (err) {
    $('situ-note').innerHTML = 'Could not read the situational data. Reload to try again.';
    return;
  }
  const { ok } = BAR.filter();
  const choice = SITU.get();
  const side = window.BOARD_SECTION === 'defense' ? 1 : 0;
  const totals = CUBE.totals({ ok, side, downs: choice.downs, zone: choice.zone, snaps: choice.snaps });
  const rows = [...totals.entries()]
    .filter(([, a]) => a.plays >= 10)
    .map(([team, a]) => ({ team, acc: a, values: CUBE_COLUMNS.map(c => c[1](a)) }));
  // best first, which is the other end of the table for a defence
  const col = CUBE_COLUMNS[cubeSort];
  let goodHigh = col[3] !== 'low';
  if (side === 1 && col[3]) goodHigh = !goodHigh;
  sortBy(rows, r => r.values[cubeSort], cubeAsc ? !goodHigh : goodHigh);

  const head = '<tr><th class="rank">#</th><th class="name">Team</th><th class="name">Conf</th>' +
    CUBE_COLUMNS.map((c, i) =>
      `<th data-i="${i}" class="${cubeSort === i ? 'sorted ' + (cubeAsc ? 'asc' : '') : ''}">${c[0]}</th>`)
      .join('') + '</tr>';
  const body = rows.map((r, i) => {
    const team = BAR.games.teams[r.team] || ['', ''];
    return `<tr><td class="rank">${i + 1}</td>
      <td class="name">${logo(team[2], 20)}<a href="../../teams/team.html?id=${r.team}&season=${BOARD.season}">${team[0]}</a></td>
      <td class="name">${team[1] || ''}</td>` +
      r.values.map((v, j) => `<td>${v === null ? '' : CUBE_COLUMNS[j][2](v)}</td>`).join('') + '</tr>';
  }).join('');
  $('board').innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
  $('board').querySelectorAll('th[data-i]').forEach(th => th.onclick = () => {
    const i = Number(th.dataset.i);
    if (cubeSort === i) cubeAsc = !cubeAsc; else { cubeSort = i; cubeAsc = false; }
    draw();
  });
  $('count').textContent = `${rows.length} teams · ${ok.size} team-games in filter`;
  $('situ-note').innerHTML = `Showing <b>${window.BOARD_SECTION === 'defense' ? 'defence' : 'offence'}</b> on `
    + `<b>${SITU.describe()}</b>, counted from the play-by-play. Clear the down and field position to go `
    + `back to the ${BOARD.title.toLowerCase()} columns.`;
}

async function loadSeason() {
  const season = $('season').value;
  let games;
  [BOARD, games] = await Promise.all([
    fetch(`${window.DATA_ROOT}/${season}.json`).then(r => r.json()),
    fetch(`${window.GAMES_ROOT}/${season}.json`).then(r => r.json())]);
  BAR.use(games);
  sortCol = null;
  draw();
}

function draw() {
  const situational = !SITU.all();
  $('situ-note').hidden = !situational;
  if (situational && cubeCanAnswer()) return drawSituational();
  if (situational) {
    $('situ-note').innerHTML = 'A down and a field position only exist in a play, and this board is built '
      + 'from season totals, so the situation below does not apply to it. It applies on the team offence '
      + 'and defence boards.';
  }
  const GAMES = BAR.games;
  const { ok, teamGames } = BAR.filter();
  const player = BOARD.scope === 'player';
  const { groups, ctx } = aggregate(BOARD.rows, BOARD.fields, ok, player ? 3 : 2, row => player ? row[2] : row[1]);
  let rows = Object.entries(groups).map(([who, acc]) => ({
    who, team: acc.team, acc,
    values: BOARD.columns.map(c => evaluate(c.spec, acc, ctx)),
    sort: evaluate(BOARD.sort.spec, acc, ctx),
  })).filter(r => qualifies(BOARD.minimum, r.acc, teamGames));
  if (sortCol === null) sortBy(rows, r => r.sort, BOARD.sort.desc);
  else sortBy(rows, r => r.values[sortCol], !sortAsc);
  if (player) rows = rows.slice(0, 300);

  const cols = BOARD.columns;
  const head = '<tr><th class="rank">#</th>' + (player
      ? '<th class="name">Player</th><th class="name">Pos</th><th class="name">Team</th>'
      : '<th class="name">Team</th><th class="name">Conf</th>') +
    cols.map((c, i) => `<th data-i="${i}" title="${c.help}" class="${sortCol === i ? 'sorted ' + (sortAsc ? 'asc' : '') : ''}">${c.label}</th>`).join('') + '</tr>';
  const body = rows.map((r, i) => {
    const team = GAMES.teams[r.team] || ['', ''];
    const teamLink = `<a href="../../teams/team.html?id=${r.team}&season=${BOARD.season}">${team[0]}</a>`;
    const who = player
      ? `<td class="name"><a href="../../players/player.html?id=${r.who}">${(BOARD.players[r.who] || ['?'])[0]}</a></td>
         <td class="name">${(BOARD.players[r.who] || [])[1] || ''}</td><td class="name">${logo(team[2])}${teamLink}</td>`
      : `<td class="name">${logo(team[2], 20)}${teamLink}</td><td class="name">${team[1] || ''}</td>`;
    return `<tr><td class="rank">${i + 1}</td>${who}${r.values.map((v, j) => `<td>${fmt[cols[j].format](v)}</td>`).join('')}</tr>`;
  }).join('');
  $('board').innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
  $('board').querySelectorAll('th[data-i]').forEach(th => th.onclick = () => {
    const i = Number(th.dataset.i);
    if (sortCol === i) sortAsc = !sortAsc; else { sortCol = i; sortAsc = false; }
    draw();
  });
  $('count').textContent = `${rows.length} ${player ? 'players' : 'teams'} · ${ok.size} team-games in filter`;
}

$('season').onchange = loadSeason;
loadSeason();
