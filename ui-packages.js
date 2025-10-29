// ui-packages.js — city-specific package links (append-only, no calendar/router edits)
(function(){
  const LABELS = [
    {key:'Ultimate',      title:'🥇 Ultimate — 20 hrs (8×2.5h) — $1,299', ribbon:'Best Value', meta:'Includes MVD road test waiver + insurance waiver.'},
    {key:'License Ready', title:'🏁 License Ready — 10 hrs (4×2.5h) — $680', ribbon:'Most Purchased', meta:'Includes MVD road test waiver + insurance waiver.'},
    {key:'Early Bird',    title:'🌅 Early Bird — 10 hrs (2×5h, M–F mornings) — $649', meta:'Save with weekday morning sessions.'},
    {key:'Intro',         title:'🚘 Intro — 5 hrs (2×2.5h) — $350', meta:'Focused fundamentals + confidence building.'},
    {key:'Express',       title:'⚡ Express — 2.5 hrs (1 lesson) — $200', meta:'Single lesson. Great for refreshers.'}
  ];

  function detectCity(){
    // Read-only detection: try dataset, headers, or select controls — never modify logic
    const fromData = document.querySelector('[data-current-city]')?.getAttribute('data-current-city');
    if (fromData) return fromData.trim();
    const header = document.querySelector('.current-city,#current-city,[data-city]')?.textContent;
    if (header && header.trim()) return header.trim();
    const sel = document.querySelector('select[name="city"],#city,.city-select');
    if (sel && sel.value) return sel.value.trim();
    return '';
  }

  function renderForCity(city, map){
    const rail = document.getElementById('pkg-rail'); if(!rail) return;
    rail.innerHTML = '';
    const cityLinks = map[city] || {};
    const available = LABELS.filter(def => cityLinks[def.key]);

    // Special hint for Casa Grande & West Valley
    const hint = document.querySelector('#packages-flow .hint');
    if (hint){
      if (city === 'Casa Grande') hint.textContent = 'Casa Grande: Early Bird only (weekday mornings). After purchase, select your times in the calendar below.';
      else if (city === 'West Valley') hint.textContent = 'West Valley: Early Bird only. After purchase, select your times in the calendar below.';
      else hint.textContent = 'Tip: After purchase, this page stays open. Select a date on the left and choose any available time for your city.';
    }

    (available.length ? available : LABELS).forEach(def=>{
      const href = cityLinks[def.key];
      const a = document.createElement('a');
      a.className = 'pkg-card';
      a.href = href || '#';
      a.target = href ? '_blank' : '_self';
      a.rel = href ? 'noopener noreferrer' : '';
      a.role = 'listitem';
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

  function hideLocationButtons(root=document){
    Array.from(root.querySelectorAll('button,a')).forEach(el=>{
      const t=(el.textContent||'').trim();
      if (/^Book\s+.+/i.test(t)) el.style.display='none';
    });
  }

  async function boot(){
    // Load mapping
    let map={};
    try{
      const res = await fetch('./package-links.json',{cache:'no-store'});
      map = await res.json();
    }catch(e){ /* fail safe: render defaults with no links */ }

    const paint = () => renderForCity(detectCity(), map);

    paint();
    hideLocationButtons();

    // Keep hiding location buttons and repaint on UI changes without touching logic
    const cal = document.getElementById('calendar') || document.querySelector('.calendar,#calendar-container,body');
    if (cal){
      new MutationObserver(()=>{ hideLocationButtons(cal); paint(); })
        .observe(cal,{childList:true,subtree:true,characterData:true});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
