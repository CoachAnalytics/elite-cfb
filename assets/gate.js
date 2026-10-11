
(async () => {
  const CONFIG = window.CA_SUPABASE || {};
  const main = document.querySelector('main');
  const lock = (title, body) => {
    main.innerHTML = `<h1>${title}</h1><div class="panel"><p>${body}</p>
      <p><a class="btn" href="../members/index.html">Go to members</a></p></div>`;
  };
  if (!CONFIG.url || !CONFIG.anonKey) return;           // not switched on yet
  const client = window.supabase.createClient(CONFIG.url, CONFIG.anonKey);
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
