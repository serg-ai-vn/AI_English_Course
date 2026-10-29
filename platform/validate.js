/* ============================================================
   Gating engine (deterministic, no AI calls).
   Reads rules from a lesson config (config/lesson-N.json) and
   checks prompts and texts against them. The same code serves
   every lesson - only the config changes.

   Rule set (Lesson 2 spec, section 7):
   - prompt length: first prompt >= promptMinWordsFirst words,
     every next one >= previous + promptGrowthWords
   - prompt vocabulary: >= promptMinTargetWords of targetVocabulary
   - text grammar: present perfect required for listed fields
   - text length: >= textMinWords per field
   - iterations: field closes only after minIterations accepted prompts
   ============================================================ */
'use strict';

function countWords(text) {
  return (String(text || '').trim().match(/[A-Za-z0-9']+/g) || []).length;
}

function targetWordsUsed(text, vocabulary, exclude) {
  var low = String(text || '').toLowerCase();
  var excludeSet = {};
  (exclude || []).forEach(function (w) { excludeSet[String(w).toLowerCase()] = true; });
  var used = [];
  (vocabulary || []).forEach(function (w) {
    var wl = w.toLowerCase();
    if (excludeSet[wl]) return; /* structural labels don't count as vocab */
    if (new RegExp('\\b' + wl + '\\b').test(low)) used.push(w);
  });
  return used;
}

/* Per-field vocab bank from cfg.vocabByField, resolved the same way the UI
   does (renderVocabBank): exact field id first, then the longest matching
   key prefix ("hobby-text-1" -> "hobby-text", "hobby-image-2" ->
   "hobby-image"). Bank values may be a plain array or {new:[...],
   review:[...]}. */
function fieldBank(cfg, fieldDef) {
  if (!fieldDef || !cfg.vocabByField) return null;
  var id = String(fieldDef.id || '');
  if (cfg.vocabByField[id]) return cfg.vocabByField[id];
  var keys = Object.keys(cfg.vocabByField);
  var best = null;
  keys.forEach(function (k) {
    if (k.length <= id.length && id.indexOf(k) === 0 && k.length > (best ? best.length : 0)) best = k;
  });
  return best ? cfg.vocabByField[best] : null;
}

/* Effective vocabulary for a field = today's target words PLUS every word
   the field's own Vocab Bank shows on screen. The bank is what the student
   sees, so every bank word must count in the gate - otherwise the UI offers
   words the engine silently ignores. */
function effectiveVocabulary(cfg, fieldDef) {
  var vocab = (cfg.targetVocabulary || []).slice();
  var bank = fieldBank(cfg, fieldDef);
  var words = [];
  if (Array.isArray(bank)) words = bank;
  else if (bank && Array.isArray(bank.new)) words = bank.new.concat(bank.review || []);
  words.forEach(function (w) {
    if (vocab.indexOf(w) === -1) vocab.push(w);
  });
  return vocab;
}

/* Present Perfect heuristic: have/has/'ve/'s + (word ending in -ed | known V3).
   Also accepts Present Perfect Continuous: "I have been playing", "she's been drawing". */
function hasPresentPerfect(text, v3verbs) {
  const irregular = new Set((v3verbs || []).concat(['fed','led','fled','shed','bled','said','taken','given','got','gone','eaten','drunk','bought','thought','caught','told','found','kept','left','lost','sent','spent','slept','spoken','worn']));
  const nonVerbs = new Set(['red','bed','sled','seed','weed','feed','need','speed']);
  const re = /(?:\b(?:have|has|haven't|hasn't)|\b\w+['’](?:ve|s))\s+(?:(?:not|never|ever|just|already|always|often|also|recently|only)\s+){0,2}([a-z]+)\b/gi;
  let m; while ((m = re.exec(String(text || '')))) { const w=m[1].toLowerCase(); if(irregular.has(w) || (w.length>=4 && /^[a-z]+ed$/.test(w) && !nonVerbs.has(w))) return true; } return false;
}

/* Check a prompt against the gating rules.
   prevAcceptedPrompts: array of prompts already accepted for this field.
   fieldDef: optional field definition (used for per-field grammar rule).
   Returns { ok, errors: [{rule, hint}], words, targetUsed } */
function checkPrompt(prompt, prevAcceptedPrompts, cfg, fieldDef) {
  var errors = [];
  var words = countWords(prompt);
  var isFirst = prevAcceptedPrompts.length === 0;

  if (isFirst) {
    if (words < cfg.rules.promptMinWordsFirst) {
      errors.push({ rule: 'firstLength', hint: cfg.hints.firstLength });
    }
  } else {
    var prevWords = countWords(prevAcceptedPrompts[prevAcceptedPrompts.length - 1]);
    if (words < prevWords + cfg.rules.promptGrowthWords) {
      errors.push({ rule: 'length', hint: cfg.hints.length });
    }
  }

  /* Structure check: each structural label must appear as "Role:" / "Context:" etc.
     This enforces the Role + Context + Task + Format formula from Lesson 2 spec. */
  var structural = cfg.rules.structuralWords || [];
  var missingStruct = [];
  structural.forEach(function (w) {
    var re = new RegExp('\\b' + w.toLowerCase() + '\\s*[:\\-]', 'i');
    if (!re.test(String(prompt || ''))) missingStruct.push(w);
  });
  const labeled = parseLabeled(prompt, structural);
  structural.forEach(w => { if (!String(labeled[w] || '').trim() && !missingStruct.includes(w)) missingStruct.push(w); });
  if (missingStruct.length > 0) {
    errors.push({ rule: 'structure', hint: cfg.hints.structure });
  }

  /* Vocabulary: target words from today's lesson, excluding the structural
     labels the student already uses as part of the formula. Skipped for
     fields flagged with vocabRequired:false (e.g. hobbies - "You do" stage:
     structure + tense stay mandatory, vocab check is dropped to avoid
     forcing the same 6 words across 4 fields). */
  var targetUsed = [];
  if (!fieldDef || fieldDef.vocabRequired !== false) {
    targetUsed = targetWordsUsed(prompt, effectiveVocabulary(cfg, fieldDef), structural);
    if (targetUsed.length < cfg.rules.promptMinTargetWords) {
      errors.push({ rule: 'vocab', hint: cfg.hints.vocab });
    }
  }

  /* Present Perfect in the prompt itself (for fields flagged with grammar).
     Per Lesson 2 spec, the student writes their experience in the Context
     line ("I have played football for 2 years"), so the AI draft inherits
     the tense and editing preserves it. The final-text check stays as a
     safety net. */
  if (fieldDef && fieldDef.grammar === 'present-perfect') {
    if (!hasPresentPerfect(prompt, cfg.rules.v3verbs || [])) {
      errors.push({ rule: 'promptGrammar', hint: cfg.hints.promptGrammar });
    }
  }

  return { ok: errors.length === 0, errors: errors, words: words, targetUsed: targetUsed };
}

/* Check a final text for a field. fieldDef comes from cfg.fields. */
function checkText(fieldDef, text, cfg) {
  var errors = [];
  var t = String(text || '').trim();

  if (!t) {
    errors.push({ rule: 'empty', hint: cfg.hints.empty });
    return { ok: false, errors: errors };
  }

  var words = countWords(t);
  var minKey = fieldDef.id.indexOf('hobby-text') === 0 ? 'hobby-text' : fieldDef.id;
  var minWords = (cfg.rules.textMinWords || {})[minKey];
  if (minWords && words < minWords) {
    errors.push({ rule: 'textShort', hint: cfg.hints.textShort });
  }

  if (fieldDef.grammar === 'present-perfect' ||
      (cfg.rules.presentPerfectFields || []).indexOf(fieldDef.id) !== -1) {
    if (!hasPresentPerfect(t, cfg.rules.v3verbs)) {
      errors.push({ rule: 'grammar', hint: cfg.hints.grammar });
    }
  }

  if (fieldDef.maxLength && t.length > fieldDef.maxLength) {
    errors.push({ rule: 'tooLong', hint: 'Too long - keep it under ' + fieldDef.maxLength + ' characters.' });
  }

  return { ok: errors.length === 0, errors: errors };
}

/* A direct-input field (no AI cycle): only presence + length + optional
   minWords (used by Lesson 5 reflection answers). */
function checkDirect(fieldDef, value, cfg) {
  var errors = [];
  var v = String(value || '').trim();
  if (fieldDef.required && !v) {
    errors.push({ rule: 'empty', hint: 'This field is required.' });
  }
  if (fieldDef.maxLength && v.length > fieldDef.maxLength) {
    errors.push({ rule: 'tooLong', hint: 'Too long - keep it under ' + fieldDef.maxLength + ' characters.' });
  }
  if (fieldDef.minWords && countWords(v) < fieldDef.minWords) {
    errors.push({ rule: 'textShort', hint: (cfg && cfg.hints && cfg.hints.reflectionShort) || 'Your answer is too short.' });
  }
  return { ok: errors.length === 0, errors: errors };
}

/* Lesson 5 audit checklist: every item in fieldDef.items must be checked
   before the field can be saved. value = { itemId: true|false }. */
function checkChecklist(fieldDef, value, cfg) {
  var errors = [];
  var v = value || {};
  var unchecked = (fieldDef.items || []).filter(function (it) { return v[it.id] !== true; });
  if (unchecked.length > 0) {
    errors.push({ rule: 'audit', hint: (cfg && cfg.hints && cfg.hints.auditRequired) || 'Confirm all items before continuing.' });
  }
  return { ok: errors.length === 0, errors: errors };
}

/* Lesson 5 reflection vocabulary: at least reflectionVocabMin of
   reflectionVocabWords must appear across ALL six reflection answers
   combined (the spec gate is journal-wide, not per answer). */
function checkReflectionVocab(cfg, fields) {
  var words = (cfg.rules && cfg.rules.reflectionVocabWords) || [];
  var min = (cfg.rules && cfg.rules.reflectionVocabMin) || 1;
  var joined = (cfg.fields || [])
    .filter(function (f) { return f.id.indexOf('reflection-') === 0; })
    .map(function (f) {
      var fs = (fields || {})[f.id];
      return String(fs && fs.value || '');
    })
    .join(' ');
  var used = targetWordsUsed(joined, words, []);
  return { ok: used.length >= min, used: used };
}

/* Can the field be closed? Needs >= minIterations accepted prompts.
   Per-field override via fieldDef.minIterations (e.g. hobbies = 1). */
function iterationsLeft(acceptedCount, cfg, fieldDef) {
  var min = (fieldDef && typeof fieldDef.minIterations === 'number')
    ? fieldDef.minIterations : cfg.rules.minIterations;
  return Math.max(0, min - acceptedCount);
}

/* ---------- Lesson 3 v2: image-cycle gating ----------
   Image prompts use a four-part formula:
       Subject: ...  Style: ...  Framing: ...  Lighting: ...
   The platform parses these four fields and compares them across
   iterations. Per-iteration gating rules from Lesson_3.md section 7:
   - structure:  all four labels present and non-empty
   - change:     at least one of the four differs from the previous prompt
   - vocab:      >=1 visual target word in the prompt text
   - pros:       >= prosMinWords (3) - what the student likes
   - cons:       >= consMinWords (3) - what the student does not like
   Field-level gating (canAcceptImageField):
   - minImageIterations (3) rated iterations logged
   - minBest (1) iteration marked best with a non-empty reason -> goes on site
   - minWorst (1) iteration marked worst with a non-empty reason
   - best index != worst index (the same image cannot be both)               */

var IMAGE_STRUCT_FIELDS = ['subject', 'style', 'framing', 'lighting'];
var THEME_STRUCT_FIELDS = ['role', 'context', 'task', 'format'];

/* Generic labeled-section parser: splits text by "label:" markers of the
   given field list. Missing labels come back as null; present-but-empty
   labels come back as ''. Used for the image formula (Subject/Style/...)
   and the theme formula (Role/Context/Task/Format). Label match is
   case-insensitive, values preserve original case. */
function parseLabeled(text, fields) {
  var s = String(text || '');
  var low = s.toLowerCase();
  var result = {};
  var positions = {};
  fields.forEach(function (f) {
    result[f] = null;
    positions[f] = low.indexOf(f + ':');
  });
  var present = fields.filter(function (f) { return positions[f] >= 0; })
    .sort(function (a, b) { return positions[a] - positions[b]; });
  present.forEach(function (f, i) {
    var start = positions[f] + f.length + 1; /* skip "subject:" */
    var end = (i + 1 < present.length) ? positions[present[i + 1]] : s.length;
    result[f] = s.slice(start, end).trim();
  });
  return result;
}

/* Parse a prompt into {subject, style, framing, lighting}. */
function parseImageStructure(prompt) {
  return parseLabeled(prompt, IMAGE_STRUCT_FIELDS);
}

/* Are all four structure fields present and non-empty?
   Returns { ok, missing: [fieldNames] }. */
function checkImageStructurePresent(parsed, cfg) {
  var fields = (cfg && cfg.rules && cfg.rules.imageStructureFields) || IMAGE_STRUCT_FIELDS;
  var missing = [];
  fields.forEach(function (f) {
    var v = parsed ? parsed[f] : null;
    if (v === null || !String(v).trim()) missing.push(f);
  });
  return { ok: missing.length === 0, missing: missing };
}

/* How many of the four structure fields differ between prev and curr?
   Comparison is on trimmed, lowercased value. Returns { changedCount, changed: [names] }. */
function diffImageStructures(prev, curr) {
  var changed = [];
  IMAGE_STRUCT_FIELDS.forEach(function (f) {
    var a = (prev && prev[f]) ? String(prev[f]).toLowerCase().trim() : '';
    var b = (curr && curr[f]) ? String(curr[f]).toLowerCase().trim() : '';
    if (a !== b) changed.push(f);
  });
  return { changedCount: changed.length, changed: changed };
}

/* Validate the PROMPT half of an image iteration (step 1 of 2 in the
   L3 wizard: student writes prompt -> Generate -> image appears).
   Checks: empty, structure (Subject/Style/Framing/Lighting all present
   and non-empty), target vocab, and diff against the previous prompt's
   structure (>= minStructureChanged field must change). Does NOT check
   pros/cons - those come in step 2 via checkImageEval, after the student
   has seen the generated image.
   opts = { prompt, prevStructures, cfg }
   prevStructures: array of parsed structures from prior accepted iterations
   (only the last one is compared - keeps the chain one-step). Returns
   { ok, errors, structure, targetUsed, diff }.                          */
function checkImagePrompt(opts) {
  var prompt = opts.prompt;
  var prevStructures = opts.prevStructures || [];
  var cfg = opts.cfg;
  var fieldDef = opts.fieldDef || null;
  var errors = [];

  if (!String(prompt || '').trim()) {
    errors.push({ rule: 'empty', hint: cfg.hints.empty });
    return { ok: false, errors: errors };
  }

  var structure = parseImageStructure(prompt);
  var structCheck = checkImageStructurePresent(structure, cfg);
  if (!structCheck.ok) {
    errors.push({ rule: 'structure', hint: cfg.hints.structure });
  }

  var structural = cfg.rules.structuralWords || [];
  var targetUsed = targetWordsUsed(prompt, effectiveVocabulary(cfg, fieldDef), structural);
  if (targetUsed.length < (cfg.rules.promptMinTargetWords || 1)) {
    errors.push({ rule: 'vocab', hint: cfg.hints.vocab });
  }

  var diff = null;
  if (prevStructures.length > 0) {
    var prev = prevStructures[prevStructures.length - 1];
    diff = diffImageStructures(prev, structure);
    if (diff.changedCount < (cfg.rules.minStructureChanged || 1)) {
      errors.push({ rule: 'diff', hint: cfg.hints.diff });
    }
  }

  return {
    ok: errors.length === 0,
    errors: errors,
    structure: structure,
    targetUsed: targetUsed,
    diff: diff
  };
}

/* Validate the EVAL half of an image iteration (step 2 of 2 in the L3
   wizard: after the image is generated, student writes pros/cons about
   what they see). Only checks pros and cons word counts - the prompt
   was already validated in step 1.
   opts = { pros, cons, cfg }
   Returns { ok, errors }.                                                */
function checkImageEval(opts) {
  var pros = opts.pros;
  var cons = opts.cons;
  var cfg = opts.cfg;
  var errors = [];

  if (countWords(pros) < (cfg.rules.prosMinWords || 3)) {
    errors.push({ rule: 'pros', hint: cfg.hints.prosRequired });
  }
  if (countWords(cons) < (cfg.rules.consMinWords || 3)) {
    errors.push({ rule: 'cons', hint: cfg.hints.consRequired });
  }

  return { ok: errors.length === 0, errors: errors };
}

/* Can the image field (avatar / background) be accepted/closed?
   iterations: array of journal iterations, each shaped as
   { structure, pros, cons, best:{reason}|null, worst:{reason}|null }.
   Returns { ok, errors }.                                                             */
function canAcceptImageField(iterations, cfg) {
  var errors = [];
  iterations = iterations || [];

  if (iterations.filter(it => countWords(it.pros) >= (cfg.rules.prosMinWords || 3) && countWords(it.cons) >= (cfg.rules.consMinWords || 3)).length < (cfg.rules.minImageIterations || 3)) {
    errors.push({ rule: 'iterations', hint: cfg.hints.iterations || cfg.hints.accept });
  }

  var hasReason = function (mark) {
    return mark && String(mark.reason || '').trim();
  };
  var bestIdx = -1; var worstIdx = -1;
  iterations.forEach(function (it, i) {
    if (hasReason(it.best)) {
      if (bestIdx < 0) bestIdx = i;   /* first best wins for the "best != worst" check */
    }
    if (hasReason(it.worst)) {
      if (worstIdx < 0) worstIdx = i;
    }
  });

  if (bestIdx < 0) {
    errors.push({ rule: 'best', hint: cfg.hints.bestReason });
  }
  if (worstIdx < 0) {
    errors.push({ rule: 'worst', hint: cfg.hints.worstReason });
  }
  if (bestIdx >= 0 && worstIdx >= 0 && bestIdx === worstIdx) {
    errors.push({ rule: 'samePick', hint: 'Pick different images for best and worst.' });
  }

  return { ok: errors.length === 0, errors: errors };
}

/* ---------- Lesson 4: rapid hobby images + theme picker ----------
   Hobby images (ai-image-rapid) keep the Lesson 3 image formula but drop
   the tournament: the student can publish the first image or improve it
   up to maxImageIterations times. Each regeneration needs a change reason
   (>= changeReasonMinWords) and a prompt diff (>= minStructureChanged of
   the four formula fields) - the same diff mechanic as Lesson 3.

   Theme picker (theme-picker) reuses the Lesson 2 R.C.T.F. formula:
   - Option 1: structure + non-empty Context + a mood word in Format
   - Option 2: same + prompt must actually change
   - Journal: justification with comparative/superlative + a design word  */

function checkReason(reason, cfg) {
  var errors = [];
  var r = String(reason || '').trim();
  if (!r) {
    errors.push({ rule: 'reasonRequired', hint: cfg.hints.reasonRequired });
  } else if (countWords(r) < (cfg.rules.changeReasonMinWords || 3)) {
    errors.push({ rule: 'reasonShort', hint: cfg.hints.reasonShort });
  }
  return { ok: errors.length === 0, errors: errors };
}

/* Comparative / superlative heuristic (Lesson 4 journal gate): a whitelist
   of common -er/-est forms, "more/most + adjective", or the "than" marker.
   Lightweight pattern match, same category as hasPresentPerfect in L2. */
function hasComparative(text, cfg) {
  var t = String(text || '').toLowerCase();
  var words = (cfg.rules.comparativeWords || []);
  for (var i = 0; i < words.length; i++) {
    if (new RegExp('\\b' + words[i] + '\\b').test(t)) return true;
  }
  if (/\bmore\s+[a-z]+\b/.test(t)) return true;
  if (/\bmost\s+[a-z]+\b/.test(t)) return true;
  if (/\bthan\b/.test(t)) return true;
  return false;
}

/* Validate the R.C.T.F. theme prompt. opts = { prompt, cfg, prevPrompt }.
   prevPrompt present => Option 2 (the prompt must have changed). Returns
   { ok, errors, parsed, moodWord, warning }. moodWord = the first mood
   word found in Format; warning carries a soft hint when Option 2 maps to
   the same preset as Option 1 (not a hard block, per Sergey). */
function checkThemePrompt(opts) {
  var prompt = opts.prompt;
  var cfg = opts.cfg;
  var prevPrompt = opts.prevPrompt || null;
  var errors = [];

  if (!String(prompt || '').trim()) {
    errors.push({ rule: 'empty', hint: cfg.hints.empty });
    return { ok: false, errors: errors };
  }

  var parsed = parseLabeled(prompt, THEME_STRUCT_FIELDS);

  /* all four labels present and non-empty */
  var missing = [];
  THEME_STRUCT_FIELDS.forEach(function (f) {
    var v = parsed[f];
    if (v === null || !String(v).trim()) missing.push(f);
  });
  if (missing.length > 0) {
    errors.push({ rule: 'structure', hint: cfg.hints.themeStructure });
  }

  /* Context must actually describe the site (>= 3 words) */
  var ctxWords = countWords(parsed.context);
  if (ctxWords < (cfg.rules.themeContextMinWords || 3)) {
    errors.push({ rule: 'themeContext', hint: cfg.hints.themeContext });
  }

  /* Format must carry at least one mood word; the FIRST hit decides the preset */
  var fmt = String(parsed.format || '').toLowerCase();
  var moodHit = null;
  var moodPos = -1;
  (cfg.rules.themeMoodWords || []).forEach(function (w) {
    var re = new RegExp('\\b' + String(w).toLowerCase() + '\\b');
    var m = re.exec(fmt);
    if (m && (moodPos < 0 || m.index < moodPos)) { moodPos = m.index; moodHit = w; }
  });
  if (!moodHit) {
    errors.push({ rule: 'themeMood', hint: cfg.hints.themeMood });
  }

  var warning = null;
  if (prevPrompt) {
    var p1 = String(prevPrompt || '').trim().toLowerCase().replace(/\s+/g, ' ');
    var p2 = String(prompt || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (p1 === p2) {
      errors.push({ rule: 'themeDiff', hint: cfg.hints.themeDiff });
    } else if (moodHit && opts.prevPreset) {
      /* same mood family => likely the same preset again: soft hint only */
      var preset = matchThemePreset(parsed.format, cfg);
      if (preset && preset.id === opts.prevPreset) {
        warning = cfg.hints.themeSame;
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors: errors,
    parsed: parsed,
    moodWord: moodHit,
    warning: warning
  };
}

/* Pick the preset whose mood word appears FIRST in the Format value.
   Returns the preset object or null. The mood-word lists live in
   cfg.presets[].moodWords (superset of the validation list). */
function matchThemePreset(formatValue, cfg) {
  var text = String(formatValue || '').toLowerCase();
  var presets = cfg.presets || [];
  var best = null;
  var bestPos = -1;
  presets.forEach(function (p) {
    (p.moodWords || []).forEach(function (w) {
      var re = new RegExp('\\b' + String(w).toLowerCase() + '\\b');
      var m = re.exec(text);
      if (m && (bestPos < 0 || m.index < bestPos)) { bestPos = m.index; best = p; }
    });
  });
  return best;
}

/* Final theme journal gate: meaningful length + comparative/superlative +
   at least one design word (theme, palette, contrast, font, bold, soft). */
function checkThemeJournal(text, cfg) {
  var errors = [];
  var t = String(text || '').trim();
  if (t.length < (cfg.rules.journalMinChars || 10)) {
    errors.push({ rule: 'justifyShort', hint: cfg.hints.justifyShort });
    return { ok: false, errors: errors };
  }
  if (countWords(t) < (cfg.rules.journalMinWords || 3)) {
    errors.push({ rule: 'justifyShort', hint: cfg.hints.justifyShort });
    return { ok: false, errors: errors };
  }
  if (!hasComparative(t, cfg)) {
    errors.push({ rule: 'justifyGrammar', hint: cfg.hints.justifyGrammar });
  }
  /* design words: the rules list + the theme field's own vocab bank (so
     bank words like "mood"/"match" also count, matching the spec hint). */
  var designVocab = (cfg.rules.designWords || []).slice();
  var themeBank = fieldBank(cfg, { id: 'theme' });
  var tb = [];
  if (Array.isArray(themeBank)) tb = themeBank;
  else if (themeBank && Array.isArray(themeBank.new)) tb = themeBank.new.concat(themeBank.review || []);
  tb.forEach(function (w) { if (designVocab.indexOf(w) === -1) designVocab.push(w); });
  if (targetWordsUsed(t, designVocab).length < 1) {
    errors.push({ rule: 'justifyVocab', hint: cfg.hints.justifyVocab });
  }
  return { ok: errors.length === 0, errors: errors };
}

module.exports = {
  countWords: countWords,
  targetWordsUsed: targetWordsUsed,
  fieldBank: fieldBank,
  effectiveVocabulary: effectiveVocabulary,
  hasPresentPerfect: hasPresentPerfect,
  checkPrompt: checkPrompt,
  checkText: checkText,
  checkDirect: checkDirect,
  checkChecklist: checkChecklist,
  checkReflectionVocab: checkReflectionVocab,
  iterationsLeft: iterationsLeft,
  /* Lesson 3 v2 */
  parseLabeled: parseLabeled,
  parseImageStructure: parseImageStructure,
  checkImageStructurePresent: checkImageStructurePresent,
  diffImageStructures: diffImageStructures,
  checkImagePrompt: checkImagePrompt,
  checkImageEval: checkImageEval,
  canAcceptImageField: canAcceptImageField,
  /* Lesson 4 */
  checkReason: checkReason,
  hasComparative: hasComparative,
  checkThemePrompt: checkThemePrompt,
  matchThemePreset: matchThemePreset,
  checkThemeJournal: checkThemeJournal
};
