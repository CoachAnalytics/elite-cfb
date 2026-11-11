
const $ = id => document.getElementById(id);
const CONFIG = window.CA_SUPABASE || {};
let client = null;

const PANELS = ['setup', 'start', 'signin', 'signup', 'sent', 'forgot', 'recover', 'account'];

// An invitation arrives in the address bar and has to survive what comes
// next: a confirmation email, a different tab, a browser closed and opened
// again. So it is kept until it is redeemed, and the address bar is tidied
// up so a screenshot of this page does not hand the code to anybody else.
const INVITE_KEY = 'ca-invite';
// Which plan they chose before they had an account. Kept for the same reason
// the invitation code is: the confirmation email is opened somewhere else,
// and somebody who has already chosen should not be asked again.
const PLAN_KEY = 'ca-plan';
function wants(value) {
  try {
    if (value === undefined) return localStorage.getItem(PLAN_KEY) || '';
    if (value) localStorage.setItem(PLAN_KEY, value); else localStorage.removeItem(PLAN_KEY);
  } catch (e) {}
  return value || '';
}
function invite(value) {
  try {
    if (value === undefined) return localStorage.getItem(INVITE_KEY) || '';
    if (value) localStorage.setItem(INVITE_KEY, value); else localStorage.removeItem(INVITE_KEY);
  } catch (e) {}
  return value || '';
}

/** Hand the code in, once there is an account to attach it to. */
async function redeemInvite(noteId) {
  const note = noteId || 'account-note';
  const code = invite();
  if (!code) return false;
  const { data: { session } } = await client.auth.getSession();
  if (!session) return false;
  try {
    const r = await fetch(`${CONFIG.url}/functions/v1/invite`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ code }),
    });
    const out = await r.json();
    if (!r.ok) {
      // A code that will never work is cleared; one that failed because the
      // network did is kept for the next try.
      if (r.status === 400) invite('');
      say(note, out.error || 'That invitation could not be redeemed.', true);
      return false;
    }
    invite('');
    $('invited').hidden = false;
    $('invited').textContent = out.again
      ? `Your ${out.label} access is already on this account.`
      : `Welcome in. You have been added as ${out.label}.`;
    return true;
  } catch (err) {
    return false;
  }
}
const show = id => PANELS.forEach(p => { $(p).hidden = p !== id; });
const say = (id, text, bad) => { const el = $(id); el.textContent = text; el.className = bad ? 'note bad' : 'note'; };

async function refresh() {
  const { data: { session } } = await client.auth.getSession();
  if (!session) { show(invite() || wants() ? 'signup' : 'start'); return; }
  // a saved session can outlive its token (a password change ends it), so
  // check with the server rather than trusting what is in the browser
  const { data: who, error: whoError } = await client.auth.getUser();
  if (whoError || !who?.user) {
    await client.auth.signOut();
    show('signin');
    say('signin-note', 'Your session has expired. Please sign in again.');
    return;
  }
  show('account');
  $('who').textContent = who.user.email;
  // Redeem before reading the access, or the page says "no subscription" to
  // somebody who has just been given one.
  if (invite()) await redeemInvite();
  const { data, error } = await client.from('my_access').select('*').maybeSingle();
  if (error) say('account-note', `Could not read your access: ${error.message}`, true);
  else say('account-note', '');
  const live = !error && data && data.allowed;
  // A cancelled subscription that still has time on it is live access with an
  // end date, and saying "active" about it invites a second cancellation.
  const until = data && data.current_period_end
    ? new Date(data.current_period_end).toLocaleDateString() : '';
  const ending = live && data.status === 'canceled';
  $('status').innerHTML = live
    ? `<span class="badge ${ending ? 'off' : 'on'}">${ending ? 'Cancelled' : 'Subscription active'}</span>`
      + (until ? ` <span class="dim">${ending ? 'access until' : 'through'} ${until}</span>` : '')
    : '<span class="badge off">No active subscription</span>';
  $('tools').hidden = !live;
  $('offer').hidden = Boolean(live);
  if (live) maybeAdmin();
  // They chose a plan before they had an account. Finish what they started
  // rather than showing them the menu a second time.
  if (!live && wants()) {
    $('resume').hidden = false;
    $('resume-plan').textContent = wants() === 'annual' ? 'yearly' : 'monthly';
    // The pitch has been made and taken. What is left below is the other
    // plan, not a second attempt at the same one.
    $('offer-head').textContent = 'Or take the other plan';
    $('offer-blurb').hidden = true;
  }
}

/** "Invalid login credentials" is true and useless: it tells someone holding a
 *  password that was handed to them nothing about which half is wrong. Almost
 *  always it is a password copied with a space on the end, or an older one. */
function signInTrouble(error) {
  const said = error.message || '';
  if (/invalid login credentials/i.test(said))
    return 'That email and password do not match. Passwords are case-sensitive, and a copied '
         + 'one often picks up a space at the end - try retyping it. If you were sent a password '
         + 'and it still will not work, ask for a fresh one.';
  if (/email not confirmed/i.test(said))
    return 'This account has not been confirmed yet. Open the link in the signup email first.';
  return said;
}

async function signIn(e) {
  e.preventDefault();
  say('signin-note', 'Signing in\u2026');
  const { error } = await client.auth.signInWithPassword({
    email: $('email').value.trim(), password: $('password').value });
  if (error) { say('signin-note', signInTrouble(error), true); return; }
  say('signin-note', '');
  refresh();
}

async function signUp(e) {
  e.preventDefault();
  if ($('new-password').value.length < 8) { say('signup-note', 'Use at least 8 characters.', true); return; }
  say('signup-note', 'Creating your account\u2026');
  // The code travels in the confirmation link, not only in this browser's
  // storage. People open that link wherever their email is - the Gmail app's
  // own browser, a different phone, a laptop - and anything kept here is not
  // there when they arrive. Without this they confirm, sign in, and find an
  // account with no access and nothing to explain why.
  const back = new URL(location.href.split('#')[0]);
  back.search = '';
  if (invite()) back.searchParams.set('invite', invite());
  if (wants()) back.searchParams.set('plan', wants());
  const { data, error } = await client.auth.signUp({
    email: $('signup-email').value.trim(), password: $('new-password').value,
    options: { emailRedirectTo: back.toString() } });
  if (error) { say('signup-note', error.message, true); return; }
  if (data.session) { refresh(); return; }          // the project does not ask for confirmation
  // Signing up with an address that already has an account comes back looking
  // exactly like success - Supabase will not confirm or deny that an address is
  // registered - and the only tell is that no identity was created. Saying "we
  // sent you a link" to someone who already has an account sends them to wait
  // for an email that is never coming.
  if (data.user && (data.user.identities || []).length === 0) {
    say('signup-note', 'There is already an account for that address. Sign in below instead, '
                     + 'or ask for a fresh sign-in link if you do not have the password.', true);
    return;
  }
  $('sent-to').textContent = $('signup-email').value.trim();
  show('sent');
}

async function forgot(e) {
  e.preventDefault();
  say('forgot-note', 'Sending\u2026');
  const { error } = await client.auth.resetPasswordForEmail($('forgot-email').value.trim(),
    { redirectTo: location.href.split('#')[0] });
  say('forgot-note', error ? error.message : 'Check your email for a link to set a new password.',
      Boolean(error));
}

// Stripe Checkout, opened by the payment function with the member's token
const planSay = (text, bad) => say('plan-note', text, bad);

async function subscribe(plan) {
  planSay('Opening Stripe…');
  const { data: { session } } = await client.auth.getSession();
  if (!session) { planSay('Sign in first.', true); return; }
  try {
    const res = await fetch(`${CONFIG.url}/functions/v1/stripe/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ plan }),
    });
    const body = await res.json();
    if (!res.ok || !body.url) { planSay(body.error || 'Could not start checkout.', true); return; }
    location.href = body.url;
  } catch (err) {
    planSay('Could not reach the payment service: ' + err.message, true);
  }
}

// Stripe's own billing page. Cancelling has to happen at Stripe, or the card
// keeps being charged after the site has stopped letting them in.
async function manage() {
  const note = (text, bad) => say('manage-note', text, bad);
  note('Opening Stripe…');
  const { data: { session } } = await client.auth.getSession();
  if (!session) { note('Sign in first.', true); return; }
  try {
    const res = await fetch(`${CONFIG.url}/functions/v1/stripe/portal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
    });
    const body = await res.json();
    if (!res.ok || !body.url) { note(body.error || 'Could not open the billing page.', true); return; }
    location.href = body.url;
  } catch (err) {
    note('Could not reach the payment service: ' + err.message, true);
  }
}

/** Is this the owner? The browser is not told who the admins are - that
 *  list lives on the server and always will - so the page asks the admin
 *  endpoint whether it would answer, and shows the link only if it would.
 *  Anyone else gets a refusal that costs nothing: the endpoint turns a
 *  stranger away before it reads anything. */
async function maybeAdmin() {
  try {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;
    const r = await fetch(`${CONFIG.url}/functions/v1/admin/summary`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
      body: '{}',
    });
    if (r.ok) $('admin-link').hidden = false;
  } catch (err) { /* no link, and nothing to say about it */ }
}

/** Somebody who was invited, confirmed their email somewhere else, and
 *  arrived without the code. They can type it in rather than be told to
 *  find the original link. */
async function redeemTyped(e) {
  e.preventDefault();
  const typed = $('code-input').value.trim().toUpperCase();
  if (!typed) { say('code-note', 'Paste the code from your invitation.', true); return; }
  invite(typed);
  say('code-note', 'Checking…');
  if (await redeemInvite('code-note')) {
    $('code-input').value = '';
    say('code-note', '');
    await refresh();
  }
}

async function savePassword(e) {
  e.preventDefault();
  if ($('account-password').value.length < 8) { say('password-note', 'Use at least 8 characters.', true); return; }
  const { error } = await client.auth.updateUser({ password: $('account-password').value });
  say('password-note', error ? error.message : 'Saved. Sign in with your email and this password from now on.',
      Boolean(error));
  if (!error) $('account-password').value = '';
}

async function setPassword(e) {
  e.preventDefault();
  if ($('recover-password').value.length < 8) { say('recover-note', 'Use at least 8 characters.', true); return; }
  const { error } = await client.auth.updateUser({ password: $('recover-password').value });
  if (error) { say('recover-note', error.message, true); return; }
  history.replaceState(null, '', location.pathname);
  refresh();
}

(async () => {
  if (!CONFIG.url || !CONFIG.anonKey) { show('setup'); return; }
  client = window.supabase.createClient(CONFIG.url, CONFIG.anonKey);
  client.auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') show('recover');       // arrived from a reset email
    else if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') refresh();
  });
  $('signin-form').addEventListener('submit', signIn);
  $('signup-form').addEventListener('submit', signUp);
  $('forgot-form').addEventListener('submit', forgot);
  $('recover-form').addEventListener('submit', setPassword);
  $('password-form').addEventListener('submit', savePassword);
  $('code-form').addEventListener('submit', redeemTyped);
  $('resume-go').onclick = () => subscribe(wants() || 'monthly');
  document.querySelectorAll('[data-plan]').forEach(b => b.onclick = () => subscribe(b.dataset.plan));
  // Picking a plan before signing up is the first half of one action, not a
  // separate decision to be made again later.
  document.querySelectorAll('[data-start]').forEach(b => b.onclick = () => {
    wants(b.dataset.start);
    show('signup');
    say('signup-note', 'One minute. Your email and a password, then your card at Stripe.');
  });
  document.querySelectorAll('[data-show]').forEach(el =>
    el.onclick = e => { e.preventDefault(); show(el.dataset.show); });
  $('manage').onclick = manage;
  $('signout').onclick = async () => { await client.auth.signOut(); show('signin'); };
  if (location.hash.includes('type=recovery')) { show('recover'); return; }

  // Arriving on an invitation link: keep the code, take it out of the
  // address bar, and start them on the form that makes an account rather
  // than the one that signs into an account they have not got yet.
  const chosen = new URLSearchParams(location.search).get('plan');
  if (chosen === 'monthly' || chosen === 'annual') wants(chosen);
  const invited = new URLSearchParams(location.search).get('invite');
  if (invited) {
    invite(invited.trim().toUpperCase());
    history.replaceState(null, '', location.pathname);
  }
  if (invite()) {
    $('invite-banner').hidden = false;
    say('signup-note', 'Use your own email address.');
  }
  await refresh();
  if (new URLSearchParams(location.search).get('checkout') === 'done') {
    wants('');
    planSay('Thanks! Setting up your subscription…');
    setTimeout(refresh, 2500);                 // give the payment webhook a moment
    setTimeout(refresh, 6000);
  }
})();
