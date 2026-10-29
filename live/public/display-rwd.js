/* 麗喆 303 班 — v4.2.1 responsive signage geometry.
 * A viewport resize changes layout only. It never reconnects a room, restarts a
 * round, changes the scene, or recreates the audio graph.
 * Physical rotation must first be reflected by the browser / operating system.
 */
(() => {
 'use strict';
 const root = document.documentElement;
 let frame = 0, current = null;
 function resize() {
  const width = Math.max(1, root.clientWidth || window.innerWidth);
  const height = Math.max(1, window.innerHeight || root.clientHeight);
  const portrait = height >= width;
  const layout = portrait ? 'portrait' : 'landscape';
  const baseWidth = portrait ? 900 : 1600;
  const baseHeight = portrait ? 1600 : 900;
  const scale = Math.min(width / baseWidth, height / baseHeight);
  root.dataset.layout = layout;
  root.dataset.displayVersion = '4.2.1';
  root.style.setProperty('--board-w', baseWidth + 'px');
  root.style.setProperty('--board-h', baseHeight + 'px');
  root.style.setProperty('--scale', String(scale));
  root.style.setProperty('--viewport-h', height + 'px');
  const label = document.getElementById('layout-info');
  if (label) {
   label.textContent = (portrait ? '直式' : '橫式') + '・自動';
   label.title = `v4.2.1｜可見範圍 ${width} × ${height}；自動重排，不重整遊戲。`;
  }
  // Decorative SVG uses the whole portrait canvas; game demonstration SVG
  // retains its original viewBox so cup/card motion is never distorted.
  document.querySelectorAll('.ambient-svg').forEach(svg => {
   if (!svg.dataset.originalViewbox) svg.dataset.originalViewbox = svg.getAttribute('viewBox');
   svg.setAttribute('viewBox', portrait ? '0 0 900 1600' : svg.dataset.originalViewbox);
  });
  current = Object.freeze({version:'4.2.1',layout,width,height,baseWidth,baseHeight,scale});
 }
 function queueResize() {
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; resize(); });
 }
 window.DisplayLayout = Object.freeze({resize, get state() { return current; }});
 window.addEventListener('resize', queueResize, {passive:true});
 window.addEventListener('orientationchange', queueResize, {passive:true});
 if (window.visualViewport) window.visualViewport.addEventListener('resize', queueResize, {passive:true});
 if (window.screen.orientation?.addEventListener) window.screen.orientation.addEventListener('change', queueResize);
 document.addEventListener('fullscreenchange', queueResize);
 document.addEventListener('webkitfullscreenchange', queueResize);
 resize();
})();
