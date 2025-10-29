// ui-packages.js — packages UI + aggressive hide for "Book {City}" CTAs
// Safe: no edits to app.js, APIs, or router.

(function(){
  const LABELS = [
    {key:'Ultimate',      title:'🥇 Ultimate — 20 hrs (8×2.5h) — $1,299', ribbon:'Best Value',       meta:'Includes MVD road test waiver + insurance waiver.'},
    {key:'License Ready', title:'🏁 License Ready — 10 hrs (4×2.5h) — $680', ribbon:'Most Purchased', meta:'Includes MVD road test waiver + insurance waiver.'},
    {key:'Early Bird',    title:'🌅 Early Bird — 10 hrs (2×5h, M–F mornings) — $649',                meta:'Save with weekday morning sessions.'},
    {key:'Intro',         title:'🚘 Intro — 5 hrs (2×2.5h) — $350',                                   meta:'Focused fundamentals + confidence building.'},
    {key:'Express',       title:'⚡ Express — 2.5 hrs (1 lesson) — $200',                              meta:'Single lesson. Great for refreshers.'}
  ];

  function detectCity(){
    return (
      document.querySelector('[data-current-city]')?.getAttribute('data-current-city')?.trim() ||
      document.querySelector('.current-city,#current-city,[data-city]')?.textContent?.trim() ||
      document.querySelector('select[name="city"],#city,.city-select')?.value?.trim() || ''
    );
  }

  // 🔒 Aggressively hide any "Book {City}" buttons/links by text (visual only)
  function hideCityCTAs(root=document){
    const nodes = Array.from(root.querySelectorAll('button,a,[role="button"]'));
    nodes.forEach(el=>{
      const txt = (el.textContent || '').replace(/\s+/g,' ').trim();
      if (/^book\s+[a-z]/i.test(txt)) {
        el.style.display = 'none';
        el.setAttribute('hidden','true');
        el.setAttribute('aria-hidden','true');
        // Also try to collapse common wrapper rows if they only contained that CTA
        const card = el.closest('.book-location-btn, .cta, .actions, .toolbar, .header, .footer');
        if (card && card.children.length <= 2) { card.style.display = 'none'; card.setAttribute('hidden','true'); }
      }
    });
  }

  function renderForCity(city, map){
    const rail = document.getElementById('pkg-rail'); if(!rail) return;
    rail.innerHTML = '';
    const cityLinks = map[city] || {};
    const available = LABELS.filter(def => cityLinks[def.key]);

    const hint = document.querySelector('#packages-flow .hint');
    if (hint){
      if (city === 'Casa Grande')      hint.textContent = 'Casa Grande: Early Bird only (weekday mornings). After purchase, select your times in the calendar below.';
      else if (city === 'West Valley') hint.textContent = 'West Valley: Early Bird only. After purchase, select your times in the calendar below.';
      else                             hint.textContent = 'Tip: After purchase, this page stays open. Select a date on the left and choose any available time for your city.';
    }

    (available.length ? available : LABELS).forEach(def=>{
      const href = cityLinks[def.key];
      const a = document.createElement('a');
      a.className = 'pkg-card';
      a.href   = href || '#';
      a.target = href ? '_blank' : '_self';
      a.rel    = href ? 'noopener noreferrer' : '';
      a.role   = 'listitem';
      a.innerHTML = `
        <div class="pkg-title">${def.title}</div>
        <div class="pkg-meta">${def.meta || ''}</div>
        <div class="ribbons">
          ${def.ribbon ? `<span class="ribbon ${def.ribbon.includes('Best')?'best':'most'}">${def.ribbon}</span>` : ''}
        </div>
        <div class="pkg-meta">${href ? 'Opens in new tab →' : 'Not available in this city'}</div>
      `;
      rail.appendChild(a);
    });
  }

  // Debounce to avoid thrash on calendar updates
  function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

  async function boot(){
    // Load static mapping (created earlier as package-links.json)
    let map={};
    try{
      const res = await fetch('./package-links.json', {cache:'no-store'});
      map = await res.json();
    }catch(e){ /* ok to render without links */ }

    const repaint = debounce(() => { renderForCity(detectCity(), map); hideCityCTAs(); }, 60);

    // Initial pass
    repaint(); hideCityCTAs();

    // Observe ONLY the calendar container (never <body>)
    const findCal = () =>
      document.getElementById('calendar') ||
      document.querySelector('#calendar-container') ||
      document.querySelector('.calendar');

    let tries = 0;
    (function waitForCal(){
      const cal = findCal();
      if (cal){
        new MutationObserver(()=>{ repaint(); hideCityCTAs(cal); })
          .observe(cal, {childList:true, subtree:true, characterData:true});
        repaint(); hideCityCTAs(cal);
        return;
      }
      if (tries++ < 20) setTimeout(waitForCal, 100);
    })();

    // Belt & suspenders: brief hide sweeper for late UI injections
    let sweeps = 0;
    const interval = setInterval(()=>{ hideCityCTAs(); if (++sweeps > 12) clearInterval(interval); }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
