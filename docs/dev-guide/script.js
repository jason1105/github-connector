// github-connector :: dev-guide :: interaction layer

(function () {
  'use strict';

  // ---- Tab switching ----
  var tabs = document.querySelectorAll('.tab-btn');
  var panels = document.querySelectorAll('.panel');

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var targetId = tab.getAttribute('data-target');

      tabs.forEach(function (t) { t.classList.remove('active'); });
      panels.forEach(function (p) { p.classList.remove('active'); });

      tab.classList.add('active');
      var target = document.getElementById(targetId);
      if (target) target.classList.add('active');

      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // ---- Live clock (local time, HH:MM:SS) ----
  var clockEl = document.getElementById('clock');

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function tick() {
    if (!clockEl) return;
    var now = new Date();
    clockEl.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
  }

  tick();
  setInterval(tick, 1000);
})();
