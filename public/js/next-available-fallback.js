(function(){
  const SEL = {
    calendarWrap: ['#acuity-calendar', '.acuity-embed', '[data-calendar-root]', '.calendar'],
    calendarIframe: ['#acuity-calendar iframe', '.acuity-embed iframe', 'iframe[src*="acuityscheduling.com"]'],
    locationSelect: ['*[data-location-select]', '#location-select', '#location', 'select[name*="location"]', 'select[name*="city"]']
  };

  const q = (selectors, root = document) => {
    for (const sel of selectors){
      try {
        const node = root.querySelector(sel);
        if (node) return node;
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

  function ensureBar(){
    if (document.getElementById('next-month-helper')) return;
    const bar = document.createElement('div');
    bar.id = 'next-month-helper';
    bar.setAttribute('aria-live', 'polite');
    bar.style.cssText = [
      'position:sticky',
      'top:8px',
      'z-index:40',
      'background:#0f172a',
      'color:#e2e8f0',
      'border:1px solid #334155',
      'border-radius:10px',
      'padding:10px 12px',
      'display:none',
      'gap:10px',
      'align-items:center',
      'margin-bottom:8px',
      'box-shadow:0 6px 18px rgba(0,0,0,.15)',
      'font:600 14px/1.2 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto'
    ].join(';');
    bar.innerHTML = [
      '<span>No openings this month.</span>',
      '<button id="next-month-helper-btn" style="margin-left:auto;padding:8px 12px;border-radius:9px;background:#34b16a;color:#0b1320;border:0;font-weight:700;cursor:pointer;">Next month ▶</button>'
    ].join('');

    const wrap = q(SEL.calendarWrap) || document.body;
    wrap.parentNode.insertBefore(bar, wrap);

    bar.querySelector('#next-month-helper-btn').addEventListener('click', () => {
      const target = q(SEL.calendarWrap);
      if (target){
        target.scrollIntoView({ behavior: 'smooth' });
        pulse();
      }
    });
  }

  function pulse(){
    removePulse();
    const wrap = q(SEL.calendarWrap);
    if (!wrap) return;

    const overlay = document.createElement('div');
    overlay.id = 'next-month-pulse';
    overlay.style.cssText = 'position:absolute;pointer-events:none;inset:0;z-index:35;';

    const dot = document.createElement('div');
    dot.style.cssText = [
      'position:absolute',
      'width:18px',
      'height:18px',
      'right:28px',
      'top:18px',
      'border-radius:9999px',
      'background:#34b16a',
      'opacity:.9',
      'box-shadow:0 0 0 0 rgba(52,177,106,0.7)',
      'animation:dvds-pulse 1.2s infinite'
    ].join(';');

    const container = wrap.closest('.calendar-container') || wrap;
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';

    overlay.appendChild(dot);
    container.appendChild(overlay);

    setTimeout(removePulse, 4500);

    if (!document.getElementById('dvds-pulse-style')){
      const style = document.createElement('style');
      style.id = 'dvds-pulse-style';
      style.textContent = [
        '@keyframes dvds-pulse {',
        '  0% { box-shadow: 0 0 0 0 rgba(52,177,106,0.7); }',
        '  70% { box-shadow: 0 0 0 12px rgba(52,177,106,0); }',
        '  100% { box-shadow: 0 0 0 0 rgba(52,177,106,0); }',
        '}'
      ].join('\n');
      document.head.appendChild(style);
    }
  }

  function removePulse(){
    const overlay = document.getElementById('next-month-pulse');
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  function setVisible(visible){
    const bar = document.getElementById('next-month-helper');
    if (!bar) return;
    bar.style.display = visible ? 'flex' : 'none';
  }

  function showIfIframe(){
    const frame = q(SEL.calendarIframe);
    setVisible(!!frame);
  }

  const onChange = debounce(() => {
    ensureBar();
    showIfIframe();
  }, 200);

  function bind(){
    SEL.locationSelect.forEach(sel => {
      document.querySelectorAll(sel).forEach(node => {
        node.removeEventListener('change', onChange);
        node.addEventListener('change', onChange);
      });
    });

    const observer = new MutationObserver(onChange);
    observer.observe(document.body, { childList: true, subtree: true });

    onChange();
  }

  if (['complete', 'interactive'].includes(document.readyState)) bind();
  else document.addEventListener('DOMContentLoaded', bind, { once: true });
})();
