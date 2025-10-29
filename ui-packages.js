// ui-packages.js — hard-hide "Book {City}" CTAs globally (append-only, calendar logic untouched)
(function(){
  const LABELS = [
    {key:'Ultimate',      title:'🥇 Ultimate — 20 hrs (8×2.5h) — $1,299', ribbon:'Best Value',       meta:'Includes MVD road test waiver + insurance waiver.'},
    {key:'License Ready', title:'🏁 License Ready — 10 hrs (4×2.5h) — $680', ribbon:'Most Purchased', meta:'Includes MVD road test waiver + insurance waiver.'},
    {key:'Early Bird',    title:'🌅 Early Bird — 10 hrs (2×5h, M–F mornings) — $649',                meta:'Save with weekday morning sessions.'},
    {key:'Intro',         title:'🚘 Intro — 5 hrs (2×2.5h) — $350',                                   meta:'Focused fundamentals + confidence building.'},
    {key:'Express',       title:'⚡ Express — 2.5 hrs (1 lesson) — $200',                              meta:'Single lesson. Great for refreshers.'}
  ];

  const BOOK_RE = /^book\s+/i; // catches "Book Anthem", "Book Awatukee", etc. (typos included)

  function detectCity(){
    return (
      document.querySelector('[data-current-city]')?.getAttribute('data-current-city')?.trim() ||
      document.querySelector('.current-city,#current-city,[data-city]')?.textContent?.trim() ||
      document.querySelector('select[name="city"],#city,.city-select')?.value?.trim() || ''
    );
  }

  function renderForCity(city, map){
    const rail = document.getElementById('pkg-rail'); if(!rail) return;
    rail.innerHTML = '';
    const cityLinks = (map||{})[city] || {};
    const defs = LABELS.filter(d => cityLinks[d.key]).length ? LABELS.filter(d => cityLinks[d.key]) : LABELS;

    const hint = document.querySelector('#packages-flow .hint');
    if (hint){
      if (city === 'Casa Grande')      hint.textContent = 'Casa Grande: Early Bird only (weekday mornings). After purchase, select your times in the calendar below.';
      else if (city === 'West Valley') hint.textContent = 'West Valley: Early Bird only. After purchase, select your times in the calendar below.';
      else                             hint.textContent = 'Tip: After purchase, this page stays open. Select a date on the left and choose any available time for your city.';
    }

    defs.forEach(def=>{
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

  // Mark and hide any element that visually reads "Book {City}"
  function killBookCTAs(scope=document){
    const candidates = scope.querySelectorAll('button, a, [role="button"]');
    candidates.forEach(el=>{
      if (el.classList.contains('kill-book-city')) return;

      // Build a text snapshot that ignores nested markup/spacing
      const txt = (el.textContent || '')
        .replace(/\s+/g,' ')
        .trim();

      // Also check common label attributes
      const labelTxt = (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();

      if (BOOK_RE.test(txt) || BOOK_RE.test(labelTxt)) {
        el.classList.add('kill-book-city');
        // Optionally hide small wrappers that only contain this CTA
        const wrap = el.closest('.book-location-btn, .cta, .actions, .toolbar, .header, .footer');
        if (wrap && wrap.querySelectorAll('.kill-book-city').length === wrap.querySelectorAll('button,a,[role="button"]').length) {
          wrap.classList.add('kill-book-city');
        }
      }
    });
  }

  // Debounce helpers
  function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

  async function boot(){
    // Load mapping if present
    let map={};
    try{
      const res = await fetch('./package-links.json', {cache:'no-store'});
      if (res.ok) map = await res.json();
    }catch(e){}

    const repaint = debounce(() => { renderForCity(detectCity(), map); killBookCTAs(document); }, 60);

    // Initial pass
    repaint();
    killBookCTAs(document);

    // Observe calendar container for city changes (not <body> to avoid thrash)
    const findCal = () =>
      document.getElementById('calendar') ||
      document.querySelector('#calendar-container') ||
      document.querySelector('.calendar');

    let tries = 0;
    (function waitForCal(){
      const cal = findCal();
      if (cal){
        new MutationObserver(()=>{ repaint(); killBookCTAs(cal); })
          .observe(cal, {childList:true, subtree:true, characterData:true});
        repaint(); killBookCTAs(cal);
        return;
      }
      if (tries++ < 20) setTimeout(waitForCal, 100);
    })();

    // Global lightweight observer to catch late UI injections anywhere
    const globalHide = debounce(()=>killBookCTAs(document), 80);
    new MutationObserver(globalHide).observe(document.documentElement, {childList:true, subtree:true});

    // Periodic sweeps (defensive): quickly at first, then slower
    let count = 0;
    const timer = setInterval(()=>{
      killBookCTAs(document);
      if (++count > 20) clearInterval(timer); // ~20 sweeps
    }, 200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
