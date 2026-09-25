
const $ = id => document.getElementById(id);
const CONFIG = window.CA_SUPABASE || {};
let client = null;

const PANELS = ['setup', 'signin', 'signup', 'sent', 'forgot', 'recover', 'account'];
const show = id => PANELS.forEach(p => { $(p).hidden = p !== id; });
const say = (id, text, bad) => { const el = $(id); el.textContent = text; el.className = bad ? 'note bad' : 'note'; };

async function refresh() {
  const { data: { session } } = await client.auth.getSession();
  if (!session) { show('signin'); return; }
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
  const { data, error } = await client.from('my_access').select('*').maybeSingle();
  if (error) say('account-note', `Could not read your access: ${error.message}`, true);
  else say('account-note', '');
  const live = !error && data && data.allowed;
  $('status').innerHTML = live
    ? `<span class="badge on">Subscription active</span>${data.current_period_end
        ? ` <span class="dim">through ${new Date(data.current_period_end).toLocaleDateString()}</span>` : ''}`
    : '<span class="badge off">No active subscription</span>';
  $('tools').hidden = !live;
  $('offer').hidden = Boolean(live);
}

async function signIn(e) {
  e.preventDefault();
  say('signin-note', 'Signing in\u2026');
  const { error } = await client.auth.signInWithPassword({
    email: $('email').value.trim(), password: $('password').value });
  if (error) { say('signin-note', error.message, true); return; }
  say('signin-note', '');
  refresh();
}

async function signUp(e) {
  e.preventDefault();
  if ($('new-password').value.length < 8) { say('signup-note', 'Use at least 8 characters.', true); return; }
  say('signup-note', 'Creating your account\u2026');
  const { data, error } = await client.auth.signUp({
    email: $('signup-email').value.trim(), password: $('new-password').value,
    options: { emailRedirectTo: location.href.split('#')[0] } });
  if (error) { say('signup-note', error.message, true); return; }
  if (data.session) { refresh(); return; }          // the project does not ask for confirmation
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
  document.querySelectorAll('[data-plan]').forEach(b => b.onclick = () => subscribe(b.dataset.plan));
  document.querySelectorAll('[data-show]').forEach(el =>
    el.onclick = e => { e.preventDefault(); show(el.dataset.show); });
  $('signout').onclick = async () => { await client.auth.signOut(); show('signin'); };
  if (location.hash.includes('type=recovery')) { show('recover'); return; }
  await refresh();
  if (new URLSearchParams(location.search).get('checkout') === 'done') {
    planSay('Thanks! Setting up your subscription…');
    setTimeout(refresh, 2500);                 // give the payment webhook a moment
    setTimeout(refresh, 6000);
  }
})();
