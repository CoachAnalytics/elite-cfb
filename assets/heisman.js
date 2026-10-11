
// The write-ups are the thing being paid for, so they are not in the page.
// They come down with the subscriber's own token, the same way every other
// number behind the button does - a page that ships its content and then
// hides it with a stylesheet is not a paywall, it is a curtain.
(async () => {
  try {
    const data = await memberData(`heisman/2026.json`);
    document.getElementById('merit').innerHTML = data.merit.join('');
    document.getElementById('vote').innerHTML = data.vote.join('');
  } catch (err) {
    const note = document.querySelector('.sub');
    if (note) note.textContent = 'This page is for subscribers.';
  }
})();
