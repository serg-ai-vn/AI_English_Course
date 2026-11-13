/* Presentation helpers. No network, storage, progress writes or gate decisions. */
'use strict';
var workspaceDisclosure = Object.create(null);
var workspaceRenderingField = '';
var workspacePromptDrafts = Object.create(null);
var workspaceNameDrafts = Object.create(null);
function completionLabel(def) {
  if (def.input === 'direct') return 'Saved';
  if (def.input === 'checklist') return 'Complete';
  if (def.input === 'ai-image-cycle') return 'Accepted';
  if (def.input === 'theme-picker') return 'Selected';
  return 'Published';
}
function imageFeedback(kind, heading, text) {
  var card = el('section', 'image-review-card ' + kind);
  card.appendChild(el('h4', 'image-review-title', heading));
  card.appendChild(el('p', 'image-review-text', text));
  return card;
}
function reviewInput(kind, heading, input) {
  var label = el('label', 'image-review-card feedback-input ' + kind);
  label.appendChild(el('span', 'image-review-title', heading));
  label.appendChild(input);
  return label;
}
function renderImageReview(image, iteration) {
  var row = el('div', 'image-review-layout');
  if (image) {
    var figure = el('figure', 'image-review-figure'); figure.appendChild(image); row.appendChild(figure);
  }
  var feedback = el('div', 'image-feedback');
  if (iteration.pros) feedback.appendChild(imageFeedback('good', '✓ What I like', iteration.pros));
  if (iteration.cons) feedback.appendChild(imageFeedback('needs', '🔧 What needs to change', iteration.cons));
  if (iteration.reason) feedback.appendChild(imageFeedback('change', '↻ Why I changed it', iteration.reason));
  if (iteration.best) feedback.appendChild(imageFeedback('good', '✓ My best choice', iteration.best.reason || ''));
  if (iteration.worst) feedback.appendChild(imageFeedback('needs', '🔎 My less suitable choice', iteration.worst.reason || ''));
  if (feedback.childNodes.length) row.appendChild(feedback);
  if (!image || !feedback.childNodes.length) row.classList.add('image-only');
  return row;
}
function iterationPanel(content, title) {
  var panel = el('details', 'iteration-panel');
  // No `name` attribute: opening one iteration never closes a sibling.
  var key = state.me.student.id + ':' + state.me.config.lesson + ':' + workspaceRenderingField + ':' + title + ':' + content.textContent;
  panel.open = workspaceDisclosure[key] === true;
  var summary = el('summary', 'iteration-summary');
  var parts = /^(.*?)(?:\s*·\s*(Saved|Reviewed|Selected)\s*✓?)$/.exec(title);
  summary.appendChild(el('span', 'iteration-title', parts ? parts[1] : title));
  if (parts) summary.appendChild(el('span', 'iteration-state', '✓ ' + parts[2]));
  panel.appendChild(summary);
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
  interesting: ['Makes you want to know more.', 'Thú vị'],
  prompt: ['Words that tell AI what to make.', 'Câu lệnh cho AI'],
  avatar: ['A picture that represents you online.', 'Ảnh đại diện'],
  background: ['The part behind the main person or object.', 'Phông nền'],
  generate: ['Create something, such as an image or text.', 'Tạo ra'],
  'concept art': ['An early picture that shows a design idea.', 'Tranh ý tưởng'],
  'close-up': ['A view from near an object, showing its details.', 'Cận cảnh'],
  'volumetric lighting': ['Light you can see as rays in mist or smoke.', 'Ánh sáng thành tia trong sương hoặc khói'],
  hallucination: ['A false fact or wrong detail made by AI.', 'Thông tin sai hoặc chi tiết sai do AI tạo ra'],
  fact: ['Something true that you can check.', 'Sự thật'],
  detail: ['A small part of a picture or description.', 'Chi tiết'],
  section: ['One part of a web page.', 'Một phần của trang web'],
  layout: ['The way pictures and text are arranged.', 'Bố cục'],
  portrait: ['A picture of a person.', 'Chân dung'],
  'soft light': ['Gentle light without strong, dark shadows.', 'Ánh sáng dịu'],
  'bold colors': ['Strong colors that are easy to notice.', 'Màu sắc nổi bật'],
  theme: ['The overall look and style of a website.', 'Giao diện; chủ đề'],
  palette: ['A set of colors used together.', 'Bảng màu'],
  mood: ['The feeling a picture or design gives you.', 'Cảm giác; không khí'],
  contrast: ['A clear difference, such as light against dark.', 'Độ tương phản'],
  font: ['A style of letters used in text.', 'Phông chữ'],
  bold: ['Strong and easy to notice.', 'Đậm; nổi bật'],
  soft: ['Gentle, rather than strong or bright.', 'Nhẹ nhàng'],
  match: ['Look good together or fit an idea.', 'Phù hợp'],
  publish: ['Make your finished work available to other people.', 'Xuất bản'],
  audit: ['Check your work carefully for problems.', 'Kiểm tra kỹ; rà soát'],
  operator: ['The person who guides AI and checks its work.', 'Người điều khiển và kiểm tra AI'],
  data: ['Information used by a person or computer.', 'Dữ liệu'],
  export: ['Save your work as a file you can use elsewhere.', 'Xuất thành tệp'],
  link: ['An address you click to open a page.', 'Liên kết'],
  change: ['Make something different.', 'Thay đổi'],
  presentation: ['A talk that shows and explains your work.', 'Bài thuyết trình']
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
  goal.appendChild(lessonGoals(cfg));
  // Every existing gate explanation remains reachable; none is discarded.
  var allRules = el('details', 'all-requirements');
  allRules.appendChild(el('summary', null, 'All lesson requirements'));
  styleRequirements(list, cfg);
  allRules.appendChild(list);
  goal.appendChild(allRules);
  bar.appendChild(goal);
  var words = glossaryWords(cfg);
  var vocab = helperPanel("📚 Today's Words (" + words.length + ')', 'words');
  var vocabGrid = el('div', 'helper-words');
  words.forEach(function (word, index) {
    var label = word.charAt(0).toUpperCase() + word.slice(1);
    var help = workspaceWordHelp[word.toLowerCase()];
    if (!help) return; // Coverage is checked against every configured glossary word.
    var entry = el('details', 'word-help');
    entry.dataset.word = word.toLowerCase();
    var heading = el('summary');
    heading.appendChild(el('span', 'word-number', String(index + 1).padStart(2, '0')));
    heading.appendChild(el('span', 'word-title', label));
    entry.appendChild(heading);
    var meaning = el('div', 'word-meaning');
    meaning.appendChild(el('span', 'word-caption', 'Meaning'));
    meaning.appendChild(el('p', null, help[0]));
    var translation = el('div', 'word-translation');
    translation.appendChild(el('span', 'word-caption', 'Tiếng Việt'));
    var vi = el('p', null, help[1]); vi.lang = 'vi'; translation.appendChild(vi);
    entry.append(meaning, translation);
    vocabGrid.appendChild(entry);
  });
  vocab.appendChild(vocabGrid); bar.appendChild(vocab);
  var grammar = helperPanel(cfg.lesson === 2 ? '🧩 Grammar: Present Perfect' : cfg.lesson === 3 ? '🗣 Review phrases' : cfg.lesson === 4 ? '🗣 Compare & explain' : '🗣 Reflection phrases', 'grammar');
  grammar.appendChild(languageSupport(cfg.lesson));
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
  if (cfg.lesson === 2) groupHobbies();
}
function glossaryWords(cfg) {
  if (cfg.lesson === 2) return cfg.vocabByField['about-me'].slice();
  var words = (cfg.targetVocabulary || []).slice();
  Object.values(cfg.vocabByField || {}).forEach(function (bank) {
    (Array.isArray(bank) ? bank : (bank.new || []).concat(bank.review || [])).forEach(function (word) {
      if (words.indexOf(word) === -1) words.push(word);
    });
  });
  return words;
}
function languageSupport(lesson) {
  var box = el('div', 'language-support');
  if (lesson === 2) {
    box.appendChild(el('p', 'language-intro', 'Present Perfect connects a past action or experience to now.'));
    box.appendChild(el('p', 'grammar-formula', 'have / has + V3 (past participle)'));
    var uses = el('div', 'language-cards');
    [['Still true now', 'I have skated for two years.', 'for = how long · since = when it started'],
      ['Experience, no exact time', 'I have tried skating.', 'ever · never'],
      ['A result now', 'I have finished my picture. It is ready.', 'already · yet']].forEach(function (item) {
      var card = el('article', 'language-card');
      card.appendChild(el('h3', null, item[0]));
      card.appendChild(el('p', 'language-example', item[1]));
      card.appendChild(el('p', 'language-clue', item[2])); uses.appendChild(card);
    });
    box.appendChild(uses);
    var timeline = el('p', 'grammar-timeline', 'Started before ━━━━━▶ NOW · still true now');
    box.appendChild(timeline);
    box.appendChild(el('p', 'grammar-contrast', 'A finished time? Use Past Simple: “I skated yesterday.” Signal words are clues — choose the tense by meaning.'));
    return box;
  }
  var phrases = {
    3: [['✓ What I like', 'I like the ___ because ___.', 'I like the lighting because the face is clear.'],
      ['🔧 What needs to change', 'The ___ looks ___. I want ___.', 'The hands look strange. I want natural hands.'],
      ['Explain a choice', 'Version ___ is better because ___.', 'Version 2 is better because the face is clearer.']],
    4: [['Compare colors', 'This palette is ___ than ___.', 'This palette is calmer than the other palette.'],
      ['Explain an improvement', 'I changed ___ because ___.', 'I changed the lighting because the picture was too dark.'],
      ['Explain your theme', 'I chose ___ because its ___ matches ___.', 'I chose Ocean Calm because its softer palette matches my mood.']],
    5: [['Describe a change', 'At first, ___. Then I changed ___.', 'At first, my prompt was short. Then I added a clear Format.'],
      ['Explain your thinking', 'I chose ___ because ___.', 'I chose this image because it shows my hobby clearly.'],
      ['Plan your next step', 'Next time, I will ___.', 'Next time, I will check the details before I publish.']]
  };
  var cards = el('div', 'language-cards');
  (phrases[lesson] || []).forEach(function (item) {
    var card = el('article', 'language-card');
    card.appendChild(el('h3', null, item[0]));
    card.appendChild(el('p', 'sentence-frame', item[1]));
    card.appendChild(el('p', 'language-example', item[2])); cards.appendChild(card);
  });
  box.appendChild(cards);
  return box;
}
function lessonGoals(cfg) {
  var rules = cfg.rules;
  var content = {
    2: [['Write your first prompt', 'Role + Context + Task + Format. Start with ' + rules.promptMinWordsFirst + '+ words.'],
      ['Review & improve', 'Check the AI draft. Add ' + rules.promptGrowthWords + '+ words to your next prompt.'],
      ['Polish & publish', 'Edit the final text by hand. Make it sound like you.']],
    3: [['Create your visuals', 'Write Subject, Style, Framing and Lighting for your avatar and background.'],
      ['Compare your images', 'Try ' + rules.minImageIterations + '–' + rules.maxImageIterations + ' versions. Review what is good and what needs to change.'],
      ['Choose & explain', 'Pick different best and worst images. Explain both choices.']],
    4: [['Create hobby images', 'Keep your first image or improve it, up to ' + rules.maxImageIterations + ' versions.'],
      ['Compare two themes', 'Use Role, Context, Task and Format. Try two moods and compare the palettes and fonts.'],
      ['Choose your design', 'Pick a theme and explain why it fits, using comparative and design words.']],
    5: [['Audit your site', 'Check for real personal data and AI-invented facts. Confirm both checks.'],
      ['Reflect on your work', 'Answer six questions with at least ' + rules.reflectionMinWords + ' words each.'],
      ['Share your result', 'Use a lesson word in your reflection. Your teacher publishes the finished site.']]
  };
  var grid = el('div', 'goal-steps');
  (content[cfg.lesson] || []).forEach(function (item, i) {
    var card = el('article', 'goal-card');
    card.appendChild(el('span', 'goal-number', '0' + (i + 1)));
    card.appendChild(el('h3', 'goal-title', item[0]));
    card.appendChild(el('p', 'goal-copy', item[1]));
    grid.appendChild(card);
  });
  return grid;
}
function styleRequirements(list, cfg) {
  var titles = {
    2: ['Your three steps', 'The prompt formula', 'Words in your prompt', 'Your experience', 'Your hobbies', 'Your critical review'],
    3: ['The image formula', 'Visual vocabulary', 'Try different versions', 'Review every image', 'Best & worst', 'Be the Operator'],
    4: ['Your hobby images', 'Explain each improvement', 'Design a theme', 'Compare your choices', 'Use design words'],
    5: ['Your final audit', 'Your reflections', 'Use lesson vocabulary', 'Share your finished site']
  };
  list.classList.add('requirement-grid');
  Array.from(list.children).forEach(function (item, i) {
    var copy = el('div', 'requirement-copy');
    while (item.firstChild) copy.appendChild(item.firstChild);
    var head = el('div', 'requirement-head');
    head.appendChild(el('span', 'goal-number', String(i + 1).padStart(2, '0')));
    head.appendChild(el('h3', null, (titles[cfg.lesson] || [])[i] || 'Lesson requirement'));
    item.append(head, copy);
  });
}
function groupHobbies() {
  [1, 2, 3].forEach(function (number) {
    var title = document.getElementById('card-hobby-title-' + number);
    var body = document.getElementById('card-hobby-text-' + number);
    if (!title || !body) return;
    var complete = title.classList.contains('done') && body.classList.contains('done');
    var group = el('section', 'hobby-group' + (complete ? ' done' : ''));
    group.id = 'hobby-group-' + number;
    var header = el('div', 'field-head');
    if (complete) {
      var check = el('span', 'completion-check', '✓'); check.setAttribute('aria-hidden', 'true'); header.appendChild(check);
    }
    header.appendChild(el('span', 'field-label', 'Hobby ' + number));
    if (complete) header.appendChild(el('span', 'status done', 'Published'));
    group.appendChild(header);
    title.before(group);
    title.querySelector('.field-head').remove();
    body.querySelector('.field-head').remove();
    title.classList.add('hobby-name-field'); body.classList.add('hobby-description-field');
    var label = el('label', 'hobby-name-label', 'Hobby name');
    var input = title.querySelector('input[type="text"]');
    if (input) {
      input.id = 'hobby-name-' + number; label.htmlFor = input.id;
      var nameKey = state.me.student.id + ':' + number;
      if (Object.prototype.hasOwnProperty.call(workspaceNameDrafts, nameKey)) input.value = workspaceNameDrafts[nameKey];
      input.addEventListener('input', function () { workspaceNameDrafts[nameKey] = input.value; });
    }
    title.prepend(label);
    group.append(title, body);
    // Each field keeps its ID, handlers, value and correction form. No new save endpoint.
    title.querySelectorAll(':scope > small.iteration-note').forEach(function (note) { note.remove(); });
  });
}
function structuredPrompt(card, source, cfg, def) {
  var v = window.PlatformValidation;
  var field = state.me.progress.fields[def.id] || {};
  var draftKey = state.me.student.id + ':' + cfg.lesson + ':' + def.id + ':' + (field.nextStep || (def.input === 'ai-text-3step' ? 'A1-prompt' : 'B1-prompt'));
  if (Object.prototype.hasOwnProperty.call(workspacePromptDrafts, draftKey)) source.value = workspacePromptDrafts[draftKey];
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
      workspacePromptDrafts[draftKey] = source.value;
      source.dispatchEvent(new Event('input', { bubbles: true }));
      update();
    });
  });
  source.hidden = true;
  source.before(form);
  var chips = el('div', 'live-gates');
  chips.setAttribute('aria-label', 'Prompt requirements');
  chips.setAttribute('role', 'list');
  var note = el('p', 'gate-note', 'These checks help you write. Your teacher checks the final result.');
  source.after(el('p', 'gate-heading', 'Before you generate: check your prompt'));
  source.nextElementSibling.after(chips, note);
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
      var chip = el('span', 'gate-chip' + (ok ? ' met' : ''));
      chip.setAttribute('role', 'listitem');
      chip.appendChild(el('span', 'gate-state', ok ? '✓ Ready' : 'To do'));
      chip.appendChild(el('span', 'gate-name', rule[1]));
      chips.appendChild(chip);
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
