(async () => {
  const status = document.getElementById('status');
  const sel = document.getElementById('location');
  const out = document.getElementById('out');

  const formatLabel = (city) => {
    const pieces = [city.name || city.key];
    if (city.account) {
      pieces.push(`(${city.account})`);
    }
    if (!city.url) {
      pieces.push('⚠ configure');
    }
    return pieces.join(' ');
  };

  const renderDetails = (city) => {
    const details = {
      key: city.key,
      name: city.name,
      account: city.account,
      appointmentType: city.appointmentType,
      owner: city.owner,
      url: city.url,
      baseUrl: city.baseUrl,
    };
    out.textContent = JSON.stringify(details, null, 2);
  };

  try {
    const response = await fetch('/api/locations');
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'Failed to load locations');

    const cities = Array.isArray(data.cities) ? data.cities : [];
    sel.innerHTML = '';

    if (!cities.length) {
      status.textContent = 'No locations';
      out.textContent = 'No location data available.';
      return;
    }

    cities.forEach((city, idx) => {
      const opt = document.createElement('option');
      opt.value = city.key;
      opt.textContent = formatLabel(city);
      if (!city.url) {
        opt.disabled = true;
      }
      if (idx === 0 && !opt.disabled) {
        opt.selected = true;
        renderDetails(city);
      }
      sel.appendChild(opt);
    });

    sel.addEventListener('change', () => {
      const selected = cities.find((city) => city.key === sel.value);
      if (selected) {
        renderDetails(selected);
      }
    });

    status.textContent = 'Ready';
    if (!sel.value) {
      renderDetails(cities[0]);
    }
  } catch (error) {
    status.textContent = 'Error';
    out.textContent = error?.message || 'Failed to load locations';
  }
})();
