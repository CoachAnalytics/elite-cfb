
let INDEX = [];
const box = document.getElementById('search');
const out = document.getElementById('results');

function render(list) {
  out.innerHTML = list.slice(0, 25).map(p => `<a href="player.html?id=${p[0]}">
      <span class="pname">${p[1]}</span>
      <span class="pmeta">${p[2] || ''} &middot; ${p[3]} &middot; ${p[4] === p[5] ? p[4] : p[4] + '&ndash;' + p[5]}</span></a>`).join('')
    || (box.value ? '<p class="sub">No player by that name.</p>' : '');
}

box.oninput = () => {
  const words = box.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) { out.innerHTML = ''; return; }
  const hits = INDEX.filter(p => words.every(w => p[1].toLowerCase().includes(w) || p[3].toLowerCase().includes(w)));
  hits.sort((a, b) => b[5] - a[5] || a[1].localeCompare(b[1]));
  render(hits);
};

(async () => {
  INDEX = await (await fetch('../data/players/index.json')).json();
  document.getElementById('count').textContent = `${INDEX.length.toLocaleString()} players`;
  box.focus();
})();
