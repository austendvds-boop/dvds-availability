// ui-packages.js — Colorful packages UI + city-aware links + location chip
// Append-only & read-only to existing logic. No edits to app.js/APIs/router.

(function(){
  /* ---------- Package label presets ---------- */
  const LABELS = [
    {key:'Ultimate',      title:'🥇 Ultimate — 20 hrs (8×2.5h) — $1,299', ribbon:'Best Value',       meta:'Includes MVD road test waiver + insurance waiver.', border:'border-ultimate'},
    {key:'License Ready', title:'🏁 License Ready — 10 hrs (4×2.5h) — $680', ribbon:'Most Purchased', meta:'Includes MVD road test waiver + insurance waiver.', border:'border-license'},
    {key:'Early Bird',    title:'🌅 Early Bird — 10 hrs (2×5h, M–F mornings) — $649',                meta:'Save with weekday morning sessions.',                border:'border-early'},
    {key:'Intro',         title:'🚘 Intro — 5 hrs (2×2.5h) — $350',                                   meta:'Focused fundamentals + confidence building.',        border:'border-intro'},
    {key:'Express',       title:'⚡ Express — 2.5 hrs (1 lesson) — $200',                              meta:'Single lesson. Great for refreshers.',               border:'border-express'}
  ];

  /* ---------- Helpers ---------- */
  const toKey = s => (s||'').toLowerCase().trim().replace(/\s+/g,' ');
  // Normalize common city typos/aliases
  const CITY_ALIASES = {
    'awatukee':'ahwatukee',
    'ahwatukee':'ahwatukee',
    'dtn phoenix':'downtown phoenix',
    'downtown phoenix':'downtown phoenix',
    'north phoenix':'north phoenix',
    'san tan valley':'san tan valley',
    'queen creek':'queen creek',
    'west valley':'west valley'
  };
  const DEFAULT_OWNER = '23214568';
  const CATALOG = owner => `https://app.acuityscheduling.com/catalog.php?owner=${owner}`;

  function normalizeCityName(raw){
    const k = toKey(raw);
    return CITY_ALIASES[k] || k;
  }

  function detectCity(){
    // Read-only detection; never mutates DOM state
    const fromData = document.querySelector('[data-current-city]')?.getAttribute('data-current-city');
    if (fromData) return fromData.trim();
    const header   = document.querySelector('.current-city,#current-city,[data-city]')?.textContent;
    if (header && header.trim()) return header.trim();
    const sel      = document.querySelector('select[name="city"],#city,.city-select');
    if (sel && sel.value) return sel.value.trim();
    return '';
  }

  function updateCityChip(city){
    const chip = document.getElementById('city-chip-name');
    if (chip) chip.textContent = city || '-';
  }

  function killDevText(){
    // Remove the diagnostic sentence if it exists
    const nodes = Array.from(document.querySelectorAll('*'));
    nodes.forEach(n=>{
      const t = (n.textContent||'').trim();
      if (t.startsWith('If the dropdown fills and availability renders')) {
        n.style.display='none';
        n.setAttribute('aria-hidden','true');
      }
    });
  }

  // Hide all "Book {City}" green CTAs anywhere (visual only)
  function hideCityCTAs(scope=document){
    const BOOK_RE = /^book\s+/i;
    Array.from(scope.querySelectorAll('button,a,[role="button"]')).forEach(el=>{
      if (el.classList.contains('kill-book-city')) return;
      const txt = (el.textContent||'').replace(/\s+/g,' ').trim();
      const lbl = (el.getAttribute('aria-label')||el.getAttribute('title')||'').trim();
      if (BOOK_RE.test(txt) || BOOK_RE.test(lbl)) el.classList.add('kill-book-city');
    });
  }

  /* ---------- Render ---------- */
  function renderForCity(city, map){
    updateCityChip(city);
    const rail = document.getElementById('pkg-rail'); if(!rail) return;
    rail.innerHTML = '';

    const norm = normalizeCityName(city);
    // Build a normalized lookup table once
    const normMap = {};
    Object.keys(map||{}).forEach(k=>{ normMap[normalizeCityName(k)] = map[k]; });

    const cityLinks = normMap[norm] || {};
    // Decide a fallback owner from the first link we see; else default main
    let fallbackOwner = DEFAULT_OWNER;
    try {
      const anyUrl = Object.values(cityLinks)[0];
      const m = /owner=(\d+)/.exec(anyUrl||'');
      if (m) fallbackOwner = m[1];
    } catch(_) {}

    const list = LABELS.map(def=>{
      const href = cityLinks[def.key] || CATALOG(fallbackOwner); // fallback to that city's catalog
      return {...def, href};
    });

    list.forEach(def=>{
      const a = document.createElement('a');
      a.className = 'pkg-card';
      a.href   = def.href;
      a.target = '_blank';
      a.rel    = 'noopener noreferrer';
      a.role   = 'listitem';
      a.innerHTML = `
        <span class="pkg-border ${def.border}"></span>
        <div class="pkg-title">${def.title}</div>
        <div class="pkg-meta">${def.meta || ''}</div>
        <div class="ribbons">
          ${def.ribbon ? `<span class="ribbon ${def.ribbon.includes('Best')?'best':'most'}">${def.ribbon}</span>` : ''}
        </div>
        <div class="pkg-meta" style="margin-top:4px">Opens in new tab →</div>
      `;
      rail.appendChild(a);
    });
  }

  // Debounce
  const debounce = (fn,ms)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };

  async function boot(){
    // Fetch city→package links (created earlier as package-links.json)
    let map = {};
    try{
      const res = await fetch('./package-links.json',{cache:'no-store'});
      if (res.ok) map = await res.json();
    }catch(_){ }

    // Make calendar shell a little branded (pure CSS class)
    (document.querySelector('#calendar') || document.querySelector('#calendar-container') || document.querySelector('.calendar'))?.classList.add('cal-brand');

    // Change location chip → focuses existing dropdown
    const change = document.getElementById('change-location');
    if (change){
      change.addEventListener('click', ()=>{
        const sel = document.querySelector('select[name="city"],#city,.city-select');
        if (sel){
          sel.focus();
          // Try to open native selects where allowed
          ['pointerdown','mousedown','click'].forEach(evt=> sel.dispatchEvent(new MouseEvent(evt,{bubbles:true})));
        }
      });
    }

    const repaint = debounce(()=>{
      renderForCity(detectCity(), map);
      hideCityCTAs(document);
      killDevText();
    }, 60);

    // Initial
    repaint();

    // Observe calendar only (not <body>)
    const findCal = ()=> document.getElementById('calendar') || document.querySelector('#calendar-container') || document.querySelector('.calendar');
    let tries = 0;
    (function waitForCal(){
      const cal = findCal();
      if (cal){
        new MutationObserver(()=>{ repaint(); hideCityCTAs(cal); }).observe(cal,{childList:true,subtree:true,characterData:true});
        repaint(); hideCityCTAs(cal);
        return;
      }
      if (tries++ < 20) setTimeout(waitForCal, 100);
    })();

    // Small global observer to catch late UI injections (safe)
    new MutationObserver(debounce(()=>hideCityCTAs(document),80)).observe(document.documentElement,{childList:true,subtree:true});
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
