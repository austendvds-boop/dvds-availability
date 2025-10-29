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

async function loadMonth(y,m,{prefetch=true}={}){
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
  const book = document.getElementById('book');
  const book2 = document.getElementById('book2');
  const times = document.getElementById('times');
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

    sel.addEventListener('change', async () => {
      const name = decodeURIComponent(sel.value || '');
      if(!name) return;
      state.city = loc.cities.find(c => c.name === name || c.label === name) || loc.cities.find(c=>c.name===name);

      if(state.city?.url){
        book.href = state.city.url;
        book2.href = state.city.url;
        book.textContent = `Book ${state.city.label||state.city.name}`;
        book2.textContent = `Book ${state.city.label||state.city.name}`;
        book.style.display = 'inline-block';
        book2.style.display = 'inline-block';
      } else if(state.city?.baseUrl){
        book.href = state.city.baseUrl;
        book2.href = state.city.baseUrl;
        book.textContent = `Book ${state.city.label||state.city.name}`;
        book2.textContent = `Book ${state.city.label||state.city.name}`;
        book.style.display = 'inline-block';
        book2.style.display = 'inline-block';
      } else {
        book.style.display = 'none';
        book2.style.display = 'none';
      }

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
  }
})();

if (typeof window !== 'undefined' && /locations1\b/.test(document.documentElement.innerHTML)) {
  console.warn('Found stale /api/locations1 reference — should be /api/locations');
}
