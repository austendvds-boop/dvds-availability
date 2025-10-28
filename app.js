const API = {
  locations: '/api/locations',
  availability: '/api/availability'
};

function cacheKey(city, from, to) {
  return `avail:${city}:${from}:${to}`;
}

async function getJSON(url) {
  const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) {
    let body = null;
    try { body = await r.json(); } catch {}
    const detail = body && body.detail;
    const error = body && body.error;
    const msg = (error || detail)
      ? `${error || ''} ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`.trim()
      : `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return r.json();
}

function ymd(d) {
  return new Date(d).toISOString().slice(0,10);
}

(async function main(){
  const status = document.getElementById('status');
  const sel = document.getElementById('location');
  const out = document.getElementById('out');
  const open = document.getElementById('open');

  try {
    status.textContent = 'Loading…';
    const data = await getJSON(API.locations);
    if (!data.ok) throw new Error(data.error || 'locations failed');

    const envInfo = await getJSON('/api/env-check').catch(() => ({ timezone: 'America/Phoenix', defaultDays: 14 }));

    // Build dropdown
    sel.innerHTML = '<option value="">Select a location…</option>' +
      data.cities.map(c => `<option value="${encodeURIComponent(c.name)}">${c.label || c.name}</option>`).join('');
    sel.disabled = false;
    status.textContent = 'Ready';

    sel.addEventListener('change', async () => {
      const name = decodeURIComponent(sel.value || '');
      if (!name) return;

      const city = data.cities.find(c => c.name === name || c.label === name) || data.cities.find(c => c.name === name);
      if (!city) return;

      const tz = envInfo.timezone || 'America/Phoenix';
      const fallbackDays = 14;
      const defaultDays = Number(envInfo.defaultDays) || fallbackDays;
      const today = ymd(Date.now());
      const to = ymd(Date.now() + defaultDays * 86400000);
      const cityName = city.name;

      out.textContent = 'Fetching availability…';

      const key = cacheKey(cityName, today, to);
      const cached = sessionStorage.getItem(key);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          renderAvailability(parsed, city, tz, open, out);
          return;
        } catch {}
      }

      const availabilityUrl = `${API.availability}?city=${encodeURIComponent(cityName)}&from=${today}&to=${to}`;

      try {
        const avail = await getJSON(availabilityUrl);
        sessionStorage.setItem(key, JSON.stringify(avail));
        renderAvailability(avail, city, tz, open, out);
      } catch (e) {
        try {
          const r = await fetch(`${API.availability}?city=${encodeURIComponent(cityName)}&from=${today}&to=${to}`);
          out.textContent = await r.text();
        } catch {
          out.textContent = JSON.stringify({ ok:false, error:e.message }, null, 2);
        }
        open.style.display = 'none';
      }
    });

    function renderAvailability(data, city, tz, open, out) {
      if (!data.ok) {
        out.textContent = JSON.stringify(data, null, 2);
        open.style.display = 'none';
        return;
      }

      const lines = (data.times || []).slice(0,120).map(t => `• ${t.readable} (${t.slots} slot${t.slots>1?'s':''})`);

      if (city.url) {
        open.href = city.url;
        open.textContent = `Book ${city.label || city.name}`;
        open.style.display = 'inline-block';
      } else if (city.baseUrl) {
        open.href = city.baseUrl;
        open.textContent = `Book ${city.label || city.name}`;
        open.style.display = 'inline-block';
      } else {
        open.style.display = 'none';
      }

      out.textContent = [
        `City: ${city.label || city.name}`,
        `Range: ${data.range.from} → ${data.range.to}`,
        `Timezone: ${data.timezone || tz}`,
        `Count: ${data.count}`,
        '',
        ...lines
      ].join('\n');
    }
  } catch(e) {
    status.textContent = 'Error';
    out.textContent = JSON.stringify({ ok:false, error:e.message, cities: [] }, null, 2);
    sel.disabled = true;
  }
})();

// Safety net for any stale '/api/locations1' markup
if (typeof window !== 'undefined' && /locations1\b/.test(document.documentElement.innerHTML)) {
  console.warn('Found stale /api/locations1 reference — should be /api/locations');
}
