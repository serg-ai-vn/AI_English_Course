/* ============================================================
   Student workspace (multi-lesson) - Lesson 2 v2 interaction.
   Lesson 2 fields:
     direct             - setup text fields (greeting, site title, ...)
     ai-text-3step      - About Me: A1 (prompt+draft+eval) -> A2 (improved prompt+draft+eval) -> A3 (Operator edit + Publish)
     ai-cycle-bonus     - Hobbies: B1 (prompt+draft) -> fork (Publish OR Improve = manual edit + reason -> Publish with Bonus)
    Lesson 3 fields use the same one-stage-at-a-time wizard (ai-image-cycle,
    nextStep-driven: I1-prompt -> I1-eval -> ... -> pick -> accept -> done).
   UX guardrails (per Aug 2026 spec):
     - On any card only one stage inputs/buttons are active at a time.
     - Completed iterations stay VISIBLE inline above the active stage
       (never hidden behind a "View log" button) so the student always
       sees what they wrote, what the AI produced, and what they reviewed.
       Prompt structure labels (Role / Context / Task / Format) are
       highlighted in gold inside these visible prompts.
     - Once a whole field is done it collapses to a green stripe with a
       read-only "View log" expander. No edits allowed.
   ============================================================ */
'use strict';

var state = { me: null, saving: {} };

function token() { return localStorage.getItem('token') || ''; }

async function api(path,method,body){try{var res=await fetch(path,{method:method,headers:{'Content-Type':'application/json','Authorization':'Bearer '+token()},body:body?JSON.stringify(body):undefined});if(res.status===401){location.href='/login.html';return {ok:false,errors:[{hint:'Please log in again.'}]};}var payload=await res.json();if(!res.ok&&!payload.errors)payload.errors=[{hint:payload.error||'Please retry.'}];return payload;}catch(e){return {ok:false,errors:[{hint:'Connection failed. Your input is still here. Retry when connected.'}]};}}

function el(tag, className, text) {
  var e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/* ---------- boot ---------- */

async function boot() {
  if (!token()) { location.href = '/login.html'; return; }
  state.me = await api('/api/me', 'GET');
  render();
}

async function refresh() {
  state.me = await api('/api/me', 'GET');
  render();
}

async function switchLesson(n) {
  try { await api('/api/lesson-switch', 'POST', { lesson: n }); } catch (e) { return; }
  refresh();
}

/* ---------- render ---------- */

function render() {
  var me = state.me;
  var cfg = me.config;
  ['reset-btn','reset-all-btn'].forEach(function(id){var b=document.getElementById(id);if(b)b.hidden=!me.allowReset;});
  var notice=document.getElementById('simulation-notice');if(!notice){notice=el('p','iteration-note','');notice.id='simulation-notice';document.body.insertBefore(notice,document.body.firstChild);}notice.textContent=me.mode==='demo'?'Demo: prepared sample images. Prompts do not change these pictures.':'';


  document.getElementById('lesson-tag').textContent = 'Lesson ' + cfg.lesson + ' - ' + cfg.title;
  document.getElementById('who').textContent = me.student.name + ' (' + me.student.classCode + ')';

  renderLessonTabs(me);
  renderDrivingQuestion(cfg);
  renderVocabStrip(cfg);
  renderRules(cfg);

  /* progress */
  var required = cfg.fields.filter(function (f) { return f.required; });
  var done = required.filter(function (f) {
    return me.progress.fields[f.id] && me.progress.fields[f.id].status === 'done';
  });
  document.getElementById('progress-count').textContent = done.length + '/' + required.length;

  /* sections */
  var sections = document.getElementById('sections');
  sections.innerHTML = '';
  groupsFor(cfg).forEach(function (g) {
    var fields = cfg.fields.filter(g.match);
    if (!fields.length) return;
    var h = el('h2', 'section-title');
    var parts = g.title.split(' ');
    h.appendChild(el('span', 'section-index', parts[0]));
    h.appendChild(document.createTextNode(parts.slice(1).join(' ')));
    sections.appendChild(h);
    fields.forEach(function (f) { sections.appendChild(renderField(f)); });
  });

  renderCompleteBanner(me, cfg);
  renderL5VocabWarning(me, cfg);
}

/* Lesson 5 soft gate: after all reflections are saved, at least one of
   today's words (publish / export / change / presentation) must appear
   across the six answers - the teacher's publish button depends on it.
   Mirrors validate.checkReflectionVocab so the student can fix it first. */
function renderL5VocabWarning(me, cfg) {
  var w = document.getElementById('l5-vocab-warning');
  if (!w) return;
  if (cfg.lesson !== 5 || !me.progress.complete) { w.hidden = true; return; }
  var words = (cfg.rules && cfg.rules.reflectionVocabWords) || [];
  var min = (cfg.rules && cfg.rules.reflectionVocabMin) || 1;
  var joined = cfg.fields
    .filter(function (f) { return f.id.indexOf('reflection-') === 0; })
    .map(function (f) { return String((me.progress.fields[f.id] || {}).value || ''); })
    .join(' ').toLowerCase();
  var used = words.filter(function (word) {
    return new RegExp('\\b' + word + '\\b').test(joined);
  });
  if (used.length >= min) { w.hidden = true; return; }
  w.hidden = false;
  w.textContent = 'Almost done! Add one of today\'s words to your reflection so your teacher can publish: ' + words.join(', ') + '.';
}

function renderDrivingQuestion(cfg) {
  var b = document.getElementById('driving-question');
  if (!b) return;
  if (cfg.drivingQuestion) {
    b.hidden = false;
    b.textContent = cfg.drivingQuestion;
  } else {
    b.hidden = true;
  }
}

/* The global vocab strip is only shown for lessons that do NOT have a
   per-field bank (Lesson 3 keeps the global strip; Lesson 2 hides it
   and renders a per-field bank inside each prompt card). */
function renderVocabStrip(cfg) {
  var strip = document.getElementById('vocab-strip');
  strip.innerHTML = '';
  if (cfg.lesson === 2 && cfg.vocabByField) { strip.hidden = true; return; }
  strip.hidden = false;
  strip.appendChild(el('span', 'strip-label', "Today's words:"));
  cfg.targetVocabulary.forEach(function (w) { strip.appendChild(el('span', 'chip', w)); });
}

/* A small inline vocab bank shown above a prompt area inside a card.
   Picks the per-field list from cfg.vocabByField[fieldId], falls back
   to the global targetVocabulary. A two-group bank ({new:[...],
   review:[...]}, used by Lesson 4) renders as two labeled chip rows. */
function renderVocabBank(cfg, fieldId) {
  var bank = el('div', 'vocab-bank-field');
  var list = (cfg.vocabByField && cfg.vocabByField[fieldId]) || cfg.targetVocabulary || [];
  if (list && !Array.isArray(list) && (list.new || list.review)) {
    if (list.new && list.new.length) {
      bank.appendChild(el('span', 'bank-label', 'New words:'));
      list.new.forEach(function (w) { bank.appendChild(el('span', 'chip', w)); });
    }
    if (list.review && list.review.length) {
      bank.appendChild(el('span', 'bank-label review-label', 'Review words:'));
      list.review.forEach(function (w) { bank.appendChild(el('span', 'chip', w)); });
    }
    return bank;
  }
  bank.appendChild(el('span', 'bank-label', "Today's words:"));
  list.forEach(function (w) { bank.appendChild(el('span', 'chip', w)); });
  return bank;
}

function renderLessonTabs(me) {
  var tabs = document.getElementById('lesson-tabs');
  tabs.innerHTML = '';
  var unlocked = me.unlockedLessons || [me.lesson];
  if (unlocked.length <= 1) { tabs.hidden = true; return; }
  tabs.hidden = false;
  unlocked.sort(function (a, b) { return a - b; });
  unlocked.forEach(function (n) {
    var b = el('button', 'lesson-tab' + (n === me.lesson ? ' active' : ''), 'Lesson ' + n);
    b.addEventListener('click', function () { switchLesson(n); });
    tabs.appendChild(b);
  });
}

function groupsFor(cfg) {
  if (cfg.lesson === 3) {
    return [{ title: '01 Visuals', match: function (f) { return f.input === 'ai-image-cycle'; } }];
  }
  if (cfg.lesson === 4) {
    return [
      { title: '01 Hobby images', match: function (f) { return f.input === 'ai-image-rapid'; } },
      { title: '02 Website theme', match: function (f) { return f.id === 'theme'; } }
    ];
  }
  if (cfg.lesson === 5) {
    return [
      { title: '01 Final audit', match: function (f) { return f.input === 'checklist'; } },
      { title: '02 Reflection', match: function (f) { return f.id.indexOf('reflection-') === 0; } }
    ];
  }
  return [
    { title: '01 Your site header', match: function (f) { return /^hero-|^site-/.test(f.id); } },
    { title: '02 About Me', match: function (f) { return f.id === 'about-me'; } },
    { title: '03 My Hobbies', match: function (f) { return /^hobby-/.test(f.id); } },
    { title: '04 Footer', match: function (f) { return f.id === 'footer-text'; } }
  ];
}

function renderRules(cfg) {
  var rules = document.getElementById('rules-list');
  rules.innerHTML = '';
  var r = cfg.rules;
  var items;
  if (cfg.lesson === 2) {
    items = [
      'About Me runs in <b>three stages</b>: Step 1 (write your first prompt), Step 2 (improve the prompt), Step 3 (you are the Operator - polish & publish).',
      'Every prompt uses the formula: <b>Role: ... Context: ... Task: ... Format: ...</b>',
      'First prompt: at least <b>' + r.promptMinWordsFirst + ' words</b>. Step 2 prompt: at least <b>' +
        r.promptGrowthWords + ' words longer</b> than Step 1. About Me lesson words: at least <b>' + r.promptMinTargetWords + '</b>.',
      '<b>Present Perfect</b> is required in the Context line ("I have played...", "I have been playing...").',
      'Hobbies: one prompt in the same formula. You can <b>Publish</b> straight away or choose <b>Improve this text (bonus)</b> and edit the AI draft by hand + write why you changed it.',
      'After each About Me draft, write your <b>critical review</b>: what is good and what needs to change. This is your analytical feedback - it stays in the journal.'
    ];
  } else if (cfg.lesson === 3) {
    items = [
      'Write your prompt with the formula: <b>Subject:, Style:, Framing:, Lighting:</b>.',
      'Use today\'s visual words: <b>concept art</b>, <b>close-up</b>, <b>volumetric lighting</b>, <b>avatar</b>, <b>background</b>, ...',
      'Generate at least <b>' + (r.minImageIterations || 3) + '</b> iterations. <b>Each one must change</b> at least one formula field (Subject / Style / Framing / Lighting) from your previous prompt.',
      'After every image, fill in <b>pros</b> (what you like) and <b>cons</b> (what you do not like / could be improved) - at least 3 words each.',
      'When done, pick your <b>best</b> image (it goes on your website) and your <b>worst</b> image (a record of what you caught), each with a short English reason.',
      'Act as the Operator: catch AI <b>hallucinations</b> - extra fingers, melted hands, fake text, watermarks, real faces - and put them in your cons.'
    ];
  } else if (cfg.lesson === 4) {
    items = [
      'Hobby images: keep the formula <b>Subject:, Style:, Framing:, Lighting:</b>. You can <b>publish the first image</b> or improve it - up to <b>' + (r.maxImageIterations || 6) + ' attempts</b>.',
      'Each regeneration needs: a <b>reason</b> why the image must change (at least ' + (r.changeReasonMinWords || 3) + ' words) and <b>at least one formula field changed</b> in your new prompt.',
      'Website theme: use the text formula <b>Role:, Context:, Task:, Format:</b> and a <b>mood word</b> in Format (warm, calm, natural, bold, energetic, mysterious (and their related mood words)).',
      'Generate <b>two theme options</b> and compare them. Pick your favorite and <b>justify the choice</b> using comparative words: brighter, calmer, bolder, the boldest...',
      'Your justification also needs a <b>design word</b>: theme, palette, contrast, font, bold, or soft.'
    ];
  } else if (cfg.lesson === 5) {
    items = [
      'Final audit: check your site as the <b>Operator</b> - no real personal data, no AI-invented facts. Confirm both items.',
      'Write your <b>final reflection</b> - six questions, at least <b>' + (r.reflectionMinWords || 15) + ' words</b> each.',
      'Use one of today\'s words in your reflection: <b>publish, export, change, presentation</b>.',
      'When everything is done, your teacher <b>publishes</b> your site and you get the link to share with your family.'
    ];
  } else {
    items = ['(Rules for this lesson are not configured yet.)'];
  }
  items.forEach(function (r) {
    var li = document.createElement('li');
    li.innerHTML = r;
    rules.appendChild(li);
  });
}

function renderCompleteBanner(me, cfg) {
  var banner = document.getElementById('complete-banner');
  var title = document.getElementById('complete-title');
  var body = document.getElementById('complete-body');
  var proceedBtn = document.getElementById('proceed-btn');
  var nextBtn = document.getElementById('next-lesson-btn');
  if (!me.progress.complete) { banner.hidden = true; proceedBtn.hidden = true; nextBtn.hidden = true; return; }
  banner.hidden = false;
  proceedBtn.hidden = false;

  if (cfg.lesson === 2) {
    title.textContent = 'Lesson 2 complete!';
    body.textContent = 'Your texts are published. Ask your teacher to unlock Lesson 3 (visuals) so you can finish your site.';
    proceedBtn.textContent = 'Proceed to Website Preview \u{1F5A5}\u{FE0F}';
    proceedBtn.onclick = function () {
      var msg = document.getElementById('proceed-msg');
      if (!msg) return;
      msg.hidden = false;
      msg.textContent = 'Lesson 3 is still locked. Your teacher will unlock the visuals next - you will design your avatar and background there.';
    };
  } else if (cfg.lesson === 3) {
    title.textContent = 'Lesson 3 complete!';
    body.textContent = 'Your avatar and background are ready. Complete Lesson 4 next; your teacher can build the site after that.';
    proceedBtn.hidden = true;
  } else if (cfg.lesson === 4) {
    title.textContent = 'Lesson 4 complete!';
    body.textContent = 'Your hobby images and your website theme are ready. Your teacher can now build your site.';
    proceedBtn.hidden = true;
  } else if (cfg.lesson === 5) {
    title.textContent = 'Lesson 5 complete!';
    body.textContent = 'Your final audit and reflection are done. Ask your teacher to publish your site and share the link with your family.';
    proceedBtn.hidden = true;
  } else {
    title.textContent = 'Lesson ' + cfg.lesson + ' complete!';
    body.textContent = 'All gates passed.';
    proceedBtn.hidden = true;
  }
  /* If the next lesson is already unlocked, the student can switch. */
  var unlocked = me.unlockedLessons || [me.lesson];
  var next = null;
  for (var n = cfg.lesson + 1; n <= 5; n++) { if (unlocked.indexOf(n) !== -1) { next = n; break; } }
  if (next) {
    nextBtn.hidden = false;
    nextBtn.textContent = 'Open Lesson ' + next;
    nextBtn.onclick = function () { switchLesson(next); };
  } else {
    nextBtn.hidden = true;
  }
}

function renderField(def) {
  var me = state.me;
  var fstate = me.progress.fields[def.id] || emptyFstate(def);
  var isDone = fstate.status === 'done';

  var card = el('div', 'field-card' + (isDone ? ' done' : ''));
  card.id = 'card-' + def.id;

  var head = el('div', 'field-head');
  var status = isDone ? 'done' : 'open';
  head.appendChild(el('span', 'field-label', def.label));
  if (def.brief) head.appendChild(el('span', 'field-brief', def.brief));
  head.appendChild(el('span', 'spacer'));
  head.appendChild(el('span', 'status ' + status, isDone ? 'Done' : 'Open'));
  card.appendChild(head);

  if (isDone) {
    card.appendChild(renderDoneStripe(def, fstate));
    var grants=me.progress.editGrants || {};
    if(grants[def.id] || def.id.indexOf('reflection-')===0) {
      var correct=el('button','btn btn-ghost','Correct this field');card.appendChild(correct);
      correct.addEventListener('click',async function(){
        var reason=prompt('Why are you correcting this field?');if(!reason)return;
        var text=prompt(def.input.indexOf('image')>=0?'Image version number':(def.id==='theme'?'Theme option number (1 or 2)':'Corrected text'),fstate.value || '');if(text===null)return;
        try {var r=await api('/api/correct-field','POST',{field:def.id,text:text,reason:reason});if(!r.ok){showErrors(card,r.errors);return;}refresh();}catch(e){showErrors(card,[{hint:'Could not save. Please try again.'}]);}
      });
    } else card.appendChild(el('small','iteration-note','Ask your teacher to allow a correction.'));

    return card;
  }

  if (def.input === 'direct') renderDirect(card, def, fstate);
  else if (def.input === 'checklist') renderChecklist(card, def, fstate);
  else if (def.input === 'ai-text-3step') renderAboutMe(card, def, fstate);
  else if (def.input === 'ai-cycle-bonus') renderHobby(card, def, fstate);
  else if (def.input === 'ai-image-cycle') renderImageCycle(card, def, fstate);
  else if (def.input === 'ai-image-rapid') renderHobbyImageRapid(card, def, fstate);
  else if (def.input === 'theme-picker') renderThemePicker(card, def, fstate);
  else if (def.input === 'ai-cycle') renderAiCycleLegacy(card, def, fstate);
  return card;
}

function emptyFstate(def) {
  if (def.input === 'checklist') return { status: 'open', items: {} };
  if (def.input === 'ai-image-cycle') return { status: 'open', nextStep: 'I1-prompt', iterations: [], acceptedImage: null };
  if (def.input === 'ai-image-rapid') return { status: 'open', nextStep: 'I1-prompt', iterations: [], publishedVersion: null };
  if (def.input === 'theme-picker') return { status: 'open', nextStep: 'T1-prompt', option1: null, option2: null, choice: null, justification: null };
  if (def.input === 'ai-text-3step') return { status: 'open', nextStep: 'A1-prompt', iterations: [], acceptedPrompts: [] };
  if (def.input === 'ai-cycle-bonus') return { status: 'open', nextStep: 'B1-prompt', iterations: [], acceptedPrompts: [], bonusClaimed: false };
  return { value: '', status: 'open', iterations: [], acceptedPrompts: [] };
}

/* ---------- done stripe + view log ---------- */

function renderDoneStripe(def, fstate) {
  var wrap = el('div', 'done-stripe-wrap');
  var stripe = el('div', 'step-stripe done');
  var label;
  if (def.input === 'ai-text-3step') label = '\u2713 About Me published';
  else if (def.input === 'ai-cycle-bonus') {
    label = '\u2713 ' + def.label + ' published' + (fstate.bonusClaimed ? ' (bonus claimed)' : '');
  } else if (def.input === 'direct') {
    var dv = String(fstate.value || '');
    label = '\u2713 ' + def.label + ': ' + (dv.length > 70 ? dv.slice(0, 70) + '\u2026' : dv);
  } else if (def.input === 'checklist') {
    label = '\u2713 Final Operator Audit completed';
  } else if (def.input === 'ai-image-cycle') {
    label = '\u2713 ' + def.label + ' accepted';
  } else if (def.input === 'ai-image-rapid') {
    label = '\u2713 ' + def.label + ' published (V' + (fstate.publishedVersion || '') + ')';
  } else if (def.input === 'theme-picker') {
    var pName = presetName(fstate);
    label = '\u2713 Website theme selected' + (pName ? ': ' + pName : '');
  } else {
    label = '\u2713 ' + def.label;
  }
  stripe.appendChild(el('span', 'stripe-text', label));
  var viewBtn = el('button', 'btn btn-ghost mini-btn view-log-btn', 'View log');
  viewBtn.addEventListener('click', function () {
    wrap.classList.toggle('expanded');
    viewBtn.textContent = wrap.classList.contains('expanded') ? 'Hide log' : 'View log';
  });
  stripe.appendChild(viewBtn);
  wrap.appendChild(stripe);

  var detail = el('div', 'done-detail');
  detail.hidden = true;
  /* keep detail in sync with the wrap.expanded class via a MutationObserver
     is overkill - simpler: toggle the hidden attr right here. */
  viewBtn.addEventListener('click', function () {
    detail.hidden = !wrap.classList.contains('expanded');
  });

  /* read-only detail content per input type */
  if (def.input === 'direct') {
    detail.appendChild(el('div', 'final-text', String(fstate.value || '')));
  } else if (def.input === 'ai-text-3step') {
    detail.appendChild(el('div', 'final-text', String(fstate.value || '')));
    (fstate.iterations || []).forEach(function (it, i) {
      detail.appendChild(renderReadOnlyIteration(it, i, 'about-me'));
    });
  } else if (def.input === 'ai-cycle-bonus') {
    detail.appendChild(el('div', 'final-text', String(fstate.value || '')));
    (fstate.iterations || []).forEach(function (it, i) {
      detail.appendChild(renderReadOnlyIteration(it, i, 'hobby'));
    });
  } else if (def.input === 'ai-image-cycle') {
    var img = document.createElement('img');
    img.className = 'accepted-image';
    img.src = '/preview/' + (fstate.acceptedImage || fstate.value);
    img.alt = def.label;
    detail.appendChild(img);
    (fstate.iterations || []).forEach(function (it, i) {
      detail.appendChild(renderReadOnlyIteration(it, i, 'image'));
    });
  } else if (def.input === 'ai-image-rapid') {
    var rImg = document.createElement('img');
    rImg.className = 'accepted-image';
    rImg.src = '/preview/' + (fstate.value || '');
    rImg.alt = def.label;
    detail.appendChild(rImg);
    (fstate.iterations || []).forEach(function (it, i) {
      detail.appendChild(renderReadOnlyIteration(it, i, 'rapid'));
    });
  } else if (def.input === 'theme-picker') {
    detail.appendChild(renderThemeDetail(fstate));
  }
  wrap.appendChild(detail);
  return wrap;
}

/* read-only summary of a finalized theme-picker field (View log). */
function renderThemeDetail(fstate) {
  var box = el('div', 'iter-entry read-only');
  var pName = presetName(fstate);
  if (pName) box.appendChild(el('div', 'iter-head', 'Theme: ' + pName));
  ['option1', 'option2'].forEach(function (key) {
    var o = fstate[key];
    if (!o) return;
    var num = key === 'option1' ? 1 : 2;
    var head = el('div', 'di-row', 'Option ' + num + ' \u00B7 ' + o.presetName);
    box.appendChild(head);
    box.appendChild(el('div', 'iter-row-label', 'Prompt:'));
    box.appendChild(renderPromptHighlighted(o.prompt));
    box.appendChild(el('div', 'iter-row', 'Mood: ' + (o.moodWord || '') + ' \u00B7 Preset: ' + o.presetName));
  });
  box.appendChild(el('div', 'iter-row-label', 'Your choice:'));
  box.appendChild(el('div', 'iter-row', 'Option ' + (fstate.choice || '-') + ' (' +
    (fstate.choice === 1 ? (fstate.option1 && fstate.option1.presetName) :
      (fstate.choice === 2 ? (fstate.option2 && fstate.option2.presetName) : '')) + ')'));
  if (fstate.justification) {
    box.appendChild(el('div', 'iter-row-label', 'Why you chose it:'));
    box.appendChild(el('div', 'iter-row', fstate.justification));
  }
  return box;
}

/* resolve the winning preset name of a theme-picker field state */
function presetName(fstate) {
  var cfg = state.me ? state.me.config : null;
  var id = fstate && fstate.value;
  if (!id || !cfg || !cfg.presets) return '';
  var p = cfg.presets.find(function (x) { return x.id === id; });
  return p ? p.name : '';
}

/* read-only view of one iteration as it appears in the "View log" expander. */
function renderReadOnlyIteration(it, i, kind) {
  var box = el('div', 'iter-entry read-only');
  var headTxt = 'Iteration ' + (i + 1);
  if (it.stage) {
    if (kind === 'about-me') headTxt += ' \u00B7 Step ' + it.stage;
    else if (kind === 'hobby') headTxt += ' \u00B7 attempt ' + it.stage;
  }
  box.appendChild(el('div', 'iter-head', headTxt));
  box.appendChild(el('div', 'iter-row-label', 'Prompt:'));
  if (kind === 'image' || kind === 'rapid') {
    box.appendChild(renderPromptHighlighted(it.prompt, L3_LABELS));
    if (it.image && it.image.url) {
      var im = document.createElement('img');
      im.src = it.image.url; im.alt = 'iter ' + (i + 1); im.className = 'img-thumb';
      box.appendChild(im);
    }
    if (it.reason) box.appendChild(el('div', 'iter-row iter-notes', 'Why change: ' + it.reason));
    if (kind === 'image') {
      if (it.pros) box.appendChild(el('div', 'iter-row', 'pros: ' + it.pros));
      if (it.cons) box.appendChild(el('div', 'iter-row', 'cons: ' + it.cons));
      if (it.best) box.appendChild(el('div', 'img-verdict best', 'Best: ' + (it.best.reason || '')));
      if (it.worst) box.appendChild(el('div', 'img-verdict worst', 'Worst: ' + (it.worst.reason || '')));
    }
  } else {
    box.appendChild(renderPromptHighlighted(it.prompt));
    box.appendChild(el('div', 'iter-row-label', 'AI draft:'));
    box.appendChild(el('div', 'iter-row', it.draft));
    if (it.good) box.appendChild(renderEvalLine('good', it.good));
    if (it.needsChange) box.appendChild(renderEvalLine('needs', it.needsChange));
    if (it.edited) {
      box.appendChild(el('div', 'iter-row-label', 'Your final edit:'));
      box.appendChild(el('div', 'iter-row iter-edited', it.edited));
    }
    if (it.reason) box.appendChild(el('div', 'iter-row iter-notes', 'Why improve: ' + it.reason));
  }
  return box;
}

/* Render text with the prompt formula labels highlighted in gold. Safe:
   builds DOM nodes only, no innerHTML, so student-written text can never
   inject markup. labels defaults to the Lesson 2 formula (Role / Context /
   Task / Format); pass ['Subject','Style','Framing','Lighting'] for Lesson 3
   image prompts.                                                          */
function renderPromptHighlighted(promptText, labels) {
  var box = el('div', 'prompt-shown');
  var txt = String(promptText || '');
  labels = labels || ['Role', 'Context', 'Task', 'Format'];
  var alt = labels.join('|');
  var re = new RegExp('(' + alt + ')\\s*:\\s*([\\s\\S]*?)(?=\\s*(?:' + alt + ')\\s*:|$)', 'gi');
  var m;
  var lastIndex = 0;
  var matched = false;
  while ((m = re.exec(txt)) !== null) {
    matched = true;
    if (m.index > lastIndex) {
      box.appendChild(document.createTextNode(txt.slice(lastIndex, m.index)));
    }
    box.appendChild(el('span', 'struct-label', m[1]));
    box.appendChild(el('span', 'struct-sep', ': '));
    box.appendChild(document.createTextNode(String(m[2]).replace(/\s+$/, '')));
    lastIndex = re.lastIndex;
  }
  if (!matched) {
    box.appendChild(document.createTextNode(txt));
  } else if (lastIndex < txt.length) {
    box.appendChild(document.createTextNode(txt.slice(lastIndex)));
  }
  return box;
}

var L3_LABELS = ['Subject', 'Style', 'Framing', 'Lighting'];

function renderEvalLine(kind, value) {
  var line = el('div', 'eval-line');
  line.appendChild(el('span', 'eval-tag ' + kind, kind === 'good' ? 'Good' : 'Needs to change'));
  line.appendChild(document.createTextNode(': ' + value));
  return line;
}

/* Always-visible completed iteration card shown ABOVE the active stage in
   About Me. Renders the prompt (with highlighted structure labels), the
   AI draft, and the student's saved critical review. Nothing is hidden
   behind a View log toggle, so the student always sees what they wrote,
   what the AI produced, and what they reviewed - while working on the
   next stage. */
function renderCompletedIteration(it, i, kind) {
  var wrap = el('div', 'iter-done-card');
  var stage = it.stage || (i + 1);
  var badge = el('div', 'step-badge step-' + stage);
  badge.appendChild(el('span', 'step-num', '\u2713'));
  badge.appendChild(el('span', 'step-title',
    kind === 'about-me' ? ('Step ' + stage + ': Iteration ' + (i + 1) + ' - saved') : ('Iteration ' + (i + 1) + ' - saved')));
  wrap.appendChild(badge);

  wrap.appendChild(el('div', 'draft-label', 'Your prompt'));
  wrap.appendChild(renderPromptHighlighted(it.prompt));
  wrap.appendChild(el('div', 'draft-label', 'AI draft' + (stage >= 2 ? ' V' + stage : ' V1')));
  wrap.appendChild(el('div', 'ai-draft-box', it.draft));

  if (it.good || it.needsChange) {
    wrap.appendChild(el('div', 'draft-label', 'Your critical review'));
    if (it.good) wrap.appendChild(renderEvalLine('good', it.good));
    if (it.needsChange) wrap.appendChild(renderEvalLine('needs', it.needsChange));
  }
  return wrap;
}

/* ---------- direct fields ---------- */

function renderDirect(card, def, fstate) {
  if (def.question) {
    card.appendChild(el('div', 'reflection-question', def.question));
  }
  var input = document.createElement(def.question ? 'textarea' : 'input');
  if (def.question) {
    input.className = 'prompt-area reflection-area';
    input.rows = 3;
  } else {
    input.type = 'text';
    input.placeholder = def.placeholder || def.label;
  }
  input.maxLength = def.maxLength || 200;
  input.value = fstate.value || '';
  card.appendChild(input);

  var actions = el('div', 'field-actions');
  var btn = el('button', 'btn btn-primary', 'Save');
  btn.addEventListener('click', async function () {
    clearErrors(card);
    var res = await api('/api/save-direct', 'POST', { field: def.id, value: input.value });
    if (!res.ok) { showErrors(card, res.errors); return; }
    refresh();
  });
  actions.appendChild(btn);
  var note = el('span', 'iteration-note',
    'Max ' + (def.maxLength || 200) + ' characters' + (def.minWords ? ' \u00B7 at least ' + def.minWords + ' words' : ''));
  actions.appendChild(note);
  card.appendChild(actions);
}

/* ---------- Lesson 5 audit checklist ---------- */

function renderChecklist(card, def, fstate) {
  var boxes = {};
  var saved = fstate.items || {};
  (def.items || []).forEach(function (it) {
    var row = el('label', 'checklist-item');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!saved[it.id];
    boxes[it.id] = cb;
    row.appendChild(cb);
    row.appendChild(document.createTextNode(' ' + it.label));
    card.appendChild(row);
  });

  var actions = el('div', 'field-actions');
  var btn = el('button', 'btn btn-primary', 'Confirm audit');
  btn.disabled = true;
  var update = function () {
    var all = (def.items || []).every(function (it) { return boxes[it.id] && boxes[it.id].checked; });
    btn.disabled = !all;
  };
  (def.items || []).forEach(function (it) { boxes[it.id].addEventListener('change', update); });
  btn.addEventListener('click', async function () {
    clearErrors(card);
    var items = {};
    (def.items || []).forEach(function (it) { items[it.id] = !!boxes[it.id].checked; });
    var res = await api('/api/save-direct', 'POST', { field: def.id, items: items });
    if (!res.ok) { showErrors(card, res.errors); return; }
    refresh();
  });
  actions.appendChild(btn);
  card.appendChild(actions);
}

/* ---------- About Me (ai-text-3step) ----------
   Three sequential stages. Exactly one stage's inputs/buttons are
   visible at any time. Earlier stages collapse into a green stripe
   once the student moves on.                                                */

function renderAboutMe(card, def, fstate) {
  var cfg = state.me.config;
  var its = fstate.iterations || [];
  var nextStep = fstate.nextStep || 'A1-prompt';
  var lastIter = its.length ? its[its.length - 1] : null;

  /* Completed iterations render as always-visible cards above the active
     stage. The student sees their prompt (with highlighted Role/Context/
     Task/Format labels), the AI draft, and their saved critical review at
     all times - nothing is hidden behind a View log button. The iteration
     currently being reviewed (the last one, while on an A1-eval / A2-eval
     stage) is rendered inline in the eval block below instead. */
  var evalInProgress = (nextStep === 'A1-eval' || nextStep === 'A2-eval');
  its.forEach(function (it, i) {
    var isLast = (i === its.length - 1);
    if (isLast && evalInProgress) return;
    card.appendChild(renderCompletedIteration(it, i, 'about-me'));
  });

  /* ---------- Stage A1: write the first prompt ---------- */
  if (nextStep === 'A1-prompt') {
    card.appendChild(stepBadge('Step 1: Your First Draft (Iteration 1)', 1));
    card.appendChild(renderVocabBank(cfg, 'about-me'));

    var pl = el('div', 'draft-label', 'Your prompt');
    pl.appendChild(el('span', 'ai-badge', 'formula: Role + Context + Task + Format'));
    card.appendChild(pl);

    var prompt = document.createElement('textarea');
    prompt.className = 'prompt-area';
    prompt.placeholder = 'Role: A 12-year-old student. Context: I have ... Task: Write ... Format: One paragraph, energetic tone.';
    card.appendChild(prompt);

    var actions = el('div', 'field-actions');
    var genBtn = el('button', 'btn btn-primary', 'Generate Text \u{1F916}');
    actions.appendChild(genBtn);
    card.appendChild(actions);

    genBtn.addEventListener('click', async function () {
      clearErrors(card);
      if (!String(prompt.value || '').trim()) { showErrors(card, [{ hint: 'Write a prompt first.' }]); return; }
      genBtn.disabled = true;
      var res = await api('/api/prompt', 'POST', { field: def.id, prompt: prompt.value });
      genBtn.disabled = false;
      if (!res.ok) { showErrors(card, res.errors); return; }
      refresh();
    });
    return;
  }

  /* ---------- Stage A1-eval: review the V1 draft ---------- */
  if (nextStep === 'A1-eval' && lastIter) {
    card.appendChild(stepBadge('Step 1: Your First Draft (Iteration 1)', 1));
    card.appendChild(el('div', 'draft-label', 'Your prompt'));
    card.appendChild(renderPromptHighlighted(lastIter.prompt));
    card.appendChild(el('div', 'draft-label', 'AI Response V1'));
    card.appendChild(el('div', 'ai-draft-box', lastIter.draft));

    card.appendChild(el('div', 'draft-label', 'Your critical review (write in English)'));
    var goodInput = document.createElement('input');
    goodInput.type = 'text';
    goodInput.className = 'eval-input';
    goodInput.placeholder = 'What is good about this text?';
    card.appendChild(goodInput);

    var needsInput = document.createElement('input');
    needsInput.type = 'text';
    needsInput.className = 'eval-input';
    needsInput.placeholder = 'What needs to change?';
    card.appendChild(needsInput);

    var act = el('div', 'field-actions');
    var saveBtn = el('button', 'btn btn-primary', 'Save Step 1 \u{1F4BE}');
    saveBtn.disabled = true;
    act.appendChild(saveBtn);

    function evalReady() {
      saveBtn.disabled = !(String(goodInput.value || '').trim() && String(needsInput.value || '').trim());
    }
    goodInput.addEventListener('input', evalReady);
    needsInput.addEventListener('input', evalReady);

    saveBtn.addEventListener('click', async function () {
      clearErrors(card);
      saveBtn.disabled = true;
      var res = await api('/api/save-eval', 'POST', { field: def.id, good: goodInput.value, needsChange: needsInput.value });
      saveBtn.disabled = false;
      if (!res.ok) { showErrors(card, res.errors); return; }
      refresh();
    });
    card.appendChild(act);
    return;
  }

  /* ---------- Stage A2: improve the prompt ---------- */
  if (nextStep === 'A2-prompt' && its.length >= 1) {
    card.appendChild(stepBadge('Step 2: Guide your Co-pilot (Iteration 2)', 2));
    var instr = el('div', 'stage-instruction',
      'Modify your prompt to help the AI write better. Use simpler words if the text was too hard. ' +
      'Your new prompt must be at least ' + cfg.rules.promptGrowthWords + ' words longer than Step 1.');
    card.appendChild(instr);
    card.appendChild(renderVocabBank(cfg, 'about-me'));

    var p2Label = el('div', 'draft-label', 'Your improved prompt');
    p2Label.appendChild(el('span', 'ai-badge', 'formula: Role + Context + Task + Format'));
    card.appendChild(p2Label);

    var prompt2 = document.createElement('textarea');
    prompt2.className = 'prompt-area';
    /* Prefilled with the V1 prompt - student edits it manually */
    prompt2.value = its[0].prompt;
    card.appendChild(prompt2);

    var act2 = el('div', 'field-actions');
    var regenBtn = el('button', 'btn btn-primary', 'Regenerate Text \u{1F916}');
    act2.appendChild(regenBtn);
    card.appendChild(act2);

    regenBtn.addEventListener('click', async function () {
      clearErrors(card);
      if (!String(prompt2.value || '').trim()) { showErrors(card, [{ hint: 'Write a prompt first.' }]); return; }
      regenBtn.disabled = true;
      var res = await api('/api/prompt', 'POST', { field: def.id, prompt: prompt2.value });
      regenBtn.disabled = false;
      if (!res.ok) { showErrors(card, res.errors); return; }
      refresh();
    });
    return;
  }

  /* ---------- Stage A2-eval: review the V2 draft ---------- */
  if (nextStep === 'A2-eval' && lastIter) {
    card.appendChild(stepBadge('Step 2: Guide your Co-pilot (Iteration 2)', 2));
    card.appendChild(el('div', 'draft-label', 'Your prompt'));
    card.appendChild(renderPromptHighlighted(lastIter.prompt));
    card.appendChild(el('div', 'draft-label', 'AI Response V2'));
    card.appendChild(el('div', 'ai-draft-box', lastIter.draft));

    card.appendChild(el('div', 'draft-label', 'Your critical review (write in English)'));
    var g2 = document.createElement('input');
    g2.type = 'text'; g2.className = 'eval-input';
    g2.placeholder = 'What is good about this text?';
    card.appendChild(g2);
    var n2 = document.createElement('input');
    n2.type = 'text'; n2.className = 'eval-input';
    n2.placeholder = 'What needs to change?';
    card.appendChild(n2);

    var act3 = el('div', 'field-actions');
    var save2 = el('button', 'btn btn-primary', 'Save Step 2 \u{1F4BE}');
    save2.disabled = true;
    act3.appendChild(save2);
    function eval2Ready() {
      save2.disabled = !(String(g2.value || '').trim() && String(n2.value || '').trim());
    }
    g2.addEventListener('input', eval2Ready);
    n2.addEventListener('input', eval2Ready);
    save2.addEventListener('click', async function () {
      clearErrors(card);
      save2.disabled = true;
      var res = await api('/api/save-eval', 'POST', { field: def.id, good: g2.value, needsChange: n2.value });
      save2.disabled = false;
      if (!res.ok) { showErrors(card, res.errors); return; }
      refresh();
    });
    card.appendChild(act3);
    return;
  }

  /* ---------- Stage A3: Operator edit + Publish ---------- */
  if (nextStep === 'A3-publish' && its.length >= 2) {
    card.appendChild(stepBadge('Step 3: You are the Operator!', 3));
    card.appendChild(el('div', 'stage-instruction',
      'Read the AI draft below. Polish it! Remove boring or difficult words. Make this text sound like YOU.'));
    var draftV2 = its[1].draft;
    card.appendChild(el('div', 'draft-label', 'AI draft (V2) - edit it below'));
    var edit = document.createElement('textarea');
    edit.className = 'edit-area operator-edit';
    edit.value = draftV2;
    card.appendChild(edit);

    var act4 = el('div', 'field-actions');
    var publishBtn = el('button', 'btn btn-publish', 'Publish to Website \u{1F680}');
    publishBtn.disabled = true;
    act4.appendChild(publishBtn);
    var editHint = el('span', 'iteration-note', 'Edit at least one character to unlock Publish.');
    act4.appendChild(editHint);
    card.appendChild(act4);

    function editReady() {
      var changed = String(edit.value || '').trim() !== String(draftV2 || '').trim();
      publishBtn.disabled = !changed;
      editHint.textContent = changed
        ? 'Looks good - you polished the AI draft. Press Publish.'
        : 'Edit at least one character to unlock Publish.';
    }
    edit.addEventListener('input', editReady);

    publishBtn.addEventListener('click', async function () {
      clearErrors(card);
      publishBtn.disabled = true;
      var res = await api('/api/submit-text', 'POST', { field: def.id, text: edit.value });
      publishBtn.disabled = false;
      if (!res.ok) { showErrors(card, res.errors); return; }
      refresh();
    });
    return;
  }
}

function stepBadge(text, num) {
  var b = el('div', 'step-badge step-' + num);
  b.appendChild(el('span', 'step-num', String(num)));
  b.appendChild(el('span', 'step-title', text));
  return b;
}

/* ---------- Hobby (ai-cycle-bonus) ----------
   One prompt + AI draft, then a fork:
     Publish to Website        -> publish (light edit allowed), no bonus
     Improve this text (bonus) -> manually edit the draft by hand + write a
                                  reason, then Publish with Bonus. No second
                                  prompt, no second AI generation - the
                                  student IS the Operator (Sergey, 04.08). */

function renderHobby(card, def, fstate) {
  var cfg = state.me.config;
  var its = fstate.iterations || [];
  var nextStep = fstate.nextStep || 'B1-prompt';
  var lastIter = its.length ? its[its.length - 1] : null;

  /* ---------- B1: write the first prompt ---------- */
  if (nextStep === 'B1-prompt') {
    card.appendChild(stepBadge('Section: My Hobbies - first draft', 1));
    card.appendChild(renderVocabBank(cfg, 'hobby-text'));

    var pl = el('div', 'draft-label', 'Your prompt');
    pl.appendChild(el('span', 'ai-badge', 'formula: Role + Context + Task + Format'));
    card.appendChild(pl);

    var prompt = document.createElement('textarea');
    prompt.className = 'prompt-area';
    prompt.placeholder = 'Role: ... Context: I have ... Task: Write a short paragraph about this hobby. Format: One paragraph.';
    card.appendChild(prompt);

    var actions = el('div', 'field-actions');
    var genBtn = el('button', 'btn btn-primary', 'Generate Hobbies Text \u{1F916}');
    actions.appendChild(genBtn);
    card.appendChild(actions);

    genBtn.addEventListener('click', async function () {
      clearErrors(card);
      if (!String(prompt.value || '').trim()) { showErrors(card, [{ hint: 'Write a prompt first.' }]); return; }
      genBtn.disabled = true;
      var res = await api('/api/prompt', 'POST', { field: def.id, prompt: prompt.value });
      genBtn.disabled = false;
      if (!res.ok) { showErrors(card, res.errors); return; }
      refresh();
    });
    return;
  }

  /* ---------- B1-fork: show prompt + draft + 2 buttons ---------- */
  if (nextStep === 'B1-fork' && lastIter) {
    card.appendChild(stepBadge('Your AI draft - review it', 1));
    card.appendChild(el('div', 'draft-label', 'Your prompt'));
    card.appendChild(renderPromptHighlighted(lastIter.prompt));
    card.appendChild(el('div', 'draft-label', 'AI draft'));
    card.appendChild(el('div', 'ai-draft-box', lastIter.draft));

    /* optional light edit on the first draft - student can polish before
       publishing outright. */
    card.appendChild(el('div', 'draft-label', 'Your edit (optional - polish the draft before publishing)'));
    var edit1 = document.createElement('textarea');
    edit1.className = 'edit-area';
    edit1.value = lastIter.draft;
    card.appendChild(edit1);

    var fork = el('div', 'field-actions fork-actions');
    var pubBtn = el('button', 'btn btn-publish', 'Publish to Website \u{1F680}');
    fork.appendChild(pubBtn);

    var improveBtn = el('button', 'btn btn-improve', 'Improve this text (bonus) \u2728');
    fork.appendChild(improveBtn);
    card.appendChild(fork);

    pubBtn.addEventListener('click', async function () {
      clearErrors(card);
      pubBtn.disabled = true;
      var res = await api('/api/submit-text', 'POST', { field: def.id, text: edit1.value });
      pubBtn.disabled = false;
      if (!res.ok) { showErrors(card, res.errors); return; }
      refresh();
    });
    /* Improve: reveal a manual-edit + reason block below. The student
       edits the AI draft by hand and writes WHY they changed it, then
       publishes with a bonus. No new prompt, no new AI generation - the
       student is the Operator here (Sergey, 04.08 spec revision). */
    improveBtn.addEventListener('click', function () {
      clearErrors(card);
      fork.hidden = true;
      var blk = buildHobbyImproveBlock(def, lastIter);
      card.appendChild(blk);
      blk.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return;
  }
}

/* The Improve sub-block: a manual edit of the AI draft (textarea
   pre-filled with the draft) + a "why improve?" reason field + a
   "Publish with Bonus" button. The bonus publish is unlocked only when
   the student has actually changed the draft (>=1 char) AND written a
   reason - that is the gating that marks the improve path taken. No
   second prompt or AI call happens here (Sergey, 04.08 revision). */
function buildHobbyImproveBlock(def, lastIter) {
  var wrap = el('div', 'improve-block');
  wrap.appendChild(el('div', 'stage-instruction',
    'You are the Operator. Change the AI draft by hand so it sounds like YOU, ' +
    'and write why you improved it. This is the bonus path - no new AI text.'));

  wrap.appendChild(el('div', 'draft-label', 'Your improved text (edit the draft)'));
  var edit = document.createElement('textarea');
  edit.className = 'edit-area';
  edit.value = lastIter.draft;
  wrap.appendChild(edit);

  var reasonBox = el('div', 'reason-input');
  reasonBox.appendChild(el('div', 'draft-label', 'Why did you improve it? (reason)'));
  var reason = document.createElement('input');
  reason.type = 'text';
  reason.className = 'eval-input';
  reason.placeholder = 'e.g. The text was boring, so I added my favorite team.';
  reasonBox.appendChild(reason);
  wrap.appendChild(reasonBox);

  var act = el('div', 'field-actions');
  var pub = el('button', 'btn btn-publish', 'Publish with Bonus! \u{1F680}\u2728');
  pub.disabled = true;
  act.appendChild(pub);
  var hint = el('span', 'iteration-note', 'Edit the text above and write a reason to unlock the bonus.');
  act.appendChild(hint);
  wrap.appendChild(act);

  function bonusReady() {
    var changed = String(edit.value || '').trim() !== String(lastIter.draft || '').trim();
    var hasReason = !!String(reason.value || '').trim();
    pub.disabled = !(changed && hasReason);
    if (!changed) hint.textContent = 'Change the AI draft above (at least one character) to unlock the bonus.';
    else if (!hasReason) hint.textContent = 'Write a reason for your improvement to unlock the bonus.';
    else hint.textContent = 'Looks great - press Publish with Bonus.';
  }
  edit.addEventListener('input', bonusReady);
  reason.addEventListener('input', bonusReady);

  pub.addEventListener('click', async function () {
    clearErrors(wrap);
    pub.disabled = true;
    var res = await api('/api/submit-text', 'POST', { field: def.id, text: edit.value, reason: reason.value });
    pub.disabled = false;
    if (!res.ok) { showErrors(wrap, res.errors); return; }
    refresh();
  });
  return wrap;
}

/* ---------- AI image-cycle (Lesson 3, v2 wizard) ----------
   Same one-stage-at-a-time pattern as Lesson 2's renderAboutMe. The
   fstate.nextStep drives which stage is visible:
     I1-prompt  -> write the first prompt, hit Generate
     I1-eval    -> image appears, write pros/cons, hit Save
     I2-prompt  -> write a changed prompt, hit Generate
     I2-eval    -> ...
     pick       -> all required iterations done, pick best & worst
     accept     -> both picks made, confirm to close the field
     done       -> field closed (rendered as done-stripe by renderField)
   Completed iterations stay visible as green ✓ cards above the active
   stage, so the student always sees what they wrote, what the AI made,
   and how they rated it - same UX guardrail as Lesson 2.              */

function renderImageCycle(card, def, fstate) {
  var me = state.me;
  var cfg = me.config;
  var minIter = cfg.rules.minImageIterations || 3;
  var maxIter = cfg.rules.maxImageIterations || 6;
  var minWords = cfg.rules.prosMinWords || 3;
  var its = fstate.iterations || [];
  var nextStep = fstate.nextStep || 'I1-prompt';

  /* Completed iterations (all except the one being evaluated, if any)
     render as always-visible green cards above the active stage. The
     iteration currently being reviewed is rendered inline below. */
  var evalInProgress = /-eval$/.test(nextStep);
  its.forEach(function (it, i) {
    var isLast = (i === its.length - 1);
    if (isLast && evalInProgress) return;
    card.appendChild(renderCompletedImageIteration(it, i));
  });

  /* ---------- Stage I{n}-prompt: write the prompt, hit Generate ---------- */
  if (/-prompt$/.test(nextStep)) {
    var n = its.length + 1;
    var isFirst = (its.length === 0);
    card.appendChild(stepBadge('Iteration ' + n + ': Your Image Prompt', n));
    if (!isFirst) {
      card.appendChild(el('div', 'stage-instruction',
        'Change at least one of Subject / Style / Framing / Lighting from your last prompt.'));
    }
    card.appendChild(renderVocabBank(cfg, def.id));

    var pl = el('div', 'draft-label', 'Your prompt');
    pl.appendChild(el('span', 'ai-badge', 'Subject: / Style: / Framing: / Lighting:'));
    card.appendChild(pl);

    var prompt = document.createElement('textarea');
    prompt.className = 'prompt-area img-prompt-input';
    prompt.placeholder = 'Subject: a 12-year-old skater with a helmet.\nStyle: concept art.\nFraming: close-up.\nLighting: volumetric lighting.';
    card.appendChild(prompt);

    var actions = el('div', 'field-actions');
    var genBtn = el('button', 'btn btn-primary',
      isFirst ? 'Generate image \u{1F5BC}\u{FE0F}' : 'Generate another image \u{1F5BC}\u{FE0F}');
    if (its.length >= maxIter) genBtn.disabled = true;
    actions.appendChild(genBtn);
    actions.appendChild(el('span', 'iteration-note',
      'Iteration ' + n + ' \u00B7 ' + (its.length < minIter
        ? (minIter - its.length) + ' more after this to unlock picking'
        : 'enough for picking') +
      (its.length >= maxIter ? ' \u00B7 max reached' : '')));
    card.appendChild(actions);

    genBtn.addEventListener('click', async function () {
      clearErrors(card);
      if (!String(prompt.value || '').trim()) {
        showErrors(card, [{ hint: 'Write a prompt first.' }]);
        return;
      }
      genBtn.disabled = true;
      try {
        var res = await api('/api/image-prompt', 'POST', { field: def.id, prompt: prompt.value });
        genBtn.disabled = false;
        if (!res.ok) { showErrors(card, res.errors); return; }
        refresh();
      } catch (e) { genBtn.disabled = false; }
    });
    return;
  }

  /* ---------- Stage I{n}-eval: image shown, write pros/cons ---------- */
  if (evalInProgress && its.length) {
    var lastIter = its[its.length - 1];
    var iterN = its.length;
    card.appendChild(stepBadge('Iteration ' + iterN + ': Rate this image', iterN));

    card.appendChild(el('div', 'draft-label', 'Your prompt'));
    card.appendChild(renderPromptHighlighted(lastIter.prompt, L3_LABELS));

    card.appendChild(el('div', 'draft-label', 'Generated image'));
    var img = document.createElement('img');
    img.className = 'img-preview-big';
    img.src = lastIter.image.url;
    img.alt = 'iteration ' + iterN;
    card.appendChild(img);

    card.appendChild(el('div', 'draft-label', 'Your critical review (write in English)'));
    card.appendChild(el('div', 'stage-instruction',
      'What do you like? What could be improved? (min ' + minWords + ' words each)'));

    var prosInput = document.createElement('input');
    prosInput.type = 'text';
    prosInput.className = 'eval-input';
    prosInput.placeholder = 'What is good about this image?';
    card.appendChild(prosInput);

    var consInput = document.createElement('input');
    consInput.type = 'text';
    consInput.className = 'eval-input';
    consInput.placeholder = 'What needs to change?';
    card.appendChild(consInput);

    var act = el('div', 'field-actions');
    var saveBtn = el('button', 'btn btn-primary', 'Save iteration \u{1F4BE}');
    saveBtn.disabled = true;
    act.appendChild(saveBtn);
    card.appendChild(act);

    function evalReady() {
      saveBtn.disabled = !(String(prosInput.value || '').trim() && String(consInput.value || '').trim());
    }
    prosInput.addEventListener('input', evalReady);
    consInput.addEventListener('input', evalReady);

    saveBtn.addEventListener('click', async function () {
      clearErrors(card);
      saveBtn.disabled = true;
      try {
        var res = await api('/api/image-eval', 'POST', {
          field: def.id, pros: prosInput.value, cons: consInput.value
        });
        saveBtn.disabled = false;
        if (!res.ok) { showErrors(card, res.errors); return; }
        refresh();
      } catch (e) { saveBtn.disabled = false; }
    });
    return;
  }

  /* ---------- Stage pick: all required iterations done, pick best & worst -- */
  if (nextStep === 'pick') {
    card.appendChild(stepBadge('Pick your best and worst image', its.length + 1));
    card.appendChild(el('div', 'stage-instruction',
      'You have ' + its.length + ' iterations. Pick your BEST (it goes on your website) and your WORST (a record of what you caught). They must be different images.'));

    var hasBest = its.some(function (it) { return it.best; });
    var hasWorst = its.some(function (it) { return it.worst; });
    var status = el('div', 'img-status');
    status.appendChild(statusPill('Best', hasBest ? 1 : 0, 1, hasBest));
    status.appendChild(statusPill('Worst', hasWorst ? 1 : 0, 1, hasWorst));
    card.appendChild(status);

    card.appendChild(renderPickPanel(def.id, fstate));

    /* Let the student generate one more iteration (up to max) before picking. */
    if (its.length < maxIter) {
      var moreAct = el('div', 'field-actions');
      var moreBtn = el('button', 'btn btn-ghost', 'Generate one more image \u{1F5BC}\u{FE0F}');
      moreAct.appendChild(moreBtn);
      card.appendChild(moreAct);
      moreBtn.addEventListener('click', function () {
        moreBtn.hidden = true;
        var blk = el('div', 'improve-block');
        blk.appendChild(el('div', 'stage-instruction',
          'Write a new prompt. Change at least one field from your last one.'));
        var p = document.createElement('textarea');
        p.className = 'prompt-area img-prompt-input';
        p.placeholder = 'Subject: ... Style: ... Framing: ... Lighting: ...';
        blk.appendChild(p);
        var b = el('div', 'field-actions');
        var g = el('button', 'btn btn-primary', 'Generate \u{1F5BC}\u{FE0F}');
        g.disabled = true;
        b.appendChild(g);
        blk.appendChild(b);
        p.addEventListener('input', function () { g.disabled = !String(p.value || '').trim(); });
        g.addEventListener('click', async function () {
          clearErrors(blk);
          g.disabled = true;
          try {
            var res = await api('/api/image-prompt', 'POST', { field: def.id, prompt: p.value });
            g.disabled = false;
            if (!res.ok) { showErrors(blk, res.errors); return; }
            refresh();
          } catch (e) { g.disabled = false; }
        });
        card.appendChild(blk);
        p.focus();
      });
    }
    return;
  }

  /* ---------- Stage accept: best & worst chosen, confirm ---------- */
  if (nextStep === 'accept') {
    card.appendChild(stepBadge('Confirm your choice', its.length + 1));
    var bestIt = its.find(function (x) { return x.best; });
    var worstIt = its.find(function (x) { return x.worst; });
    var bestIdx = its.indexOf(bestIt);
    var worstIdx = its.indexOf(worstIt);
    card.appendChild(el('div', 'stage-instruction',
      'Best image (goes on your site): iteration ' + (bestIdx + 1) +
      ' \u2014 "' + (bestIt && bestIt.best.reason) + '"'));
    card.appendChild(el('div', 'stage-instruction',
      'Worst image (your record): iteration ' + (worstIdx + 1) +
      ' \u2014 "' + (worstIt && worstIt.worst.reason) + '"'));

    var act = el('div', 'field-actions');
    var acceptBtn = el('button', 'btn btn-primary', 'Accept this image \u{1F680}');
    act.appendChild(acceptBtn);
    act.appendChild(el('span', 'iteration-note',
      'The best image goes on your website. The worst stays in your journal.'));
    card.appendChild(act);

    acceptBtn.addEventListener('click', async function () {
      clearErrors(card);
      acceptBtn.disabled = true;
      try {
        var res = await api('/api/image-accept', 'POST', { field: def.id });
        acceptBtn.disabled = false;
        if (!res.ok) { showErrors(card, res.errors); return; }
        refresh();
      } catch (e) { acceptBtn.disabled = false; }
    });
    return;
  }
}

/* ---------- Hobby images (ai-image-rapid, Lesson 4) ----------
   Scaffolding Removal: same four-field formula as Lesson 3, but the
   student can publish the FIRST image or improve it up to 6 versions.
   Every regeneration needs a reason (>= 3 words) + a changed prompt
   field. No pros/cons, no best/worst tournament - the reason is the
   critical evaluation here (Sergey, 05.08 spec). Stages:
     I1-prompt -> I1-review -> (Edit & Regenerate) I2-prompt -> ... -> done */

function renderHobbyImageRapid(card, def, fstate) {
  var cfg = state.me.config;
  var maxAttempts = cfg.rules.maxImageIterations || 6;
  var its = fstate.iterations || [];
  var nextStep = fstate.nextStep || 'I1-prompt';

  var reviewInProgress = /-review$/.test(nextStep);
  its.forEach(function (it, i) {
    var isLast = (i === its.length - 1);
    if (isLast && reviewInProgress) return;
    card.appendChild(renderCompletedRapidIteration(it, i));
  });

  /* ---------- Stage I{n}-prompt ---------- */
  if (/-prompt$/.test(nextStep)) {
    var n = its.length + 1;
    var isFirst = (its.length === 0);
    card.appendChild(stepBadge('Version V' + n + ': Your Image Prompt', n));
    if (!isFirst) {
      card.appendChild(el('div', 'stage-instruction',
        'Change at least one of Subject / Style / Framing / Lighting from your last prompt.'));
    }
    card.appendChild(renderVocabBank(cfg, 'hobby-image'));

    var pl = el('div', 'draft-label', 'Your prompt');
    pl.appendChild(el('span', 'ai-badge', 'Subject: / Style: / Framing: / Lighting:'));
    card.appendChild(pl);

    var prompt = document.createElement('textarea');
    prompt.className = 'prompt-area img-prompt-input';
    prompt.placeholder = 'Subject: a soccer ball on the green grass.\nStyle: concept art.\nFraming: close-up.\nLighting: volumetric lighting.';
    card.appendChild(prompt);

    var actions = el('div', 'field-actions');
    var genBtn = el('button', 'btn btn-primary',
      isFirst ? 'Generate Image \u{1F3A8}' : 'Generate V' + n + ' \u{1F3A8}');
    actions.appendChild(genBtn);
    card.appendChild(actions);

    genBtn.addEventListener('click', async function () {
      clearErrors(card);
      if (!String(prompt.value || '').trim()) { showErrors(card, [{ hint: 'Write a prompt first.' }]); return; }
      genBtn.disabled = true;
      try {
        var res = await api('/api/image-prompt', 'POST', { field: def.id, prompt: prompt.value });
        genBtn.disabled = false;
        if (!res.ok) { showErrors(card, res.errors); return; }
        refresh();
      } catch (e) { genBtn.disabled = false; }
    });
    return;
  }

  /* ---------- Stage I{n}-review: Publish / Edit & Regenerate ---------- */
  if (reviewInProgress && its.length) {
    var lastIter = its[its.length - 1];
    var v = its.length;
    var attemptsLeft = Math.max(0, maxAttempts - v);
    var canEdit = v < maxAttempts;

    card.appendChild(stepBadge('Version V' + v + ': review your image', v));
    card.appendChild(el('div', 'draft-label', 'Your prompt'));
    card.appendChild(renderPromptHighlighted(lastIter.prompt, L3_LABELS));
    card.appendChild(el('div', 'draft-label', 'Generated image'));
    var img = document.createElement('img');
    img.className = 'img-preview-big';
    img.src = lastIter.image.url;
    img.alt = 'version ' + v;
    card.appendChild(img);

    var versionSelect=document.createElement('select');fstate.iterations.forEach(function(it){var o=document.createElement('option');o.value=it.version;o.textContent='Version '+it.version;versionSelect.appendChild(o);});versionSelect.value=lastIter.version;card.appendChild(versionSelect);
    var act = el('div', 'field-actions fork-actions');
    var pubBtn = el('button', 'btn btn-publish', 'Publish to Website \u{1F680}');
    act.appendChild(pubBtn);
    if (canEdit) {
      var editBtn = el('button', 'btn btn-ghost', 'Edit & Regenerate \u{1F504}');
      act.appendChild(editBtn);
      act.appendChild(el('span', 'iteration-note',
        'Attempts left: ' + attemptsLeft + '/' + maxAttempts));
    } else {
      card.appendChild(el('div', 'stage-instruction', cfg.hints.noMore || ''));
    }
    card.appendChild(act);

    pubBtn.addEventListener('click', async function () {
      clearErrors(card);
      pubBtn.disabled = true;
      try {
        var res = await api('/api/image-publish', 'POST', { field: def.id,version:Number(versionSelect.value) });
        pubBtn.disabled = false;
        if (!res.ok) { showErrors(card, res.errors); return; }
        refresh();
      } catch (e) { pubBtn.disabled = false; }
    });

    if (canEdit) {
      editBtn.addEventListener('click', function () {
        clearErrors(card);
        act.hidden = true;
        var blk = buildRapidRegenBlock(def, lastIter, v);
        card.appendChild(blk);
        blk.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
    return;
  }
}

/* Edit & Regenerate sub-block: mandatory reason + prefilled prompt for a
   manual edit + Regenerate button. Client unlocks on non-empty reason +
   changed prompt; the server re-validates reason length + formula diff. */
function buildRapidRegenBlock(def, lastIter, version) {
  var wrap = el('div', 'improve-block');
  wrap.appendChild(el('div', 'stage-instruction',
    'You are the Operator. Explain why this image needs to change, then edit your prompt and regenerate.'));

  wrap.appendChild(el('div', 'draft-label', 'Why do you want to change this image? (Write in English)'));
  var reason = document.createElement('input');
  reason.type = 'text';
  reason.className = 'eval-input';
  reason.placeholder = 'e.g. The colors are too dark, so I want bright daylight instead.';
  wrap.appendChild(reason);

  var pl = el('div', 'draft-label', 'Your prompt - edit it below');
  pl.appendChild(el('span', 'ai-badge', 'Subject: / Style: / Framing: / Lighting:'));
  wrap.appendChild(pl);
  var prompt = document.createElement('textarea');
  prompt.className = 'prompt-area img-prompt-input';
  prompt.value = lastIter.prompt;
  wrap.appendChild(prompt);

  var act = el('div', 'field-actions');
  var regenBtn = el('button', 'btn btn-primary', 'Regenerate Image \u{1F3A8}');
  regenBtn.disabled = true;
  act.appendChild(regenBtn);
  var hint = el('span', 'iteration-note', 'Write a reason and change at least one formula field to unlock.');
  act.appendChild(hint);
  wrap.appendChild(act);

  function ready() {
    var hasReason = !!String(reason.value || '').trim();
    var changed = String(prompt.value || '').trim() !== String(lastIter.prompt || '').trim();
    regenBtn.disabled = !(hasReason && changed);
    if (!hasReason) hint.textContent = 'Write why you want to change this image (at least 3 words).';
    else if (!changed) hint.textContent = 'Change at least one of Subject / Style / Framing / Lighting in your prompt.';
    else hint.textContent = 'Looks good - regenerate V' + (version + 1) + '.';
  }
  reason.addEventListener('input', ready);
  prompt.addEventListener('input', ready);

  regenBtn.addEventListener('click', async function () {
    clearErrors(wrap);
    regenBtn.disabled = true;
    try {
      var res = await api('/api/image-regenerate', 'POST', { field: def.id, prompt: prompt.value, reason: reason.value });
      regenBtn.disabled = false;
      if (!res.ok) { showErrors(wrap, res.errors); return; }
      refresh();
    } catch (e) { regenBtn.disabled = false; }
  });
  return wrap;
}

/* A completed rapid iteration as a green card: prompt, image, reason. */
function renderCompletedRapidIteration(it, i) {
  var wrap = el('div', 'iter-done-card');
  var badge = el('div', 'step-badge step-' + (i + 1));
  badge.appendChild(el('span', 'step-num', '\u2713'));
  badge.appendChild(el('span', 'step-title', 'Version V' + (i + 1) + ' \u00B7 saved'));
  wrap.appendChild(badge);
  wrap.appendChild(el('div', 'draft-label', 'Your prompt'));
  wrap.appendChild(renderPromptHighlighted(it.prompt, L3_LABELS));
  wrap.appendChild(el('div', 'draft-label', 'Generated image'));
  var img = document.createElement('img');
  img.className = 'img-preview-inline';
  img.src = it.image.url;
  img.alt = 'version ' + (i + 1);
  wrap.appendChild(img);
  if (it.reason) wrap.appendChild(el('div', 'iter-row iter-notes', 'Why change: ' + it.reason));
  return wrap;
}

/* ---------- Website theme (theme-picker, Lesson 4) ----------
   R.C.T.F. formula (Lesson 2) applied to site design. The mood words in
   the Format tag are matched against the six presets; the student MUST
   generate two options, compare them side by side, choose one and justify
   the choice (comparative/superlative + a design word). Stages:
     T1-prompt -> T2-prompt -> compare -> justify -> done                */

function renderThemePicker(card, def, fstate) {
  var cfg = state.me.config;
  var nextStep = fstate.nextStep || 'T1-prompt';

  /* ---------- T1: Option 1 prompt ---------- */
  if (nextStep === 'T1-prompt') {
    card.appendChild(stepBadge('Step 1: Website Theme Design - Option 1', 1));
    card.appendChild(el('div', 'stage-instruction',
      'Use the R.C.T.F. formula to describe your site mood. The system turns your mood words into a ready-made theme (colors + fonts).'));
    card.appendChild(renderVocabBank(cfg, 'theme'));

    var pl = el('div', 'draft-label', 'Your prompt');
    pl.appendChild(el('span', 'ai-badge', 'formula: Role + Context + Task + Format'));
    card.appendChild(pl);

    var prompt = document.createElement('textarea');
    prompt.className = 'prompt-area';
    prompt.placeholder = 'Role: Act as a creative web designer.\nContext: My website is about energetic sports.\nTask: Suggest a color palette and fonts.\nFormat: An energetic and bold mood with high contrast.';
    card.appendChild(prompt);

    var actions = el('div', 'field-actions');
    var genBtn = el('button', 'btn btn-primary', 'Generate Theme \u{1F3A8}');
    actions.appendChild(genBtn);
    card.appendChild(actions);

    genBtn.addEventListener('click', async function () {
      clearErrors(card);
      if (!String(prompt.value || '').trim()) { showErrors(card, [{ hint: 'Write a prompt first.' }]); return; }
      genBtn.disabled = true;
      var res = await api('/api/theme-prompt', 'POST', { field: def.id, prompt: prompt.value });
      genBtn.disabled = false;
      if (!res.ok) { showErrors(card, res.errors); return; }
      refresh();
    });
    return;
  }

  /* ---------- T2: Option 2 prompt (prefilled, must change) ---------- */
  if (nextStep === 'T2-prompt' && fstate.option1) {
    card.appendChild(renderThemeOptionCard(fstate.option1, 1));
    card.appendChild(stepBadge('Step 2: Generate Option 2 to compare', 2));
    card.appendChild(el('div', 'stage-instruction',
      'Excellent! Now try a different mood to generate Option 2 and compare them. Change the Format tag in your prompt!'));

    var p2 = document.createElement('textarea');
    p2.className = 'prompt-area';
    p2.value = fstate.option1.prompt;
    card.appendChild(p2);

    var act2 = el('div', 'field-actions');
    var gen2 = el('button', 'btn btn-primary', 'Generate Option 2 \u{1F3A8}');
    act2.appendChild(gen2);
    card.appendChild(act2);

    gen2.addEventListener('click', async function () {
      clearErrors(card);
      gen2.disabled = true;
      try {
        var res = await api('/api/theme-second', 'POST', { field: def.id, prompt: p2.value });
        gen2.disabled = false;
        if (!res.ok) { showErrors(card, res.errors); return; }
        if (res.warning) showWarning(card, res.warning);
        refresh();
      } catch (e) { gen2.disabled = false; }
    });
    return;
  }

  /* ---------- compare: dual preview + choose ---------- */
  if (nextStep === 'compare' && fstate.option1 && fstate.option2) {
    card.appendChild(stepBadge('Step 3: Compare your themes', 3));
    card.appendChild(el('div', 'stage-instruction',
      'Both themes are ready. Look at the colors and fonts - which one matches YOU better?'));

    var dual = el('div', 'dual-preview');
    dual.appendChild(renderThemeOptionCard(fstate.option1, 1));
    dual.appendChild(renderThemeOptionCard(fstate.option2, 2));
    card.appendChild(dual);

    var act = el('div', 'field-actions fork-actions');
    var c1 = el('button', 'btn btn-publish', 'Choose Theme 1 \uD83D\uDC4D');
    var c2 = el('button', 'btn btn-ghost', 'Choose Theme 2 \uD83D\uDC4D');
    act.appendChild(c1);
    act.appendChild(c2);
    card.appendChild(act);

    function choose(n) {
      clearErrors(card);
      c1.disabled = true; c2.disabled = true;
      api('/api/theme-choose', 'POST', { field: def.id, choice: n }).then(function (res) {
        if (!res.ok) { showErrors(card, res.errors); c1.disabled = false; c2.disabled = false; return; }
        refresh();
      });
    }
    c1.addEventListener('click', function () { choose(1); });
    c2.addEventListener('click', function () { choose(2); });
    return;
  }

  /* ---------- justify: final choice + journal ---------- */
  if (nextStep === 'justify') {
    var win = (fstate.choice === 1) ? fstate.option1 : fstate.option2;
    card.appendChild(stepBadge('Step 4: Justify your choice', 4));
    card.appendChild(el('div', 'stage-instruction',
      'You chose ' + (win ? win.presetName : '') + '. Compare your Option 1 and Option 2 in English - use words like "brighter", "calmer", "the boldest", and a design word (theme, palette, contrast, font, bold, soft).'));

    var ta = document.createElement('textarea');
    ta.className = 'prompt-area';
    ta.placeholder = 'I chose Comet Trail because it has bolder contrast than Sunny Day, and the violet palette matches my mood better.';
    card.appendChild(ta);

    var act3 = el('div', 'field-actions');
    var pub = el('button', 'btn btn-publish', 'Publish my theme \u{1F680}');
    pub.disabled = true;
    act3.appendChild(pub);
    card.appendChild(act3);

    ta.addEventListener('input', function () { pub.disabled = !String(ta.value || '').trim(); });
    pub.addEventListener('click', async function () {
      clearErrors(card);
      pub.disabled = true;
      var res = await api('/api/theme-justify', 'POST', { field: def.id, text: ta.value });
      pub.disabled = false;
      if (!res.ok) { showErrors(card, res.errors); return; }
      refresh();
    });
    return;
  }
}

/* A preview card of one theme option: name, palette swatches, fonts and a
   text sample, plus the mood word that produced it. Used for the Option 1
   recap and the dual-preview comparison. */
function renderThemeOptionCard(opt, num) {
  var c = el('div', 'theme-option');
  c.appendChild(el('div', 'theme-option-head', 'Option ' + num + ' \u00B7 ' + (opt.presetName || '')));
  var sw = el('div', 'theme-swatches');
  (opt.palette || []).forEach(function (col) {
    var s = el('span', 'swatch');
    s.style.background = col;
    s.title = col;
    sw.appendChild(s);
  });
  c.appendChild(sw);
  var fonts = el('div', 'theme-fonts');
  fonts.appendChild(el('div', 'theme-font-head',
    (opt.fontHeading || '') + ' heading \u00B7 ' + (opt.fontBody || '') + ' body'));
  var sample = el('div', 'theme-sample');
  sample.style.fontFamily = opt.fontHeading || 'inherit';
  sample.textContent = 'This is how your site looks';
  fonts.appendChild(sample);
  c.appendChild(fonts);
  c.appendChild(el('div', 'theme-mood', 'Mood: ' + (opt.moodWord || '')));
  return c;
}

/* soft hint (e.g. "same theme twice") - yellow box, not a hard error */
function showWarning(card, text) {
  clearErrors(card);
  var box = el('div', 'error-box warning');
  box.appendChild(el('div', null, text));
  card.appendChild(box);
}

/* A completed image iteration shown as a green ✓ card above the active
   stage. Mirrors renderCompletedIteration from Lesson 2: step badge, prompt
   with highlighted Subject/Style/Framing/Lighting labels, the generated
   image, and the student's pros/cons review. best/worst verdicts are shown
   if set. Read-only - no edits allowed.                              */
function renderCompletedImageIteration(it, i) {
  var wrap = el('div', 'iter-done-card');
  var badge = el('div', 'step-badge step-' + (i + 1));
  badge.appendChild(el('span', 'step-num', '\u2713'));
  badge.appendChild(el('span', 'step-title', 'Iteration ' + (i + 1) + ' \u00B7 saved'));
  wrap.appendChild(badge);

  wrap.appendChild(el('div', 'draft-label', 'Your prompt'));
  wrap.appendChild(renderPromptHighlighted(it.prompt, L3_LABELS));

  wrap.appendChild(el('div', 'draft-label', 'Generated image'));
  var img = document.createElement('img');
  img.className = 'img-preview-inline';
  img.src = it.image.url;
  img.alt = 'iteration ' + (i + 1);
  wrap.appendChild(img);

  if (it.pros || it.cons) {
    wrap.appendChild(el('div', 'draft-label', 'Your critical review'));
    if (it.pros) wrap.appendChild(renderEvalLine('good', it.pros));
    if (it.cons) wrap.appendChild(renderEvalLine('needs', it.cons));
  }
  if (it.best) wrap.appendChild(el('div', 'img-verdict best',
    'Best: ' + (it.best.reason || '')));
  if (it.worst) wrap.appendChild(el('div', 'img-verdict worst',
    'Worst: ' + (it.worst.reason || '')));
  return wrap;
}

function statusPill(label, n, min, ok) {
  return el('span', 'img-pill ' + (ok ? 'done' : 'open'), label + ': ' + n + '/' + min);
}

/* The pick panel: a grid of iteration cards with "Pick as best" / "Pick as
   worst" buttons. Shown only at the 'pick' and 'accept' stages. Clicking a
   pick opens a full-width reason form below the grid (same style as the
   eval inputs - no browser prompt()/alert()). Clicking a selected pick
   unmarks it.                                                         */
function renderPickPanel(fieldId, fstate) {
  var wrap = el('div', 'pick-panel-wrap');
  var grid = el('div', 'img-journal');
  var activePick = null;
  var hasBest = (fstate.iterations || []).some(function (it) { return it.best; });
  var hasWorst = (fstate.iterations || []).some(function (it) { return it.worst; });
  (fstate.iterations || []).forEach(function (it, i) {
    var cellClass = 'img-iter';
    if (it.best) cellClass += ' best';
    else if (it.worst) cellClass += ' worst';
    var cell = el('div', cellClass);
    cell.appendChild(el('div', 'img-iter-head', 'Iteration ' + (i + 1)));
    var img = document.createElement('img');
    img.src = it.image.url; img.alt = 'iteration ' + (i + 1); img.className = 'img-thumb';
    cell.appendChild(img);
    cell.appendChild(el('div', 'img-prompt', it.prompt));
    if (it.pros) cell.appendChild(el('div', 'img-pros', 'pros: ' + it.pros));
    if (it.cons) cell.appendChild(el('div', 'img-cons', 'cons: ' + it.cons));

    var row = el('div', 'img-actions');
    var bestBtn = el('button', 'btn btn-ghost img-btn' + (it.best ? ' selected best' : ''),
      it.best ? '\u2713 Best' : 'Pick as best');
    if (!it.best && hasBest) { bestBtn.disabled = true; bestBtn.title = 'Unmark the current best first'; }
    bestBtn.addEventListener('click', function () {
      if (it.best) { api('/api/image-unmark', 'POST', { field: fieldId, iteration: i, mark: 'best' }).then(refresh); }
      else { openPickReason(activePick, 'best', fieldId, i, it.image.url); }
    });
    row.appendChild(bestBtn);
    var worstBtn = el('button', 'btn btn-ghost img-btn' + (it.worst ? ' selected worst' : ''),
      it.worst ? '\u2713 Worst' : 'Pick as worst');
    if (!it.worst && hasWorst) { worstBtn.disabled = true; worstBtn.title = 'Unmark the current worst first'; }
    worstBtn.addEventListener('click', function () {
      if (it.worst) { api('/api/image-unmark', 'POST', { field: fieldId, iteration: i, mark: 'worst' }).then(refresh); }
      else { openPickReason(activePick, 'worst', fieldId, i, it.image.url); }
    });
    row.appendChild(worstBtn);
    if (it.best || it.worst) {
      row.appendChild(el('span', 'img-verdict-line',
        (it.best ? ('Best: ' + it.best.reason) : ('Worst: ' + it.worst.reason))));
    }
    cell.appendChild(row);
    grid.appendChild(cell);
  });
  wrap.appendChild(grid);

  /* Full-width reason form below the grid: mini thumbnail of the picked
     iteration + draft-label + wide input + field-actions. Only one form
     can be open at a time - opening a new one cancels the previous.     */
  function openPickReason(activePickRef, mark, fieldId, iteration, imgUrl) {
    var active = (typeof activePickRef === 'object' && activePickRef) ? activePickRef.v : null;
    if (active) active.close();
    var isBest = mark === 'best';
    var block = el('div', 'pick-reason-block ' + mark);
    var head = el('div', 'pick-reason-head');
    var thumb = document.createElement('img');
    thumb.className = 'pick-reason-thumb';
    thumb.src = imgUrl;
    thumb.alt = 'iteration ' + (iteration + 1);
    head.appendChild(thumb);
    var labels = el('div', 'pick-reason-labels');
    labels.appendChild(el('div', 'pick-reason-title', 'Iteration ' + (iteration + 1)));
    labels.appendChild(el('div', 'draft-label',
      isBest ? 'Why is this your BEST image? (in English)'
             : 'Why is this your WORST image? (in English)'));
    head.appendChild(labels);
    block.appendChild(head);
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'eval-input';
    input.placeholder = isBest ? 'I like this one because...' : 'This one is weak because...';
    block.appendChild(input);
    var actions = el('div', 'field-actions');
    var confirmBtn = el('button', 'btn btn-primary',
      isBest ? 'Confirm best \u2713' : 'Confirm worst \u2713');
    confirmBtn.disabled = true;
    var cancelBtn = el('button', 'btn btn-ghost', 'Cancel');
    actions.appendChild(confirmBtn);
    actions.appendChild(cancelBtn);
    block.appendChild(actions);
    wrap.appendChild(block);
    input.focus();

    input.addEventListener('input', function () {
      confirmBtn.disabled = !String(input.value || '').trim();
    });
    confirmBtn.addEventListener('click', async function () {
      confirmBtn.disabled = true;
      try {
        var res = await api('/api/image-' + mark, 'POST',
          { field: fieldId, iteration: iteration, reason: input.value });
        if (!res.ok) { confirmBtn.disabled = false; showErrors(block, res.errors); return; }
        activePick.v = null;
        refresh();
      } catch (e) { confirmBtn.disabled = false; }
    });
    cancelBtn.addEventListener('click', function () {
      if (activePick.v) activePick.v.close();
    });
    activePick.v = { close: function () { block.remove(); activePick.v = null; } };
  }

  activePick = { v: null };
  return wrap;
}

/* ---------- legacy ai-cycle (only old progress, no longer in the spec) ---------- */

function renderAiCycleLegacy(card, def, fstate) {
  var me = state.me;
  var iterations = (fstate.iterations && fstate.iterations.length) || 0;
  var minIter = (def.minIterations != null) ? def.minIterations : me.config.rules.minIterations;
  var left = Math.max(0, minIter - iterations);

  if (fstate.iterations && fstate.iterations.length) {
    var hist = el('div', 'iter-history');
    fstate.iterations.forEach(function (it, i) {
      var box = el('div', 'iter-entry');
      box.appendChild(el('div', 'iter-head', 'Iteration ' + (i + 1)));
      box.appendChild(el('div', 'iter-row', 'Prompt: ' + it.prompt));
      box.appendChild(el('div', 'iter-row', 'AI draft: ' + it.draft));
      if (it.edited) box.appendChild(el('div', 'iter-row iter-edited', 'Your edit: ' + it.edited));
      if (it.notes) box.appendChild(el('div', 'iter-row iter-notes', 'Notes: ' + it.notes));
      hist.appendChild(box);
    });
    card.appendChild(hist);
  }

  var pl = el('div', 'draft-label', 'Your prompt');
  pl.appendChild(el('span', 'ai-badge', 'formula: Role + Context + Task + Format'));
  card.appendChild(pl);

  var prompt = document.createElement('textarea');
  prompt.className = 'prompt-area';
  card.appendChild(prompt);

  var actions = el('div', 'field-actions');
  var genBtn = el('button', 'btn btn-primary', 'Generate');
  actions.appendChild(genBtn);
  card.appendChild(actions);

  genBtn.addEventListener('click', async function () {
    clearErrors(card);
    var res = await api('/api/prompt', 'POST', { field: def.id, prompt: prompt.value });
    if (!res.ok) { showErrors(card, res.errors); return; }
    refresh();
  });
}

/* ---------- errors ---------- */

function showErrors(card, errors) {
  clearErrors(card);
  var box = el('div', 'error-box');
  var ul = document.createElement('ul');
  (errors && errors.length ? errors : [{hint:'The request failed. Please try again.'}]).forEach(function (e) {
    var li = document.createElement('li');
    li.textContent = e.hint || e.rule;
    ul.appendChild(li);
  });
  box.appendChild(ul);
  card.appendChild(box);
}

function clearErrors(card) {
  card.querySelectorAll('.error-box').forEach(function (b) { b.remove(); });
}

/* ---------- logout / reset ---------- */

document.getElementById('logout-btn').addEventListener('click', async function () {
  try { await api('/api/logout', 'POST', {}); } catch (e) { /* session may be gone */ }
  localStorage.removeItem('token');
  localStorage.removeItem('studentName');
  location.href = '/login.html';
});

document.getElementById('reset-btn').addEventListener('click', async function () {
  if (!confirm('Reset all your progress for this lesson? This clears every prompt and image you have saved for the current lesson only. This cannot be undone.')) return;
  try {
    var res = await api('/api/reset', 'POST', {});
    if (!res.ok) { alert('Reset failed.'); return; }
    refresh();
  } catch (e) { alert('Reset failed.'); }
});

document.getElementById('reset-all-btn').addEventListener('click', async function () {
  if (!confirm('Reset ALL progress? This wipes EVERY lesson (Lesson 2 texts AND Lesson 3 images) and returns you to Lesson 2 from scratch. Use this if you want to re-test the whole flow from the very first prompt. This cannot be undone.')) return;
  if (!confirm('Are you really sure? All your prompts, AI drafts, edits, image iterations, best/worst picks - everything goes.')) return;
  try {
    var res = await api('/api/reset-all', 'POST', {});
    if (!res.ok) { alert('Reset failed.'); return; }
    refresh();
  } catch (e) { alert('Reset failed.'); }
});

boot();