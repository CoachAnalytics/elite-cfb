(function () {
  const span = document.getElementById('covers');
  if (!span || document.getElementById('reset')) return;
  const picker = document.getElementById('season');
  fetch((window.CA_UP || '') + 'data/coverage.json')
    .then(r => r.json())
    .then(all => {
      const show = () => {
        // the picker when there is one, otherwise the newest season we hold
        const season = (picker && picker.value) || Object.keys(all).sort().pop();
        span.textContent = all[season] ? 'Data through ' + all[season] : 'No games yet';
      };
      show();
      if (picker) picker.addEventListener('change', show);
    })
    .catch(() => {});   // say nothing rather than something wrong
})();
