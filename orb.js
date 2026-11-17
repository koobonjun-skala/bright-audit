// B:RIGHT 도우미 구슬: 짙은 남색 위쪽, 밝은 하늘색 아래쪽, 물결 경계에 무지갯빛 한 줄
(function () {
  let n = 0;
  const W = 'C-80 40 -65 44 -50 54 S-20 64 0 52 C20 40 35 44 50 54 S80 64 100 52 C120 40 135 44 150 54 S180 64 200 52';
  window.orbSVG = function () {
    const p = 'ob' + (n++);
    return `<svg viewBox="0 0 100 100" aria-hidden="true">
<defs>
 <linearGradient id="${p}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0D1A44"/><stop offset=".42" stop-color="#1E3A93"/><stop offset=".6" stop-color="#5F86EE"/><stop offset="1" stop-color="#E3ECFF"/></linearGradient>
 <linearGradient id="${p}i" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7FD6FF"/><stop offset=".3" stop-color="#FFB28C"/><stop offset=".5" stop-color="#FFFFFF"/><stop offset=".72" stop-color="#8FE6FF"/><stop offset="1" stop-color="#7C96FF"/></linearGradient>
 <radialGradient id="${p}g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
 <radialGradient id="${p}h" cx=".35" cy=".25" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
 <clipPath id="${p}c"><circle cx="50" cy="50" r="46"/></clipPath>
 <filter id="${p}f" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="1.1"/></filter>
</defs>
<circle cx="50" cy="50" r="46" fill="url(#${p}b)"/>
<g clip-path="url(#${p}c)">
 <g class="orb-wave"><path d="M-100 52 ${W} V110 H-100Z" fill="#A9C2FA" opacity=".5"/>
  <path d="M-100 52 ${W}" fill="none" stroke="url(#${p}i)" stroke-width="3.2" filter="url(#${p}f)"/></g>
 <ellipse cx="50" cy="88" rx="30" ry="12" fill="url(#${p}g)"/>
 <circle cx="50" cy="50" r="46" fill="url(#${p}h)"/>
</g>
<circle cx="50" cy="50" r="45.4" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.4"/>
</svg>`;
  };
  const css = document.createElement('style');
  css.textContent = '.orb{display:inline-block;border-radius:50%;box-shadow:0 4px 12px rgba(30,60,170,.28)}.orb svg{display:block;width:100%;height:100%}.orb-wave{animation:orbw 5s linear infinite}@keyframes orbw{to{transform:translateX(-100px)}}.orb.busy .orb-wave{animation-duration:1.2s}';
  document.head.appendChild(css);
  const fill = () => document.querySelectorAll('[data-orb]:not([data-done])').forEach(el => { el.innerHTML = window.orbSVG(); el.dataset.done = 1; });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill); else fill();
  window.fillOrbs = fill;
})();
