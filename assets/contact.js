
const $ = id => document.getElementById(id);
const endpoint = (window.CA_SUPABASE || {}).url + '/functions/v1/contact';

$('contact-form').addEventListener('submit', async e => {
  e.preventDefault();
  const note = $('contact-note');
  const button = $('contact-send');
  note.className = 'form-note';
  note.textContent = 'Sending…';
  button.disabled = true;
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json',
                 apikey: (window.CA_SUPABASE || {}).anonKey || '' },
      body: JSON.stringify({
        name: $('c-name').value, email: $('c-email').value,
        message: $('c-message').value, website: $('c-website').value,
      }),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(out.error || 'It did not send.');
    $('contact-form').hidden = true;
    $('contact-done').hidden = false;
  } catch (err) {
    note.className = 'form-note bad';
    note.textContent = err.message;
    button.disabled = false;
  }
});
