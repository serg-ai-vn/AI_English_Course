/* Presentation helpers. No network, storage, progress writes or gate decisions. */
'use strict';
var workspaceDisclosure = Object.create(null);
var workspaceRenderingField = '';
function iterationPanel(content, title) {
  var panel = el('details', 'iteration-panel');
  // No `name` attribute: opening one iteration never closes a sibling.
  var key = state.me.student.id + ':' + state.me.config.lesson + ':' + workspaceRenderingField + ':' + title + ':' + content.textContent;
  panel.open = workspaceDisclosure[key] === true;
  panel.appendChild(el('summary', 'iteration-summary', title));
  var head = content.querySelector('.step-badge, .iter-head');
  if (head) head.remove();
  panel.appendChild(content);
  panel.addEventListener('toggle', function () { workspaceDisclosure[key] = panel.open; });
  return panel;
}
function renderStepper(def, field) {
  var steps = def.input === 'ai-text-3step'
    ? ['First Prompt', 'Improve Prompt', 'Polish & Publish']
    : ['First Prompt', 'Review & Publish'];
  var current = field.status === 'done' ? steps.length + 1 : Number(((field.nextStep || 'A1').match(/\d+/) || ['1'])[0]);
  if (def.input === 'ai-cycle-bonus') current = field.status === 'done' ? 3 : (field.iterations || []).length ? 2 : 1;
  var list = el('ol', 'task-stepper');
  list.setAttribute('aria-label', def.label + ' steps');
  steps.forEach(function (title, i) {
    var item = el('li', i + 1 < current ? 'done' : i + 1 === current ? 'current' : 'future');
    if (i + 1 === current) item.setAttribute('aria-current', 'step');
    item.appendChild(el('span', 'step-number', i + 1 < current ? '✓' : String(i + 1)));
    item.appendChild(el('span', null, title));
    list.appendChild(item);
  });
  return list;
}
var workspaceWordHelp = {
  energetic: ['Full of energy.', 'Tràn đầy năng lượng'],
  boring: ['Not fun or interesting.', 'Nhàm chán'],
  creative: ['Good at making new things or ideas.', 'Sáng tạo'],
  paragraph: ['A group of sentences about one idea.', 'Đoạn văn'],
  experience: ['Something you have done or learned.', 'Trải nghiệm; kinh nghiệm'],
  interesting: ['Makes you want to know more.', 'Thú vị']
};
function helperPanel(title, id) {
  var panel = el('details', 'helper-panel');
  var key = 'helper:' + state.me.config.lesson + ':' + id;
  panel.open = workspaceDisclosure[key] === true;
  panel.appendChild(el('summary', null, title));
  panel.addEventListener('toggle', function () { workspaceDisclosure[key] = panel.open; });
  return panel;
}
function enhanceWorkspace(cfg) {
  var question = document.getElementById('driving-question');
  if (!question.hidden) question.appendChild(el('span', 'spotlight-badge', '★ Driving Question'));
  var rules = document.getElementById('rules-card');
  var list = document.getElementById('rules-list');
  var bar = el('div', 'helper-bar');
  var goal = helperPanel('🎯 Lesson Goal & Steps', 'goal');
  if (cfg.lesson === 2) {
    var goals = el('div', 'goal-steps');
    ['① First prompt: Role + Context + Task + Format. ' + cfg.rules.promptMinWordsFirst + '+ words.',
      '② Review the AI draft. Improve your prompt: +' + cfg.rules.promptGrowthWords + ' words.',
      '③ Polish the final text by hand. Publish your work.'].forEach(function (text) { goals.appendChild(el('p', null, text)); });
    goal.appendChild(goals);
  }
  // Every existing gate explanation remains reachable; none is discarded.
  var allRules = el('details', 'all-requirements');
  allRules.appendChild(el('summary', null, 'All lesson requirements'));
  allRules.appendChild(list);
  goal.appendChild(allRules);
  bar.appendChild(goal);
  var words = cfg.lesson === 2 ? cfg.vocabByField['about-me'] : cfg.targetVocabulary;
  var vocab = helperPanel("📚 Today's Words (" + words.length + ')', 'words');
  var vocabGrid = el('div', 'helper-words');
  words.forEach(function (word) {
    var label = word.charAt(0).toUpperCase() + word.slice(1);
    var help = workspaceWordHelp[word.toLowerCase()];
    if (!help) { vocabGrid.appendChild(el('span', 'chip', label)); return; }
    var entry = el('details', 'word-help');
    entry.appendChild(el('summary', null, label));
    entry.appendChild(el('p', null, help[0]));
    var vi = el('p', null, help[1]); vi.lang = 'vi'; entry.appendChild(vi);
    vocabGrid.appendChild(entry);
  });
  vocab.appendChild(vocabGrid); bar.appendChild(vocab);
  var grammar = helperPanel(cfg.lesson === 2 ? '🧩 Grammar: Present Perfect' : '🧩 Language tips', 'grammar');
  if (cfg.lesson === 2) {
    grammar.appendChild(el('p', 'grammar-formula', 'have / has + V3 (past participle)'));
    grammar.appendChild(el('p', null, 'Use it in Context: I have skated for two years.'));
    grammar.appendChild(el('p', null, 'I have drawn many pictures.'));
  } else {
    grammar.appendChild(el('p', null, cfg.lesson === 4 ? 'Compare your choices: brighter, calmer, bolder. Explain why your theme fits.' : cfg.lesson === 3 ? 'Explain what is good and what needs to change. Give reasons for your best and worst choices.' : 'Explain your choices and changes in full sentences.'));
  }
  bar.appendChild(grammar);
  rules.replaceChildren(bar);
  rules.classList.add('helper-shell');
  document.querySelectorAll('.vocab-strip .chip, .vocab-bank-field .chip').forEach(function (chip) {
    chip.textContent = chip.textContent.charAt(0).toUpperCase() + chip.textContent.slice(1);
    chip.dataset.word = chip.textContent.toLowerCase();
  });
  document.querySelectorAll('.field-card').forEach(function (card) {
    var def = cfg.fields.find(function (f) { return card.id === 'card-' + f.id; });
    if (cfg.lesson === 2 && /ai-text-3step|ai-cycle-bonus/.test(def.input)) {
      var source = card.querySelector('textarea.prompt-area');
      if (source) structuredPrompt(card, source, cfg, def);
      var published = card.querySelector('.final-text');
      if (published) {
        published.classList.add('published-text');
        published.before(el('div', 'published-label', '✓ Published on website'));
      }
    }
    card.querySelectorAll('.iter-entry.read-only .iter-row-label').forEach(function (label) {
      if (label.textContent === 'AI draft:' && label.nextElementSibling) label.nextElementSibling.classList.add('ai-draft-box');
    });
    card.querySelectorAll('.review-card.good').forEach(function (good) {
      var needs = good.nextElementSibling;
      if (needs && needs.classList.contains('review-card')) {
        var grid = el('div', 'review-grid'); good.before(grid); grid.append(good, needs);
      }
    });
  });
}
function structuredPrompt(card, source, cfg, def) {
  var v = window.PlatformValidation;
  var labels = ['Role', 'Context', 'Task', 'Format'];
  var initial = v.parseLabeled(source.value, labels.map(function (label) { return label.toLowerCase(); }));
  var form = el('div', 'prompt-builder');
  var inputs = {};
  labels.forEach(function (label) {
    var row = el('label', 'prompt-builder-row');
    row.appendChild(el('span', 'struct-label', label));
    var input = document.createElement('textarea');
    input.rows = 2;
    input.value = initial[label.toLowerCase()] || '';
    input.setAttribute('aria-label', label);
    input.placeholder = label === 'Context' ? 'I have skated for two years...' : label === 'Role' ? 'A creative student...' : label === 'Task' ? 'Write a short paragraph about me...' : 'One energetic paragraph.';
    inputs[label] = input; row.appendChild(input); form.appendChild(row);
    input.addEventListener('input', function () {
      source.value = labels.every(function (name) { return !inputs[name].value.trim(); }) ? '' : labels.map(function (name) { return name + ': ' + inputs[name].value; }).join('\n');
      source.dispatchEvent(new Event('input', { bubbles: true }));
      update();
    });
  });
  source.hidden = true;
  source.before(form);
  var chips = el('div', 'live-gates');
  chips.setAttribute('aria-label', 'Prompt requirements');
  var note = el('p', 'gate-note', 'These checks help you write. Your teacher and the server check the final result.');
  source.after(chips, note);
  var field = state.me.progress.fields[def.id] || {};
  var previous = (field.iterations || []).map(function (it) { return it.prompt; });
  function update() {
    var result = v.checkPrompt(source.value, previous, cfg, def);
    var errors = result.errors.map(function (e) { return e.rule; });
    var rules = [['structure', 'Formula: R · C · T · F'], ['length', previous.length ? '+' + cfg.rules.promptGrowthWords + ' words longer' : cfg.rules.promptMinWordsFirst + '+ words']];
    if (def.vocabRequired !== false) rules.push(['vocab', cfg.rules.promptMinTargetWords + '+ lesson words (' + result.targetUsed.length + '/' + cfg.rules.promptMinTargetWords + ')']);
    if (def.grammar) rules.push(['promptGrammar', 'Present Perfect']);
    chips.replaceChildren();
    rules.forEach(function (rule) {
      var ok = source.value.trim() && errors.indexOf(rule[0]) === -1;
      chips.appendChild(el('span', 'gate-chip' + (ok ? ' met' : ''), (ok ? '✓ ' : '□ ') + rule[1]));
    });
    var used = v.targetWordsUsed(source.value, v.effectiveVocabulary(cfg, def), cfg.rules.structuralWords);
    card.querySelectorAll('.vocab-bank-field .chip').forEach(function (chip) {
      var met = used.indexOf(chip.dataset.word) !== -1;
      chip.classList.toggle('word-used', met);
      chip.setAttribute('aria-label', chip.textContent + (met ? ' — used' : ' — not used yet'));
    });
  }
  update();
}
