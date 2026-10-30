
// A dropdown of checkboxes. summary(selected, all) writes the button text.
function multi(id, summary, onChange) {
  const root = document.getElementById(id), button = root.querySelector('button.multi-btn'), list = root.querySelector('.multi-list');
  button.onclick = e => { e.stopPropagation(); document.querySelectorAll('.multi.open').forEach(m => m !== root && m.classList.remove('open')); root.classList.toggle('open'); };
  root.querySelector('.multi-panel').onclick = e => e.stopPropagation();
  root.querySelector('[data-all]').onclick = () => { api.set(null); onChange(); };
  root.querySelector('[data-none]').onclick = () => { api.set([]); onChange(); };
  const api = {
    options: [],
    fill(options, keep) {          // options: [[value, label]]; keep: values to leave checked, or null for all
      this.options = options;
      list.innerHTML = options.map(([v, label]) =>
        `<label><input type="checkbox" value="${v}" ${keep === null || keep.includes(v) ? 'checked' : ''}>${label}</label>`).join('');
      list.querySelectorAll('input').forEach(i => i.onchange = () => { this.label(); onChange(); });
      this.label();
    },
    selected() { return [...list.querySelectorAll('input:checked')].map(i => i.value); },
    all() { return this.selected().length === this.options.length; },
    set(values) { list.querySelectorAll('input').forEach(i => i.checked = values === null || values.includes(i.value)); this.label(); },
    label() { button.textContent = summary(this.selected(), this.options) + ' \u25BE'; },
  };
  return api;
}

function listSummary(noun, plural) {
  return (sel, options) => {
    if (sel.length === options.length) return `All ${plural}`;
    if (!sel.length) return `No ${plural}`;
    const labels = options.filter(o => sel.includes(o[0])).map(o => o[1]);
    return labels.length <= 2 ? labels.join(', ') : `${labels.length} ${plural}`;
  };
}

function weekSummary(sel, options) {
  if (sel.length === options.length) return 'All weeks';
  if (!sel.length) return 'No weeks';
  const idx = options.map((o, i) => sel.includes(o[0]) ? i : -1).filter(i => i >= 0);
  const run = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  const name = i => options[i][1].replace('Week ', '');
  if (idx.length === 1) return options[idx[0]][1];
  if (run) return `Weeks ${name(idx[0])}\u2013${name(idx[idx.length - 1])}`;
  return `${idx.length} weeks`;
}

document.addEventListener('click', () => document.querySelectorAll('.multi.open').forEach(m => m.classList.remove('open')));
