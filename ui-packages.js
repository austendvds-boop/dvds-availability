// ui-packages.js — strict addCart links only + reinforce CTA hiding (append-only)
(function(){
  const LABELS=[
    {key:'Ultimate',title:'🥇 Ultimate — 20 hrs (8×2.5h) — $1,299',ribbon:'Best Value',meta:'Includes MVD road test waiver + insurance waiver.'},
    {key:'License Ready',title:'🏁 License Ready — 10 hrs (4×2.5h) — $680',ribbon:'Most Purchased',meta:'Includes MVD road test waiver + insurance waiver.'},
    {key:'Early Bird',title:'🌅 Early Bird — 10 hrs (2×5h, M–F mornings) — $649',meta:'Save with weekday morning sessions.'},
    {key:'Intro',title:'🚘 Intro — 5 hrs (2×2.5h) — $350',meta:'Focused fundamentals + confidence building.'},
    {key:'Express',title:'⚡ Express — 2.5 hrs (1 lesson) — $200',meta:'Single lesson. Great for refreshers.'}
  ];
  const toKey=s=>(s||'').toLowerCase().trim().replace(/\s+/g,' ');
  const CITY_ALIASES={'awatukee':'ahwatukee','ahwatukee':'ahwatukee','dtn phoenix':'downtown phoenix','downtown phoenix':'downtown phoenix','north phoenix':'north phoenix','san tan valley':'san tan valley','queen creek':'queen creek','west valley':'west valley'};
  const normCity=n=>CITY_ALIASES[toKey(n)]||toKey(n);

  function detectCity(){
    const d=document.querySelector('[data-current-city]')?.getAttribute('data-current-city'); if(d) return d.trim();
    const h=document.querySelector('.current-city,#current-city,[data-city]')?.textContent; if(h&&h.trim()) return h.trim();
    const s=document.querySelector('select[name="city"],#city,.city-select'); if(s&&s.value) return s.value.trim();
    return '';
  }

  function updateHint(city){
    const hint=document.getElementById('packages-hint'); if(!hint) return;
    if(city==='Casa Grande') hint.textContent='Casa Grande: Early Bird only (weekday mornings). After purchase, select your times in the calendar below.';
    else if(city==='West Valley') hint.textContent='West Valley: Early Bird only. After purchase, select your times in the calendar below.';
    else hint.textContent='Tip: After purchase, this page stays open. Select a date on the left and choose any available time for your city.';
  }

  function killDevText(){
    Array.from(document.querySelectorAll('*')).forEach(n=>{
      const t=(n.textContent||'').trim();
      if(t.startsWith('If the dropdown fills and availability renders')){ n.style.display='none'; n.setAttribute('aria-hidden','true'); }
    });
  }

  function hideBookCTAs(scope=document){
    const re=/^book\s+/i;
    scope.querySelectorAll('button,a,[role="button"]').forEach(el=>{
      const txt=(el.textContent||'').replace(/\s+/g,' ').trim();
      const lbl=(el.getAttribute('aria-label')||el.getAttribute('title')||'').trim();
      if(re.test(txt)||re.test(lbl)) el.classList.add('kill-book-city');
    });
  }

  function renderForCity(city,map){
    const rail=document.getElementById('pkg-rail'); if(!rail) return;
    rail.innerHTML='';
    document.getElementById('city-chip-name')?.replaceChildren(document.createTextNode(city||'-'));
    updateHint(city);

    const norm=normCity(city);
    const normMap={}; Object.keys(map||{}).forEach(k=>{ normMap[normCity(k)]=map[k]; });
    const links=normMap[norm]||{};

    LABELS.forEach(def=>{
      const href=links[def.key]||''; // STRICT: no fallback
      const a=document.createElement('a');
      a.className='pkg-card';
      a.role='listitem';
      if(href){ a.href=href; a.target='_blank'; a.rel='noopener noreferrer'; }
      else { a.href='javascript:void(0)'; a.setAttribute('aria-disabled','true'); a.style.opacity='.55'; a.style.pointerEvents='none'; }
      a.innerHTML=`
        <div class="pkg-title">${def.title}</div>
        <div class="pkg-meta">${def.meta||''}</div>
        <div class="ribbons">${def.ribbon?`<span class="ribbon ${def.ribbon.includes('Best')?'best':'most'}">${def.ribbon}</span>`:''}</div>
        <div class="pkg-meta" style="margin-top:4px">${href?'Opens in new tab →':'Not available for this city'}</div>
      `;
      rail.appendChild(a);
    });
  }

  const debounce=(fn,ms)=>{let t;return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);}};

  async function boot(){
    let map={};
    try{const r=await fetch('./package-links.json',{cache:'no-store'}); if(r.ok) map=await r.json();}catch(_){ }

    killDevText();

    const change=document.getElementById('change-location');
    if(change){
      change.addEventListener('click',()=>{
        const sel=document.querySelector('select[name="city"],#city,.city-select');
        if(sel){
          sel.focus();
          ['pointerdown','mousedown','click'].forEach(evt=>sel.dispatchEvent(new MouseEvent(evt,{bubbles:true}))); }
      });
    }

    (document.querySelector('#calendar')||document.querySelector('#calendar-container')||document.querySelector('.calendar'))?.classList.add('cal-brand');

    const repaint=debounce(()=>{ renderForCity(detectCity(),map); hideBookCTAs(document); },60);
    repaint();

    const findCal=()=>document.getElementById('calendar')||document.querySelector('#calendar-container')||document.querySelector('.calendar');
    let tries=0;
    (function wait(){
      const cal=findCal();
      if(cal){
        new MutationObserver(()=>{ repaint(); hideBookCTAs(cal); }).observe(cal,{childList:true,subtree:true,characterData:true});
        repaint();
        hideBookCTAs(cal);
        return;
      }
      if(tries++<20) setTimeout(wait,100);
    })();

    new MutationObserver(debounce(()=>hideBookCTAs(document),80)).observe(document.documentElement,{childList:true,subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
