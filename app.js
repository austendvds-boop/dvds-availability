const API = {
  locations: '/api/locations',
  availability: '/api/availability',
  env: '/api/env-check'
};

const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const state = {
  cities: [],
  city: null,
  cityIndex: new Map(),
  y: null,
  m: null,
  cache: new Map(),
  env: null,
  inFlight: null,
  googleKey: null,
  googleReady: false,
  autocomplete: null
};

const ui = { selectedDay: null };

const PACKAGE_CATALOG = {
  ultimate: { emoji: '🚀', title: 'Ultimate Package', details: '8 Lessons · 2.5 Hours Each (20 Hours Total)' },
  license: { emoji: '🏁', title: 'License Ready Package', details: '4 Lessons · 2.5 Hours Each (10 Hours Total)' },
  early: { emoji: '🌅', title: 'Early Bird Package', details: '2 Lessons · 5 Hours Total · Weekday mornings only' },
  intro: { emoji: '🚘', title: 'Intro to Driving Package', details: '2 Lessons · 5 Hours Total' },
  express: { emoji: '⚡', title: 'Express Lesson', details: '1 Lesson · 2.5 Hours Total' }
};

const PACKAGE_ORDER = ['ultimate', 'license', 'early', 'intro', 'express'];

const PACKAGE_LINKS = {
  'apache-junction': { owner: 23214568, packages: { ultimate: 2074785, license: 2074786, early: 2074789, intro: 2074791, express: 2074784 } },
  'awatukee': { owner: 23214568, packages: { ultimate: 2074794, license: 2074797, early: 2074799, intro: 2074800, express: 2074801 } },
  'casa-grande': { owner: 23214568, packages: { early: 2074803 } },
  'cave-creek': { owner: 23214568, packages: { ultimate: 2074805, license: 2074806, early: 2074807, intro: 2074808, express: 2074809 } },
  'chandler': { owner: 23214568, packages: { ultimate: 2074812, license: 2074813, early: 2074814, intro: 2074815, express: 2074816 } },
  'downtown-phoenix': { owner: 23214568, packages: { ultimate: 2074818, license: 2074819, early: 2074820, intro: 2074821, express: 2074823 } },
  'gilbert': { owner: 23214568, packages: { ultimate: 2074824, license: 2074826, early: 2074827, intro: 2074829, express: 2074831 } },
  'mesa': { owner: 23214568, packages: { ultimate: 2074833, license: 2074834, early: 2074837, intro: 2074838, express: 2074839 } },
  'queen-creek': { owner: 23214568, packages: { ultimate: 2074849, license: 2074850, early: 2074851, intro: 2074852, express: 2074854 } },
  'san-tan-valley': { owner: 23214568, packages: { ultimate: 2074861, license: 2074864, early: 2074865, intro: 2074867, express: 2074868 } },
  'scottsdale': { owner: 23214568, packages: { ultimate: 2074871, license: 2074872, early: 2074875, intro: 2074879, express: 2074881 } },
  'tempe': { owner: 23214568, packages: { ultimate: 2074908, license: 2074909, early: 2074913, intro: 2074918, express: 2074920 } },
  'buckeye': { owner: 23214568, packages: { early: 2074922 } },
  'tolleson': { owner: 23214568, packages: { early: 2074922 } },
  'laveen': { owner: 23214568, packages: { early: 2074922 } },
  'anthem': { owner: 28722957, packages: { ultimate: 2074776, license: 2074779, early: 2074780, intro: 2074782, express: 2074783 } },
  'glendale': { owner: 28722957, packages: { ultimate: 2070512, license: 2070501, early: 2070518, intro: 2070516, express: 2070525 } },
  'north-phoenix': { owner: 28722957, packages: { ultimate: 2074607, license: 2074609, early: 2074610, intro: 2074770, express: 2074774 } },
  'peoria': { owner: 28722957, packages: { ultimate: 2074842, license: 2074844, early: 2074846, intro: 2074847, express: 2074848 } },
  'sun-city': { owner: 28722957, packages: { ultimate: 2074900, license: 2074901, early: 2074902, intro: 2074904, express: 2074905 } },
  'surprise': { owner: 28722957, packages: { ultimate: 2074885, license: 2074886, early: 2074887, intro: 2074888, express: 2074890 } }
};

const PACKAGE_NOTES = {
  'casa-grande': 'Casa Grande currently offers only the Early Bird package.',
  'buckeye': 'Buckeye currently offers only the Early Bird package.',
  'tolleson': 'Tolleson currently offers only the Early Bird package.',
  'laveen': 'Laveen currently offers only the Early Bird package.'
};

const packageSection = typeof document !== 'undefined' ? document.getElementById('packages') : null;
const packageGrid = typeof document !== 'undefined' ? document.getElementById('packageGrid') : null;
const packageNote = typeof document !== 'undefined' ? document.getElementById('packages-note') : null;

const finderMessageEl = typeof document !== 'undefined' ? document.getElementById('finder-message') : null;

const CITY_ALIAS_MAP = new Map([
  ['apache junction', 'apache-junction'],
  ['apachejunction', 'apache-junction'],
  ['aj', 'apache-junction'],
  ['anthem', 'anthem'],
  ['ahwatukee', 'awatukee'],
  ['awatukee', 'awatukee'],
  ['casa grande', 'casa-grande'],
  ['casa-grande', 'casa-grande'],
  ['cave creek', 'cave-creek'],
  ['cavecreek', 'cave-creek'],
  ['chandler', 'chandler'],
  ['downtown phoenix', 'downtown-phoenix'],
  ['downtown phx', 'downtown-phoenix'],
  ['central phoenix', 'downtown-phoenix'],
  ['central phx', 'downtown-phoenix'],
  ['gilbert', 'gilbert'],
  ['mesa', 'mesa'],
  ['queen creek', 'queen-creek'],
  ['queencreek', 'queen-creek'],
  ['san tan valley', 'san-tan-valley'],
  ['santan valley', 'san-tan-valley'],
  ['san tan', 'san-tan-valley'],
  ['scottsdale', 'scottsdale'],
  ['tempe', 'tempe'],
  ['buckeye', 'buckeye'],
  ['tolleson', 'tolleson'],
  ['laveen', 'laveen'],
  ['maryvale', 'tolleson'],
  ['desert hills', 'anthem'],
  ['new river', 'anthem'],
  ['north phoenix', 'north-phoenix'],
  ['north phx', 'north-phoenix'],
  ['north valley', 'north-phoenix'],
  ['phx', 'phoenix'],
  ['phoenix', 'phoenix'],
  ['phoenix az', 'phoenix'],
  ['sun city', 'sun-city'],
  ['surprise', 'surprise'],
  ['peoria', 'peoria'],
  ['glendale', 'glendale'],
  ['downtown', 'downtown-phoenix'],
  ['desert ridge', 'north-phoenix'],
  ['arcadia', 'downtown-phoenix']
]);

const CITY_CENTROIDS = {
  'apache-junction': { lat: 33.415, lng: -111.5496 },
  'awatukee': { lat: 33.3191, lng: -111.986 },
  'casa-grande': { lat: 32.8795, lng: -111.7574 },
  'cave-creek': { lat: 33.8334, lng: -111.9507 },
  'downtown-phoenix': { lat: 33.4484, lng: -112.074 },
  'gilbert': { lat: 33.3528, lng: -111.789 },
  'mesa': { lat: 33.4152, lng: -111.8315 },
  'queen-creek': { lat: 33.2484, lng: -111.6343 },
  'san-tan-valley': { lat: 33.1934, lng: -111.528 },
  'scottsdale': { lat: 33.4942, lng: -111.9261 },
  'tempe': { lat: 33.4255, lng: -111.94 },
  'buckeye': { lat: 33.3703, lng: -112.5838 },
  'tolleson': { lat: 33.4501, lng: -112.259 },
  'laveen': { lat: 33.3628, lng: -112.1667 },
  'anthem': { lat: 33.8673, lng: -112.1469 },
  'glendale': { lat: 33.5387, lng: -112.186 },
  'north-phoenix': { lat: 33.6801, lng: -112.074 },
  'peoria': { lat: 33.5806, lng: -112.2374 },
  'sun-city': { lat: 33.6086, lng: -112.2718 },
  'surprise': { lat: 33.6292, lng: -112.3679 },
  'chandler': { lat: 33.3062, lng: -111.8413 }
};

const PHOENIX_SUBAREAS = new Map([
  ['laveen', 'laveen'],
  ['maryvale', 'tolleson'],
  ['ahwatukee', 'awatukee'],
  ['awatukee', 'awatukee'],
  ['desert hills', 'anthem'],
  ['new river', 'anthem'],
  ['desert ridge', 'north-phoenix'],
  ['north valley', 'north-phoenix'],
  ['north phoenix', 'north-phoenix'],
  ['west phoenix', 'tolleson'],
  ['south mountain', 'laveen']
]);

function buildPackageList(slug){
  const entry = PACKAGE_LINKS[slug];
  if(!entry || !entry.owner || !entry.packages) return [];
  const { owner, packages } = entry;
  const base = 'https://app.acuityscheduling.com/catalog.php';
  const list = [];
  for(const key of PACKAGE_ORDER){
    const id = packages[key];
    if(!id) continue;
    const meta = PACKAGE_CATALOG[key];
    if(!meta) continue;
    const url = `${base}?owner=${owner}&action=addCart&clear=1&id=${id}`;
    list.push({ ...meta, url });
  }
  return list;
}

function renderPackages(city){
  if(!packageSection || !packageGrid) return;
  const slug = city?.name || city?.key || '';
  const list = buildPackageList(slug);
  if(!list.length){
    packageSection.classList.add('hidden');
    packageGrid.innerHTML = '';
    if(packageNote){
      packageNote.textContent = '';
      packageNote.classList.add('hidden');
    }
    return;
  }

  packageGrid.innerHTML = list.map(pkg => {
    return `
      <article class="package-card">
        <div class="package-header">
          <span class="package-emoji">${pkg.emoji}</span>
          <span class="package-name">${pkg.title}</span>
        </div>
        <div class="package-details">${pkg.details}</div>
        <a class="package-cta" href="${pkg.url}" target="_blank" rel="noopener">Book now →</a>
      </article>
    `;
  }).join('');

  if(packageNote){
    const note = PACKAGE_NOTES[slug];
    if(note){
      packageNote.textContent = note;
      packageNote.classList.remove('hidden');
    }else{
      packageNote.textContent = '';
      packageNote.classList.add('hidden');
    }
  }

  packageSection.classList.remove('hidden');
}

function normalizeToken(value){
  if(!value || typeof value !== 'string') return '';
  return value.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}

function slugFromAlias(value){
  const key = normalizeToken(value);
  return key ? CITY_ALIAS_MAP.get(key) || null : null;
}

function toRadians(deg){ return deg * (Math.PI/180); }

function distanceMiles(lat1,lng1,lat2,lng2){
  const R = 3958.8; // Earth radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function nearestCity(lat,lng){
  let winner = null;
  for(const [slug, coords] of Object.entries(CITY_CENTROIDS)){
    if(typeof coords?.lat !== 'number' || typeof coords?.lng !== 'number') continue;
    const dist = distanceMiles(lat, lng, coords.lat, coords.lng);
    if(dist <= 20 && (!winner || dist < winner.distance)){
      winner = { slug, distance: dist };
    }
  }
  return winner;
}

function showFinderMessage(text, mode){
  if(!finderMessageEl) return;
  finderMessageEl.textContent = text;
  finderMessageEl.classList.remove('error','success');
  if(mode === 'error'){ finderMessageEl.classList.add('error'); }
  else if(mode === 'success'){ finderMessageEl.classList.add('success'); }
}

let mapsPromise = null;

function ensureGoogleMaps(key){
  if(!key) return Promise.reject(new Error('missing Google Maps key'));
  if(mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    if(typeof window === 'undefined'){ resolve(null); return; }
    const existing = document.querySelector('script[data-google-maps]');
    if(existing){
      existing.addEventListener('load', () => resolve(window.google || null));
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=__initMaps`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = 'true';
    window.__initMaps = () => {
      resolve(window.google || null);
      delete window.__initMaps;
    };
    script.addEventListener('error', () => {
      delete window.__initMaps;
      reject(new Error('Google Maps failed to load'));
    });
    document.head.appendChild(script);
  });
  return mapsPromise;
}

function parseAddressComponents(components){
  if(!Array.isArray(components)) return {};
  const find = (...types) => components.find(c => types.every(t => c.types.includes(t)));
  const cityComp = components.find(c => c.types.includes('locality'))
    || components.find(c => c.types.includes('postal_town'))
    || components.find(c => c.types.includes('sublocality_level_1'))
    || components.find(c => c.types.includes('administrative_area_level_3'));
  const stateComp = find('administrative_area_level_1');
  const postalComp = components.find(c => c.types.includes('postal_code'));
  const sublocalities = components
    .filter(c => c.types.some(t => t.startsWith('sublocality')))
    .map(c => c.long_name?.toLowerCase?.() || '')
    .filter(Boolean);

  return {
    city: cityComp?.long_name || '',
    state: stateComp?.short_name || '',
    postal: postalComp?.long_name || '',
    sublocalities
  };
}

function normalizePlace(place, query){
  if(!place) return null;
  const { city, state, postal, sublocalities } = parseAddressComponents(place.address_components);
  let lat = null, lng = null;
  const loc = place.geometry?.location;
  if(loc){
    lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
    lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
  }
  const types = Array.isArray(place.types) ? place.types.slice() : [];
  return {
    raw: query || place.formatted_address || place.name || '',
    city,
    state,
    postal,
    sublocalities,
    lat: typeof lat === 'number' ? lat : null,
    lng: typeof lng === 'number' ? lng : null,
    isZip: types.includes('postal_code'),
    types,
    slugHint: slugFromAlias(city),
    source: 'autocomplete'
  };
}

function normalizeGeocode(result, query, { isZip=false } = {}){
  if(!result) return null;
  const { city, state, postal, sublocalities } = parseAddressComponents(result.address_components);
  const loc = result.geometry?.location;
  let lat = null, lng = null;
  if(loc){
    lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
    lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
  }else if(result.geometry?.location_type && result.geometry?.bounds){
    // fallback for API returning plain objects
    lat = result.geometry?.location?.lat ?? null;
    lng = result.geometry?.location?.lng ?? null;
  }
  return {
    raw: query,
    city,
    state,
    postal,
    sublocalities,
    lat: typeof lat === 'number' ? lat : null,
    lng: typeof lng === 'number' ? lng : null,
    isZip,
    slugHint: slugFromAlias(city),
    source: 'geocode'
  };
}

async function geocodeAddress(query){
  if(!state.googleKey) throw new Error('Google Maps key unavailable');
  const params = new URLSearchParams({ address: query, key: state.googleKey, components: 'country:US' });
  const resp = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
  if(!resp.ok) throw new Error(`Geocode HTTP ${resp.status}`);
  const data = await resp.json();
  if(data.status !== 'OK' || !Array.isArray(data.results) || !data.results.length){
    throw new Error(data.error_message || data.status || 'No geocode results');
  }
  return data.results[0];
}

function phoenixBand(lat){
  if(typeof lat !== 'number') return null;
  if(lat > 33.8) return 'anthem';
  if(lat > 33.5236) return 'north-phoenix';
  if(lat > 33.36) return 'downtown-phoenix';
  return 'awatukee';
}

function detectPhoenixSubarea(normalized, rawLower){
  const haystack = [rawLower, normalizeToken(normalized.city), ...(normalized.sublocalities||[])].filter(Boolean);
  for(const chunk of haystack){
    const alias = slugFromAlias(chunk);
    if(alias && alias !== 'phoenix') return alias;
    for(const [needle, slug] of PHOENIX_SUBAREAS.entries()){
      if(chunk.includes(needle)) return slug;
    }
  }
  return null;
}

function isGeneralPhoenix(normalized){
  if(!normalized) return false;
  const raw = normalized.raw || '';
  const rawHasZip = /\b\d{5}(?:-\d{4})?\b/.test(raw);
  const hasSub = Array.isArray(normalized.sublocalities) && normalized.sublocalities.length > 0;
  const types = normalized.types || [];
  const onlyLocality = types.length && types.every(t => t === 'locality' || t === 'political');
  return !rawHasZip && !normalized.postal && !hasSub && (onlyLocality || !normalized.lat);
}

function resolveNormalized(normalized){
  if(!normalized) return { error: 'We could not understand that location.' };
  const rawLower = normalizeToken(normalized.raw);
  const cityLower = normalizeToken(normalized.city);

  if(normalized.state && normalized.state !== 'AZ'){
    return { error: 'Outside our service area.' };
  }

  let slug = normalized.slugHint;
  if(!slug) slug = slugFromAlias(cityLower);
  if(!slug) slug = slugFromAlias(rawLower);

  if(slug && slug !== 'phoenix'){
    const city = lookupCity(slug);
    if(city) return { city, slug, meta:{ method:'direct' } };
  }

  if((slug === 'phoenix') || cityLower === 'phoenix' || (rawLower && rawLower.includes('phoenix'))){
    const sub = detectPhoenixSubarea(normalized, rawLower);
    if(sub){
      const city = lookupCity(sub);
      if(city) return { city, slug: sub, meta:{ method:'phoenix-subarea' } };
    }
    if(isGeneralPhoenix(normalized)){
      return { error: 'Phoenix spans multiple service areas. Please include a ZIP code to continue.' };
    }
    const latSlug = phoenixBand(normalized.lat);
    if(latSlug){
      const city = lookupCity(latSlug);
      if(city) return { city, slug: latSlug, meta:{ method:'phoenix-band' } };
    }
    return { error: 'We still need a Phoenix ZIP code to finish routing you.' };
  }

  if(!slug && typeof normalized.lat === 'number' && typeof normalized.lng === 'number'){
    const nearby = nearestCity(normalized.lat, normalized.lng);
    if(nearby){
      const city = lookupCity(nearby.slug);
      if(city) return { city, slug: nearby.slug, meta:{ method:'proximity', distance: nearby.distance } };
    }
  }

  if(slug){
    const city = lookupCity(slug);
    if(city) return { city, slug, meta:{ method:'direct' } };
  }

  return { error: 'We could not match that location. Please try again or call 602-663-3502.' };
}

function lookupCity(key){
  if(!key) return null;
  if(state.cityIndex.has(key)) return state.cityIndex.get(key);
  return state.cities.find(c => c.name === key || c.key === key) || null;
}

function resetCalendarUI(){
  const grid   = document.getElementById('grid');
  const times  = document.getElementById('times');
  const title  = document.getElementById('paneltitle');
  const label  = document.getElementById('monthlabel');
  ui.selectedDay = null;
  state.y = null; state.m = null;
  if(grid) grid.innerHTML = '';
  if(times) times.innerHTML = '<div class="emptymsg">Search for a city to view availability.</div>';
  if(title) title.textContent = 'Select a day';
  if(label) label.textContent = '—';
}

function clearCity(){
  state.city = null;
  if(state.inFlight){
    try{ state.inFlight.abort(); }catch{}
    state.inFlight = null;
  }
  renderPackages(null);
  resetCalendarUI();
}

async function applyResolution(result, normalized){
  const status = document.getElementById('status');
  const times = document.getElementById('times');
  const title = document.getElementById('paneltitle');

  if(result.error){
    showFinderMessage(`${result.error} Call 602-663-3502 for help.`, 'error');
    if(!state.city){
      resetCalendarUI();
      renderPackages(null);
    }
    return;
  }

  const city = result.city;
  if(!city){
    showFinderMessage('We could not match that location. Call 602-663-3502 for help.', 'error');
    return;
  }

  state.city = city;
  showFinderMessage(`Showing availability for ${city.label || city.name}.`, 'success');
  renderPackages(city);

  if(times){
    times.innerHTML = '<div class="emptymsg">Select a day to view available times.</div>';
  }
  if(title){
    title.textContent = 'Select a day';
  }

  const today = new Date();
  await loadMonth(today.getFullYear(), today.getMonth()+1);

  if(status){
    status.textContent = 'Ready';
  }
}

async function processQuery({ query, place }){
  const trimmed = (query || '').trim();
  if(!trimmed){
    showFinderMessage('Search for your city or ZIP to view the packages available in your area.');
    clearCity();
    return;
  }

  showFinderMessage('Matching your location…');

  try {
    let normalized = null;
    const directSlug = slugFromAlias(trimmed);
    const isZip = /^\d{5}(?:-\d{4})?$/.test(trimmed);

    if(place){
      normalized = normalizePlace(place, trimmed);
    }

    if(!normalized && directSlug && directSlug !== 'phoenix'){
      const city = lookupCity(directSlug);
      const coords = CITY_CENTROIDS[directSlug] || {};
      normalized = {
        raw: trimmed,
        city: city?.label || city?.name || trimmed,
        state: 'AZ',
        postal: isZip ? trimmed : '',
        sublocalities: [],
        lat: typeof coords.lat === 'number' ? coords.lat : null,
        lng: typeof coords.lng === 'number' ? coords.lng : null,
        isZip,
        slugHint: directSlug,
        source: 'direct'
      };
    }

    if(!normalized && directSlug === 'phoenix'){
      normalized = {
        raw: trimmed,
        city: 'Phoenix',
        state: 'AZ',
        postal: '',
        sublocalities: [],
        lat: null,
        lng: null,
        isZip,
        slugHint: 'phoenix',
        source: 'direct'
      };
    }

    if(!normalized){
      if(!state.googleKey){
        throw new Error('Maps key unavailable');
      }
      const geoResult = await geocodeAddress(trimmed);
      normalized = normalizeGeocode(geoResult, trimmed, { isZip });
    }

    if(normalized && (!normalized.lat || !normalized.lng) && normalized.slugHint && CITY_CENTROIDS[normalized.slugHint]){
      const coords = CITY_CENTROIDS[normalized.slugHint];
      normalized.lat = typeof normalized.lat === 'number' ? normalized.lat : coords.lat;
      normalized.lng = typeof normalized.lng === 'number' ? normalized.lng : coords.lng;
    }

    const resolution = resolveNormalized(normalized);
    await applyResolution(resolution, normalized);
  } catch (err) {
    console.error('Location lookup failed', err);
    showFinderMessage('We could not look up that location. Please try again or call 602-663-3502.', 'error');
    if(!state.city){
      clearCity();
    }
  }
}

async function handleQuery(query){
  return processQuery({ query });
}

function ymd(d){ return new Date(d).toISOString().slice(0,10); }
function firstOfMonth(y,m){ return `${y}-${String(m).padStart(2,'0')}-01`; }
function lastOfMonth(y,m){ return ymd(new Date(y, m, 0)); }
function labelOf(y,m){
  return new Date(`${y}-${String(m).padStart(2,'0')}-01T00:00:00`).toLocaleString('en-US',{ month:'long', year:'numeric' });
}
function startDowMonday(dateStr){
  const d = new Date(dateStr+'T00:00:00');
  return (d.getDay() + 6) % 7;
}
function monthKey(city,y,m){ return `${city}|${y}-${String(m).padStart(2,'0')}`; }
function sset(k,v){ try{ sessionStorage.setItem(k, JSON.stringify(v)); }catch{} }
function sget(k){ try{ const t=sessionStorage.getItem(k); return t?JSON.parse(t):null; }catch{ return null; } }

async function getJSON(url, signal){
  const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now(), { cache:'no-store', signal });
  if(!r.ok){
    let body=null; try{ body=await r.json(); }catch{}
    const msg = body && (body.detail || body.error)
      ? `${body.error||''} ${typeof body.detail==='string'?body.detail:JSON.stringify(body.detail)}`.trim()
      : `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return r.json();
}

function buildGrid(days, availByDate){
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  DOW.forEach(d => {
    const el = document.createElement('div');
    el.className = 'dow';
    el.textContent = d;
    grid.appendChild(el);
  });

  const today = new Date(); today.setHours(0,0,0,0);
  const todayYMD = ymd(today);

  let lead = startDowMonday(days[0]);
  for(let i=0;i<lead;i++){
    const pad=document.createElement('div'); pad.className='cell'; grid.appendChild(pad);
  }

  days.forEach(dstr=>{
    const d = new Date(dstr+'T00:00:00');
    const el = document.createElement('div');
    el.className = 'cell';
    const dateEl = document.createElement('div');
    dateEl.className='date';
    dateEl.textContent = String(d.getDate());
    el.appendChild(dateEl);

    const isPast = d < today;
    const list = availByDate.get(dstr) || [];
    const isEmptyFuture = !isPast && list.length === 0;

    if(dstr === todayYMD){
      el.classList.add('today');
    }

    if(isPast){
      el.classList.add('past','disabled');
    } else if(isEmptyFuture){
      el.classList.add('empty');
    } else if(list.length){
      el.classList.add('clickable');
      const dot = document.createElement('div');
      dot.className='badge';
      dot.textContent = `${list.length}×`;
      el.appendChild(dot);
      el.addEventListener('click', () => {
        ui.selectedDay = dstr;
        highlightActive(grid);
        showTimes(dstr, list);
      });
    }

    if(ui.selectedDay === dstr){
      el.classList.add('active');
    }

    grid.appendChild(el);
  });

  highlightActive(grid);
}

function highlightActive(grid){
  grid.querySelectorAll('.cell.active').forEach(node => node.classList.remove('active'));
  if(!ui.selectedDay) return;
  const cells = Array.from(grid.querySelectorAll('.cell'));
  const targetDay = new Date(ui.selectedDay+'T00:00:00').getDate();
  for(const cell of cells){
    if(cell.classList.contains('past') || cell.classList.contains('empty')) continue;
    const num = cell.querySelector('.date')?.textContent?.trim();
    if(num && Number(num) === targetDay){
      cell.classList.add('active');
      break;
    }
  }
}

function showTimes(dateStr, list){
  const title = document.getElementById('paneltitle');
  const times = document.getElementById('times');
  const human = new Date(dateStr+'T12:00:00').toLocaleDateString('en-US',{weekday:'long', month:'long', day:'numeric'});
  title.textContent = human;

  if(!list.length){
    times.innerHTML = '<div class="emptymsg">No times available.</div>';
    return;
  }

  times.innerHTML = list.map(t => `<span class="pill">${t.readable.replace(':00 ', ' ')}</span>`).join('');
}

function drawMonth(data){
  const from = data.range.from;
  const [yy,mm] = from.split('-').map(Number);
  const end = lastOfMonth(yy,mm);
  const days = [];
  for(let d = new Date(from+'T00:00:00'); ymd(d) <= end; d.setDate(d.getDate()+1)){
    days.push(ymd(d));
  }
  const by = new Map();
  (data.times||[]).forEach(t => {
    const day = t.time.slice(0,10);
    if(!by.has(day)) by.set(day, []);
    by.get(day).push(t);
  });
  buildGrid(days, by);
}

function monthAfter(y,m){
  return m === 12 ? [y + 1, 1] : [y, m + 1];
}

function hasFutureAvailability(times){
  if(!Array.isArray(times) || !times.length) return false;
  const now = new Date();
  now.setHours(0,0,0,0);
  return times.some(slot => {
    const when = new Date(slot.time);
    return when >= now;
  });
}

async function loadMonth(y,m,{prefetch=true, autoAdvance=true, visited}={}){
  const status = document.getElementById('status');
  const label  = document.getElementById('monthlabel');
  const grid   = document.getElementById('grid');
  const times  = document.getElementById('times');
  const title  = document.getElementById('paneltitle');

  if(!state.city){
    return;
  }

  state.y=y; state.m=m;
  ui.selectedDay = null;
  label.textContent = labelOf(y,m);
  grid.innerHTML = '';
  for(let i=0;i<14;i++){ const sk=document.createElement('div'); sk.className='cell skeleton'; grid.appendChild(sk); }
  times.innerHTML = '<div class="emptymsg">Select a day to view available times.</div>';
  title.textContent = 'Select a day';

  const from = firstOfMonth(y,m);
  const to   = lastOfMonth(y,m);
  const key  = monthKey(state.city.name, y, m);

  const cached = state.cache.get(key) || sget(key);
  if(cached){
    drawMonth(cached);
  }

  if(state.inFlight) state.inFlight.abort();
  state.inFlight = new AbortController();

  try{
    const data = await getJSON(`${API.availability}?city=${encodeURIComponent(state.city.name)}&from=${from}&to=${to}`, state.inFlight.signal);
    if(!data.ok) throw new Error(data.error || 'availability failed');
    if (data.accountUsed && data.accountConfigured && data.accountUsed !== data.accountConfigured) {
      const note = { configured: data.accountConfigured, used: data.accountUsed };
      data.debugAccount = note;
      console.warn(`[availability] account override detected for ${state.city?.name || state.city?.label || 'city'}`, note);
    }
    sset(key, data); state.cache.set(key, data);
    drawMonth(data);
    status.textContent = 'Ready';

    if(autoAdvance){
      const monthEnd = new Date(to + 'T23:59:59');
      const today = new Date();
      today.setHours(0,0,0,0);
      if(monthEnd >= today && !hasFutureAvailability(data.times)){
        const marker = `${y}-${m}`;
        if(!visited){ visited = new Set(); }
        if(!visited.has(marker)) visited.add(marker);
        const [nextY, nextM] = monthAfter(y,m);
        const nextKey = `${nextY}-${nextM}`;
        if(!visited.has(nextKey) && visited.size <= 24){
          await loadMonth(nextY, nextM, { prefetch, autoAdvance:true, visited });
          return;
        }
      }
    }
  }catch(e){
    if(e.name === 'AbortError') return;
    status.textContent = 'Error';
    try {
      const resp = await fetch(`${API.availability}?city=${encodeURIComponent(state.city.name)}&from=${from}&to=${to}`);
      times.textContent = await resp.text();
    } catch {
      times.textContent = JSON.stringify({ ok:false, error:e.message }, null, 2);
    }
  }

  if(prefetch){
    const prevM = m===1 ? 12 : m-1, prevY = m===1 ? y-1 : y;
    const nextM = m===12? 1  : m+1, nextY = m===12? y+1 : y;
    prefetchMonth(prevY, prevM);
    prefetchMonth(nextY, nextM);
  }
}

async function prefetchMonth(y,m){
  if(!state.city) return;
  const key = monthKey(state.city.name, y, m);
  if(state.cache.has(key) || sget(key)) return;
  const from = firstOfMonth(y,m);
  const to   = lastOfMonth(y,m);
  try{
    const data = await getJSON(`${API.availability}?city=${encodeURIComponent(state.city.name)}&from=${from}&to=${to}`);
    if(data && data.ok){ sset(key,data); state.cache.set(key,data); }
  }catch{}
}

(async function boot(){
  const status = document.getElementById('status');
  const times = document.getElementById('times');
  const title = document.getElementById('paneltitle');
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  const finder = document.getElementById('finder');
  const finderInput = document.getElementById('finder-input');
  const clearBtn = document.getElementById('finder-clear');

  if(finderInput){ finderInput.disabled = true; }
  if(clearBtn){ clearBtn.disabled = true; }

  resetCalendarUI();
  renderPackages(null);

  const defaultMessage = 'Search for your city or ZIP to view the packages available in your area.';
  showFinderMessage(defaultMessage);

  try{
    const [loc, env] = await Promise.all([
      getJSON(API.locations),
      getJSON(API.env).catch(()=>null)
    ]);

    if(!loc.ok) throw new Error(loc.error || 'locations failed');

    state.env = env;
    state.cities = Array.isArray(loc.cities) ? loc.cities : [];
    state.cityIndex = new Map();
    state.cities.forEach((city) => {
      if(!city) return;
      const slug = city.name || city.key;
      if(slug) state.cityIndex.set(slug, city);
      if(city.key) state.cityIndex.set(city.key, city);
      if(city.label) state.cityIndex.set(normalizeToken(city.label), city);
    });

    if(status){ status.textContent = 'Ready'; }
    if(times){ times.innerHTML = '<div class="emptymsg">Search for a city to view availability.</div>'; }
    if(title){ title.textContent = 'Select a day'; }
    if(finderInput){ finderInput.disabled = false; }
    if(clearBtn){ clearBtn.disabled = false; }

    const mapsKey = env?.googlemapsapi || env?.googleMapsApiKey || env?.googleMapsKey || env?.GOOGLE_MAPS_API_KEY;
    if(mapsKey){
      state.googleKey = mapsKey;
      ensureGoogleMaps(mapsKey).then(google => {
        state.googleReady = !!google;
        if(!google || !finderInput) return;
        const autocomplete = new google.maps.places.Autocomplete(finderInput, {
          fields: ['address_components','geometry','formatted_address','name','types']
        });
        state.autocomplete = autocomplete;
        autocomplete.addListener('place_changed', async () => {
          const place = autocomplete.getPlace();
          if(!place || (!place.geometry && !place.address_components)){
            await handleQuery(finderInput.value || '');
            return;
          }
          await processQuery({ query: finderInput.value || place.formatted_address || '', place });
        });
      }).catch(err => {
        console.warn('Google Maps failed to load', err);
        showFinderMessage('Autocomplete is unavailable. Enter a full address or ZIP and press Enter.', 'error');
      });
    } else {
      showFinderMessage('Autocomplete is unavailable. Enter a full address or ZIP and press Enter.', 'error');
    }

    finder?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await handleQuery(finderInput?.value || '');
    });

    finderInput?.addEventListener('keydown', async (event) => {
      if(event.key === 'Enter'){
        event.preventDefault();
        await handleQuery(finderInput.value || '');
      }
    });

    clearBtn?.addEventListener('click', () => {
      if(finderInput){
        finderInput.value = '';
        finderInput.focus();
      }
      showFinderMessage(defaultMessage);
      clearCity();
    });

    prev?.addEventListener('click', async ()=>{
      if(!state.city) return;
      const m = state.m===1 ? 12 : state.m-1;
      const y = state.m===1 ? state.y-1 : state.y;
      await loadMonth(y,m);
    });
    next?.addEventListener('click', async ()=>{
      if(!state.city) return;
      const m = state.m===12 ? 1 : state.m+1;
      const y = state.m===12 ? state.y+1 : state.y;
      await loadMonth(y,m);
    });
  }catch(e){
    console.error('Boot failure', e);
    if(status){ status.textContent = 'Error'; }
    if(times){ times.textContent = JSON.stringify({ ok:false, error:e.message, cities:[] }, null, 2); }
    showFinderMessage('We could not load availability. Please call 602-663-3502.', 'error');
    renderPackages(null);
    if(finderInput){ finderInput.disabled = false; }
    if(clearBtn){ clearBtn.disabled = false; }
  }
})();

if (typeof window !== 'undefined' && /locations1\b/.test(document.documentElement.innerHTML)) {
  console.warn('Found stale /api/locations1 reference — should be /api/locations');
}
