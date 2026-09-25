const CUBE_DOWNS = [[1, "1st down"], [2, "2nd down"], [3, "3rd down"], [4, "4th down"]];

// The cube: counts of plays by game, team, side, down and field zone. It
// carries no play, so it can ship with the site while the plays cannot.
const CUBE = {
  data: null,
  season: null,

  async load(season, up) {
    if (this.season === season && this.data) return this.data;
    const r = await fetch(`${up || '../'}data/cube/${season}.json`);
    if (!r.ok) throw new Error('Could not read the situational data.');
    this.data = await r.json();
    this.season = season;
    this.index = Object.fromEntries(this.data.measures.map((m, i) => [m, i + 6]));
    return this.data;
  },

  /** Add up the cells a filter selects, per team. `ok` is the game filter. */
  totals({ ok, side, downs, zone, snaps }) {
    const want = downs && downs.length && downs.length < 4 ? new Set(downs.map(Number)) : null;
    const out = new Map();
    for (const row of this.data.rows) {
      const [game, team, rowSide, down, rowZone, garbage] = row;
      if (rowSide !== side) continue;
      if (ok && !ok.has(game + '-' + team)) continue;
      if (want && !want.has(down)) continue;
      if (zone && rowZone !== zone) continue;
      if (snaps === 'competitive' && garbage) continue;
      if (snaps === 'garbage' && !garbage) continue;
      let acc = out.get(team);
      if (!acc) {
        acc = {};
        for (const m of this.data.measures) acc[m] = 0;
        acc.games = new Set();
        out.set(team, acc);
      }
      for (const m of this.data.measures) acc[m] += row[this.index[m]];
      acc.games.add(game);
    }
    return out;
  },
};

// What the cube can say. Each one is a rate over the cells that passed.
const CUBE_COLUMNS = [
  ['Plays', a => a.plays, v => v.toLocaleString(), 'high'],
  ['Yards', a => a.yards, v => v.toLocaleString(), 'high'],
  ['Yards/play', a => a.plays ? a.yards / a.plays : null, v => v.toFixed(2), 'high'],
  ['Success', a => a.plays ? a.success / a.plays : null, v => (v * 100).toFixed(1) + '%', 'high'],
  ['Explosive', a => a.plays ? a.explosive / a.plays : null, v => (v * 100).toFixed(1) + '%', 'high'],
  ['First downs', a => a.plays ? a.first_downs / a.plays : null, v => (v * 100).toFixed(1) + '%', 'high'],
  ['EPA/play', a => a.plays ? a.epa / a.plays / 100 : null, v => v.toFixed(3), 'high'],
  ['Run share', a => a.plays ? a.runs / a.plays : null, v => (v * 100).toFixed(1) + '%', null],
  ['Yards/carry', a => a.runs ? a.run_yards / a.runs : null, v => v.toFixed(2), 'high'],
  ['Yards/dropback', a => a.passes ? a.pass_yards / a.passes : null, v => v.toFixed(2), 'high'],
  ['Sack rate', a => a.passes ? a.sacks / a.passes : null, v => (v * 100).toFixed(1) + '%', 'low'],
  ['Touchdowns', a => a.td, v => v.toLocaleString(), 'high'],
  ['Turnovers', a => a.turnover, v => v.toLocaleString(), 'low'],
];

/** Wires the down checklist and the field-position menu. */
function situationBar(onChange) {
  const downs = multi('downs', (sel, all) =>
    sel.length === all.length ? 'All downs' : sel.length ? sel.map(d => ORDINALS[d]).join(', ')
    : 'No downs', onChange);
  downs.fill(CUBE_DOWNS.map(([value, label]) => [String(value), label]), null);
  const zone = document.getElementById('zone');
  const snaps = document.getElementById('cube-snaps');
  if (zone) zone.onchange = onChange;
  if (snaps) snaps.onchange = onChange;
  return {
    get() {
      return {
        downs: downs.selected(),
        zone: zone ? zone.value : '',
        snaps: snaps ? snaps.value : '',
      };
    },
    // what the filter says, for a heading
    describe() {
      const bits = [];
      const picked = downs.selected();
      if (picked.length && picked.length < CUBE_DOWNS.length) {
        bits.push(picked.map(d => ORDINALS[d]).join(' and ') + ' down');
      }
      if (zone && zone.value) bits.push(zone.options[zone.selectedIndex].text.toLowerCase());
      if (snaps && snaps.value === '') bits.push('all snaps');
      if (snaps && snaps.value === 'garbage') bits.push('garbage time');
      return bits.join(', ');
    },
    all() {
      const picked = downs.selected();
      return picked.length === CUBE_DOWNS.length && (!zone || !zone.value)
        && (!snaps || snaps.value === 'competitive');
    },
  };
}

const ORDINALS = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' };
