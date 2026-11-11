
(async () => {
  const CONFIG = window.CA_SUPABASE || {};
  const main = document.querySelector('main');
  const lock = (title, body) => {
    main.innerHTML = `<h1>${title}</h1><div class="panel"><p>${body}</p>
      <p><a class="btn" href="../members/index.html">Go to members</a></p></div>`;
  };
  if (!CONFIG.url || !CONFIG.anonKey) return;           // not switched on yet
  // One client for the whole page, shared under a name the other scripts
  // know. Built before the first await, so a script that loads after this
  // one finds it ready rather than finding undefined: that is what left the
  // admin panel showing "undefined is not an object" instead of its data,
  // and the Start page quietly skipping the line that says when a
  // subscription runs out.
  const client = window.CA_CLIENT
    || (window.CA_CLIENT = window.supabase.createClient(CONFIG.url, CONFIG.anonKey));
  const { data: { session } } = await client.auth.getSession();
  if (!session) {
    lock('Advanced Analytics', 'This is a subscriber section. Sign in and we will bring you straight back.');
    return;
  }
  const { data } = await client.from('my_access').select('allowed').maybeSingle();
  if (!data || !data.allowed) {
    lock('Advanced Analytics', 'Your account does not have an active subscription yet.');
  }
})();
