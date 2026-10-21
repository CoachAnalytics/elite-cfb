
const $ = id => document.getElementById(id);
const fn = (window.CA_SUPABASE || {}).url + '/functions/v1/admin';

const money = cents => '$' + (cents / 100).toLocaleString(undefined,
  { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = iso => iso ? new Date(iso).toLocaleDateString(undefined,
  { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function signedInClient() {
  if (window.CA_CLIENT) return window.CA_CLIENT;
  const CONFIG = window.CA_SUPABASE || {};
  if (!CONFIG.url || !CONFIG.anonKey) throw new Error('This site is not connected to its accounts yet.');
  return (window.CA_CLIENT = window.supabase.createClient(CONFIG.url, CONFIG.anonKey));
}

async function callAdmin(action, body) {
  const client = signedInClient();
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error('Sign in first.');
  const r = await fetch(`${fn}/${action}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${session.access_token}`,
               'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || `Refused (${r.status}).`);
  return out;
}

function card(label, value, note) {
  return `<div class="stat-card"><div class="k">${label}</div><div class="v">${value}</div>
          <div class="s">${note || ''}</div></div>`;
}

function draw(d) {
  $('cards').innerHTML = [
    card('Subscribers', d.total_live, 'with live access right now'),
    card('Paying', d.paying, 'active Stripe subscriptions'),
    card('On trial', d.trialing, 'not yet charged'),
    card('Monthly recurring', money(d.mrr_cents), 'from active subscriptions'),
    card('Collected', money(d.collected_30d_cents), 'in the last 30 days'),
  ].join('');

  const by = Object.entries(d.counts).sort();
  $('breakdown').innerHTML = by.length
    ? `<table class="report"><thead><tr><th class="name">Where from</th><th>State</th>
         <th>How many</th></tr></thead><tbody>${by.map(([k, n]) => {
           const [src, state] = k.split(':');
           return `<tr><th class="name">${src}</th><td>${state}</td><td>${n}</td></tr>`;
         }).join('')}</tbody></table>`
    : '<p class="sub">Nobody yet.</p>';

  $('recent').innerHTML = `<table class="report"><thead><tr>
      <th class="name">Member</th><th>Source</th><th>State</th><th>Until</th><th>Note</th><th></th>
    </tr></thead><tbody>${d.recent.map(r => `
      <tr>
        <th class="name">${r.email || '—'}</th>
        <td>${r.source || '—'}</td>
        <td><span class="pill ${r.live ? 'on' : 'off'}">${r.live ? r.status : 'lapsed'}</span></td>
        <td>${r.ends ? when(r.ends) : 'no end date'}</td>
        <td class="note-cell">${r.note || ''}</td>
        <td>${r.source === 'comp' && r.live
              ? `<button class="btn ghost tiny" data-revoke="${r.email}">End</button>` : ''}</td>
      </tr>`).join('')}</tbody></table>`;

  $('recent').querySelectorAll('[data-revoke]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { await callAdmin('revoke', { email: b.dataset.revoke }); await load(); }
    catch (err) { say($('comp-note'), err.message, true); b.disabled = false; }
  });
}

const say = (el, text, bad) => { el.textContent = text; el.className = bad ? 'form-note bad' : 'form-note'; };

async function load() {
  // The gate runs beside this and may replace the whole page while we are
  // waiting on the server, so the page is checked for again on the way back
  // rather than assumed.
  if (!$('panel')) return;
  try {
    draw(await callAdmin('summary'));
    if (!$('panel')) return;
    $('panel').hidden = false;
    $('denied').hidden = true;
  } catch (err) {
    if (!$('panel')) return;
    $('panel').hidden = true;
    $('denied').hidden = false;
    // Say which account was refused. "Not an admin" with no name sends you
    // looking for a broken page when the answer is that this browser is
    // signed in as the account you subscribed with to test the checkout.
    let who = '';
    try {
      const { data } = await signedInClient().auth.getUser();
      if (data && data.user) who = data.user.email;
    } catch (e) {}
    $('denied').textContent = /refused \(403\)|not allowed/i.test(err.message)
      ? (who ? `This page is for administrators, and ${who} is not one. `
             + 'Sign out and back in with your admin address.'
             : 'This page is for administrators. Your account is not one.')
      : err.message;
  }
}

// Without a subscription the gate replaces the whole page, so none of the
// fields below exist. Wiring them up anyway throws before load() is ever
// reached, which buries the real reason under a null reference.
if ($('comp-form')) {
$('comp-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('comp-email').value.trim();
  const months = $('comp-months').value ? Number($('comp-months').value) : null;
  say($('comp-note'), 'Working…');
  try {
    const out = await callAdmin('comp', { email, months, note: $('comp-reason').value.trim() });
    say($('comp-note'), out.link
      ? 'Comped. They have no account yet, so send them the sign-in link below.'
      : `Comped ${email}.`);
    $('comp-link').hidden = !out.link;
    $('comp-link').value = out.link || '';
    $('comp-email').value = ''; $('comp-reason').value = '';
    await load();
  } catch (err) { say($('comp-note'), err.message, true); }
});

load();
}
