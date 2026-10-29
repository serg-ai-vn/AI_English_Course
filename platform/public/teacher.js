/* ============================================================
   Teacher console (Lesson 2, Piece 2).
   Renders a read-only table of students: field statuses, the
   latest prompt of each student (Prompt Journal), a "needs help"
   flag for anyone stuck mid-flow. Refresh on demand or every few
   seconds (auto toggle). The server is the single source of truth.
   ============================================================ */
'use strict';

var state = { overview: null, openId: null, timer: null, lesson: null };

function token() { return localStorage.getItem('token') || ''; }

async function api(path, method, body) {
  var res = await fetch(path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401 || res.status === 403) { location.href = '/login.html'; throw new Error('unauthorized'); }
  return res.json();
}

function el(tag, className, text) {
  var e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function initials(name) {
  var n = String(name || '?').trim();
  return n.slice(0, 2).toUpperCase();
}

function relTime(ts) {
  if (!ts) return '';
  var diff = Date.now() - ts;
  if (diff < 0) diff = 0;
  var s = Math.floor(diff / 1000);
  if (s < 45) return 'just now';
  var m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  var h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  var d = Math.floor(h / 24);
  if (d < 7) return d + 'd ago';
  return new Date(ts).toISOString().slice(0, 10);
}

function stateLabel(s) {
  return s === 'complete' ? 'Complete' : (s === 'working' ? 'In progress' : 'Not started');
}

/* ---------- boot / refresh ---------- */

async function boot() {
  if (!token()) { location.href = '/login.html'; return; }
  var q = new URLSearchParams(location.search).get('lesson');
  if (q) state.lesson = Number(q);
  await refreshOverview();
}

async function refreshOverview() {
  try {
    var q = state.lesson ? '?lesson=' + state.lesson : '';
    state.overview = await api('/api/teacher/overview' + q, 'GET');
    render();
  } catch (e) { /* redirected to login by api() */ }
}

/* ---------- render ---------- */

function render() {
  var ov = state.overview;
  document.getElementById('lesson-tag').textContent = 'Lesson ' + ov.lesson + ' - ' + ov.title;
  document.getElementById('who').textContent = 'Teacher \u00B7 ' + ov.class.code + ' (' + ov.class.name + ')';
  renderConsoleTabs(ov);
  renderSummary(ov.summary);
  renderTable();
  document.getElementById('last-refresh').textContent = 'updated ' + new Date().toLocaleTimeString();
}

/* Lesson switcher: the whole console (summary, table, chips, journal) shows
   the selected lesson. Defaults to Lesson 2 until the teacher clicks another. */
function renderConsoleTabs(ov) {
  var tabs = document.getElementById('console-tabs');
  tabs.innerHTML = '';
  var list = ov.lessons || [];
  if (list.length <= 1) { tabs.hidden = true; return; }
  tabs.hidden = false;
  list.forEach(function (l) {
    var b = el('button', 'lesson-tab' + (l.lesson === ov.lesson ? ' active' : ''), 'Lesson ' + l.lesson);
    b.title = l.title;
    b.addEventListener('click', function () {
      if (l.lesson === ov.lesson) return;
      state.lesson = l.lesson;
      state.openId = null;
      refreshOverview();
    });
    tabs.appendChild(b);
  });
}

function renderSummary(s) {
  var box = document.getElementById('summary');
  box.innerHTML = '';
  if (!s) return;
  function card(num, label, opts) {
    opts = opts || {};
    var c = el('div', 'sum-card' + (opts.attn ? ' attn' : '') + (opts.ok ? ' ok' : ''));
    c.appendChild(el('div', 'sum-num' + (opts.grad ? ' grad' : ''), String(num)));
    c.appendChild(el('div', 'sum-label', label));
    return c;
  }
  box.appendChild(card(s.total, 'students', { grad: true }));
  box.appendChild(card(s.complete, 'complete on this lesson'));
  box.appendChild(card(s.working, 'in progress'));
  box.appendChild(card(s.notStarted, 'not started'));
  box.appendChild(card(s.needsAttention, 'need help', { attn: true }));
  if (s.readyToBuild != null) box.appendChild(card(s.readyToBuild, 'ready to build', { ok: true }));
  if (s.built != null) box.appendChild(card(s.built, 'sites built', { ok: true }));
  if (s.readyToPublish != null) box.appendChild(card(s.readyToPublish, 'ready to publish', { ok: true }));
  if (s.published != null) box.appendChild(card(s.published, 'published', { ok: true }));

  var help = document.getElementById('console-help');
  if (s.needsAttention > 0) {
    help.hidden = false;
    help.textContent = s.needsAttention + ' student(s) started a prompt cycle but have not finished it - check their AI fields below.';
  } else if (s.readyToPublish > 0 && s.published < s.readyToPublish) {
    help.hidden = false;
    help.textContent = s.readyToPublish + ' student(s) finished the whole course and are waiting for you to publish their site (Publish button on their row).';
  } else if (s.readyToBuild > 0 && s.built < s.readyToBuild) {
    help.hidden = false;
    help.textContent = s.readyToBuild + ' student(s) finished both lessons and are waiting for you to build their site (Build button on their row).';
  } else {
    help.hidden = true;
  }
}

function renderTable() {
  var wrap = document.getElementById('table-wrap');
  wrap.innerHTML = '';
  var ov = state.overview;

  if (!ov.students.length) {
    wrap.appendChild(el('p', 'rules-card', 'No students in this class yet.'));
    return;
  }

  var tbl = document.createElement('table');
  tbl.className = 'student-table';
  var thead = document.createElement('thead');
  var hr = el('tr');
  ['Student', 'Lesson progress', 'AI fields (accepted / min)', 'Latest prompt', 'Actions'].forEach(function (h) {
    hr.appendChild(el('th', null, h));
  });
  thead.appendChild(hr);
  tbl.appendChild(thead);

  var tbody = document.createElement('tbody');
  ov.students.forEach(function (stu) {
    var nodes = renderRow(stu);
    (Array.isArray(nodes) ? nodes : [nodes]).forEach(function (n) { tbody.appendChild(n); });
  });
  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
}

/* Clickable lesson pill: switches the whole console to this lesson and
   opens this student's journal for it. Stops propagation so the row does
   not toggle its own expand. */
function lessonPill(n, ls, stu) {
  var pill = el('span', 'lesson-pill L' + n + (ls.complete ? ' done' : '') + ' clickable',
    'L' + n + ' ' + ls.done + '/' + ls.total);
  pill.title = 'Show Lesson ' + n + ' data for all students and open ' + stu.name + "'s journal for it";
  pill.addEventListener('click', function (e) {
    e.stopPropagation();
    if (state.lesson === n && state.openId === stu.id) {
      state.openId = null;
      renderTable();
      return;
    }
    state.lesson = n;
    state.openId = stu.id;
    refreshOverview();
  });
  return pill;
}

function renderRow(stu) {
  var tr = el('tr');
  if (stu.state === 'complete') tr.className = 'row-complete';
  if (state.openId === stu.id) tr.classList.add('open-detail');
  tr.style.cursor = 'pointer';

  /* 1 - student */
  var c1 = el('td'); c1.setAttribute('data-th', 'Student');
  var cell = el('div', 'stu-cell');
  cell.appendChild(el('span', 'stu-avatar', initials(stu.name)));
  var meta = el('div', 'stu-meta');
  meta.appendChild(el('span', 'stu-name', stu.name));
  meta.appendChild(el('span', 'state-pill ' + stu.state, stateLabel(stu.state)));
  if (stu.needsAttention) meta.appendChild(el('span', 'attn-badge', 'needs help'));
  if (stu.readyToBuild) meta.appendChild(el('span', 'attn-badge ok', 'ready to build'));
  if (stu.readyToPublish) meta.appendChild(el('span', 'attn-badge ok', 'ready to publish'));
  if (stu.published) meta.appendChild(el('span', 'attn-badge ok', 'published'));
  var ls = stu.lessonsStatus || {};
  if (ls['2']) meta.appendChild(lessonPill(2, ls['2'], stu));
  if (ls['3']) meta.appendChild(lessonPill(3, ls['3'], stu));
  if (ls['4']) meta.appendChild(lessonPill(4, ls['4'], stu));
  if (ls['5']) meta.appendChild(lessonPill(5, ls['5'], stu));
  cell.appendChild(meta);
  var correction=el('button','btn btn-ghost mini-btn','Allow correction');
  correction.addEventListener('click',async function(e){e.stopPropagation();var field=prompt('Field ID (about-me, hobby-text-1, avatar, background, hobby-image-1, theme, reflection-1, etc.)');if(!field)return;var reason=prompt('Reason for reopening this field');if(!reason)return;var r=await api('/api/teacher/allow-correction','POST',{studentId:stu.id,field:field,reason:reason});if(!r.ok)alert(r.error || 'Cannot allow correction');else refreshOverview();});cell.appendChild(correction);
  c1.appendChild(cell);
  tr.appendChild(c1);

  /* 2 - progress */
  var c2 = el('td'); c2.setAttribute('data-th', 'Progress');
  var p = el('div');
  p.appendChild(el('span', 'iteration-note',
    stu.progress.done + '/' + stu.progress.total + ' done \u00B7 setup ' + stu.setup.done + '/' + stu.setup.total));
  var bar = el('div', 'mini-bar');
  var fill = el('span');
  fill.style.width = (stu.progress.total ? (100 * stu.progress.done / stu.progress.total) : 0) + '%';
  bar.appendChild(fill);
  p.appendChild(bar);
  c2.appendChild(p);
  tr.appendChild(c2);

  /* 3 - AI field chips */
  var c3 = el('td'); c3.setAttribute('data-th', 'AI fields');
  var chips = el('div', 'chip-row');
  stu.aiFields.forEach(function (f) {
    var cls = f.status === 'done' ? 'done' : (f.midflow ? 'mid' : '');
    var chip = el('span', 'fchip ' + cls, f.label);
    var cnt = f.status === 'done' ? '\u2713' : (f.input === 'ai-image-cycle'
      ? (f.accepted + '/' + f.min) : (f.min ? f.accepted + '/' + f.min : '\u00B7'));
    chip.appendChild(el('span', 'fchip-c', cnt));
    var tip;
    if (f.status === 'done') {
      tip = f.label + ' - done' + (f.bonusClaimed ? ' (bonus claimed)' : '');
    } else if (f.midflow) {
      if (f.input === 'ai-text-3step') tip = f.label + ' - ' + (f.nextStep || 'in progress') + ' (' + f.accepted + ' iteration' + (f.accepted === 1 ? '' : 's') + ')';
      else if (f.input === 'ai-cycle-bonus') tip = f.label + ' - ' + (f.nextStep || 'in progress') + ' (' + f.accepted + ' iteration' + (f.accepted === 1 ? '' : 's') + ')';
      else tip = f.label + ' - stuck: ' + f.accepted + ' of ' + f.min + ' prompts accepted, needs more';
    } else {
      tip = f.label + ' - open: no prompts yet';
    }
    chip.title = tip;
    chips.appendChild(chip);
  });
  c3.appendChild(chips);
  tr.appendChild(c3);

  /* 4 - latest prompt */
  var c4 = el('td'); c4.setAttribute('data-th', 'Latest prompt');
  var lp = el('div', 'last-prompt');
  if (stu.lastActivity) {
    var metaText = stu.lastActivity.label;
    if (stu.lastActivity.ts) metaText += ' \u00B7 ' + relTime(stu.lastActivity.ts);
    lp.appendChild(el('span', 'lp-meta', metaText));
    var t = el('div', 'lp-text', stu.lastActivity.prompt || '');
    t.title = stu.lastActivity.prompt || '';
    lp.appendChild(t);
  } else {
    lp.appendChild(el('span', 'lp-none', 'No prompts yet'));
  }
  c4.appendChild(lp);
  tr.appendChild(c4);

  /* 5 - actions: unlock next lesson, build site, built stamp. Clicks on
     these buttons must not toggle the row expand, so they stop the event. */
  var c5 = el('td'); c5.style.textAlign = 'right'; c5.setAttribute('data-th', 'Actions');
  var actBox = el('div', 'act-box');

  /* Unlock Lesson 3: appears only when Lesson 2 is complete AND Lesson 3 is
     not yet unlocked for this student. */
  var ls = stu.lessonsStatus || {};
  var l2done = ls['2'] && ls['2'].complete;
  var l3done = ls['3'] && ls['3'].complete;
  var unlocked = stu.unlockedLessons || [];
  if (l2done && unlocked.indexOf(3) === -1) {
    var unBtn = el('button', 'btn btn-ghost mini-btn', 'Unlock Lesson 3');
    unBtn.title = 'Lesson 2 is complete. Open the digital workspace for Lesson 3 (visuals).';
    unBtn.addEventListener('click', async function (e) {
      e.stopPropagation();
      if (!confirm('Unlock Lesson 3 for ' + stu.name + '? This opens the visuals workspace.')) return;
      var res = await api('/api/teacher/unlock-lesson', 'POST', { studentId: stu.id, lesson: 3 });
      if (!res.ok) { alert(res.error || 'Could not unlock.'); return; }
      refreshOverview();
    });
    actBox.appendChild(unBtn);
  }

  /* Unlock Lesson 4: Lesson 3 complete, Lesson 4 not yet unlocked. */
  if (l3done && unlocked.indexOf(4) === -1) {
    var un4Btn = el('button', 'btn btn-ghost mini-btn', 'Unlock Lesson 4');
    un4Btn.title = 'Lesson 3 is complete. Open the Lesson 4 workspace (hobby images + theme).';
    un4Btn.addEventListener('click', async function (e) {
      e.stopPropagation();
      if (!confirm('Unlock Lesson 4 for ' + stu.name + '? This opens the hobby images + theme workspace.')) return;
      var res = await api('/api/teacher/unlock-lesson', 'POST', { studentId: stu.id, lesson: 4 });
      if (!res.ok) { alert(res.error || 'Could not unlock.'); return; }
      refreshOverview();
    });
    actBox.appendChild(un4Btn);
  }

  /* Unlock Lesson 5: Lesson 4 complete, Lesson 5 not yet unlocked. */
  var l4done = ls['4'] && ls['4'].complete;
  var l5done = ls['5'] && ls['5'].complete;
  if (l4done && unlocked.indexOf(5) === -1) {
    var un5Btn = el('button', 'btn btn-ghost mini-btn', 'Unlock Lesson 5');
    un5Btn.title = 'Lesson 4 is complete. Open the final audit + reflection workspace.';
    un5Btn.addEventListener('click', async function (e) {
      e.stopPropagation();
      if (!confirm('Unlock Lesson 5 for ' + stu.name + '? This opens the final audit + reflection workspace.')) return;
      var res = await api('/api/teacher/unlock-lesson', 'POST', { studentId: stu.id, lesson: 5 });
      if (!res.ok) { alert(res.error || 'Could not unlock.'); return; }
      refreshOverview();
    });
    actBox.appendChild(un5Btn);
  }

  /* Build site: appears when the content lessons (L2-L4) are complete. */
  if (stu.readyToBuild && !stu.readyToPublish) {
    var buildBtn = el('button', 'btn btn-primary mini-btn', 'Build site');
    buildBtn.title = 'Assemble the single-file HTML (inline images + particles).';
    var stamp = stu.built && stu.built.ts ? relTime(stu.built.ts) : null;
    if (stamp) buildBtn.textContent = 'Rebuild (' + stamp + ')';
    buildBtn.addEventListener('click', async function (e) {
      e.stopPropagation();
      buildBtn.disabled = true;
      buildBtn.textContent = 'Building...';
      try {
        var res = await api('/api/teacher/build-site', 'POST', { studentId: stu.id });
        buildBtn.disabled = false;
        if (!res.ok) { alert(res.error || 'Build failed.'); buildBtn.textContent = 'Build site'; return; }
        buildBtn.textContent = 'Built! Open';
        buildBtn.classList.add('ok');
        buildBtn.onclick = function () { window.open(res.url, '_blank'); };
        refreshOverview();
      } catch (err) { buildBtn.disabled = false; buildBtn.textContent = 'Build site'; alert('Build failed.'); }
    });
    actBox.appendChild(buildBtn);
  }

  if (stu.built && stu.built.ts) {
    var open = el('a', 'built-link');
    open.href = (stu.built.url || ('/preview/' + stu.built.file));
    open.target = '_blank';
    open.textContent = 'open ' + (stu.built.file || 'site');
    open.title = 'Built ' + relTime(stu.built.ts) + ', ' + Math.round((stu.built.size / 1024)) + ' KB';
    actBox.appendChild(open);
  }

  /* Publish (Lesson 5 export): final handover, only after the whole course
     (L2-L5) is complete. Runs the same export pipeline and stamps the
     progress as published. */
  if (stu.readyToPublish && !stu.published) {
    var pubBtn = el('button', 'btn btn-publish mini-btn', 'Publish site');
    pubBtn.title = 'Final export: assemble the single-file HTML and hand it to the family (requires the reflection to use a lesson word).';
    pubBtn.addEventListener('click', async function (e) {
      e.stopPropagation();
      if (!confirm('Publish the final site for ' + stu.name + '? This is the export handed over to the family.')) return;
      pubBtn.disabled = true;
      pubBtn.textContent = 'Publishing...';
      try {
        var res = await api('/api/teacher/export-site', 'POST', { studentId: stu.id });
        pubBtn.disabled = false;
        if (!res.ok) { alert(res.error || 'Publish failed.'); pubBtn.textContent = 'Publish site'; return; }
        pubBtn.textContent = 'Published!';
        pubBtn.classList.add('ok');
        pubBtn.onclick = function () { window.open(res.url, '_blank'); };
        refreshOverview();
      } catch (err) { pubBtn.disabled = false; pubBtn.textContent = 'Publish site'; alert('Publish failed.'); }
    });
    actBox.appendChild(pubBtn);
  }

  if (stu.published && stu.published.ts) {
    var pub = el('span', 'act-box-inline');
    var pubOpen = el('a', 'built-link pub');
    pubOpen.href = stu.published.url || ('/preview/' + stu.published.file);
    pubOpen.target = '_blank';
    pubOpen.textContent = 'open published site';
    pubOpen.title = 'Published ' + relTime(stu.published.ts) + ', ' + Math.round((stu.published.size / 1024)) + ' KB';
    pub.appendChild(pubOpen);
    var dl = el('a', 'built-link pub');
    dl.href = (stu.published.url || ('/preview/' + stu.published.file)) + '?download=1';
    dl.textContent = 'download file';
    dl.title = 'Single-file HTML for the family - opens anywhere, no server needed.';
    pub.appendChild(dl);
    actBox.appendChild(pub);
  }

  c5.appendChild(actBox);
  tr.appendChild(c5);

  tr.addEventListener('click', function (e) {
    if (e.target.closest('.act-box')) return;   /* don't expand when a button is clicked */
    state.openId = (state.openId === stu.id) ? null : stu.id;
    renderTable();
  });

  /* expandable detail row with the full Prompt Journal */
  if (state.openId === stu.id) {
    var dr = el('tr');
    dr.className = 'detail-row';
    var dt = el('td');
    dt.colSpan = 5;
    dt.appendChild(renderDetail(stu));
    dr.appendChild(dt);
    return [tr, dr];
  }
  return tr;
}

function renderDetail(stu) {
  var g = el('div', 'detail-grid');
  stu.journal.forEach(function (f) {
    var df = el('div', 'detail-field');
    var headText = f.fieldLabel + (f.status === 'done' ? ' \u2713' : '');
    if (f.bonusClaimed) headText += ' \u00B7 bonus';
    if (f.nextStep && f.nextStep !== 'done' && f.status !== 'done') headText += ' \u00B7 next: ' + f.nextStep;
    df.appendChild(el('div', 'df-head', headText));
    if (f.input === 'checklist') {
      if (!f.items) { df.appendChild(el('div', 'lp-none', 'Audit not confirmed yet.')); g.appendChild(df); return; }
      df.appendChild(el('div', 'di-row di-edited', 'Final audit confirmed:'));
      ['data', 'hallucination'].forEach(function (key) {
        var label = key === 'data'
          ? 'no real personal data' : 'no AI-invented facts';
        df.appendChild(el('div', 'di-row', (f.items[key] ? '\u2713 ' : '\u2717 ') + label));
      });
      g.appendChild(df);
      return;
    }
    if (f.input === 'direct' && f.value) {
      df.appendChild(el('div', 'di-row di-notes', 'Final answer:'));
      df.appendChild(el('div', 'di-row', String(f.value)));
      g.appendChild(df);
      return;
    }
    if (f.input === 'theme-picker' && f.themeData) {
      var td = f.themeData;
      if (!td.option1 && !td.option2) {
        df.appendChild(el('div', 'lp-none', 'No prompts yet.'));
        g.appendChild(df);
        return;
      }
      [['option1', 1], ['option2', 2]].forEach(function (pair) {
        var o = td[pair[0]];
        if (!o) return;
        var d = el('div', 'detail-iter');
        d.appendChild(el('div', 'di-row', 'Option ' + pair[1] + ' \u00B7 ' + o.presetName + ' \u00B7 mood: ' + (o.moodWord || '')));
        d.appendChild(el('div', 'di-row', 'Prompt: ' + o.prompt));
        df.appendChild(d);
      });
      if (td.choice) {
        df.appendChild(el('div', 'di-row di-edited',
          'Final choice: Option ' + td.choice +
          ' (' + ((td.choice === 1 && td.option1) ? td.option1.presetName : (td.option2 ? td.option2.presetName : '')) + ')'));
      }
      if (td.justification) df.appendChild(el('div', 'di-row di-notes', 'Why: ' + td.justification));
      g.appendChild(df);
      return;
    }
    if (!f.iterations.length) {
      df.appendChild(el('div', 'lp-none', 'No prompts yet.'));
      g.appendChild(df);
      return;
    }
    var isImage = f.input === 'ai-image-cycle' || f.input === 'ai-image-rapid';
    var isAboutMe = f.input === 'ai-text-3step';
    f.iterations.forEach(function (it, i) {
      var d = el('div', 'detail-iter');
      var head = el('div', 'di-row', 'Iteration ' + (i + 1) + (it.ts ? ' \u00B7 ' + relTime(it.ts) : ''));
      if (it.version) head.appendChild(el('span', 'tag kept', 'V' + it.version));
      if (it.stage) {
        if (isAboutMe) head.appendChild(el('span', 'tag kept', 'step ' + it.stage));
        else head.appendChild(el('span', 'tag kept', 'attempt ' + it.stage));
      }
      d.appendChild(head);
      d.appendChild(el('div', 'di-row', 'Prompt: ' + it.prompt));
      if (isImage) {
        if (it.image && it.image.url) {
          var im = document.createElement('img');
          im.src = it.image.url;
          im.alt = 'iter ' + (i + 1);
          im.className = 'di-thumb';
          d.appendChild(im);
        }
        if (it.pros) d.appendChild(el('div', 'di-row', 'pros: ' + it.pros));
        if (it.cons) d.appendChild(el('div', 'di-row', 'cons: ' + it.cons));
        if (it.best) d.appendChild(el('div', 'di-row di-edited', 'Best: ' + (it.best.reason || '')));
        if (it.worst) d.appendChild(el('div', 'di-row di-reject', 'Worst: ' + (it.worst.reason || '')));
        if (it.reason) d.appendChild(el('div', 'di-row di-notes', 'Why change: ' + it.reason));
      } else {
        d.appendChild(el('div', 'di-row', 'AI draft: ' + it.draft));
        if (it.good) d.appendChild(el('div', 'di-row di-edited', 'Good: ' + it.good));
        if (it.needsChange) d.appendChild(el('div', 'di-row di-reject', 'Needs to change: ' + it.needsChange));
        if (it.edited) d.appendChild(el('div', 'di-row di-edited', 'Final edit: ' + it.edited));
        else if (f.status === 'done' && !isAboutMe) d.appendChild(el('div', 'di-row', 'Edit: accepted the AI draft as-is'));
        if (it.reason) d.appendChild(el('div', 'di-row di-notes', 'Why improve: ' + it.reason));
        if (it.notes) d.appendChild(el('div', 'di-row di-notes', 'Notes: ' + it.notes));
      }
      df.appendChild(d);
    });
    g.appendChild(df);
  });
  (stu.corrections || []).forEach(function(c){var note=el('p','iteration-note',c.field+': '+c.before+' → '+c.after+' ('+c.reason+')');g.appendChild(note);});
  return g;
}

/* ---------- auto-refresh ---------- */

document.getElementById('refresh-btn').addEventListener('click', refreshOverview);

var dotEl = document.getElementById('refresh-dot');
document.getElementById('auto-toggle').addEventListener('change', function () {
  if (this.checked) {
    dotEl.classList.add('on');
    state.timer = setInterval(refreshOverview, 5000);
  } else {
    dotEl.classList.remove('on');
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
  }
});

/* ---------- logout ---------- */

document.getElementById('logout-btn').addEventListener('click', async function () {
  try { await api('/api/logout', 'POST', {}); } catch (e) { /* session may be gone */ }
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  location.href = '/login.html';
});

boot();