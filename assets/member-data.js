
// One place that fetches the data a subscription pays for. The same call
// fails for anyone without a live subscription, because the rule lives on
// the bucket rather than in this page.
window.memberData = async function (relative) {
  if (!window.CA_PRIVATE_DATA) {
    const r = await fetch(`${window.CA_UP || ''}data/${relative}`);
    if (!r.ok) throw new Error(`Could not read ${relative}`);
    return r.json();
  }
  const CONFIG = window.CA_SUPABASE || {};
  const client = window.CA_CLIENT
    || (window.CA_CLIENT = window.supabase.createClient(CONFIG.url, CONFIG.anonKey));
  const { data, error } = await client.storage.from('members').download(`${relative}.gz`);
  if (error) throw new Error(error.message || 'This data is for subscribers.');
  const stream = data.stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json();
};
