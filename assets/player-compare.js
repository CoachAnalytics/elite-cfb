
const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
let PLAYS = null;
const BAR = filterBar(() => draw());

const pct = v => v === null ? '—' : (v * 100).toFixed(1) + '%';
const dec = (v, d) => v === null ? '—' : Number(v).toFixed(d);
const per = (a, b) => b ? a / b : null;
const num = v => v === null ? '—' : Number(v).toLocaleString();

// For each role: the measures, how to read them, and which way is better.
// "rate" measures lead, because a comparison of totals between a starter and a
// rotation player is a comparison of playing time.
const ROLES = {
  passing: {
    title: 'Passing', unit: 'drop-back',
    rates: [['EPA per drop-back', a => per(a.epa, a.n), v => dec(v, 3), 1],
            ['Success rate', a => per(a.success, a.n), pct, 1],
            ['Completion %', a => per(a.cmp, a.att), pct, 1],
            ['Yards per attempt', a => per(a.yards, a.att), v => dec(v, 2), 1],
            ['Explosive rate', a => per(a.explosive, a.n), pct, 1],
            ['Sack rate', a => per(a.sacks, a.n), pct, -1],
            ['Interception rate', a => per(a.ints, a.att), pct, -1]],
    totals: [['Drop-backs', a => a.n, num], ['Attempts', a => a.att, num],
             ['Completions', a => a.cmp, num], ['Yards', a => a.yards, num],
             ['Touchdowns', a => a.td, num], ['Interceptions', a => a.ints, num],
             ['Sacks taken', a => a.sacks, num]],
  },
  rushing: {
    title: 'Rushing', unit: 'carry',
    rates: [['EPA per carry', a => per(a.epa, a.n), v => dec(v, 3), 1],
            ['Success rate', a => per(a.success, a.n), pct, 1],
            ['Yards per carry', a => per(a.yards, a.n), v => dec(v, 2), 1],
            ['Explosive rate', a => per(a.explosive, a.n), pct, 1],
            ['Stuffed rate', a => per(a.stuffed, a.n), pct, -1]],
    totals: [['Carries', a => a.n, num], ['Yards', a => a.yards, num],
             ['Touchdowns', a => a.td, num]],
  },
  receiving: {
    title: 'Receiving', unit: 'target',
    rates: [['EPA per target', a => per(a.epa, a.n), v => dec(v, 3), 1],
            ['Success rate', a => per(a.success, a.n), pct, 1],
            ['Catch rate', a => per(a.cmp, a.n), pct, 1],
            ['Yards per target', a => per(a.yards, a.n), v => dec(v, 2), 1],
            ['Explosive rate', a => per(a.explosive, a.n), pct, 1]],
    totals: [['Targets', a => a.n, num], ['Catches', a => a.cmp, num],
             ['Yards', a => a.yards, num], ['Touchdowns', a => a.td, num]],
  },
};

// What survives a change of position. A quarterback and a running back cannot
// be compared on completion percentage, but both add points per play and both
// either move the chains or do not.
const COMMON = [['EPA per play', a => per(a.epa, a.n), v => dec(v, 3), 1],
                ['Success rate', a => per(a.success, a.n), pct, 1],
                ['Explosive rate', a => per(a.explosive, a.n), pct, 1],
                ['Touchdowns', a => a.td, num, 1],
                ['Plays involved in', a => a.n, num, 0]];

const blank = () => ({ n: 0, yards: 0, epa: 0, success: 0, explosive: 0, stuffed: 0,
                       td: 0, cmp: 0, att: 0, ints: 0, sacks: 0 });

function keep(r, where) {
  const [, , , , down, dist, ytg, , , flags] = r;
  if ($('snaps').value === 'competitive' && (flags & 4)) return false;
  if ($('snaps').value === 'garbage' && !(flags & 4)) return false;
  if (where.down && !where.down.includes(down)) return false;
  if (where.dist && (dist < where.dist[0] || dist > where.dist[1])) return false;
  if (where.zone && (ytg < where.zone[0] || ytg > where.zone[1])) return false;
  const quarter = r[15], margin = r[16];
  if (where.quarters && !where.quarters.includes(quarter)) return false;
  if (where.half === 2 && (quarter < 3 || quarter === 0)) return false;
  if (where.state === 'close' && Math.abs(margin) > 8) return false;
  return true;
}

function add(a, r, role) {
  const [, , , , , , , kind, yards, flags, epa, , , , result] = r;
  a.n += 1; a.yards += yards; a.epa += epa / 100;
  if (flags & 1) a.success += 1;
  if (flags & 2) a.explosive += 1;
  if (kind === 0 && yards <= 0) a.stuffed += 1;
  if (flags & 32) a.td += 1;
  if (result === 1) a.cmp += 1;
  if (result === 3) a.ints += 1;
  if (result === 4) a.sacks += 1;
  if (result && result !== 4) a.att += 1;
}

/** Both players and every situation, in one pass over the plays. */
function gather(idxA, idxB, ok) {
  const empty = () => ({ passing: SPLITS.map(blank), rushing: SPLITS.map(blank),
                         receiving: SPLITS.map(blank), any: SPLITS.map(blank) });
  const out = { [idxA]: empty(), [idxB]: empty() };
  for (const r of PLAYS.rows) {
    if (r[7] === 2) continue;                        // a penalty is nobody's play
    if (!ok.has(PLAYS.games[r[0]] + '-' + PLAYS.teams[r[1]])) continue;
    for (const who of [idxA, idxB]) {
      const roles = [];
      if (r[11] === who) roles.push('passing');
      if (r[12] === who) roles.push('rushing');
      if (r[13] === who) roles.push('receiving');
      if (!roles.length) continue;
      SPLITS.forEach((split, i) => {
        if (!keep(r, split[1])) return;
        for (const role of roles) add(out[who][role][i], r, role);
        add(out[who].any[i], r, 'any');
      });
    }
  }
  return out;
}

const primary = agg => ['passing', 'rushing', 'receiving']
  .reduce((best, role) => agg[role][0].n > agg[best][0].n ? role : best, 'passing');

/** One row: the measure, both values, and who is ahead. */
function row(label, read, show, better, a, b) {
  const va = read(a), vb = read(b);
  let lead = '';
  if (better && va !== null && vb !== null && va !== vb) lead = (va > vb) === (better > 0) ? 'a' : 'b';
  const gap = (va !== null && vb !== null) ? Math.abs(va - vb) : null;
  return `<tr class="${lead ? 'has-lead' : ''}">
    <td class="va ${lead === 'a' ? 'lead' : ''}">${show(va)}</td>
    <th>${label}</th>
    <td class="vb ${lead === 'b' ? 'lead' : ''}">${show(vb)}</td></tr>`;
}

function card(title, spec, a, b) {
  const body = spec.map(([label, read, show, better]) => row(label, read, show, better, a, b)).join('');
  return `<section class="cmp"><h2>${title}</h2>
    <table class="versus"><tbody>${body}</tbody></table></section>`;
}

/** The same measure in every situation, for both. */
function situations(role, A, B) {
  const spec = ROLES[role] || null;
  const read = spec ? (a => per(a.epa, a.n)) : (a => per(a.epa, a.n));
  const rows = SPLITS.map((split, i) => {
    const a = (spec ? A[role] : A.any)[i], b = (spec ? B[role] : B.any)[i];
    if (!a.n && !b.n) return '';
    const va = read(a), vb = read(b);
    const lead = (va !== null && vb !== null && va !== vb) ? (va > vb ? 'a' : 'b') : '';
    return `<tr>
      <td class="va ${lead === 'a' ? 'lead' : ''}">${dec(va, 3)}<em>(${a.n})</em></td>
      <th>${split[0]}</th>
      <td class="vb ${lead === 'b' ? 'lead' : ''}">${dec(vb, 3)}<em>(${b.n})</em></td></tr>`;
  }).join('');
  return `<section class="cmp"><h2>Points added per play, by situation</h2>
    <table class="versus situ"><tbody>${rows}</tbody></table>
    <p class="note">Small grey numbers are how many plays each figure rests on. Three carries on
      third and short is not evidence of anything.</p></section>`;
}

function who(idx) {
  const p = PLAYS.players[idx];
  return p ? { name: p[0], position: p[1] || '' } : null;
}

function draw() {
  const idxA = Number($('playerA').value), idxB = Number($('playerB').value);
  const head = $('head'), blocks = $('blocks');
  if (!(idxA >= 0) || !(idxB >= 0)) {
    head.innerHTML = ''; blocks.innerHTML = '<p class="sub">Pick a player on each side.</p>';
    return;
  }
  if (idxA === idxB) {
    blocks.innerHTML = '<p class="sub">Those are the same player.</p>'; return;
  }
  const { ok } = BAR.filter(null);
  const agg = gather(idxA, idxB, ok);
  const A = agg[idxA], B = agg[idxB];
  const pa = who(idxA), pb = who(idxB);

  head.innerHTML = `<div class="versus-head">
    <div class="side"><div class="nm">${pa.name}</div><div class="sub">${pa.position}</div></div>
    <div class="vs">v</div>
    <div class="side right"><div class="nm">${pb.name}</div><div class="sub">${pb.position}</div></div>
  </div>`;

  const roleA = primary(A), roleB = primary(B);
  const parts = [];
  if (roleA === roleB && A[roleA][0].n && B[roleB][0].n) {
    const spec = ROLES[roleA];
    parts.push(card(`${spec.title}: per ${spec.unit}`, spec.rates, A[roleA][0], B[roleB][0]));
    parts.push(card(`${spec.title}: totals`,
                    spec.totals.map(([l, r, s]) => [l, r, s, 0]), A[roleA][0], B[roleB][0]));
    parts.push(situations(roleA, A, B));
  } else {
    parts.push(`<p class="sub mismatch">${pa.name} is mostly a ${ROLES[roleA].unit} player and
      ${pb.name} is mostly a ${ROLES[roleB].unit} player, so the position-specific numbers do not
      line up. These are the measures that survive the difference.</p>`);
    parts.push(card('Common ground', COMMON, A.any[0], B.any[0]));
    parts.push(situations(null, A, B));
  }
  blocks.innerHTML = parts.join('');
  $('count').textContent = `${ok.size} team-games in filter`;
}

/** Team pickers fill player pickers; both sides work the same way. */
function fillPlayers(side) {
  const teamId = Number($('team' + side).value);
  const counts = new Map();
  for (const r of PLAYS.rows) {
    if (PLAYS.teams[r[1]] !== teamId || r[7] === 2) continue;
    for (const idx of [r[11], r[12], r[13]]) {
      if (idx >= 0) counts.set(idx, (counts.get(idx) || 0) + 1);
    }
  }
  const order = [...counts.entries()].sort((x, y) => y[1] - x[1]);
  const sel = $('player' + side);
  sel.innerHTML = '<option value="-1">Choose a player…</option>' + order.map(([idx, n]) => {
    const p = PLAYS.players[idx] || ['?', ''];
    return `<option value="${idx}">${p[0]}${p[1] ? ' (' + p[1] + ')' : ''} · ${n}</option>`;
  }).join('');
}

async function load() {
  const season = $('season').value;
  const [plays, games] = await Promise.all([
    memberData(`situational/${season}.json`),
    fetch(`../data/stats/games/${season}.json`).then(r => r.json())]);
  PLAYS = plays;
  BAR.use(games);
  for (const side of ['A', 'B']) {
    const sel = $('team' + side);
    sel.innerHTML = Object.entries(BAR.games.teams)
      .map(([id, t]) => [id, t[0]]).sort((x, y) => x[1].localeCompare(y[1]))
      .map(([id, name]) => `<option value="${id}">${name}</option>`).join('');
    const wanted = q.get('team' + side.toLowerCase());
    if (wanted) sel.value = wanted;
    sel.onchange = () => { fillPlayers(side); draw(); };
    fillPlayers(side);
    const pick = q.get(side.toLowerCase());
    if (pick) $('player' + side).value = pick;
    $('player' + side).onchange = draw;
  }
  draw();
}

$('season').onchange = load;
$('swap').onclick = () => {
  const a = [$('teamA').value, $('playerA').value];
  $('teamA').value = $('teamB').value; fillPlayers('A'); $('playerA').value = $('playerB').value;
  $('teamB').value = a[0]; fillPlayers('B'); $('playerB').value = a[1];
  draw();
};
load();
