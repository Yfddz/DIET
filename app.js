/* ============================================================
   Plate — app.js
   Diet planner logic: macro tracking, persistence, an in-app
   plan editor (targets + feeds), a rolling day history with a
   streak counter, and meal-time reminders.
   Notifications use the Notification Triggers API where the
   browser supports it (fires even when the app is closed —
   e.g. Chrome on Android), and fall back to in-app timers.
   ============================================================ */
(function () {
  'use strict';

  /* ---- defaults (used until the user edits, and for "reset") ---- */
  var DEFAULT_PLAN = { kcal: 2500, protein: 150, carbs: 335, fat: 66 };
  var DEFAULT_MEALS = [
    { id: 1, name: 'Breakfast',   time: '07:30', short: 'Oats, milk, banana, 3 eggs',     kcal: 670, protein: 35, carbs: 80,  fat: 24 },
    { id: 2, name: 'Mid-morning', time: '11:00', short: 'Curd + a fruit',                 kcal: 150, protein: 6,  carbs: 25,  fat: 3  },
    { id: 3, name: 'Lunch',       time: '13:30', short: 'Rice, light fish curry, dal',    kcal: 780, protein: 48, carbs: 120, fat: 13 },
    { id: 4, name: 'Pre-gym',     time: '17:00', short: 'Banana + dates',                 kcal: 185, protein: 2,  carbs: 48,  fat: 0  },
    { id: 5, name: 'Post-gym',    time: '18:45', short: 'Milk + 2 eggs (or whey)',        kcal: 265, protein: 21, carbs: 12,  fat: 15 },
    { id: 6, name: 'Dinner',      time: '20:00', short: 'Roti, grilled chicken, veg',     kcal: 450, protein: 38, carbs: 50,  fat: 11 }
  ];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---- storage (try/catch so it degrades in sandboxes) ---- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---- plan + meals (user overrides fall back to defaults) ---- */
  var PLAN = store.get('plate:plan', null) || clone(DEFAULT_PLAN);
  var MEALS = store.get('plate:meals', null) || clone(DEFAULT_MEALS);

  function isoOf(d) { return d.toISOString().slice(0, 10); }
  function dayId() { return isoOf(new Date()); }
  function todayKey() { return 'plate:log:' + dayId(); }

  var logged = store.get(todayKey(), {});
  var history = store.get('plate:history', {});   // { 'YYYY-MM-DD': {kcal,protein,carbs,fat,count,total} }

  function defaultTimes() { var t = {}; MEALS.forEach(function (m) { t[m.id] = m.time; }); return t; }
  var reminders = store.get('plate:reminders', { enabled: false, times: defaultTimes() });
  if (!reminders.times) reminders.times = defaultTimes();

  function $(id) { return document.getElementById(id); }
  function txt(id, v) { var e = $(id); if (e) e.textContent = v; }

  /* ---- time formatting for cards (e.g. "13:30" -> "1:30") ---- */
  function fmtTime(t) {
    var p = String(t || '').split(':');
    var h = Number(p[0]); if (!isFinite(h)) return t;
    var mm = (p[1] || '00');
    if (h === 0) h = 12; else if (h > 12) h -= 12;
    return h + ':' + mm;
  }

  /* ---- rings ---- */
  function setRing(id, value, target) {
    var el = $(id);
    if (!el) return;
    var len;
    try { len = el.getTotalLength(); } catch (e) { len = 2 * Math.PI * parseFloat(el.getAttribute('r')); }
    var pct = target > 0 ? Math.max(0, Math.min(1, value / target)) : 0;
    el.style.strokeDasharray = len;
    el.style.strokeDashoffset = len * (1 - pct);
  }

  /* ---- render meal cards from data ---- */
  function mealCard(m) {
    return '<button class="meal" data-id="' + m.id + '">'
      + '<span class="mtime tnum">' + esc(fmtTime(m.time)) + '</span>'
      + '<span class="mbody">'
      + '<span class="mname">' + esc(m.name) + '</span>'
      + '<span class="mfood">' + esc(m.short) + '</span>'
      + '<span class="mmacros"><i>' + m.kcal + '</i> kcal · <i>' + m.protein + '</i>P · <i>' + m.carbs + '</i>C · <i>' + m.fat + '</i>F</span>'
      + '</span><span class="mcheck"></span></button>';
  }
  function renderMeals() {
    var list = $('mealList');
    if (!list) return;
    list.innerHTML = MEALS.map(mealCard).join('');
  }

  /* ---- totals + persistence ---- */
  var liveCount = 0;
  function recalc() {
    var t = { kcal: 0, protein: 0, carbs: 0, fat: 0 }, count = 0;
    MEALS.forEach(function (m) {
      if (logged[m.id]) { count++; t.kcal += m.kcal; t.protein += m.protein; t.carbs += m.carbs; t.fat += m.fat; }
    });
    liveCount = count;
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
    history[dayId()] = { kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat, count: count, total: MEALS.length };
    store.set('plate:history', history);
    renderWeek();
  }

  /* ---- history / streak ---- */
  function dayComplete(rec) { return !!(rec && rec.total > 0 && rec.count >= rec.total); }

  function recFor(key) {
    if (key === dayId()) return { count: liveCount, total: MEALS.length };
    return history[key];
  }

  function computeStreak() {
    var s = 0, d = new Date();
    for (var i = 0; i < 400; i++) {
      var rec = recFor(isoOf(d));
      if (dayComplete(rec)) { s++; }
      else if (i > 0) { break; }   // a gap on any past day ends the streak
      // i === 0 with today not yet complete: keep counting from yesterday
      d.setDate(d.getDate() - 1);
    }
    return s;
  }

  function renderWeek() {
    var strip = $('weekStrip');
    if (!strip) return;
    var dn = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    var today = dayId();
    var d = new Date(); d.setDate(d.getDate() - 6);
    var html = '';
    for (var i = 0; i < 7; i++) {
      var key = isoOf(d);
      var rec = recFor(key);
      var done = dayComplete(rec);
      var part = !done && rec && rec.total > 0 && rec.count > 0;
      var cls = 'wd' + (done ? ' done' : '') + (part ? ' part' : '') + (key === today ? ' today' : '');
      html += '<div class="' + cls + '"><span class="wd-dot"></span><span class="wd-lbl">' + dn[d.getDay()] + '</span></div>';
      d.setDate(d.getDate() + 1);
    }
    strip.innerHTML = html;
    var streak = computeStreak();
    txt('streakNum', streak);
    txt('streakLbl', streak === 1 ? 'day streak' : 'day streak');
  }

  /* ---- meal toggling (delegated, survives re-render) ---- */
  $('mealList').addEventListener('click', function (e) {
    var card = e.target.closest && e.target.closest('.meal');
    if (!card) return;
    var id = Number(card.getAttribute('data-id'));
    logged[id] = !logged[id];
    recalc();
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

  /* ---- sheets (reminders + edit share one overlay) ---- */
  var sheet = $('sheet'), editSheet = $('editSheet'), overlay = $('overlay');
  function openSheet(el) { el.classList.add('open'); overlay.classList.add('show'); }
  function closeSheets() {
    sheet.classList.remove('open');
    editSheet.classList.remove('open');
    overlay.classList.remove('show');
  }
  $('bellBtn').addEventListener('click', function () { openSheet(sheet); });
  $('sheetClose').addEventListener('click', closeSheets);
  $('editBtn').addEventListener('click', function () { openEditor(); });
  $('editClose').addEventListener('click', closeSheets);
  overlay.addEventListener('click', closeSheets);

  /* ---- reminders: feed-time inputs ---- */
  var timeList = $('timeList');
  function renderTimeList() {
    timeList.innerHTML = MEALS.map(function (m) {
      return '<label class="time-row"><span>' + esc(m.name) + '</span>'
        + '<input type="time" data-id="' + m.id + '" value="' + (reminders.times[m.id] || m.time) + '"></label>';
    }).join('');
  }
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

  /* ---- plan editor ---- */
  var editList = $('editList');

  function mealEditRow(m) {
    return '<div class="erow" data-id="' + m.id + '">'
      + '<div class="erow-top">'
      + '<input type="time" class="ef-time" value="' + esc(m.time) + '">'
      + '<input class="ef-name" value="' + esc(m.name) + '" placeholder="Feed name">'
      + '<button type="button" class="ef-del" aria-label="Remove feed">✕</button>'
      + '</div>'
      + '<input class="ef-food" value="' + esc(m.short) + '" placeholder="Foods">'
      + '<div class="ef-grid">'
      + '<label>kcal<input type="number" inputmode="numeric" class="ef-kcal" value="' + m.kcal + '"></label>'
      + '<label>Protein<input type="number" inputmode="numeric" class="ef-pro" value="' + m.protein + '"></label>'
      + '<label>Carbs<input type="number" inputmode="numeric" class="ef-carb" value="' + m.carbs + '"></label>'
      + '<label>Fat<input type="number" inputmode="numeric" class="ef-fat" value="' + m.fat + '"></label>'
      + '</div></div>';
  }

  function openEditor() {
    $('tgtKcal').value = PLAN.kcal;
    $('tgtPro').value = PLAN.protein;
    $('tgtCarb').value = PLAN.carbs;
    $('tgtFat').value = PLAN.fat;
    editList.innerHTML = MEALS.map(mealEditRow).join('');
    openSheet(editSheet);
  }

  editList.addEventListener('click', function (e) {
    var del = e.target.closest && e.target.closest('.ef-del');
    if (!del) return;
    var row = del.closest('.erow');
    if (editList.querySelectorAll('.erow').length <= 1) { toast('Keep at least one feed'); return; }
    if (row) row.parentNode.removeChild(row);
  });

  $('addMeal').addEventListener('click', function () {
    var maxId = 0;
    editList.querySelectorAll('.erow').forEach(function (r) { maxId = Math.max(maxId, Number(r.getAttribute('data-id')) || 0); });
    var row = document.createElement('div');
    row.innerHTML = mealEditRow({ id: maxId + 1, name: '', time: '12:00', short: '', kcal: 0, protein: 0, carbs: 0, fat: 0 });
    editList.appendChild(row.firstChild);
    editList.lastChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  function intField(id, fallback) {
    var v = parseFloat($(id).value);
    return isFinite(v) && v >= 0 ? Math.round(v) : fallback;
  }
  function rowNum(row, sel) {
    var v = parseFloat(row.querySelector(sel).value);
    return isFinite(v) && v >= 0 ? Math.round(v) : 0;
  }

  function readEditor() {
    var meals = [];
    editList.querySelectorAll('.erow').forEach(function (row) {
      meals.push({
        id: Number(row.getAttribute('data-id')),
        name: (row.querySelector('.ef-name').value || '').trim() || 'Feed',
        short: (row.querySelector('.ef-food').value || '').trim(),
        time: row.querySelector('.ef-time').value || '12:00',
        kcal: rowNum(row, '.ef-kcal'),
        protein: rowNum(row, '.ef-pro'),
        carbs: rowNum(row, '.ef-carb'),
        fat: rowNum(row, '.ef-fat')
      });
    });
    return meals;
  }

  function applyPlan(plan, meals) {
    PLAN = plan;
    MEALS = meals;
    store.set('plate:plan', PLAN);
    store.set('plate:meals', MEALS);
    // drop logged entries + reminder times for feeds that no longer exist
    var ids = {}; MEALS.forEach(function (m) { ids[m.id] = 1; });
    Object.keys(logged).forEach(function (k) { if (!ids[k]) delete logged[k]; });
    var nt = {}; MEALS.forEach(function (m) { nt[m.id] = reminders.times[m.id] || m.time; });
    reminders.times = nt; store.set('plate:reminders', reminders);
    renderMeals();
    renderTimeList();
    recalc();
    if (reminders.enabled) scheduleAll();
  }

  $('saveEdit').addEventListener('click', function () {
    var plan = {
      kcal: intField('tgtKcal', PLAN.kcal),
      protein: intField('tgtPro', PLAN.protein),
      carbs: intField('tgtCarb', PLAN.carbs),
      fat: intField('tgtFat', PLAN.fat)
    };
    var meals = readEditor();
    if (!meals.length) { toast('Add at least one feed'); return; }
    applyPlan(plan, meals);
    closeSheets();
    toast('Plan updated');
  });

  $('resetPlan').addEventListener('click', function () {
    applyPlan(clone(DEFAULT_PLAN), clone(DEFAULT_MEALS));
    openEditor();   // refresh the fields with the restored defaults
    toast('Reset to default plan');
  });

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

  /* ---- boot ---- */
  renderMeals();
  renderTimeList();
  recalc();
})();
