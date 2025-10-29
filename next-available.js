// next-available.js — Append-only helper to jump to the next month that has availability.
// Safe: purely DOM-driven; does NOT modify app.js, APIs, or routing logic.

(function(){
  // ====== CONFIGURE SELECTORS (non-breaking, tries multiple patterns) ======
  const SEL = {
    calendarRoot:   '#calendar, #calendar-container, .calendar',
    dayCell:        '.cal-day, .day, [data-day], td, .calendar-day',
    // Any marker that indicates availability inside a day cell (tweakable list):
    // - counters like "1×", "2×"
    // - dots or badges with class names
    availMarker:    '.avail, .dot, .slots, .times, .badge, .count',
    // Fallback text patterns to detect availability when no marker elements exist:
    availTextRe:    /\b(\d+×|\d+\s*slots?|\d+\s*times?)\b/i,
    // Month nav buttons (try multiple possibilities)
    nextBtn:        '[aria-label="Next month"], button[title="Next"], .cal-next, .next, [data-cal-next]'
  };

  // ====== Utility ======
  const qs  = (r, s) => (r||document).querySelector(s);
  const qsa = (r, s) => Array.from((r||document).querySelectorAll(s));

  function getCalRoot(){ return qs(document, SEL.calendarRoot); }

  function monthHasAvailability(root){
    if(!root) return false;
    const days = qsa(root, SEL.dayCell);
    // Heuristic: a day has availability if it contains a marker node OR matching text
    return days.some(d=>{
      // ignore placeholder/blank cells
      const txt = (d.textContent||'').trim();
      const hasMarker = !!qs(d, SEL.availMarker);
      const matchesTxt = SEL.availTextRe.test(txt);
      // also treat cells with a small "×" counter as available (e.g., "1×")
      return hasMarker || matchesTxt;
    });
  }

  function clickNextMonth(root){
    const btn = qs(root, SEL.nextBtn) || qs(document, SEL.nextBtn);
    if (btn){
      btn.click();
      return true;
    }
    return false;
  }

  // Debounce helper
  const debounce = (fn, ms) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

  // Main routine: checks current month → if no availability, advance until found or max jumps.
  function jumpToNextAvailable(){
    const root = getCalRoot();
    if(!root) return;

    // Safety rails
    const MAX_JUMPS = 12;   // don't go past 12 months
    let jumps = 0;

    // Inner loop with async waits to allow the calendar to re-render
    (function seek(){
      const hasAvail = monthHasAvailability(getCalRoot());
      if (hasAvail) return; // Found slots in this month → stop.

      if (jumps >= MAX_JUMPS) return; // stop trying after 12 months

      const advanced = clickNextMonth(getCalRoot());
      if (!advanced) return; // can't advance → stop

      jumps++;
      // Wait a bit for the new month DOM to render, then check again
      setTimeout(seek, 250);
    })();
  }

  // Trigger conditions:
  // 1) After location selection causes the calendar to re-render.
  // 2) Manual chip: if you add a "Skip to next available" control, call jumpToNextAvailable() on click.

  function bindObservers(){
    const root = getCalRoot();
    if (!root) return;

    const tryJump = debounce(jumpToNextAvailable, 150);

    // Observe the calendar subtree for re-renders (month change / city change)
    const mo = new MutationObserver(()=> { tryJump(); });
    mo.observe(root, { childList: true, subtree: true, characterData: true });

    // Initial attempt shortly after page load
    setTimeout(tryJump, 400);
  }

  // Wait for calendar to exist, then bind
  (function waitForCalendar(){
    const root = getCalRoot();
    if (root) { bindObservers(); return; }
    setTimeout(waitForCalendar, 100);
  })();
})();
