
// Shared by the statistics, team and position pages (assets/engine.js): the
// filter bar, and formulas that rebuild every number from game-level parts.
const fmt = {
  int: v => v === null || v === undefined ? '' : Math.round(v).toLocaleString(),
  dec1: v => v === null || v === undefined ? '' : Number(v).toFixed(1),
  dec2: v => v === null || v === undefined ? '' : Number(v).toFixed(2),
  dec3: v => v === null || v === undefined ? '' : Number(v).toFixed(3),
  pct: v => v === null || v === undefined ? '' : (Number(v) * 100).toFixed(1) + '%',
  time: v => v === null || v === undefined ? '' : Math.floor(v / 60) + ':' + String(Math.round(v % 60)).padStart(2, '0'),
  text: v => v === null || v === undefined ? '' : v,
};

// Logos are our own copies under assets/logos, written into the data as a
// path from the site root; CA_UP turns that into a path from this page.
function logo(url, size = 18) {
  if (!url) return '';
  const src = url.includes('://') ? url : (window.CA_UP || '') + url;
  return `<img class="logo" src="${src}" alt="" width="${size}" height="${size}" loading="lazy">`;
}

// Wires the filter bar (#conf, #weeks, #opp, #ap, #site, #type, #reset).
// confSummary optionally rewrites the conference button text.
function filterBar(onChange, confSummary) {
  const el = id => document.getElementById(id);
  const conf = multi('conf', confSummary || listSummary('conference', 'conferences'), onChange);
  const weeks = multi('weeks', weekSummary, onChange);
  const selects = ['opp', 'ap', 'site', 'type'];
  selects.forEach(id => el(id).onchange = onChange);
  el('reset').onclick = () => { selects.forEach(id => el(id).value = ''); conf.set(null); weeks.set(null); onChange(); };
  return {
    games: null,
    use(games) {                     // a season's data/stats/games file
      this.games = games;
      const confs = [...new Set(Object.values(games.teams).map(t => t[1]).filter(Boolean))].sort();
      // keep a partial conference choice across seasons; weeks start fresh
      conf.fill(confs.map(c => [c, c]), conf.options.length && !conf.all() ? conf.selected() : null);
      weeks.fill(games.weeks.map(w => [w.key, w.label]), null);
      const poll = games.ranking_poll || 'AP';
      el('ap').options[1].text = `vs ranked (${poll})`;
      el('ap').options[2].text = `vs unranked (${poll})`;
    },
    // The team-games that pass, as "gameId-teamId", and games per team.
    // keepTeam stays in whatever conferences are chosen (a team page).
    filter(keepTeam) {
      const opp = el('opp').value, ap = el('ap').value, site = el('site').value, type = el('type').value;
      const confs = conf.all() ? null : new Set(conf.selected());
      const wk = new Set(weeks.selected());
      const ok = new Set(), teamGames = {};
      for (const [gid, tid, w, s, confGame, oppTier, oppRank] of this.games.games) {
        const team = this.games.teams[tid] || [];
        if (confs && !confs.has(team[1]) && String(tid) !== String(keepTeam)) continue;
        if (!wk.has(w)) continue;
        // oppTier: P = Power 4 (with Notre Dame), G = Group of 6, F = FCS
        if (opp && opp !== oppTier) continue;
        if (ap === 'ranked' && oppRank === null) continue;
        if (ap === 'unranked' && oppRank !== null) continue;
        if (site && s !== site) continue;
        if (type === 'conf' && !confGame) continue;
        if (type === 'nonconf' && confGame) continue;
        ok.add(gid + '-' + tid);
        teamGames[tid] = (teamGames[tid] || 0) + 1;
      }
      return { ok, teamGames };
    },
  };
}

// Adds up game rows ([gameId, teamId, ...]) that pass the filter. The values
// start at `offset`; whoOf(row) picks the team or player they belong to.
function aggregate(rows, fields, ok, offset, whoOf) {
  const groups = {}, teamTotals = {};
  for (const row of rows) {
    const gid = row[0], tid = row[1];
    if (!ok.has(gid + '-' + tid)) continue;
    const who = whoOf(row);
    const acc = groups[who] = groups[who] || { team: tid, games: 0, gameIds: new Set(), sum: {}, max: {}, count: {}, nulls: {} };
    if (!acc.gameIds.has(gid)) { acc.gameIds.add(gid); acc.games += 1; }
    fields.forEach((f, i) => {
      const x = row[offset + i];
      if (x === null || x === undefined) { acc.nulls[f] = (acc.nulls[f] || 0) + 1; return; }
      acc.sum[f] = (acc.sum[f] || 0) + x;
      acc.count[f] = (acc.count[f] || 0) + 1;
      acc.max[f] = acc.max[f] === undefined ? x : Math.max(acc.max[f], x);
      if (f === 'adv_targets') teamTotals[tid] = (teamTotals[tid] || 0) + x;
    });
  }
  return { groups, ctx: { teamTotals } };
}

function evaluate(spec, acc, ctx) {
  const v = f => acc.sum[f] ?? null;
  if (spec.games) return acc.games;
  if (spec.record) return `${acc.sum.wins || 0}-${acc.sum.losses || 0}`;
  if (spec.sum) return v(spec.sum);
  if (spec.max) return acc.max[spec.max] ?? null;
  if (spec.ratio) {
    const num = spec.ratio[0].reduce((s, f) => s + (acc.sum[f] || 0), 0);
    const den = spec.ratio[1].reduce((s, f) => s + (acc.sum[f] || 0), 0);
    return den ? num / den : null;
  }
  if (spec.per_game) { const x = evaluate(spec.per_game, acc, ctx); return x === null || !acc.games ? null : x / acc.games; }
  if (spec.diff) return (acc.sum[spec.diff[0]] || 0) - (acc.sum[spec.diff[1]] || 0);
  if (spec.avg) return acc.count[spec.avg] ? acc.sum[spec.avg] / acc.count[spec.avg] : null;
  if (spec.countnull) return acc.nulls[spec.countnull] || 0;
  if (spec.sumof) return spec.sumof.reduce((s, f) => s + (acc.sum[f] || 0), 0) * (spec.scale || 1);
  if (spec.weighted) return spec.weighted.reduce((s, [f, w]) => s + (acc.sum[f] || 0) * w, 0);
  if (spec.frac) return acc.sum[spec.frac[1]] === undefined ? null : `${acc.sum[spec.frac[0]] || 0}/${acc.sum[spec.frac[1]]}`;
  if (spec.share) { const t = ctx.teamTotals[acc.team] || 0; return t ? (acc.sum[spec.share] || 0) / t : null; }
  return null;
}

// A qualifying minimum, checked after filtering (per game the team played
// where it is a per-game rule).
function qualifies(m, acc, teamGames) {
  if (!m) return true;
  const have = (m.fields || [m.field]).reduce((s, f) => s + (acc.sum[f] || 0), 0);
  const need = m.per_team_game ? m.value * (teamGames[acc.team] || 0) : m.value;
  return m.op === '>' ? have > need : have >= need;
}

// The team and season you picked stay with you across the Advanced tabs. A
// link that names a team still wins, so a shared address opens what it says.
const remembered = {
  get(name, fallback) {
    const fromUrl = new URLSearchParams(location.search).get(name === 'team' ? 'id' : name);
    if (fromUrl) return fromUrl;
    try { return localStorage.getItem('ca-' + name) || fallback; } catch (e) { return fallback; }
  },
  set(name, value) {
    try { localStorage.setItem('ca-' + name, value); } catch (e) {}
  },
};


// Sorts rows by key(row); blanks always last.
function sortBy(rows, key, desc) {
  return rows.sort((a, b) => {
    const x = key(a), y = key(b);
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    const d = typeof x === 'string' ? String(x).localeCompare(String(y), undefined, { numeric: true }) : x - y;
    return desc ? -d : d;
  });
}
