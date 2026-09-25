
// The metric library, and the engine that runs it over a season of plays.
// Rows are the v3 situational export; the names below are their fields.

const R_GAME = 0, R_OFF = 1, R_DEF = 2, R_DRIVE = 3, R_DOWN = 4, R_DIST = 5, R_YTG = 6,
      R_KIND = 7, R_YDS = 8, R_FLAG = 9, R_EPA = 10, R_RESULT = 14, R_QTR = 15, R_MARGIN = 16;
const F_SUCCESS = 1, F_EXPLOSIVE = 2, F_GARBAGE = 4, F_TURNOVER = 16, F_TD = 32, F_PEN_OFF = 64,
      F_PEN_DEF = 128;
const K_RUN = 0, K_DROPBACK = 1, K_PENALTY = 2;
const RES_COMPLETE = 1, RES_INCOMPLETE = 2, RES_INT = 3, RES_SACK = 4;

const isPlay = r => r[R_KIND] !== K_PENALTY;
const isRun = r => r[R_KIND] === K_RUN;
const isDropback = r => r[R_KIND] === K_DROPBACK;
const isAttempt = r => r[R_RESULT] === RES_COMPLETE || r[R_RESULT] === RES_INCOMPLETE
                    || r[R_RESULT] === RES_INT;

// better: which end of the list is good for the offence. On defence it flips.
// min: how many plays (or drives) a team needs before the number is trusted.
const METRICS = [
  { id: 'epa', group: 'Efficiency', label: 'EPA per play', fmt: 'dec3', better: 'high', min: 30,
    value: r => r[R_EPA] / 100 },
  { id: 'success', group: 'Efficiency', label: 'Success rate', fmt: 'pct', better: 'high', min: 30,
    value: r => r[R_FLAG] & F_SUCCESS ? 1 : 0 },
  { id: 'ypp', group: 'Efficiency', label: 'Yards per play', fmt: 'dec2', better: 'high', min: 30,
    value: r => r[R_YDS] },
  { id: 'stick', group: 'Efficiency', label: 'First-down rate', fmt: 'pct', better: 'high', min: 30,
    hint: 'snaps that move the sticks', value: r => r[R_YDS] >= r[R_DIST] ? 1 : 0 },
  { id: 'explosive', group: 'Efficiency', label: 'Explosive rate', fmt: 'pct', better: 'high', min: 30,
    hint: '10+ on a run, 20+ on a pass', value: r => r[R_FLAG] & F_EXPLOSIVE ? 1 : 0 },
  { id: 'negative', group: 'Efficiency', label: 'Negative play rate', fmt: 'pct', better: 'low', min: 30,
    value: r => r[R_YDS] < 0 ? 1 : 0 },
  { id: 'td', group: 'Efficiency', label: 'Touchdown rate', fmt: 'pct', better: 'high', min: 30,
    value: r => r[R_FLAG] & F_TD ? 1 : 0 },
  { id: 'turnover', group: 'Efficiency', label: 'Turnover rate', fmt: 'pct', better: 'low', min: 30,
    value: r => r[R_FLAG] & F_TURNOVER ? 1 : 0 },
  { id: 'dist', group: 'Efficiency', label: 'Average yards to go', fmt: 'dec1', better: 'low', min: 20,
    hint: 'how manageable the down is', value: r => r[R_DIST] },
  // the only metric that means the same thing on both sides: a flag on this
  // team is bad for this team, whichever unit is on the field
  { id: 'penalty', group: 'Efficiency', label: 'Penalty rate', fmt: 'pct', better: 'low', min: 30,
    hint: 'accepted penalties on this team, per snap', only: () => true, absolute: true,
    value: (r, side) => r[R_FLAG] & (side === 'defense' ? F_PEN_DEF : F_PEN_OFF) ? 1 : 0 },

  { id: 'db_epa', group: 'Passing', label: 'EPA per dropback', fmt: 'dec3', better: 'high', min: 20,
    only: isDropback, value: r => r[R_EPA] / 100 },
  { id: 'pass_success', group: 'Passing', label: 'Dropback success rate', fmt: 'pct', better: 'high', min: 20,
    only: isDropback, value: r => r[R_FLAG] & F_SUCCESS ? 1 : 0 },
  { id: 'comp', group: 'Passing', label: 'Completion %', fmt: 'pct', better: 'high', min: 20,
    only: isAttempt, value: r => r[R_RESULT] === RES_COMPLETE ? 1 : 0 },
  { id: 'ypa', group: 'Passing', label: 'Yards per attempt', fmt: 'dec2', better: 'high', min: 20,
    only: isAttempt, value: r => r[R_YDS] },
  { id: 'pass_explosive', group: 'Passing', label: 'Explosive pass rate', fmt: 'pct', better: 'high', min: 20,
    only: isDropback, value: r => r[R_FLAG] & F_EXPLOSIVE ? 1 : 0 },
  { id: 'sack', group: 'Passing', label: 'Sack rate', fmt: 'pct', better: 'low', min: 20,
    only: isDropback, value: r => r[R_RESULT] === RES_SACK ? 1 : 0 },
  { id: 'int', group: 'Passing', label: 'Interception rate', fmt: 'pct', better: 'low', min: 20,
    only: isAttempt, value: r => r[R_RESULT] === RES_INT ? 1 : 0 },

  { id: 'rush_epa', group: 'Rushing', label: 'EPA per carry', fmt: 'dec3', better: 'high', min: 20,
    only: isRun, value: r => r[R_EPA] / 100 },
  { id: 'ypc', group: 'Rushing', label: 'Yards per carry', fmt: 'dec2', better: 'high', min: 20,
    only: isRun, value: r => r[R_YDS] },
  { id: 'rush_success', group: 'Rushing', label: 'Rush success rate', fmt: 'pct', better: 'high', min: 20,
    only: isRun, value: r => r[R_FLAG] & F_SUCCESS ? 1 : 0 },
  { id: 'rush_explosive', group: 'Rushing', label: 'Explosive run rate', fmt: 'pct', better: 'high', min: 20,
    only: isRun, value: r => r[R_FLAG] & F_EXPLOSIVE ? 1 : 0 },
  { id: 'stuff', group: 'Rushing', label: 'Stuff rate', fmt: 'pct', better: 'low', min: 20,
    hint: 'carries held to nothing', only: isRun, value: r => r[R_YDS] <= 0 ? 1 : 0 },

  { id: 'run_rate', group: 'Tendency', label: 'Run rate', fmt: 'pct', better: 'none', min: 30,
    value: r => r[R_KIND] === K_RUN ? 1 : 0 },

  { id: 'drive_td', group: 'Drives', label: 'Touchdowns per drive', fmt: 'pct', better: 'high', min: 12,
    drives: true, value: d => d.td ? 1 : 0 },
  { id: 'drive_three_out', group: 'Drives', label: 'Three-and-out rate', fmt: 'pct', better: 'low', min: 12,
    hint: 'three snaps, no first down', drives: true,
    value: d => d.plays <= 3 && !d.firstDown && !d.td ? 1 : 0 },
  { id: 'drive_plays', group: 'Drives', label: 'Plays per drive', fmt: 'dec1', better: 'high', min: 12,
    drives: true, value: d => d.plays },
  { id: 'drive_yards', group: 'Drives', label: 'Yards per drive', fmt: 'dec1', better: 'high', min: 12,
    drives: true, value: d => d.yards },
  { id: 'drive_explosive', group: 'Drives', label: 'Drives with an explosive play', fmt: 'pct',
    better: 'high', min: 12, drives: true, value: d => d.explosive ? 1 : 0 },
  { id: 'drive_start', group: 'Drives', label: 'Average start (yards to go)', fmt: 'dec1', better: 'low',
    min: 12, drives: true, value: d => d.start },
  { id: 'drive_rz', group: 'Drives', label: 'Drives reaching the red zone', fmt: 'pct', better: 'high',
    min: 12, drives: true, value: d => d.redZone ? 1 : 0 },
  { id: 'drive_rz_td', group: 'Drives', label: 'Red-zone touchdown rate', fmt: 'pct', better: 'high', min: 6,
    hint: 'of the drives that get there', drives: true, only: d => d.redZone, value: d => d.td ? 1 : 0 },
];

const METRIC = Object.fromEntries(METRICS.map(m => [m.id, m]));
const METRIC_GROUPS = [...new Set(METRICS.map(m => m.group))];

function fmtMetric(metric, v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  if (metric.fmt === 'pct') return (v * 100).toFixed(1) + '%';
  if (metric.fmt === 'dec1') return v.toFixed(1);
  if (metric.fmt === 'dec2') return v.toFixed(2);
  return v.toFixed(3);
}

// Which way is good, once the side of the ball is taken into account. Most
// metrics flip on defence: yards per play is something you want to give up
// fewer of. A metric marked `absolute` reads the same way for both units.
function goodIsHigh(metric, side) {
  if (metric.better === 'none') return null;
  if (metric.absolute) return metric.better === 'high';
  return side === 'defense' ? metric.better !== 'high' : metric.better === 'high';
}

// ------------------------------------------------------------ the situation
// A `where` is the situation being measured: down, distance, field zone, play
// type, quarter, and how the game stood at the snap.
function inSituation(r, w) {
  if (!w) return true;
  if (w.snaps === 'competitive' && (r[R_FLAG] & F_GARBAGE)) return false;
  if (w.snaps === 'garbage' && !(r[R_FLAG] & F_GARBAGE)) return false;
  if (w.downs && w.downs.length && !w.downs.includes(r[R_DOWN])) return false;
  if (w.dist && (r[R_DIST] < w.dist[0] || r[R_DIST] > w.dist[1])) return false;
  if (w.zone && (r[R_YTG] < w.zone[0] || r[R_YTG] > w.zone[1])) return false;
  if (w.kind !== undefined && w.kind !== null && w.kind !== '' && r[R_KIND] !== w.kind) return false;
  if (w.quarters && w.quarters.length && !w.quarters.includes(r[R_QTR])) return false;
  if (w.state === 'lead' && r[R_MARGIN] <= 0) return false;
  if (w.state === 'behind' && r[R_MARGIN] >= 0) return false;
  if (w.state === 'close' && Math.abs(r[R_MARGIN]) > 8) return false;
  return true;
}

// The situations Strengths and Weaknesses walks through, and the ones the
// Chart Builder offers as a starting point for an axis.
const SITUATIONS = [
  { id: 'all', label: 'All plays', where: {} },
  { id: 'early', label: 'Early downs', where: { downs: [1, 2] } },
  { id: 'third', label: 'Third down', where: { downs: [3] } },
  { id: 'third_long', label: 'Third and long', where: { downs: [3], dist: [7, 99] } },
  { id: 'third_short', label: 'Third and short', where: { downs: [3], dist: [1, 3] } },
  { id: 'short_yardage', label: 'Short yardage', where: { downs: [3, 4], dist: [1, 2] } },
  { id: 'between', label: 'Between the 20s', where: { zone: [21, 80] } },
  { id: 'red_zone', label: 'Red zone', where: { zone: [1, 20] } },
  { id: 'low_rz', label: 'Inside the 10', where: { zone: [1, 10] } },
  { id: 'backed_up', label: 'Backed up', where: { zone: [80, 99] } },
  { id: 'runs', label: 'Running the ball', where: { kind: K_RUN } },
  { id: 'dropbacks', label: 'Dropping back', where: { kind: K_DROPBACK } },
  // `when` situations answer a different question (the moment, not the down),
  // so a chart axis can hold one of each: "third and long, while trailing".
  { id: 'first_half', label: 'First half', when: true, where: { quarters: [1, 2] } },
  { id: 'second_half', label: 'Second half', when: true, where: { quarters: [3, 4] } },
  { id: 'fourth', label: 'Fourth quarter', when: true, where: { quarters: [4] } },
  { id: 'lead', label: 'With a lead', when: true, where: { state: 'lead' } },
  { id: 'behind', label: 'Trailing', when: true, where: { state: 'behind' } },
  { id: 'close', label: 'One-score game', when: true, where: { state: 'close' } },
];

const SITUATION = Object.fromEntries(SITUATIONS.map(s => [s.id, s]));

// --------------------------------------------------------------- the engine
// One pass over the plays fills every metric for every team: the cost is in
// walking the rows, not in the arithmetic.
function scan(plays, ok, side, where, wanted) {
  const ids = wanted || METRICS.map(m => m.id);
  const list = ids.map(id => METRIC[id]).filter(m => m && !m.drives);
  const driveList = ids.map(id => METRIC[id]).filter(m => m && m.drives);
  const teams = new Map();
  const blank = () => {
    const a = { num: {}, den: {} };
    for (const m of list.concat(driveList)) { a.num[m.id] = 0; a.den[m.id] = 0; }
    return a;
  };

  if (list.length) {
    for (const r of plays.rows) {
      const team = plays.teams[side === 'defense' ? r[R_DEF] : r[R_OFF]];
      if (ok && !ok.has(plays.games[r[R_GAME]] + '-' + team)) continue;
      if (!inSituation(r, where)) continue;
      let acc = teams.get(team);
      if (!acc) teams.set(team, acc = blank());
      for (const m of list) {
        if (m.only ? !m.only(r) : !isPlay(r)) continue;
        acc.num[m.id] += m.value(r, side);
        acc.den[m.id] += 1;
      }
    }
  }

  if (driveList.length) {
    for (const [team, drives] of driveTable(plays, ok, side, where)) {
      let acc = teams.get(team);
      if (!acc) teams.set(team, acc = blank());
      for (const d of drives) {
        for (const m of driveList) {
          if (m.only && !m.only(d)) continue;
          acc.num[m.id] += m.value(d);
          acc.den[m.id] += 1;
        }
      }
    }
  }
  return teams;
}

// Whole drives, for the metrics that only make sense over one. Down, distance
// and field zone belong to a snap rather than a drive, so a drive is judged on
// when it happened and how the game stood at its first snap.
function driveTable(plays, ok, side, where) {
  const drives = new Map(), byTeam = new Map();
  for (const r of plays.rows) {
    if (r[R_KIND] === K_PENALTY) continue;
    const key = r[R_GAME] + '|' + r[R_DRIVE];
    let d = drives.get(key);
    if (d === undefined) {
      const team = plays.teams[side === 'defense' ? r[R_DEF] : r[R_OFF]];
      const inGame = !ok || ok.has(plays.games[r[R_GAME]] + '-' + team);
      const when = inSituation(r, where && { snaps: where.snaps, quarters: where.quarters,
                                             state: where.state });
      d = inGame && when
        ? { team, plays: 0, yards: 0, td: false, firstDown: false, explosive: false,
            start: r[R_YTG], redZone: r[R_YTG] <= 20 }
        : null;
      drives.set(key, d);
    }
    if (!d) continue;
    d.plays += 1;
    d.yards += r[R_YDS];
    if (r[R_FLAG] & F_TD) d.td = true;
    if (r[R_YDS] >= r[R_DIST]) d.firstDown = true;
    if (r[R_FLAG] & F_EXPLOSIVE) d.explosive = true;
    if (r[R_YTG] <= 20) d.redZone = true;
  }
  for (const d of drives.values()) {
    if (!d) continue;
    if (!byTeam.has(d.team)) byTeam.set(d.team, []);
    byTeam.get(d.team).push(d);
  }
  return byTeam;
}

/** One team's value for one metric, or null when the sample is too small. */
function metricValue(acc, metric, min) {
  if (!acc) return null;
  const den = acc.den[metric.id] || 0;
  if (den < (min === undefined || min === null ? metric.min : min)) return null;
  return acc.num[metric.id] / den;
}

/** Every team's value for one metric, as a Map, plus the play counts. */
function metricColumn(teams, metric, min) {
  const values = new Map(), counts = new Map();
  for (const [team, acc] of teams) {
    const v = metricValue(acc, metric, min);
    if (v === null) continue;
    values.set(team, v);
    counts.set(team, acc.den[metric.id]);
  }
  return { values, counts };
}

/** Rank the teams in one metric; 1 is the best for that side of the ball.
 *
 * Tied teams share the average of the places they cover, not the best of
 * them. In a rate like touchdowns on a handful of snaps, half the teams can
 * sit on the same zero: giving all of them first place would turn an ordinary
 * number into everybody's biggest strength. */
function rankTeams(values, high) {
  const rows = [...values.entries()].sort((a, b) => high ? b[1] - a[1] : a[1] - b[1]);
  const ranks = new Map();
  for (let i = 0; i < rows.length;) {
    let j = i;
    while (j + 1 < rows.length && rows[j + 1][1] === rows[i][1]) j += 1;
    const shared = (i + j) / 2 + 1;                 // places i+1 .. j+1, averaged
    for (let k = i; k <= j; k++) ranks.set(rows[k][0], shared);
    i = j + 1;
  }
  return { ranks, of: rows.length };
}

/** The local copy of a logo, in the version that suits the current theme. */
function logoSrc(teamId) {
  const light = document.documentElement.dataset.theme === 'light';
  return `${window.CA_UP || ''}assets/logos/${light ? 'on-light' : 'on-dark'}/${teamId}.png`;
}
