/* ============================================================
   Plate — app.js
   Diet planner logic: macro tracking, persistence, reminders.
   Notifications use the Notification Triggers API where the
   browser supports it (fires even when the app is closed —
   e.g. Chrome on Android), and fall back to in-app timers.
   ============================================================ */
(function () {
  'use strict';

  /* ---- plan + meals (single source of truth) ---- */
  var PLAN = { kcal: 2500, protein: 150, carbs: 335, fat: 66 };
  var MEALS = [
    { id: 1, name: 'Breakfast',   time: '07:30', short: 'Oats, milk, banana, 3 eggs',     kcal: 670, protein: 35, carbs: 80,  fat: 24 },
    { id: 2, name: 'Mid-morning', time: '11:00', short: 'Curd + a fruit',                 kcal: 150, protein: 6,  carbs: 25,  fat: 3  },
    { id: 3, name: 'Lunch',       time: '13:30', short: 'Rice, light fish curry, dal',    kcal: 780, protein: 48, carbs: 120, fat: 13 },
    { id: 4, name: 'Pre-gym',     time: '17:00', short: 'Banana + dates',                 kcal: 185, protein: 2,  carbs: 48,  fat: 0  },
    { id: 5, name: 'Post-gym',    time: '18:45', short: 'Milk + 2 eggs (or whey)',        kcal: 265, protein: 21, carbs: 12,  fat: 15 },
    { id: 6, name: 'Dinner',      time: '20:00', short: 'Roti, grilled chicken, veg',     kcal: 450, protein: 38, carbs: 50,  fat: 11 }
  ];

  /* ---- storage (try/catch so it degrades in sandboxes) ---- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  function todayKey() { return 'plate:log:' + new Date().toISOString().slice(0, 10); }

  var logged = store.get(todayKey(), {});
  var defaultTimes = {};
  MEALS.forEach(function (m) { defaultTimes[m.id] = m.time; });
  var reminders = store.get('plate:reminders', { enabled: false, times: defaultTimes });
  if (!reminders.times) reminders.times = defaultTimes;

  function $(id) { return document.getElementById(id); }
  function txt(id, v) { var e = $(id); if (e) e.textContent = v; }

  /* ---- rings ---- */
  function setRing(id, value, target) {
    var el = $(id);
    if (!el) return;
    var len;
    try { len = el.getTotalLength(); } catch (e) { len = 2 * Math.PI * parseFloat(el.getAttribute('r')); }
    var pct = Math.max(0, Math.min(1, value / target));
    el.style.strokeDasharray = len;
    el.style.strokeDashoffset = len * (1 - pct);
  }

  function recalc() {
    var t = { kcal: 0, protein: 0, carbs: 0, fat: 0 }, count = 0;
    MEALS.forEach(function (m) {
      if (logged[m.id]) { count++; t.kcal += m.kcal; t.protein += m.protein; t.carbs += m.carbs; t.fat += m.fat; }
    });
    txt('calVal', t.kcal);
    txt('calTarget', 'of ' + PLAN.kcal + ' kcal');
    txt('calLeft', Math.max(0, PLAN.kcal - t.kcal) + ' left');
    txt('proVal', t.protein); txt('carbVal', t.carbs); txt('fatVal', t.fat);
    txt('proT', '/' + PLAN.protein); txt('carbT', '/' + PLAN.carbs); txt('fatT', '/' + PLAN.fat);
    txt('mealCount', count);
    txt('mealTotal', MEALS.length);
    setRing('ringCal', t.kcal, PLAN.kcal);
    setRing('ringPro', t.protein, PLAN.protein);
    setRing('ringCarb', t.carbs, PLAN.carbs);
    setRing('ringFat', t.fat, PLAN.fat);
    MEALS.forEach(function (m) {
      var card = document.querySelector('.meal[data-id="' + m.id + '"]');
      if (card) card.classList.toggle('done', !!logged[m.id]);
    });
    store.set(todayKey(), logged);
  }

  /* ---- meal toggling ---- */
  document.querySelectorAll('.meal').forEach(function (card) {
    card.addEventListener('click', function () {
      var id = Number(card.getAttribute('data-id'));
      logged[id] = !logged[id];
      recalc();
    });
  });
  var resetBtn = $('resetDay');
  if (resetBtn) resetBtn.addEventListener('click', function () { logged = {}; recalc(); });

  /* ---- date ---- */
  (function () {
    var d = new Date();
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    txt('todayDate', days[d.getDay()] + ' · ' + d.getDate() + ' ' + mon[d.getMonth()]);
  })();

  /* ---- reminders sheet ---- */
  var sheet = $('sheet'), overlay = $('overlay');
  function openSheet() { sheet.classList.add('open'); overlay.classList.add('show'); }
  function closeSheet() { sheet.classList.remove('open'); overlay.classList.remove('show'); }
  $('bellBtn').addEventListener('click', openSheet);
  $('sheetClose').addEventListener('click', closeSheet);
  overlay.addEventListener('click', closeSheet);

  /* time inputs */
  var timeList = $('timeList');
  MEALS.forEach(function (m) {
    var row = document.createElement('label');
    row.className = 'time-row';
    row.innerHTML = '<span>' + m.name + '</span><input type="time" data-id="' + m.id + '" value="' + (reminders.times[m.id] || m.time) + '">';
    timeList.appendChild(row);
  });
  timeList.addEventListener('change', function (e) {
    if (e.target && e.target.matches('input[type=time]')) {
      reminders.times[e.target.getAttribute('data-id')] = e.target.value;
      store.set('plate:reminders', reminders);
      if (reminders.enabled) scheduleAll();
    }
  });

  /* enable toggle */
  var toggle = $('remToggle');
  var notifOK = ('Notification' in window);
  toggle.checked = !!(reminders.enabled && notifOK && Notification.permission === 'granted');
  toggle.addEventListener('change', function () {
    if (toggle.checked) {
      enableReminders().then(function (ok) { toggle.checked = ok; });
    } else {
      reminders.enabled = false; store.set('plate:reminders', reminders);
      clearScheduled(); toast('Reminders off');
    }
  });

  $('testBtn').addEventListener('click', testNotification);

  /* support note */
  (function () {
    var note = $('supportNote');
    if (!notifOK) { note.textContent = 'This browser does not support notifications.'; return; }
    note.textContent = supportsTriggers()
      ? 'Background reminders supported — alerts fire at meal times even when the app is closed.'
      : 'Reminders fire while the app is open in the background. For guaranteed closed-app alerts, use Chrome on Android (or add a push backend later).';
  })();

  /* ---- notification engine ---- */
  function supportsTriggers() {
    return ('Notification' in window) && ('showTrigger' in Notification.prototype) && ('TimestampTrigger' in window);
  }

  function enableReminders() {
    return new Promise(function (resolve) {
      if (!notifOK) { toast('Notifications not supported'); return resolve(false); }
      var go = function (perm) {
        if (perm !== 'granted') { toast('Permission blocked — allow it in browser settings'); return resolve(false); }
        reminders.enabled = true; store.set('plate:reminders', reminders);
        scheduleAll().then(function () { toast('Meal reminders on'); resolve(true); });
      };
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(go);
      } else { go(Notification.permission); }
    });
  }

  function getReg() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker.ready.catch(function () { return null; });
  }

  function nextDateFor(timeStr, dayOffset) {
    var p = timeStr.split(':');
    var d = new Date();
    d.setHours(Number(p[0]), Number(p[1]), 0, 0);
    d.setDate(d.getDate() + dayOffset);
    return d;
  }

  function notifOpts(m, when) {
    return {
      body: m.short + ' · ' + m.protein + 'g protein',
      tag: 'plate-meal-' + m.id + '-' + when.toISOString().slice(0, 10),
      icon: 'icon-192.png',
      badge: 'favicon.png',
      data: { url: '.' },
      renotify: true
    };
  }

  var timeouts = [];
  function clearTimeouts() { timeouts.forEach(function (t) { clearTimeout(t); }); timeouts = []; }

  function clearScheduled() {
    clearTimeouts();
    return getReg().then(function (reg) {
      if (reg && reg.getNotifications) {
        return reg.getNotifications({ includeTriggered: true }).then(function (ns) {
          ns.forEach(function (n) { if (n.tag && n.tag.indexOf('plate-meal-') === 0) n.close(); });
        }).catch(function () {});
      }
    });
  }

  function scheduleAll() {
    return clearScheduled().then(function () {
      return getReg().then(function (reg) {
        if (reg && supportsTriggers()) {
          var chain = Promise.resolve();
          for (var day = 0; day <= 2; day++) {
            (function (day) {
              MEALS.forEach(function (m) {
                var when = nextDateFor(reminders.times[m.id] || m.time, day);
                if (when.getTime() > Date.now() + 1000) {
                  chain = chain.then(function () {
                    var opts = notifOpts(m, when);
                    opts.showTrigger = new TimestampTrigger(when.getTime());
                    return reg.showNotification('Time to eat — ' + m.name, opts).catch(function () {});
                  });
                }
              });
            })(day);
          }
          return chain;
        }
        // fallback — only fires while the app is running
        MEALS.forEach(function (m) {
          var when = nextDateFor(reminders.times[m.id] || m.time, 0);
          var delay = when.getTime() - Date.now();
          if (delay > 1000 && delay < 24 * 3600 * 1000) {
            timeouts.push(setTimeout(function () {
              getReg().then(function (r) {
                if (r) r.showNotification('Time to eat — ' + m.name, notifOpts(m, when));
                else if (Notification.permission === 'granted') new Notification('Time to eat — ' + m.name, notifOpts(m, when));
              });
            }, delay));
          }
        });
      });
    });
  }

  function testNotification() {
    if (!notifOK) { toast('Not supported'); return; }
    var fire = function (perm) {
      if (perm !== 'granted') { toast('Allow notifications first'); return; }
      getReg().then(function (reg) {
        var opts = { body: 'If you can see this, reminders will work.', icon: 'icon-192.png', badge: 'favicon.png', tag: 'plate-test' };
        if (reg) reg.showNotification('Plate — test reminder', opts);
        else new Notification('Plate — test reminder', opts);
        toast('Test sent');
      });
    };
    if (Notification.permission === 'default') Notification.requestPermission().then(fire);
    else fire(Notification.permission);
  }

  /* re-arm on focus (rolling days + fallback timers) */
  window.addEventListener('focus', function () { if (reminders.enabled) scheduleAll(); });

  /* ---- install prompt ---- */
  var deferredPrompt = null, installBtn = $('installBtn');
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferredPrompt = e;
    if (installBtn) installBtn.style.display = 'inline-flex';
  });
  if (installBtn) installBtn.addEventListener('click', function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () { deferredPrompt = null; installBtn.style.display = 'none'; });
  });
  window.addEventListener('appinstalled', function () { if (installBtn) installBtn.style.display = 'none'; toast('Installed — find Plate on your home screen'); });

  /* ---- toast ---- */
  var toastT;
  function toast(msg) {
    var el = $('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  /* ---- service worker ---- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js')
        .then(function () { if (reminders.enabled) scheduleAll(); })
        .catch(function () {});
    });
  }

  recalc();
})();
