
const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
let DATA = null;

const fmtv = {
  int: v => v === null ? '—' : Math.round(v).toLocaleString(),
  dec1: v => v === null ? '—' : Number(v).toFixed(1),
  dec2: v => v === null ? '—' : Number(v).toFixed(2),
  pct: v => v === null ? '—' : (Number(v) * 100).toFixed(1) + '%',
  pct1: v => v === null ? '—' : (Number(v) * 100).toFixed(1) + '%',
  dec3: v => v === null ? '—' : (Number(v) > 0 ? '+' : '') + Number(v).toFixed(3),
};

/** The people, under the team totals: who throws it, carries it, catches it
 *  and makes the tackles. Season totals, so they agree with the rows above. */
function playerBlock(spec, rows) {
  if (!rows || !rows.length) return '';
  const head = '<tr><th class="name">Player</th><th class="pos">Pos</th>'
    + spec.columns.map(c => `<th>${c.label}</th>`).join('') + '</tr>';
  const body = rows.map(r => `<tr><th class="name">${r.n}</th><td class="pos">${r.p || ''}</td>`
    + spec.columns.map((c, i) => `<td>${(fmtv[c.format] || fmtv.int)(r.s[i])}</td>`).join('')
    + '</tr>').join('');
  return `<section class="pblock"><h3 class="minor">${spec.title}</h3>
    <div class="table-wrap"><table class="report players">
      <thead>${head}</thead><tbody>${body}</tbody></table></div></section>`;
}

function drawPlayers(team) {
  const have = team.players || {};
  const html = PLAYER_BLOCKS.map(spec => playerBlock(spec, have[spec.key])).join('');
  $('players').innerHTML = html
    || '<p class="sub">No player stats recorded for this team yet.</p>';
}

function band(rank, of) {
  const share = rank / of;
  if (share <= 0.15) return 'best';
  if (share <= 0.37) return 'good';
  if (share <= 0.63) return 'mid';
  return 'poor';
}

function row(m, side) {
  const cell = DATA.teams[$('team').value][side][m.key];
  const [value, rank] = cell || [null, null];
  const width = rank ? Math.max(4, 100 - ((rank - 1) / (DATA.of - 1)) * 96) : 0;
  return `<tr>
    <th class="name">${m.label}</th>
    <td class="val">${fmtv[m.format](value)}</td>
    <td class="barcell"><span class="bar ${rank ? band(rank, DATA.of) : ''}" style="width:${width}%"></span></td>
    <td class="rankbox ${rank ? band(rank, DATA.of) : ''}">${rank || '—'}</td></tr>`;
}

function column(side, metrics, title) {
  let html = `<h2>${title}</h2><div class="rank-note">Rank of ${DATA.of} Power 4 teams · 1 = best</div>`;
  let group = null;
  html += '<table class="profile">';
  for (const m of metrics) {
    if (m.group !== group) { group = m.group; html += `<tr class="grouphead"><th colspan="4">${group}</th></tr>`; }
    html += row(m, side);
  }
  return html + '</table>';
}

function draw() {
  const id = $('team').value;
  const t = DATA.teams[id];
  if (!t) return;
  remembered.set('team', id);
  history.replaceState(null, '', `?id=${id}&season=${DATA.season}`);
  const ranked = Object.entries({ ...t.offense_ranks, ...t.defense_ranks });
  $('head').innerHTML = `
    <div class="profile-head">
      <div class="who">${logo(t.logo, 60)}
        <div><div class="eyebrow">CoachAnalytics · ${DATA.season} season · through ${DATA.through}</div>
        <h1>${t.school}</h1></div></div>
      <div class="facts">
        <div><b>${t.record}</b><span>Record</span></div>
        <div><b>${t.rank ? '#' + t.rank : '—'}</b><span>${DATA.ranking_poll}</span></div>
        <div><b>${t.conference || '—'}</b><span>Conference</span></div>
      </div>
    </div>`;
  const best = t.best.map(([label, rank, side]) =>
    `<li><span class="rankbox best">${rank}</span><b>${label}</b><span class="side">${side}</span></li>`).join('');
  const worst = t.worst.map(([label, rank, side]) =>
    `<li><span class="rankbox poor">${rank}</span><b>${label}</b><span class="side">${side}</span></li>`).join('');
  $('extremes').innerHTML = `
    <div><h3 class="minor">Best national ranks</h3><ul class="ranklist">${best}</ul></div>
    <div><h3 class="minor">Lowest national ranks</h3><ul class="ranklist">${worst}</ul></div>`;
  $('sides').innerHTML = `<div>${column('offense', DATA.metrics.offense, 'Offense')}</div>
                          <div>${column('defense', DATA.metrics.defense, 'Defense')}</div>`;
  drawPlayers(t);
  $('small').hidden = t.games > 4;
  $('small').textContent = `Small sample: ${t.games} game${t.games === 1 ? '' : 's'} played. Early-season ranks move a lot from week to week.`;
}

async function load() {
  const season = $('season').value;
  DATA = await memberData(`advanced/${season}.json`);
  const teams = Object.entries(DATA.teams).sort((a, b) => a[1].school.localeCompare(b[1].school));
  const keep = $('team').value || remembered.get('team');
  $('team').innerHTML = teams.map(([id, t]) => `<option value="${id}">${t.school}</option>`).join('');
  if (keep && DATA.teams[keep]) $('team').value = keep;
  remembered.set('team', $('team').value);
  draw();
}
$('season').onchange = () => { remembered.set('season', $('season').value); load(); };
$('team').onchange = draw;
const startSeason = remembered.get('season');
if (startSeason && [...$('season').options].some(o => o.value === startSeason)) $('season').value = startSeason;
load();
