const API = { locations: '/api/locations' };

async function getJSON(url) {
  const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
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

    sel.innerHTML = '<option value="">Select a location…</option>' +
      data.cities.map(c => `<option value="${encodeURIComponent(c.name)}">${c.name}</option>`).join('');
    sel.disabled = false;
    status.textContent = 'Ready';

    sel.addEventListener('change', async () => {
      const name = decodeURIComponent(sel.value || '');
      const city = data.cities.find(c => c.name === name);
      if (!city) return;
      out.textContent = JSON.stringify(city, null, 2);
      if (city.url) {
        open.href = city.url;
        open.textContent = `Open ${city.name} calendar`;
        open.style.display = 'inline-block';
      } else {
        open.style.display = 'none';
      }
    });
  } catch(e) {
    status.textContent = 'Error';
    out.textContent = JSON.stringify({ ok:false, error: e.message, cities: [] }, null, 2);
    sel.disabled = true;
  }
})();
