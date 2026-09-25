
const $ = id => document.getElementById(id);
let DATA = null;

async function load() {
  const season = $('season').value;
  DATA = await (await fetch(`../data/standings/${season}.json`).then(r => r.json()));
  draw();
}

const pct = (w, l) => w + l ? (w / (w + l)).toFixed(3).replace(/^0/, '') : '.000';

function draw() {
  const league = $('league').value;
  const blocks = DATA.conferences.filter(c => !league || c.name === league).map(c => `
    <h2>${c.name}</h2>
    <div class="table-wrap"><table>
      <thead><tr><th class="name">Team</th><th>Conf</th><th>Pct</th><th>Overall</th><th>Pct</th>
        <th>PF</th><th>PA</th><th>Diff</th><th class="name">Streak</th><th class="name">Last 5</th></tr></thead>
      <tbody>${c.teams.map(t => `<tr>
        <td class="name">${t.rank ? `<span class="rk">#${t.rank}</span> ` : ''}${logo(t.logo, 20)}<a href="../teams/team.html?id=${t.team_id}&season=${DATA.season}">${t.school}</a></td>
        <td>${t.league_wins}&ndash;${t.league_losses}</td><td>${pct(t.league_wins, t.league_losses)}</td>
        <td>${t.wins}&ndash;${t.losses}</td><td>${pct(t.wins, t.losses)}</td>
        <td>${t.pf}</td><td>${t.pa}</td><td>${t.pf - t.pa > 0 ? '+' : ''}${t.pf - t.pa}</td>
        <td class="name">${t.streak}</td><td class="name">${t.last5}</td></tr>`).join('')}</tbody>
    </table></div>`).join('');
  $('boards').innerHTML = blocks;
  const teams = DATA.conferences.reduce((n, c) => n + (!league || c.name === league ? c.teams.length : 0), 0);
  $('count').textContent = `${teams} teams · ranks from the current ${DATA.ranking_poll}`;
}
$('season').onchange = load;
$('league').onchange = draw;
load();
