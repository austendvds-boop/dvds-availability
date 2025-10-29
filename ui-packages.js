// ui-packages.js — Append-only, isolates UI. No calendar/router changes.
(function(){
  const DEFAULT_OWNER='28722957';
  const CATALOG=o=>`https://app.acuityscheduling.com/catalog.php?owner=${o}`;
  const PACKAGES=[
    {title:'🥇 Ultimate — 20 hrs (8×2.5h) — $1,299',meta:'Most complete. Includes MVD road test waiver + insurance waiver.',href:CATALOG(DEFAULT_OWNER),ribbons:['Best Value']},
    {title:'🏁 License Ready — 10 hrs (4×2.5h) — $680',meta:'Includes MVD road test waiver + insurance waiver.',href:CATALOG(DEFAULT_OWNER),ribbons:['Most Purchased']},
    {title:'🌅 Early Bird — 10 hrs (2×5h, M–F mornings) — $649',meta:'Save with weekday morning sessions.',href:CATALOG(DEFAULT_OWNER)},
    {title:'🚘 Intro — 5 hrs (2×2.5h) — $350',meta:'Focused fundamentals + confidence building.',href:CATALOG(DEFAULT_OWNER)},
    {title:'⚡ Express — 2.5 hrs (1 lesson) — $200',meta:'Single lesson. Great for refreshers.',href:'https://app.acuityscheduling.com/catalog.php?owner=28722957&action=addCart&clear=1&id=2070525'}
  ];
  function renderCards(){
    const rail=document.getElementById('pkg-rail');if(!rail)return;rail.innerHTML='';
    PACKAGES.forEach(p=>{const a=document.createElement('a');a.className='pkg-card';a.href=p.href;a.target='_blank';a.rel='noopener noreferrer';a.role='listitem';a.innerHTML=`
      <div class="pkg-title">${p.title}</div>
      <div class="pkg-meta">${p.meta}</div>
      <div class="ribbons">${(p.ribbons||[]).map(r=>`<span class="ribbon ${r.includes('Best')?'best':'most'}">${r}</span>`).join('')}</div>
      <div class="pkg-meta">Opens in new tab →</div>`;rail.appendChild(a);});
  }
  function hideLocationButtons(root=document){
    Array.from(root.querySelectorAll('button,a')).forEach(el=>{
      const t=(el.textContent||'').trim();if(/^Book\s+.+/i.test(t))el.style.display='none';
    });
  }
  function boot(){
    renderCards();hideLocationButtons();
    const cal=document.getElementById('calendar')||document.querySelector('.calendar,#calendar-container,body');
    if(!cal)return;
    new MutationObserver(()=>hideLocationButtons(cal)).observe(cal,{childList:true,subtree:true,characterData:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
