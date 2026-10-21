
const $ = id => document.getElementById(id);

/** What the subscription is, in the words someone wants after paying. */
async function showAccess() {
  const client = window.CA_CLIENT;
  if (!client) return;
  const { data } = await client.from('my_access').select('*').maybeSingle();
  if (!data || !data.allowed) return;
  const ends = data.current_period_end ? new Date(data.current_period_end) : null;
  const when = ends ? ends.toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : null;
  $('access').innerHTML = data.status === 'trialing'
    ? `Your trial is running${when ? ` and becomes a subscription on <b>${when}</b>` : ''}.`
    : `Your subscription is live${when ? ` and renews on <b>${when}</b>` : ''}.`;
  $('access').hidden = false;
}

/** The team picker remembers a choice, so the first one is the one that counts. */
function wireTeam() {
  const pick = $('team-pick');
  if (!pick) return;
  pick.onchange = () => {
    if (!pick.value) return;
    remembered.set('team', pick.value);
    location.href = `team.html?team=${pick.value}&season=${START.season}`;
  };
}

showAccess();
wireTeam();
