const API = {
  locations: '/api/locations',
  availability: '/api/availability',
  env: '/api/env-check'
};

const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const state = {
  cities: [],
  city: null,
  y: null,
  m: null,
  cache: new Map(),
  env: null,
  inFlight: null
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
  'westvalley': { owner: 23214568, packages: { early: 2074922 } },
  'anthem': { owner: 28722957, packages: { ultimate: 2074776, license: 2074779, early: 2074780, intro: 2074782, express: 2074783 } },
  'glendale': { owner: 28722957, packages: { ultimate: 2070512, license: 2070501, early: 2070518, intro: 2070516, express: 2070525 } },
  'north-phoenix': { owner: 28722957, packages: { ultimate: 2074607, license: 2074609, early: 2074610, intro: 2074770, express: 2074774 } },
  'peoria': { owner: 28722957, packages: { ultimate: 2074842, license: 2074844, early: 2074846, intro: 2074847, express: 2074848 } },
  'sun-city': { owner: 28722957, packages: { ultimate: 2074900, license: 2074901, early: 2074902, intro: 2074904, express: 2074905 } },
  'surprise': { owner: 28722957, packages: { ultimate: 2074885, license: 2074886, early: 2074887, intro: 2074888, express: 2074890 } }
};

const PACKAGE_NOTES = {
  'casa-grande': 'Casa Grande currently offers only the Early Bird package.',
  'westvalley': 'West Valley currently offers only the Early Bird package.'
};

const packageSection = typeof document !== 'undefined' ? document.getElementById('packages') : null;
const packageGrid = typeof document !== 'undefined' ? document.getElementById('packageGrid') : null;
const packageNote = typeof document !== 'undefined' ? document.getElementById('packages-note') : null;

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
  const sel = document.getElementById('location');
  const times = document.getElementById('times');
  const title = document.getElementById('paneltitle');
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');

  try{
    const [loc, env] = await Promise.all([
      getJSON(API.locations),
      getJSON(API.env).catch(()=>null)
    ]);

    if(!loc.ok) throw new Error(loc.error || 'locations failed');

    state.env = env;
    state.cities = loc.cities;
    sel.innerHTML = '<option value="">Select a location…</option>' +
      loc.cities.map(c => `<option value="${encodeURIComponent(c.name)}">${c.label || c.name}</option>`).join('');
    sel.disabled = false;
    status.textContent = 'Ready';

    renderPackages(null);
    if(times){ times.innerHTML = '<div class="emptymsg">Select a location to view availability.</div>'; }
    if(title){ title.textContent = 'Select a day'; }

    sel.addEventListener('change', async () => {
      const name = decodeURIComponent(sel.value || '');
      if(!name){
        state.city = null;
        renderPackages(null);
        ui.selectedDay = null;
        if(times){ times.innerHTML = '<div class="emptymsg">Select a location to view availability.</div>'; }
        if(title){ title.textContent = 'Select a day'; }
        return;
      }
      state.city = loc.cities.find(c => c.name === name || c.label === name) || loc.cities.find(c=>c.name===name);

      renderPackages(state.city);

      const today = new Date();
      await loadMonth(today.getFullYear(), today.getMonth()+1);
    });

    prev.addEventListener('click', async ()=>{
      if(!state.city) return;
      const m = state.m===1 ? 12 : state.m-1;
      const y = state.m===1 ? state.y-1 : state.y;
      await loadMonth(y,m);
    });
    next.addEventListener('click', async ()=>{
      if(!state.city) return;
      const m = state.m===12 ? 1 : state.m+1;
      const y = state.m===12 ? state.y+1 : state.y;
      await loadMonth(y,m);
    });
  }catch(e){
    status.textContent = 'Error';
    times.textContent = JSON.stringify({ ok:false, error:e.message, cities:[] }, null, 2);
    sel.disabled = true;
    renderPackages(null);
  }
})();

if (typeof window !== 'undefined' && /locations1\b/.test(document.documentElement.innerHTML)) {
  console.warn('Found stale /api/locations1 reference — should be /api/locations');
}
