(function(){
  const SEL = {
    calendarRoot: ['#acuity-calendar', '.acuity-embed', '[data-calendar-root]', '.calendar'],
    nextMonthBtn: ['[data-cal-next]', '.calendar-nav .next', 'button[aria-label*="Next"]', 'button[aria-label*="next"]', '.pika-next', '.ui-datepicker-next'],
    monthContainer: ['[data-cal-month]', '.calendar-month', '.pika-lendar', '.ui-datepicker-group', '.acuity-iframe, iframe'],
    timeSlot: ['[data-time]', '.time-slot', '.appointment-time', 'button[class*="time"]', 'button[aria-label*="time"]', '.availabilities button', '.times button', '.slot'],
    locationSelect: ['*[data-location-select]', '#location-select', '#location', 'select[name*="location"]', 'select[name*="city"]']
  };

  const qOne = (root, selectors) => {
    const roots = Array.isArray(root) ? root : [root || document];
    for (const R of roots){
      for (const sel of selectors){
        try {
          const el = (R || document).querySelector(sel);
          if (el) return el;
        } catch (_) {}
      }
    }
    return null;
  };

  const qAny = (root, selectors) => {
    for (const sel of selectors){
      try {
        const nodes = (root || document).querySelectorAll(sel);
        if (nodes && nodes.length) return nodes;
      } catch (_) {}
    }
    return null;
  };

  const debounce = (fn, ms = 250) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  const once = key => {
    if (window.__nextAvailRan?.[key]) return false;
    (window.__nextAvailRan ??= {})[key] = true;
    return true;
  };

  const getRoot = () => qOne(document, SEL.calendarRoot) || document.body;

  const hasSlots = () => {
    const nodes = qAny(getRoot(), SEL.timeSlot);
    if (!nodes) return false;
    for (const el of nodes){
      const styles = getComputedStyle(el);
      if (styles.display !== 'none' && styles.visibility !== 'hidden' && el.offsetParent) return true;
    }
    return false;
  };

  const clickNext = () => {
    const btn = qOne(getRoot(), SEL.nextMonthBtn);
    if (!btn) return false;
    btn.click();
    return true;
  };

  const waitChange = (timeout = 1500) => new Promise(resolve => {
    const target = qOne(getRoot(), SEL.monthContainer) || getRoot();
    let done = false;
    const timer = setTimeout(() => {
      if (!done){
        done = true;
        observer && observer.disconnect();
        resolve();
      }
    }, timeout);
    const observer = new MutationObserver(() => {
      if (!done){
        done = true;
        clearTimeout(timer);
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(target, { childList: true, subtree: true });
  });

  async function advance(max = 12){
    if (hasSlots()) return;
    for (let i = 0; i < max; i++){
      const clicked = clickNext();
      if (!clicked) break;
      await waitChange(1600);
      if (hasSlots()) return;
    }
  }

  function bindLocation(){
    if (!once('bindLoc')) return;
    const controls = SEL.locationSelect.flatMap(sel => {
      try {
        return Array.from(document.querySelectorAll(sel));
      } catch (_) {
        return [];
      }
    });
    if (!controls.length) return;
    const handler = debounce(() => advance(12), 350);
    controls.forEach(el => el.addEventListener('change', handler));
  }

  function observeCalendar(){
    if (!once('obsCal')) return;
    const observer = new MutationObserver(
      debounce(() => {
        bindLocation();
        const hasLocation = !!qOne(document, SEL.locationSelect) && qOne(document, SEL.calendarRoot) !== null;
        if (hasLocation) setTimeout(() => advance(12), 400);
      }, 200)
    );
    observer.observe(document.body, { childList: true, subtree: true });
  }

  const ready = fn => {
    if (['complete', 'interactive'].includes(document.readyState)) setTimeout(fn, 0);
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  };

  ready(() => {
    bindLocation();
    observeCalendar();
  });
})();
