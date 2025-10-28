(async () => {
  const status = document.getElementById('status');
  const sel = document.getElementById('location');
  const out = document.getElementById('out');
  try {
    const r = await fetch('/api/locations');
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'Failed to load locations');
    sel.innerHTML = '';
    data.locations.forEach(l=>{
      const opt = document.createElement('option');
      opt.value = l.key;
      opt.textContent = l.isConfigured ? l.label : `${l.label} — ⚠ configure`;
      if (!l.isConfigured) opt.disabled = true;
      sel.appendChild(opt);
    });
    status.textContent = data.locations.length ? 'Ready' : 'No locations';
    out.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    status.textContent = 'Error';
    out.textContent = e.message;
  }
})();
