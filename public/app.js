(async () => {
  const status = document.getElementById('status');
  const sel = document.getElementById('location');
  const out = document.getElementById('out');

  const setStatus = (text, isError = false) => {
    status.textContent = text;
    status.style.color = isError ? '#c00' : '';
  };

  try {
    const response = await fetch('/api/locations');
    const payload = await response.json();

    if (!payload.ok) {
      throw new Error(payload.error || 'Failed to load locations');
    }

    sel.innerHTML = '';
    payload.locations.forEach((location) => {
      const option = document.createElement('option');
      option.value = location.key;
      option.textContent = location.isConfigured
        ? location.label
        : `${location.label} — ⚠ configure`;
      if (!location.isConfigured) {
        option.disabled = true;
      }
      sel.appendChild(option);
    });

    setStatus(payload.locations.length ? 'Ready' : 'No locations');
    out.textContent = JSON.stringify(payload, null, 2);
  } catch (error) {
    console.error(error);
    setStatus('Error', true);
    out.textContent = String(error.message || error);
  }
})();
