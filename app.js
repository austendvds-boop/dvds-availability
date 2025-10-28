async function main() {
  const statusEl = document.getElementById('status');
  const sel = document.getElementById('location');
  const out = document.getElementById('out');
  const open = document.getElementById('open');

  const setStatus = (text) => {
    statusEl.textContent = text;
  };

  async function fetchLocations() {
    try {
      const response = await fetch('/api/locations', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.warn('Failed to fetch /api/locations:', error);
      return { ok: false, error: error.message, cities: [] };
    }
  }

  setStatus('Fetching…');
  const data = await fetchLocations();

  if (data.ok && Array.isArray(data.cities) && data.cities.length) {
    setStatus('Ready');
    const options = ['<option value="">Select a location…</option>'];
    data.cities.forEach((city) => {
      const name = city.name || city.key;
      options.push(`<option value="${encodeURIComponent(name)}">${name}</option>`);
    });
    sel.innerHTML = options.join('');
    sel.disabled = false;

    const showCity = (name) => {
      const decoded = decodeURIComponent(name);
      const city = data.cities.find((c) => (c.name || c.key) === decoded);
      if (!city) {
        out.textContent = '';
        open.style.display = 'none';
        return;
      }
      out.textContent = JSON.stringify(city, null, 2);
      const targetUrl = city.calendar || city.url;
      if (targetUrl) {
        open.href = targetUrl;
        open.textContent = `Open ${decoded} calendar`;
        open.style.display = 'inline-block';
      } else {
        open.style.display = 'none';
      }
    };

    sel.addEventListener('change', () => {
      if (sel.value) {
        showCity(sel.value);
      } else {
        out.textContent = '';
        open.style.display = 'none';
      }
    });

    const firstCity = data.cities[0];
    if (firstCity) {
      const firstName = encodeURIComponent(firstCity.name || firstCity.key);
      sel.value = firstName;
      showCity(firstName);
    }
  } else {
    setStatus('Error');
    sel.innerHTML = '';
    sel.disabled = true;
    out.textContent = JSON.stringify(data, null, 2);
    open.style.display = 'none';
  }
}

main();
