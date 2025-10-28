async function getJSON(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function boot() {
  const status = document.getElementById('status');
  const sel = document.getElementById('location');
  const out = document.getElementById('out');
  const open = document.getElementById('open');

  try {
    status.textContent = 'Loading…';
    const { ok, cities, error } = await getJSON('/api/locations');
    if (!ok) {
      throw new Error(error || 'locations failed');
    }

    sel.innerHTML =
      '<option value="">Select a location…</option>' +
      cities
        .map((c) => {
          const value = encodeURIComponent(c.name);
          const label = c.label || c.name;
          return `<option value="${value}">${label}</option>`;
        })
        .join('');
    sel.disabled = false;
    status.textContent = 'Ready';

    sel.addEventListener('change', async () => {
      const city = decodeURIComponent(sel.value || '');
      if (!city) {
        open.style.display = 'none';
        out.textContent = 'Select a location to view availability.';
        return;
      }

      out.textContent = 'Fetching availability…';
      try {
        const today = new Date().toISOString().slice(0, 10);
        const to = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
        const data = await getJSON(
          `/api/availability?city=${encodeURIComponent(city)}&from=${today}&to=${to}`
        );
        out.textContent = JSON.stringify(data, null, 2);

        const cityInfo = cities.find((c) => c.name === city);
        if (data.ok && data.times?.length && cityInfo?.url) {
          open.href = cityInfo.url;
          open.textContent = `Open ${cityInfo.label || cityInfo.name} calendar`;
          open.style.display = 'inline-block';
        } else {
          open.style.display = 'none';
        }
      } catch (err) {
        out.textContent = JSON.stringify({ ok: false, error: err.message }, null, 2);
        open.style.display = 'none';
      }
    });
  } catch (err) {
    status.textContent = 'Error';
    out.textContent = JSON.stringify({ ok: false, error: err.message, cities: [] }, null, 2);
    sel.disabled = true;
  }
}

boot();
