(async () => {
  const status = document.getElementById('status');
  const sel = document.getElementById('location');
  try {
    const r = await fetch('/api/locations');
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'Failed to load locations');
    sel.innerHTML = '';
    for (const l of data.locations) {
      const opt = document.createElement('option');
      opt.value = l.key;
      opt.textContent = l.isConfigured ? l.label : `${l.label} — ⚠ configure`;
      if (!l.isConfigured) opt.disabled = true;
      sel.appendChild(opt);
    }
    status.textContent = data.locations.length ? 'Ready' : 'No locations';
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
  }
})();
