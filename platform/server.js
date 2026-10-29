/* ============================================================
   Platform server (MVP, zero dependencies).
   Serves the student workspace + login, keeps progress in
   JSON files, runs the gating engine (validate.js) on every
   prompt and text. LLM is a local mock for now: swap
   mockGenerate() for a real API call later - nothing else changes.

   Run:  node server.js     ->  http://localhost:3000
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const PROGRESS_DIR = path.join(DATA, 'progress');
const PORT = 3000;
const TRACK_ROOT = path.join(ROOT, '..');   /* Kimi K3 dir (template + tools + rehearsal) */

const validate = require('./validate.js');
const classes = JSON.parse(fs.readFileSync(path.join(DATA, 'classes.json'), 'utf8'));

/* Multi-lesson configs: lesson N -> its config object. Each lesson's fields
   have unique IDs, so one progress.fields object holds every lesson's work.
   The active lesson is progress.lesson; the gating + isComplete check the
   current lesson's config only. */
const lessons = {
  2: JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'lesson-2.json'), 'utf8')),
  3: JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'lesson-3.json'), 'utf8')),
  4: JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'lesson-4.json'), 'utf8')),
  5: JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'lesson-5.json'), 'utf8'))
};
const DEFAULT_LESSON = 2;
function lessonCfg(n) { return lessons[n] || lessons[DEFAULT_LESSON]; }

const SESSIONS_FILE = path.join(DATA, 'sessions.json');

/* ---------- tiny helpers ---------- */

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return fallback; }
}
function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
}

function getSessions() { return readJson(SESSIONS_FILE, {}); }
function saveSessions(s) { writeJson(SESSIONS_FILE, s); }

function progressFile(studentId) { return path.join(PROGRESS_DIR, studentId + '.json'); }
function getProgress(studentId) {
  return readJson(progressFile(studentId), {
    studentId: studentId, lesson: DEFAULT_LESSON, fields: {}, complete: false,
    unlockedLessons: [DEFAULT_LESSON]
  });
}
function saveProgress(p) { writeJson(progressFile(p.studentId), p); }

/* Look up a field definition across every loaded lesson: field IDs are
   globally unique, so the search order does not matter. Also returns
   which lesson the field belongs to (used by image-accept logging). */
function fieldDef(fieldId) {
  for (const n of Object.keys(lessons)) {
    const f = (lessons[n].fields || []).find(x => x.id === fieldId);
    if (f) return Object.assign({ lesson: Number(n) }, f);
  }
  return null;
}

function publicConfig(lessonNum) {
  const cfg = lessonCfg(lessonNum);
  return {
    lesson: cfg.lesson,
    title: cfg.title,
    targetVocabulary: cfg.targetVocabulary,
    fields: cfg.fields,
    rules: cfg.rules,
    hints: cfg.hints || {},
    autoFields: cfg.autoFields || {},
    drivingQuestion: cfg.drivingQuestion || null,
    vocabByField: cfg.vocabByField || null,
    presets: cfg.presets || null
  };
}

/* ---------- mock AI (placeholder for a real LLM call) ----------
   Deliberately produces a FLAT first draft (like a lazy model):
   the student's job in Lesson 2 is to edit it. Deterministic,
   offline. Reuses the Context part of the prompt formula if the
   student wrote one - rewarding good prompt structure. */
function mockGenerate(fieldId, prompt) {
  var context = '';
  var m = String(prompt).match(/context\s*[:\-]\s*([\s\S]*?)(?=(task|format)\s*[:\-]|$)/i);
  if (m) context = m[1].trim().replace(/\s+/g, ' ');
  if (context.length > 220) context = context.slice(0, 220).trim() + '...';

  if (fieldId === 'about-me') {
    var base = 'I am a student. ';
    if (context) base += context.charAt(0).toUpperCase() + context.slice(1) + ' ';
    base += 'I like many things and my life is interesting. This is a text about me.';
    return base;
  }
  /* hobby-text-* */
  var h = 'This is my hobby. ';
  if (context) h += context.charAt(0).toUpperCase() + context.slice(1) + ' ';
  h += 'It is very nice and I like it a lot.';
  return h;
}

/* ---------- request plumbing ---------- */

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => {
      data += c;
      if (data.length > 1e6) { reject(new Error('body too large')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(new Error('bad json')); }
    });
  });
}

function auth(req) {
  const h = req.headers['authorization'] || '';
  const token = h.replace(/^Bearer\s+/i, '');
  const sessions = getSessions();
  return sessions[token] ? { token, session: sessions[token] } : null;
}

/* ---------- API handlers ---------- */

function handleLogin(req, res, body) {
  const role = body.role === 'teacher' ? 'teacher' : 'student';
  const cls = (classes.classes || []).find(c =>
    c.code.toLowerCase() === String(body.classCode || '').trim().toLowerCase());
  if (!cls) return sendJson(res, 401, { error: 'Unknown class code. Ask your teacher.' });

  const token = crypto.randomBytes(16).toString('hex');
  const sessions = getSessions();

  if (role === 'teacher') {
    const tpin = String(body.pin || '').trim();
    if (!cls.teacherPin || String(cls.teacherPin) !== tpin) {
      return sendJson(res, 401, { error: 'Wrong teacher PIN for class ' + cls.code + '.' });
    }
    sessions[token] = {
      role: 'teacher', classCode: cls.code, className: cls.name, created: Date.now()
    };
    saveSessions(sessions);
    return sendJson(res, 200, { token, role: 'teacher', class: { code: cls.code, name: cls.name } });
  }

  /* student path */
  const student = (cls.students || []).find(s =>
    s.name.toLowerCase() === String(body.name || '').trim().toLowerCase());
  if (!student) return sendJson(res, 401, { error: 'No student with this name in class ' + cls.code + '.' });
  if (String(student.pin) !== String(body.pin || '').trim()) {
    return sendJson(res, 401, { error: 'Wrong PIN. Try again.' });
  }

  sessions[token] = {
    role: 'student', studentId: student.id, name: student.name, classCode: cls.code, created: Date.now()
  };
  saveSessions(sessions);

  sendJson(res, 200, { token, role: 'student', student: { id: student.id, name: student.name, classCode: cls.code } });
}

function handleMe(req, res, a) {
  const progress = getProgress(a.session.studentId);
  const cur = progress.lesson || DEFAULT_LESSON;
  const unlocked = Array.isArray(progress.unlockedLessons) && progress.unlockedLessons.length
    ? progress.unlockedLessons : [DEFAULT_LESSON];
  sendJson(res, 200, {
    student: { id: a.session.studentId, name: a.session.name, classCode: a.session.classCode },
    lesson: cur,
    unlockedLessons: unlocked,
    config: publicConfig(cur),
    progress: progress
  });
}

/* =========================================================================
   Lesson 2 v2 prompt handling (Aug 2026 interaction spec).
   Two new field input types:
     ai-text-3step  - About Me. Three stages:
        A1: first prompt (formula)        -> iteration{stage:1, prompt, draft, good, needsChange}
        A2: longer improved prompt         -> iteration{stage:2, ...}
        A3: operator edit + publish       -> field.status='done', field.value=editedText
        The two intermediate save stages (good / needsChange on each iteration)
        are submitted separately via /api/save-eval after the AI draft has been
        reviewed. The model never advances to the next prompt until both eval
        fields on the current iteration are filled.
ai-cycle-bonus - Hobby text. One prompt + AI draft, then a fork:
         B1: prompt                            -> iteration{stage:1, prompt, draft}
         fork: Publish to Website (with optional light edit)
                 -> field.status='done', bonusClaimed=false
               OR Improve this text (bonus) = manual edit of the draft
                 by hand + a reason (no second prompt, no second AI
                 generation - Sergey, 04.08 spec revision)
                 -> lastIter{edited, reason}, field.status='done', bonusClaimed=true
    The classic ai-cycle type (used nowhere now) is kept handled below as a
   fallback for legacy progress files: old iterations simply render as a flat
   history and the student can still submit text to close the field.
   ========================================================================= */

function emptyAboutMe() {
  return { value: '', status: 'open', nextStep: 'A1-prompt', iterations: [], acceptedPrompts: [] };
}
function emptyHobby() {
  return { value: '', status: 'open', nextStep: 'B1-prompt', iterations: [], acceptedPrompts: [], bonusClaimed: false };
}

function handlePrompt(req, res, a, body) {
  const def = fieldDef(body.field);
  if (!def) return sendJson(res, 400, { error: 'Unknown AI field.' });
  const type = def.input;
  if (type !== 'ai-cycle' && type !== 'ai-text-3step' && type !== 'ai-cycle-bonus') {
    return sendJson(res, 400, { error: 'Unknown AI field.' });
  }

  const progress = getProgress(a.session.studentId);
  const cfg = lessonCfg(def.lesson);

  /* ---- ai-text-3step (About Me) ---- */
  if (type === 'ai-text-3step') {
    const f = progress.fields[def.id] || emptyAboutMe();
    if (f.status === 'done') return sendJson(res, 400, { error: 'This field is already published.' });
    if (f.nextStep !== 'A1-prompt' && f.nextStep !== 'A2-prompt') {
      return sendJson(res, 200, { ok: false, errors: [{ rule: 'stage', hint: 'Save your review on the previous step first.' }] });
    }
    const stage = (f.nextStep === 'A1-prompt') ? 1 : 2;
    const prevPrompts = (f.iterations || []).map(function (it) { return it.prompt; });
    const check = validate.checkPrompt(String(body.prompt || ''), prevPrompts, cfg, def);
    if (!check.ok) return sendJson(res, 200, { ok: false, errors: check.errors, words: check.words });

    const draft = mockGenerate(def.id, body.prompt);
    f.iterations.push({
      stage: stage, prompt: String(body.prompt), draft: draft,
      good: null, needsChange: null, ts: Date.now()
    });
    f.acceptedPrompts.push(String(body.prompt));
    f.nextStep = (stage === 1) ? 'A1-eval' : 'A2-eval';
    progress.fields[def.id] = f;
    saveProgress(progress);
    return sendJson(res, 200, { ok: true, draft: draft, iteration: f.iterations.length, nextStep: f.nextStep });
  }

  /* ---- ai-cycle-bonus (Hobbies) ---- */
  if (type === 'ai-cycle-bonus') {
    const f = progress.fields[def.id] || emptyHobby();
    if (f.status === 'done') return sendJson(res, 400, { error: 'This field is already published.' });
    /* Only one prompt is ever written for a hobby. The "Improve" path is a
       manual edit of the AI draft + a reason - no second prompt, no second
       AI generation (Sergey, 04.08 spec revision). */
    if (f.nextStep !== 'B1-prompt') {
      return sendJson(res, 200, { ok: false, errors: [{ rule: 'stage', hint: 'You are ready to publish. No more prompts needed here.' }] });
    }
    const prevPrompts = (f.iterations || []).map(function (it) { return it.prompt; });
    const check = validate.checkPrompt(String(body.prompt || ''), prevPrompts, cfg, def);
    if (!check.ok) return sendJson(res, 200, { ok: false, errors: check.errors, words: check.words });

    const draft = mockGenerate(def.id, body.prompt);
    f.iterations = f.iterations || [];
    f.iterations.push({
      stage: 1, prompt: String(body.prompt), draft: draft, ts: Date.now()
    });
    f.acceptedPrompts = f.acceptedPrompts || [];
    f.acceptedPrompts.push(String(body.prompt));
    f.nextStep = 'B1-fork';
    progress.fields[def.id] = f;
    saveProgress(progress);
    return sendJson(res, 200, { ok: true, draft: draft, iteration: f.iterations.length, nextStep: f.nextStep });
  }

  /* ---- legacy ai-cycle fallback (only old data, not in the new spec) ---- */
  const f = progress.fields[def.id] || { value: '', status: 'open', iterations: [], acceptedPrompts: [] };
  if (f.status === 'done') return sendJson(res, 400, { error: 'This field is already approved.' });
  const check = validate.checkPrompt(String(body.prompt || ''), f.acceptedPrompts, cfg, def);
  if (!check.ok) return sendJson(res, 200, { ok: false, errors: check.errors, words: check.words });
  const draft = mockGenerate(def.id, body.prompt);
  f.iterations.push({ prompt: String(body.prompt), draft: draft, ts: Date.now() });
  f.acceptedPrompts.push(String(body.prompt));
  progress.fields[def.id] = f;
  saveProgress(progress);
  sendJson(res, 200, { ok: true, draft: draft, iteration: f.iterations.length, iterationsLeft: validate.iterationsLeft(f.acceptedPrompts.length, cfg, def) });
}

/* Save the student's critical review (good / needsChange) on the latest
   iteration of an ai-text-3step field and advance to the next stage. A1-eval
   unlock A2-prompt; A2-eval unlock A3-publish. Both fields are required - the
   journal stores them as the student's analytical feedback for the teacher. */
function handleSaveEval(req, res, a, body) {
  const def = fieldDef(body.field);
  if (!def || def.input !== 'ai-text-3step') return sendJson(res, 400, { error: 'Unknown 3-step field.' });
  const progress = getProgress(a.session.studentId);
  const cfg = lessonCfg(def.lesson);
  const f = progress.fields[def.id] || emptyAboutMe();
  if (f.status === 'done') return sendJson(res, 400, { error: 'This field is already published.' });
  if (f.nextStep !== 'A1-eval' && f.nextStep !== 'A2-eval') {
    return sendJson(res, 200, { ok: false, errors: [{ rule: 'stage', hint: 'Save your prompt first.' }] });
  }
  const good = String(body.good || '').trim();
  const needsChange = String(body.needsChange || '').trim();
  if (!good || !needsChange) {
    return sendJson(res, 200, { ok: false, errors: [{ rule: 'eval', hint: cfg.hints.evalNeeded }] });
  }
  var last = f.iterations[f.iterations.length - 1];
  last.good = good;
  last.needsChange = needsChange;
  f.nextStep = (f.nextStep === 'A1-eval') ? 'A2-prompt' : 'A3-publish';
  progress.fields[def.id] = f;
  saveProgress(progress);
  sendJson(res, 200, { ok: true, nextStep: f.nextStep });
}

function handleSubmitText(req, res, a, body) {
  const def = fieldDef(body.field);
  if (!def) return sendJson(res, 400, { error: 'Unknown AI field.' });

  const progress = getProgress(a.session.studentId);
  const cfg = lessonCfg(def.lesson);

  /* ---- About Me: ai-text-3step -> Stage A3 publish (operator edit) ---- */
  if (def.input === 'ai-text-3step') {
    const f = progress.fields[def.id] || emptyAboutMe();
    if (f.status === 'done') return sendJson(res, 400, { error: 'This field is already published.' });
    if (f.nextStep !== 'A3-publish') {
      return sendJson(res, 200, { ok: false, errors: [{ rule: 'stage', hint: 'Complete Step 1 and Step 2 (prompts + reviews) first.' }] });
    }
    const lastIter = f.iterations && f.iterations.length ? f.iterations[f.iterations.length - 1] : null;
    if (!lastIter) return sendJson(res, 400, { error: 'No AI draft to edit.' });

    const submittedText = String(body.text || '').trim();
    if (!submittedText) return sendJson(res, 200, { ok: false, errors: [{ rule: 'empty', hint: cfg.hints.empty }] });

    /* A3 gating: the student must edit at least one character of the V2
       draft before publishing (literally ">=1 char differs"). Motivation:
       make sure the student read the draft and touched it. Note this is
       not at text-inside-the-gating-engine level - validate.js stays
       untouched, per Sergey's decision. */
    if (submittedText === lastIter.draft.trim()) {
      return sendJson(res, 200, { ok: false, errors: [{ rule: 'editNeeded', hint: cfg.hints.editNeeded }] });
    }

    /* Final safety: text-level grammar + length still apply. */
    const check = validate.checkText(def, submittedText, cfg);
    if (!check.ok) return sendJson(res, 200, { ok: false, errors: check.errors });

    lastIter.edited = submittedText;
    f.value = submittedText;
    f.status = 'done';
    f.nextStep = 'done';
    progress.fields[def.id] = f;
    progress.complete = isComplete(progress, cfg);
    saveProgress(progress);
    return sendJson(res, 200, { ok: true, complete: progress.complete });
  }

  /* ---- Hobby: ai-cycle-bonus -> Publish (as-is) or Publish with Bonus ----
     Both paths submit from the B1-fork stage. The "Improve" path is now a
     manual edit of the AI draft + a reason (no second AI generation). A
     non-empty `reason` marks the bonus path, and then the submitted text
     must differ from the AI draft (the student actually edited it by
     hand). Without a reason this is a publish-as-is (light edit allowed). */
  if (def.input === 'ai-cycle-bonus') {
    const f = progress.fields[def.id] || emptyHobby();
    if (f.status === 'done') return sendJson(res, 400, { error: 'This field is already published.' });
    if (f.nextStep !== 'B1-fork') {
      return sendJson(res, 200, { ok: false, errors: [{ rule: 'stage', hint: 'Generate a draft first.' }] });
    }
    const lastIter = f.iterations && f.iterations.length ? f.iterations[f.iterations.length - 1] : null;
    if (!lastIter) return sendJson(res, 400, { error: 'No AI draft to publish.' });

    const submittedText = String(body.text || '').trim();
    if (!submittedText) return sendJson(res, 200, { ok: false, errors: [{ rule: 'empty', hint: cfg.hints.empty }] });

    const reason = String(body.reason || '').trim();
    const isBonus = !!reason;

    /* Bonus path: the student must have changed the draft by hand. Inline
       ">=1 char" gating - validate.js stays untouched, per Sergey's
       decision (same approach as About Me A3). */
    if (isBonus && submittedText === lastIter.draft.trim()) {
      return sendJson(res, 200, { ok: false, errors: [{ rule: 'editNeeded', hint: cfg.hints.editNeeded }] });
    }

    /* Final safety: text-level grammar + length still apply. */
    const check = validate.checkText(def, submittedText, cfg);
    if (!check.ok) return sendJson(res, 200, { ok: false, errors: check.errors });

    lastIter.edited = (submittedText !== lastIter.draft.trim()) ? submittedText : null;
    lastIter.reason = isBonus ? reason : null;
    lastIter.publishedPath = isBonus ? 'bonus' : 'first';
    f.value = submittedText;
    f.status = 'done';
    f.nextStep = 'done';
    f.bonusClaimed = isBonus;
    progress.fields[def.id] = f;
    progress.complete = isComplete(progress, cfg);
    saveProgress(progress);
    return sendJson(res, 200, { ok: true, complete: progress.complete, bonusClaimed: f.bonusClaimed });
  }

  /* ---- legacy ai-cycle fallback ---- */
  const f = progress.fields[def.id] || { value: '', status: 'open', iterations: [], acceptedPrompts: [] };
  const left = validate.iterationsLeft(f.acceptedPrompts.length, cfg, def);
  if (left > 0) {
    return sendJson(res, 200, { ok: false, errors: [{ rule: 'iterations', hint: cfg.hints.iterations }] });
  }
  const check = validate.checkText(def, String(body.text || ''), cfg);
  if (!check.ok) return sendJson(res, 200, { ok: false, errors: check.errors });

  f.value = String(body.text).trim();
  f.status = 'done';
  if (f.iterations.length) {
    var last = f.iterations[f.iterations.length - 1];
    last.edited = (f.value !== last.draft) ? f.value : null;
  }
  progress.fields[def.id] = f;
  progress.complete = isComplete(progress, cfg);
  saveProgress(progress);
  sendJson(res, 200, { ok: true, complete: progress.complete });
}

/* Save the student's edit + notes for the current (last) iteration without
   closing the field. Used for mid-flow iterations on multi-iteration fields
   (e.g. About Me iter 1) before writing the next prompt. */
function handleSaveEdit(req, res, a, body) {
  const def = fieldDef(body.field);
  if (!def || def.input !== 'ai-cycle') return sendJson(res, 400, { error: 'Unknown AI field.' });

  const progress = getProgress(a.session.studentId);
  const f = progress.fields[def.id];
  if (!f || !f.iterations || !f.iterations.length) {
    return sendJson(res, 400, { error: 'Generate a draft first.' });
  }
  if (f.status === 'done') return sendJson(res, 400, { error: 'This field is already approved.' });

  var last = f.iterations[f.iterations.length - 1];
  last.edited = String(body.text || '').trim();
  last.notes = String(body.notes || '').trim() || null;
  saveProgress(progress);

  sendJson(res, 200, { ok: true });
}

function handleSaveDirect(req, res, a, body) {
  const def = fieldDef(body.field);
  if (!def || (def.input !== 'direct' && def.input !== 'checklist')) {
    return sendJson(res, 400, { error: 'Unknown field.' });
  }

  const cfg = lessonCfg(def.lesson);
  let check;
  if (def.input === 'checklist') {
    check = validate.checkChecklist(def, body.items || {}, cfg);
  } else {
    check = validate.checkDirect(def, String(body.value || ''), cfg);
  }
  if (!check.ok) return sendJson(res, 200, { ok: false, errors: check.errors });

  const progress = getProgress(a.session.studentId);
  if (def.input === 'checklist') {
    progress.fields[def.id] = { items: body.items || {}, status: 'done', ts: Date.now() };
  } else {
    progress.fields[def.id] = { value: String(body.value || '').trim(), status: 'done', ts: Date.now() };
  }
  progress.complete = isComplete(progress, cfg);
  saveProgress(progress);

  sendJson(res, 200, { ok: true, complete: progress.complete });
}

function isComplete(progress, cfg) {
  const used = cfg || lessonCfg(progress.lesson || DEFAULT_LESSON);
  return used.fields
    .filter(f => f.required)
    .every(f => progress.fields[f.id] && progress.fields[f.id].status === 'done');
}

function handleLogout(req, res, a) {
  const sessions = getSessions();
  delete sessions[a.token];
  saveSessions(sessions);
  sendJson(res, 200, { ok: true });
}

function handleLessonSwitch(req, res, a, body) {
  /* Student switches their active lesson to any lesson already unlocked by
     the teacher. Cannot skip ahead - the unlock call is the only path to a
     new lesson number. */
  const target = Number(body.lesson) | 0;
  if (!target || !lessons[target]) return sendJson(res, 400, { error: 'Unknown lesson.' });
  const progress = getProgress(a.session.studentId);
  const unlocked = Array.isArray(progress.unlockedLessons) && progress.unlockedLessons.length
    ? progress.unlockedLessons : [DEFAULT_LESSON];
  if (unlocked.indexOf(target) === -1) {
    return sendJson(res, 200, { ok: false, error: 'Lesson ' + target + ' is not unlocked yet. Ask your teacher.' });
  }
  progress.lesson = target;
  progress.complete = isComplete(progress, lessonCfg(target));
  saveProgress(progress);
  sendJson(res, 200, { ok: true, lesson: target, complete: progress.complete });
}

function handleReset(req, res, a) {
  /* Reset only the current lesson's fields (keep earlier lessons intact),
     so a student can re-do lesson 3 without losing the lesson 2 texts the
     teacher already reviewed. complete is recomputed from the now-empty
     current lesson. */
  const progress = getProgress(a.session.studentId);
  const cur = progress.lesson || DEFAULT_LESSON;
  const cfg = lessonCfg(cur);
  (cfg.fields || []).forEach(function (f) { delete progress.fields[f.id]; });
  if (cur === 4 && progress.theme) delete progress.theme;   /* theme is Lesson 4 work */
  if (cur === 5 && progress.published) delete progress.published;  /* publish stamp is Lesson 5 work */
  progress.complete = false;
  saveProgress(progress);
  sendJson(res, 200, { ok: true });
}

/* Reset ALL progress: every lesson's fields, unlocked lessons, current
   lesson, complete flag. Used during development to re-run the whole
   flow from scratch (Lesson 2 first prompt -> Lesson 3 best/worst).   */
function handleResetAll(req, res, a) {
  const progress = getProgress(a.session.studentId);
  progress.fields = {};
  progress.lesson = DEFAULT_LESSON;
  progress.unlockedLessons = [DEFAULT_LESSON];
  progress.complete = false;
  if (progress.built) delete progress.built;
  if (progress.theme) delete progress.theme;
  if (progress.published) delete progress.published;
  saveProgress(progress);
  sendJson(res, 200, { ok: true });
}

/* ============================================================
   Lesson 3 - image generation (mock) + image-cycle gating.
   mockGenerateImage returns a path under rehearsal/assets/ that
   export-site.ps1 can later resolve. A real text-to-image API
   replaces this function and writes the same file paths - nothing
   else changes (same swap-one-function contract as mockGenerate).
   ============================================================ */

const ASSETS = path.join(TRACK_ROOT, 'rehearsal', 'assets');
const DEMO_ASSETS = path.join(TRACK_ROOT, 'demo-assets');

function assetExists(file) {
  try { fs.accessSync(file); return true; } catch (e) { return false; }
}

function mockGenerateImage(studentId, def, iterIdx) {
  /* Try the student's own prebuilt demo asset first (rehearsal produced
     one avatar PNG, one background JPG and three hobby JPGs per pilot
     student). Fallback to the shared demo-assets/ so brand-new students
     are never stuck. The returned "paths" are TRACK_ROOT-relative so
     export-site.ps1 (which also resolves from TRACK_ROOT) can embed them
     as base64. */
  var ext;
  if (def.id === 'avatar') ext = '.png';
  else if (def.id === 'background') ext = '.jpg';
  else if (String(def.id).indexOf('hobby-image-') === 0) ext = '.jpg';
  else ext = '.png';

  var hobbyN = /hobby-image-(\d+)/.exec(def.id);
  var candidates = [
    path.join(ASSETS, studentId + '-' + def.id + ext),
    /* some rehearsal files used "bg" naming for backgrounds */
    def.id === 'background' ? path.join(ASSETS, studentId + '-bg' + (iterIdx + 2) + '.jpg') : null,
    hobbyN ? path.join(ASSETS, studentId + '-hobby-' + hobbyN[1] + '.jpg') : null,
    hobbyN ? path.join(DEMO_ASSETS, 'hobby-' + hobbyN[1] + '.jpg') : null,
    def.id === 'avatar' ? path.join(DEMO_ASSETS, 'avatar.jpg') : null,
    def.id === 'background' ? path.join(DEMO_ASSETS, 'background.jpg') : null
  ].filter(Boolean);

  var picked = null;
  for (var i = 0; i < candidates.length; i++) {
    if (assetExists(candidates[i])) { picked = candidates[i]; break; }
  }
  if (!picked) return null;

  /* relative to TRACK_ROOT so the export pipeline finds it */
  var rel = path.relative(TRACK_ROOT, picked).replace(/\\/g, '/');
  var url = '/preview/' + rel;     /* served by our own /preview route */
  return { path: rel, url: url, src: picked };
}

/* Image-cycle state per field (Lesson 3 v2, wizard model):
   { status, nextStep, iterations: [{ prompt, image: {path,url,src}, structure, pros, cons,
       best: {reason}|null, worst: {reason}|null, ts }],
     acceptedImage: <path-of-best> | null }
   nextStep drives the UI state machine (one stage visible at a time, same
   pattern as Lesson 2's renderAboutMe):
     I1-prompt -> I1-eval -> I2-prompt -> I2-eval -> ... -> pick -> accept -> done
   Each iteration is two steps: (1) student writes a prompt with the 4-field
   formula, we generate the image; (2) the image appears, student writes pros
   and cons. The student rates each one (pros, cons) and eventually marks one
   best (-> goes on the site) and one worst (record only).                  */
function handleImagePrompt(req, res, a, body) {
  const def = fieldDef(body.field);
  if (!def || (def.input !== 'ai-image-cycle' && def.input !== 'ai-image-rapid')) {
    return sendJson(res, 400, { error: 'Unknown image field.' });
  }

  const progress = getProgress(a.session.studentId);
  const cfg = lessonCfg(def.lesson);
  const f = progress.fields[def.id] || { status: 'open', nextStep: 'I1-prompt', iterations: [], acceptedImage: null };
  if (f.status === 'done') return sendJson(res, 400, { error: 'This image is already approved.' });
  if (f.iterations.length >= (cfg.rules.maxImageIterations || 6)) {
    return sendJson(res, 200, { ok: false, errors: [{ rule: 'empty', hint: 'Too many iterations - accept or delete one first.' }] });
  }

  /* Step 1 of 2: validate the PROMPT only (structure, vocab, diff). pros/cons
     come in step 2 (handleImageEval) after the student has seen the image.  */
  const prevStructs = (f.iterations || []).map(function (it) { return it.structure; });
  const check = validate.checkImagePrompt({
    prompt: body.prompt, prevStructures: prevStructs, cfg: cfg, fieldDef: def
  });
  if (!check.ok) return sendJson(res, 200, { ok: false, errors: check.errors });

  const img = mockGenerateImage(a.session.studentId, def, f.iterations.length);
  if (!img) return sendJson(res, 200, { ok: false, errors: [{ rule: 'empty', hint: 'No image asset ready. Ask your teacher.' }] });

  const n = f.iterations.length + 1;
  f.iterations.push({
    version: n,
    prompt: String(body.prompt || ''),
    image: { path: img.path, url: img.url },
    structure: check.structure,
    pros: '',
    cons: '',
    best: null, worst: null,
    ts: Date.now()
  });

  /* Lesson 4 rapid flow: review stage (Publish / Edit & Regenerate) instead
     of the L3 eval stage (pros/cons). Everything else is identical. */
  if (def.input === 'ai-image-rapid') {
    f.nextStep = 'I' + n + '-review';
    progress.fields[def.id] = f;
    saveProgress(progress);
    return sendJson(res, 200, { ok: true, iteration: n, imageUrl: img.url, summary: rapidView(f, cfg) });
  }

  f.nextStep = 'I' + f.iterations.length + '-eval';
  progress.fields[def.id] = f;
  saveProgress(progress);

  const view = imageView(f, cfg);
  sendJson(res, 200, { ok: true, iteration: f.iterations.length, imageUrl: img.url,
    summary: view });
}

/* handleImageEval: step 2 of the L3 wizard - after the image appears, the
   student writes pros and cons about what they see. We validate only pros/cons
   word counts, save them into the last iteration, and advance the state:
     - if iterations < minImageIterations: next I{n+1}-prompt (keep iterating)
     - else: pick (the student now picks best/worst)                      */
function handleImageEval(req, res, a, body) {
  const def = fieldDef(body.field);
  if (!def || def.input !== 'ai-image-cycle') return sendJson(res, 400, { error: 'Unknown image field.' });
  const progress = getProgress(a.session.studentId);
  const cfg = lessonCfg(def.lesson);
  const f = progress.fields[def.id];
  if (!f || !f.iterations || !f.iterations.length) return sendJson(res, 400, { error: 'Generate an image first.' });
  if (f.status === 'done') return sendJson(res, 400, { error: 'This image is already approved.' });

  const check = validate.checkImageEval({ pros: body.pros, cons: body.cons, cfg: cfg });
  if (!check.ok) return sendJson(res, 200, { ok: false, errors: check.errors });

  const last = f.iterations[f.iterations.length - 1];
  last.pros = String(body.pros || '').trim();
  last.cons = String(body.cons || '').trim();

  const minIter = cfg.rules.minImageIterations || 3;
  if (f.iterations.length < minIter) {
    f.nextStep = 'I' + (f.iterations.length + 1) + '-prompt';
  } else {
    f.nextStep = 'pick';
  }
  progress.fields[def.id] = f;
  saveProgress(progress);

  sendJson(res, 200, { ok: true, summary: imageView(f, cfg) });
}

/* Mark one iteration as best. Reason is mandatory. Clears the worst flag on
   the same iteration so an image cannot be both. Updates acceptedImage (best
   goes on the site). If another iteration was previously best, its best flag
   is cleared (exactly one best at a time, per spec). After both best and worst
   are set (on different iterations), nextStep advances to 'accept'.        */
function handleImageBest(req, res, a, body) {
  const def = fieldDef(body.field);
  if (!def || def.input !== 'ai-image-cycle') return sendJson(res, 400, { error: 'Unknown image field.' });
  const progress = getProgress(a.session.studentId);
  const cfg = lessonCfg(def.lesson);
  const f = progress.fields[def.id];
  if (!f || !f.iterations || !f.iterations.length) return sendJson(res, 400, { error: 'Generate an image first.' });
  const idx = Number(body.iteration) | 0;
  if (idx < 0 || idx >= f.iterations.length) return sendJson(res, 400, { error: 'No such iteration.' });
  const reason = String(body.reason || '').trim();
  if (!reason) return sendJson(res, 200, { ok: false, errors: [{ rule: 'best', hint: cfg.hints.bestReason }] });

  f.iterations.forEach(function (it, i) { if (i !== idx && it.best) it.best = null; });
  const it = f.iterations[idx];
  it.best = { reason: reason };
  it.worst = null;
  f.acceptedImage = it.image.path;
  f.nextStep = pickNextStep(f, cfg);
  progress.fields[def.id] = f;
  saveProgress(progress);

  sendJson(res, 200, { ok: true, summary: imageView(f, cfg) });
}

/* Mark one iteration as worst. Reason is mandatory. Clears the best flag on
   the same iteration. Exactly one worst at a time. Advances nextStep to
   'accept' when both best and worst are set on different iterations.        */
function handleImageWorst(req, res, a, body) {
  const def = fieldDef(body.field);
  if (!def || def.input !== 'ai-image-cycle') return sendJson(res, 400, { error: 'Unknown image field.' });
  const progress = getProgress(a.session.studentId);
  const cfg = lessonCfg(def.lesson);
  const f = progress.fields[def.id];
  if (!f || !f.iterations || !f.iterations.length) return sendJson(res, 400, { error: 'Generate an image first.' });
  const idx = Number(body.iteration) | 0;
  if (idx < 0 || idx >= f.iterations.length) return sendJson(res, 400, { error: 'No such iteration.' });
  const reason = String(body.reason || '').trim();
  if (!reason) return sendJson(res, 200, { ok: false, errors: [{ rule: 'worst', hint: cfg.hints.worstReason }] });

  f.iterations.forEach(function (it, i) { if (i !== idx && it.worst) it.worst = null; });
  const it = f.iterations[idx];
  it.worst = { reason: reason };
  it.best = null;
  f.nextStep = pickNextStep(f, cfg);
  progress.fields[def.id] = f;
  saveProgress(progress);

  sendJson(res, 200, { ok: true, summary: imageView(f, cfg) });
}

/* Clear best or worst mark on one iteration (the student changed their mind).
   If after clearing the student no longer has both picks, nextStep goes back
   to 'pick'.                                                                */
function handleImageUnmark(req, res, a, body) {
  const def = fieldDef(body.field);
  if (!def || def.input !== 'ai-image-cycle') return sendJson(res, 400, { error: 'Unknown image field.' });
  const progress = getProgress(a.session.studentId);
  const cfg = lessonCfg(def.lesson);
  const f = progress.fields[def.id];
  if (!f || !f.iterations) return sendJson(res, 400, { error: 'Generate an image first.' });
  const idx = Number(body.iteration) | 0;
  if (idx < 0 || idx >= f.iterations.length) return sendJson(res, 400, { error: 'No such iteration.' });
  const mark = String(body.mark || '').toLowerCase();
  const it = f.iterations[idx];
  if (mark === 'best') {
    it.best = null;
    if (!f.iterations.some(function (x) { return x.best; })) f.acceptedImage = null;
  } else if (mark === 'worst') {
    it.worst = null;
  } else {
    return sendJson(res, 400, { error: 'mark must be "best" or "worst".' });
  }
  f.nextStep = pickNextStep(f, cfg);
  progress.fields[def.id] = f;
  saveProgress(progress);
  sendJson(res, 200, { ok: true, summary: imageView(f, cfg) });
}

/* Decide the next step after a best/worst/unmark mutation:
   - both best and worst set (on different iterations) -> 'accept'
   - otherwise -> 'pick' (still choosing)                                  */
function pickNextStep(f, cfg) {
  var its = f.iterations || [];
  var hasBest = its.some(function (x) { return x.best && String(x.best.reason || '').trim(); });
  var hasWorst = its.some(function (x) { return x.worst && String(x.worst.reason || '').trim(); });
  if (hasBest && hasWorst) {
    var bi = its.findIndex(function (x) { return x.best; });
    var wi = its.findIndex(function (x) { return x.worst; });
    if (bi >= 0 && wi >= 0 && bi !== wi) return 'accept';
  }
  return 'pick';
}

function handleImageAccept(req, res, a, body) {
  /* Close the image field: needs >= minImageIterations rated iterations,
     one best with a reason, and one worst with a reason (on a different
     iteration). The accepted image used by the site is the best one. */
  const def = fieldDef(body.field);
  if (!def || def.input !== 'ai-image-cycle') return sendJson(res, 400, { error: 'Unknown image field.' });
  const progress = getProgress(a.session.studentId);
  const cfg = lessonCfg(def.lesson);
  const f = progress.fields[def.id];
  if (!f) return sendJson(res, 400, { error: 'Generate an image first.' });
  if (f.status === 'done') return sendJson(res, 400, { error: 'Already approved.' });

  const check = validate.canAcceptImageField(f.iterations || [], cfg);
  if (!check.ok) return sendJson(res, 200, { ok: false, errors: check.errors });

  const bestIt = (f.iterations || []).find(function (x) { return x.best; });
  if (!bestIt) return sendJson(res, 200, { ok: false, errors: [{ rule: 'best', hint: cfg.hints.bestReason }] });
  f.acceptedImage = bestIt.image.path;
  f.status = 'done';
  f.nextStep = 'done';
  f.value = f.acceptedImage;
  progress.fields[def.id] = f;
  progress.complete = isComplete(progress, cfg);
  saveProgress(progress);

  sendJson(res, 200, { ok: true, complete: progress.complete });
}

/* ============================================================
   Lesson 4 - rapid hobby images (ai-image-rapid) + theme picker.
   Rapid hobby images = Scaffolding Removal: the same four-field
   image formula as Lesson 3, but the student may publish the FIRST
   image right away or improve it up to maxImageIterations times.
   Every regeneration needs a change reason (>= 3 words) and a
   prompt diff (>= 1 formula field changed). No best/worst tournament.
   Theme picker = R.C.T.F. formula (Lesson 2) applied to site design:
   Option 1 prompt -> preset; Option 2 prompt -> preset; dual-preview;
   choice; journal justification with comparative/superlative + a
   design word. The chosen preset lands in progress.theme for build.
   ============================================================ */

function emptyRapid() {
  return { value: '', status: 'open', nextStep: 'I1-prompt', iterations: [], publishedVersion: null };
}

function emptyTheme() {
  return { value: '', status: 'open', nextStep: 'T1-prompt',
    option1: null, option2: null, choice: null, justification: null, ts: null };
}

/* compact view of a rapid hobby-image field for the UI */
function rapidView(f, cfg) {
  const its = f.iterations || [];
  const max = cfg.rules.maxImageIterations || 6;
  return {
    nextStep: f.nextStep || 'I1-prompt',
    iterations: its.length,
    maxAttempts: max,
    attemptsLeft: Math.max(0, max - its.length),
    publishedVersion: f.publishedVersion || null
  };
}

function handleImageRegenerate(req, res, a, body) {
  /* V{n+1} of a rapid hobby image: the student explains WHY the image
     needs to change (>= 3 words) and edits their previous prompt (>= 1
     formula field changed, same diff mechanic as Lesson 3). */
  const def = fieldDef(body.field);
  if (!def || def.input !== 'ai-image-rapid') return sendJson(res, 400, { error: 'Unknown image field.' });
  const progress = getProgress(a.session.studentId);
  const cfg = lessonCfg(def.lesson);
  const f = progress.fields[def.id];
  if (!f || f.status === 'done') return sendJson(res, 400, { error: 'This image is already published.' });
  if (f.nextStep !== 'I' + (f.iterations.length) + '-review') {
    return sendJson(res, 200, { ok: false, errors: [{ rule: 'stage', hint: 'Publish the image or edit it first.' }] });
  }
  if (f.iterations.length >= (cfg.rules.maxImageIterations || 6)) {
    return sendJson(res, 200, { ok: false, errors: [{ rule: 'max', hint: cfg.hints.noMore }] });
  }

  const reasonCheck = validate.checkReason(body.reason, cfg);
  if (!reasonCheck.ok) return sendJson(res, 200, { ok: false, errors: reasonCheck.errors });

  const prevStructs = (f.iterations || []).map(function (it) { return it.structure; });
  const check = validate.checkImagePrompt({ prompt: body.prompt, prevStructures: prevStructs, cfg: cfg, fieldDef: def });
  if (!check.ok) return sendJson(res, 200, { ok: false, errors: check.errors });

  const img = mockGenerateImage(a.session.studentId, def, f.iterations.length);
  if (!img) return sendJson(res, 200, { ok: false, errors: [{ rule: 'empty', hint: 'No image asset ready. Ask your teacher.' }] });

  const n = f.iterations.length + 1;
  f.iterations.push({
    version: n,
    prompt: String(body.prompt || ''),
    image: { path: img.path, url: img.url },
    structure: check.structure,
    reason: String(body.reason || '').trim(),
    ts: Date.now()
  });
  f.nextStep = 'I' + n + '-review';
  progress.fields[def.id] = f;
  saveProgress(progress);

  sendJson(res, 200, { ok: true, iteration: n, imageUrl: img.url, summary: rapidView(f, cfg) });
}

function handleImagePublish(req, res, a, body) {
  /* Accept the current (latest) rapid hobby image - it goes on the site. */
  const def = fieldDef(body.field);
  if (!def || def.input !== 'ai-image-rapid') return sendJson(res, 400, { error: 'Unknown image field.' });
  const progress = getProgress(a.session.studentId);
  const cfg = lessonCfg(def.lesson);
  const f = progress.fields[def.id];
  if (!f || !f.iterations || !f.iterations.length) return sendJson(res, 400, { error: 'Generate an image first.' });
  if (f.status === 'done') return sendJson(res, 400, { error: 'This image is already published.' });

  const last = f.iterations[f.iterations.length - 1];
  f.publishedVersion = last.version;
  f.value = last.image.path;
  f.status = 'done';
  f.nextStep = 'done';
  progress.fields[def.id] = f;
  progress.complete = isComplete(progress, cfg);
  saveProgress(progress);

  sendJson(res, 200, { ok: true, complete: progress.complete, publishedVersion: f.publishedVersion });
}

/* Theme picker step 1: R.C.T.F. prompt -> mood word in Format -> preset. */
function handleThemePrompt(req, res, a, body) {
  const def = fieldDef(body.field);
  if (!def || def.input !== 'theme-picker') return sendJson(res, 400, { error: 'Unknown theme field.' });
  const progress = getProgress(a.session.studentId);
  const cfg = lessonCfg(def.lesson);
  const f = progress.fields[def.id] || emptyTheme();
  if (f.status === 'done') return sendJson(res, 400, { error: 'Theme is already selected.' });
  if (f.nextStep !== 'T1-prompt') {
    return sendJson(res, 200, { ok: false, errors: [{ rule: 'stage', hint: 'Generate Option 2 next to compare.' }] });
  }

  const check = validate.checkThemePrompt({ prompt: body.prompt, cfg: cfg });
  if (!check.ok) return sendJson(res, 200, { ok: false, errors: check.errors });

  const preset = validate.matchThemePreset(check.parsed.format, cfg);
  if (!preset) return sendJson(res, 200, { ok: false, errors: [{ rule: 'themeMood', hint: cfg.hints.themeMood }] });

  f.option1 = {
    prompt: String(body.prompt || ''),
    moodWord: check.moodWord,
    preset: preset.id,
    presetName: preset.name,
    palette: preset.palette,
    fontHeading: preset.fontHeading,
    fontBody: preset.fontBody,
    ts: Date.now()
  };
  f.nextStep = 'T2-prompt';
  progress.fields[def.id] = f;
  saveProgress(progress);

  sendJson(res, 200, { ok: true, option: f.option1, nextStep: f.nextStep });
}

/* Theme picker step 2: second mood prompt -> second preset. Same gates as
   Option 1 plus "the prompt must have changed". Same preset again is only
   a soft warning, not a hard block (per Sergey). */
function handleThemeSecond(req, res, a, body) {
  const def = fieldDef(body.field);
  if (!def || def.input !== 'theme-picker') return sendJson(res, 400, { error: 'Unknown theme field.' });
  const progress = getProgress(a.session.studentId);
  const cfg = lessonCfg(def.lesson);
  const f = progress.fields[def.id];
  if (!f || !f.option1) return sendJson(res, 400, { error: 'Generate Option 1 first.' });
  if (f.status === 'done') return sendJson(res, 400, { error: 'Theme is already selected.' });
  if (f.nextStep !== 'T2-prompt') {
    return sendJson(res, 200, { ok: false, errors: [{ rule: 'stage', hint: 'Compare the two options and choose.' }] });
  }

  const check = validate.checkThemePrompt({
    prompt: body.prompt, cfg: cfg, prevPrompt: f.option1.prompt, prevPreset: f.option1.preset
  });
  if (!check.ok) return sendJson(res, 200, { ok: false, errors: check.errors });

  const preset = validate.matchThemePreset(check.parsed.format, cfg);
  if (!preset) return sendJson(res, 200, { ok: false, errors: [{ rule: 'themeMood', hint: cfg.hints.themeMood }] });

  f.option2 = {
    prompt: String(body.prompt || ''),
    moodWord: check.moodWord,
    preset: preset.id,
    presetName: preset.name,
    palette: preset.palette,
    fontHeading: preset.fontHeading,
    fontBody: preset.fontBody,
    ts: Date.now()
  };
  f.nextStep = 'compare';
  progress.fields[def.id] = f;
  saveProgress(progress);

  sendJson(res, 200, { ok: true, option: f.option2, nextStep: f.nextStep, warning: check.warning });
}

/* Theme picker step 3: the student clicks which of the two presets wins. */
function handleThemeChoose(req, res, a, body) {
  const def = fieldDef(body.field);
  if (!def || def.input !== 'theme-picker') return sendJson(res, 400, { error: 'Unknown theme field.' });
  const progress = getProgress(a.session.studentId);
  const cfg = lessonCfg(def.lesson);
  const f = progress.fields[def.id];
  if (!f || !f.option1 || !f.option2) return sendJson(res, 400, { error: 'Generate both options first.' });
  if (f.status === 'done') return sendJson(res, 400, { error: 'Theme is already selected.' });
  if (f.nextStep !== 'compare') {
    return sendJson(res, 200, { ok: false, errors: [{ rule: 'stage', hint: cfg.hints.chooseNeeded }] });
  }
  const choice = Number(body.choice) | 0;
  if (choice !== 1 && choice !== 2) return sendJson(res, 400, { error: 'choice must be 1 or 2.' });

  f.choice = choice;
  f.nextStep = 'justify';
  progress.fields[def.id] = f;
  saveProgress(progress);

  sendJson(res, 200, { ok: true, nextStep: f.nextStep });
}

/* Theme picker step 4: journal justification (comparative/superlative +
   design word + meaningful length). On success the winning preset is
   stamped into progress.theme so build-site uses it. */
function handleThemeJustify(req, res, a, body) {
  const def = fieldDef(body.field);
  if (!def || def.input !== 'theme-picker') return sendJson(res, 400, { error: 'Unknown theme field.' });
  const progress = getProgress(a.session.studentId);
  const cfg = lessonCfg(def.lesson);
  const f = progress.fields[def.id];
  if (!f || !f.choice) return sendJson(res, 400, { error: 'Choose a theme first.' });
  if (f.status === 'done') return sendJson(res, 400, { error: 'Theme is already selected.' });
  if (f.nextStep !== 'justify') {
    return sendJson(res, 200, { ok: false, errors: [{ rule: 'stage', hint: cfg.hints.chooseNeeded }] });
  }

  const check = validate.checkThemeJournal(body.text, cfg);
  if (!check.ok) return sendJson(res, 200, { ok: false, errors: check.errors });

  const win = (f.choice === 1) ? f.option1 : f.option2;
  f.justification = String(body.text || '').trim();
  f.value = win.preset;
  f.status = 'done';
  f.nextStep = 'done';
  f.ts = Date.now();
  progress.fields[def.id] = f;
  progress.theme = win.preset;
  progress.complete = isComplete(progress, cfg);
  saveProgress(progress);

  sendJson(res, 200, { ok: true, complete: progress.complete, theme: win.preset });
}

/* imageView: a compact summary of an image-cycle field state, sent back to
   the UI on every mutation so the journal/status strip can re-render.     */
function imageView(f, cfg) {
  const its = f.iterations || [];
  const bestIdx = its.findIndex(function (x) { return x.best; });
  const worstIdx = its.findIndex(function (x) { return x.worst; });
  return {
    nextStep: f.nextStep || 'I1-prompt',
    iterations: its.length,
    minIterations: (cfg.rules.minImageIterations || 3),
    bestIdx: bestIdx,
    worstIdx: worstIdx,
    canAccept: validate.canAcceptImageField(its, cfg).ok
  };
}

/* ============================================================
   Teacher-only: unlock next lesson + build the single-file site.
   Unlock follows the spec (3.1): "the teacher upload is the trigger
   that moves the student to 'Lesson 1 complete' and opens the digital
   workspace of the next lesson". For Lesson 3 we unlock when the
   student's Lesson 2 is complete.                                          */

function handleUnlockLesson(req, res, a, body) {
  if (a.session.role !== 'teacher') return sendJson(res, 403, { error: 'Teachers only.' });
  const studentId = String(body.studentId || '').trim();
  const target = Number(body.lesson) | 0;
  if (!target || !lessons[target]) return sendJson(res, 400, { error: 'Unknown lesson.' });

  const cls = (classes.classes || []).find(c => c.code === a.session.classCode);
  if (!cls) return sendJson(res, 400, { error: 'Unknown class.' });
  const student = (cls.students || []).find(s => s.id === studentId);
  if (!student) return sendJson(res, 400, { error: 'Unknown student.' });

  const progress = getProgress(studentId);
  const unlocked = Array.isArray(progress.unlockedLessons) && progress.unlockedLessons.length
    ? progress.unlockedLessons.slice() : [DEFAULT_LESSON];
  if (unlocked.indexOf(target) !== -1) {
    /* already unlocked: just switch the active lesson */
  } else {
    /* unlock next lesson only when the previous one is complete */
    const prev = target - 1;
    if (prev >= DEFAULT_LESSON && !isComplete(progress, lessonCfg(prev))) {
      return sendJson(res, 200, { ok: false, error: 'Previous lesson is not complete yet.' });
    }
    unlocked.push(target);
    progress.unlockedLessons = unlocked;
  }
  progress.lesson = target;
  progress.complete = isComplete(progress, lessonCfg(target));
  saveProgress(progress);

  sendJson(res, 200, { ok: true, lesson: target, unlockedLessons: unlocked });
}

/* ============================================================
   Build the student's site as a single self-contained HTML file.
   Server assembles the export-config from the student's progress
   (Lesson 2 texts -> slots, Lesson 3 images -> images), then runs
   the two PowerShell tools used by the rehearsal pipeline:
     1) sample-particles.ps1   - only if the avatar PNG changed since
                                 the last build (rehearsal already
                                 produced an avatar-particles.js for the
                                 demo students - we reuse it when we can)
     2) export-site.ps1       - inlines template + CSS + JS + images
                                 + particle-JS into one .html
   Returns the relative path (dist/<name>.html) so the teacher can
   download via /preview/dist/...                                    */

function runPs(args, cwd) {
  return new Promise(function (resolve) {
    execFile('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File'].concat(args),
      { cwd: cwd, windowsHide: true },
      function (err, stdout, stderr) {
        resolve({ err: err, stdout: String(stdout || ''), stderr: String(stderr || '') });
      });
  });
}

function handleBuildSite(req, res, a, body) {
  if (a.session.role !== 'teacher') return sendJson(res, 403, { error: 'Teachers only.' });
  const cls = (classes.classes || []).find(c => c.code === a.session.classCode);
  if (!cls) return sendJson(res, 400, { error: 'Unknown class.' });
  const student = (cls.students || []).find(s => s.id === String(body.studentId || '').trim());
  if (!student) return sendJson(res, 400, { error: 'Unknown student.' });

  const progress = getProgress(student.id);
  /* Gate: all content lessons (L2-L4) must be complete before we shell out. */
  if (!isComplete(progress, lessons[2])) return sendJson(res, 200, { ok: false, error: 'Lesson 2 is not complete yet.' });
  if (!isComplete(progress, lessons[3])) return sendJson(res, 200, { ok: false, error: 'Lesson 3 is not complete yet.' });
  if (!isComplete(progress, lessons[4])) return sendJson(res, 200, { ok: false, error: 'Lesson 4 is not complete yet.' });

  runExport(req, res, student, 'built');
}

/* Lesson 5 publish: the final export/handover step. Teacher-only, gated on
   the whole course being complete (L2-L5) plus the journal-wide reflection
   vocabulary check (>=1 of today's words across the six answers). Marks
   progress.published so the console can show the handover state. */
function handleExportSite(req, res, a, body) {
  if (a.session.role !== 'teacher') return sendJson(res, 403, { error: 'Teachers only.' });
  const cls = (classes.classes || []).find(c => c.code === a.session.classCode);
  if (!cls) return sendJson(res, 400, { error: 'Unknown class.' });
  const student = (cls.students || []).find(s => s.id === String(body.studentId || '').trim());
  if (!student) return sendJson(res, 400, { error: 'Unknown student.' });

  const progress = getProgress(student.id);
  if (!isComplete(progress, lessons[2])) return sendJson(res, 200, { ok: false, error: 'Lesson 2 is not complete yet.' });
  if (!isComplete(progress, lessons[3])) return sendJson(res, 200, { ok: false, error: 'Lesson 3 is not complete yet.' });
  if (!isComplete(progress, lessons[4])) return sendJson(res, 200, { ok: false, error: 'Lesson 4 is not complete yet.' });
  if (!isComplete(progress, lessons[5])) {
    return sendJson(res, 200, { ok: false, error: lessons[5].hints.exportGated });
  }
  const vocab = validate.checkReflectionVocab(lessons[5], progress.fields);
  if (!vocab.ok) {
    return sendJson(res, 200, { ok: false, error: lessons[5].hints.exportVocab });
  }

  runExport(req, res, student, 'published');
}

/* Shared export pipeline (build-site + export-site): assemble the export
   config from progress, sample particles if needed, run export-site.ps1.
   mark = 'built' (teacher preview) | 'published' (Lesson 5 handover). */
function runExport(req, res, student, mark) {
  const studentId = student.id;
  const progress = getProgress(studentId);

  /* 1. assemble export-config */
  const l2fields = progress.fields;

  /* slots: every Lesson 2 text field. about-me wrapped in <p>...</p>.
     author-name falls back to the student alias if the field wasn't set. */
  var slots = {};
  (lessons[2].fields || []).forEach(function (f) {
    if (f.input !== 'direct' && f.input !== 'ai-cycle') return;
    if (!l2fields[f.id] || l2fields[f.id].status !== 'done') return;
    var v = String(l2fields[f.id].value || '');
    if (f.id === 'about-me' && v.indexOf('<p>') !== 0) v = '<p>' + v + '</p>';
    slots[f.id] = v;
  });
  if (!slots['author-name']) slots['author-name'] = student.name;

  /* images: Lesson 3 accepted images (avatar/background) + Lesson 4 rapid
     hobby images (hobby-image-1/2/3) - all relative paths under TRACK_ROOT. */
  var images = {};
  [3, 4].forEach(function (n) {
    (lessons[n].fields || []).forEach(function (f) {
      if (f.input !== 'ai-image-cycle' && f.input !== 'ai-image-rapid') return;
      var rel = progress.fields[f.id] && progress.fields[f.id].value;
      if (!rel) return;
      var alt = f.alt ? String(f.alt).replace('{author-name}', student.name)
        .replace('{hobby-title-1}', slots['hobby-title-1'] || '')
        .replace('{hobby-title-2}', slots['hobby-title-2'] || '')
        .replace('{hobby-title-3}', slots['hobby-title-3'] || '') : '';
      images[f.id] = { src: rel, alt: alt };
    });
  });

  /* theme: chosen in Lesson 4 (theme-picker). Falls back to "sunny-day"
     for legacy progress files built before Lesson 4 existed. */
  var theme = progress.theme || 'sunny-day';
  var pageTitle = (slots['site-title'] || (student.name + "'s World"));

  /* particle-JS for the avatar. Reuse the demo student's prebuilt file
     when it matches (rehearsal produced *-avatar-particles.js). Otherwise
     run the sampler now so export-site.ps1 always gets its particle data. */
  var particlePath = 'rehearsal/assets/' + studentId + '-avatar-particles.js';
  var particles = { avatar: particlePath };
  if (!assetExists(path.join(TRACK_ROOT, particlePath))) {
    var avatarsrc = l2fields['avatar'] && l2fields['avatar'].value;
    if (avatarsrc) {
      var absAvatar = path.join(TRACK_ROOT, avatarsrc);
      if (assetExists(absAvatar)) {
        var altPart = 'rehearsal/assets/' + studentId + '-avatar-particles.js';
        var altAbs = path.join(TRACK_ROOT, altPart);
        return runPs(['tools\\sample-particles.ps1', '-Source', absAvatar,
          '-Out', altAbs, '-SlotName', 'avatar', '-Step', '4'], TRACK_ROOT)
          .then(function (out) {
            proceedExport(req, res, studentId, pageTitle, theme, slots, images, particles, out, mark);
          });
      }
    }
  }
  proceedExport(req, res, studentId, pageTitle, theme, slots, images, particles, null, mark);
}

function proceedExport(req, res, studentId, pageTitle, theme, slots, images, particles, sampleOut, mark) {
  if (sampleOut && sampleOut.err) {
    return sendJson(res, 200, { ok: false,
      error: 'Particle sampler failed: ' + (sampleOut.stderr || sampleOut.err.message) });
  }

  var exportCfg = {
    name: studentId,
    pageTitle: pageTitle,
    theme: theme,
    slots: slots,
    images: images,
    particles: particles
  };
  var cfgPath = path.join(DATA, studentId + '-export.json');
  writeJson(cfgPath, exportCfg);

  var outHtml = 'dist/' + studentId + '.html';
  runPs(['tools\\export-site.ps1', '-Config', path.relative(TRACK_ROOT, cfgPath), '-Out', outHtml], TRACK_ROOT)
    .then(function (out) {
      if (out.err) return sendJson(res, 200, { ok: false,
        error: 'Export failed: ' + (out.stderr || out.err.message) });
      var abs = path.join(TRACK_ROOT, outHtml);
      var size = assetExists(abs) ? fs.statSync(abs).size : 0;
      /* record a build stamp on the student's progress so the teacher
         console can show "site built" with a timestamp. */
      var p = getProgress(studentId);
      p.built = { ts: Date.now(), file: outHtml, size: size };
      if (mark === 'published') {
        p.published = { ts: Date.now(), file: outHtml, size: size, url: '/preview/' + outHtml };
      }
      saveProgress(p);
      sendJson(res, 200, { ok: true, file: outHtml, size: size, url: '/preview/' + outHtml,
        published: !!p.published });
    });
}

/* ---------- teacher console (Pieces 2 + 3) ----------
   No real-time dashboard: a simple table refreshed on demand or every
   few seconds. Goal = see who is stuck, not analytics. Computes a ready-
   to-render view per student from the same JSON progress the gating
   engine writes. Read-only for the teacher. */

function shortLabel(def) {
  const map = { 'about-me': 'About Me', 'hobby-text-1': 'Hobby 1',
    'hobby-text-2': 'Hobby 2', 'hobby-text-3': 'Hobby 3',
    'avatar': 'Avatar', 'background': 'Background',
    'hobby-image-1': 'Hobby 1 image', 'hobby-image-2': 'Hobby 2 image', 'hobby-image-3': 'Hobby 3 image',
    'theme': 'Theme', 'audit': 'Audit' };
  if (map[def.id]) return map[def.id];
  if (def.id.indexOf('reflection-') === 0) return 'Reflection ' + def.id.slice(-1);
  return def.label;
}

function lessonProgress(p, cfg) {
  const fields = cfg.fields || [];
  const required = fields.filter(f => f.required);
  const doneCount = required.filter(f => p.fields[f.id] && p.fields[f.id].status === 'done').length;
  const complete = doneCount === required.length && required.length > 0;
  return { done: doneCount, total: required.length, complete: complete };
}

function buildStudentView(student, selLesson) {
  const p = getProgress(student.id);
  const cur = p.lesson || DEFAULT_LESSON;
  const cfg = lessonCfg(selLesson || DEFAULT_LESSON);
  const lp = lessonProgress(p, cfg);

  /* Per-lesson statuses (the teacher needs to know whether L2 is finished
     before unlocking L3, and whether both are done before building). */
  const lessonsStatus = {};
  Object.keys(lessons).forEach(function (n) {
    lessonsStatus[n] = lessonProgress(p, lessons[n]);
  });
  const l2complete = (lessonsStatus[2] && lessonsStatus[2].complete) || false;
  const l3complete = (lessonsStatus[3] && lessonsStatus[3].complete) || false;
  const l4complete = (lessonsStatus[4] && lessonsStatus[4].complete) || false;
  const l5complete = (lessonsStatus[5] && lessonsStatus[5].complete) || false;
  const unlocked = Array.isArray(p.unlockedLessons) && p.unlockedLessons.length
    ? p.unlockedLessons : [DEFAULT_LESSON];

  const fields = cfg.fields || [];
  const required = fields.filter(f => f.required);
  const doneCount = lp.done;
  const complete = lp.complete;
  const state = complete ? 'complete' : (doneCount > 0 ? 'working' : 'not-started');

  const setupFields = fields.filter(f => f.input === 'direct' && f.required);
  const setupDone = setupFields.filter(f => p.fields[f.id] && p.fields[f.id].status === 'done').length;

/* AI fields of the CURRENT lesson only (text-cycle / image-cycle for L2
     and L3). Mid-flow flag = started prompting but not closed yet. New L2
     types (ai-text-3step About Me, ai-cycle-bonus hobbies) report their
     progress through `nextStep` rather than an iteration minimum. */
  const aiFields = fields.filter(f =>
    f.input === 'ai-cycle' || f.input === 'ai-text-3step' ||
    f.input === 'ai-cycle-bonus' || f.input === 'ai-image-cycle' ||
    f.input === 'ai-image-rapid' || f.input === 'theme-picker' ||
    f.input === 'checklist' || (f.input === 'direct' && f.minWords)).map(function (f) {
    const fs = p.fields[f.id] || { status: 'open', iterations: [], acceptedPrompts: [], nextStep: '' };
    let accepted, midflow;
    if (f.input === 'checklist' || (f.input === 'direct' && f.minWords)) {
      /* Lesson 5: audit checklist + reflection answers - single-save fields */
      accepted = fs.status === 'done' ? 1 : 0;
      midflow = false;
    } else if (f.input === 'ai-image-cycle') {
      /* v2 image cycle: rated iterations + best + worst required */
      const min = (cfg.rules.minImageIterations || 3);
      accepted = (fs.iterations || []).length;
      midflow = fs.status !== 'done' && accepted > 0 &&
        (accepted < min ||
         !(fs.iterations || []).some(function (it) { return it.best; }) ||
         !(fs.iterations || []).some(function (it) { return it.worst; }));
    } else if (f.input === 'ai-image-rapid') {
      /* L4 rapid hobby image: iterations count up, no minimum */
      accepted = (fs.iterations || []).length;
      midflow = fs.status !== 'done' && accepted > 0 && fs.nextStep !== 'done';
    } else if (f.input === 'theme-picker') {
      /* L4 theme: option1/option2 generated but not finalized yet */
      accepted = 0;
      midflow = fs.status !== 'done' && (fs.option1 || fs.option2);
    } else if (f.input === 'ai-text-3step') {
      /* About Me: stage progression via nextStep. Midflow = started, not done */
      accepted = (fs.iterations || []).length;
      midflow = fs.status !== 'done' && accepted > 0 && fs.nextStep !== 'done';
    } else if (f.input === 'ai-cycle-bonus') {
      /* Hobby: stage 1 = draft ready (fork), stage 2 = after improve */
      accepted = (fs.iterations || []).length;
      midflow = fs.status !== 'done' && accepted > 0 && fs.nextStep !== 'done';
    } else {
      /* legacy ai-cycle */
      const min = (typeof f.minIterations === 'number') ? f.minIterations : (cfg.rules.minIterations || 0);
      accepted = (fs.acceptedPrompts && fs.acceptedPrompts.length) || 0;
      midflow = fs.status !== 'done' && accepted > 0 && accepted < min;
    }
    const min = (f.input === 'ai-image-cycle') ? (cfg.rules.minImageIterations || 3) :
                (f.input === 'ai-cycle') ? ((typeof f.minIterations === 'number') ? f.minIterations : (cfg.rules.minIterations || 0)) :
                0;
    const its = fs.iterations || [];
    let lastIt = its.length ? its[its.length - 1] : null;
    if (!lastIt && f.input === 'theme-picker') lastIt = fs.option2 || fs.option1 || null;
    return {
      id: f.id, label: shortLabel(f), input: f.input,
      status: fs.status || 'open',
      nextStep: fs.nextStep || '',
      iterations: its.length,
      accepted: accepted, min: min,
      midflow: midflow,
      bonusClaimed: !!fs.bonusClaimed,
      lastTs: (lastIt && lastIt.ts) || fs.ts || null,
      rawData: fs
    };
  });

  const needsAttention = !complete && aiFields.some(f => f.midflow);
  const readyToBuild = l2complete && l3complete && l4complete;
  const readyToPublish = readyToBuild && l5complete;

  let lastTs = null, lastField = null, lastPrompt = null;
  /* Newest iteration across the lesson's AI fields. Old dev data has no ts
     on iterations - fall back to array order (iterations are pushed in
     chronological order), so the console never shows "No prompts yet"
     for a student that actually has prompts. */
  const iters = [];
  aiFields.forEach(function (f) {
    (f.rawData.iterations || []).forEach(function (it) {
      iters.push({ label: f.label, prompt: it.prompt, ts: it.ts || null });
    });
    /* theme-picker keeps its prompts in option1/option2 instead of iterations */
    if (f.input === 'theme-picker') {
      const o1 = f.rawData.option1, o2 = f.rawData.option2;
      if (o1) iters.push({ label: f.label, prompt: o1.prompt, ts: o1.ts || null });
      if (o2) iters.push({ label: f.label, prompt: o2.prompt, ts: o2.ts || null });
    }
    /* Lesson 5: audit + reflections are single-saved values */
    if ((f.input === 'checklist' || (f.input === 'direct' && f.minWords)) && f.rawData.ts) {
      const v = f.input === 'checklist' ? '(audit confirmed)' : String(f.rawData.value || '');
      iters.push({ label: f.label, prompt: v, ts: f.rawData.ts });
    }
  });
  if (iters.length) {
    iters.sort(function (x, y) { return (y.ts || 0) - (x.ts || 0); });
    const stamped = iters.filter(function (x) { return x.ts; });
    if (stamped.length) {
      lastTs = stamped[0].ts; lastField = stamped[0].label; lastPrompt = stamped[0].prompt;
    } else {
      const b = iters[iters.length - 1];
      lastField = b.label; lastPrompt = b.prompt;
    }
  }

  const journal = aiFields.map(function (f) {
    const its = (f.rawData.iterations || []).map(function (it) {
      return { prompt: it.prompt, draft: it.draft, edited: it.edited, notes: it.notes,
        reason: it.reason || null,
        image: it.image || null,
        structure: it.structure || null, pros: it.pros || null, cons: it.cons || null,
        best: it.best || null, worst: it.worst || null,
        version: it.version || null,
        stage: it.stage || null, good: it.good || null, needsChange: it.needsChange || null,
        bonusClaimed: it.bonusClaimed || null,
        ts: it.ts };
    });
    return {
      fieldLabel: f.label, input: f.input, status: f.status,
      nextStep: f.rawData.nextStep || '',
      bonusClaimed: f.rawData.bonusClaimed || false,
      value: f.rawData.value || null,
      items: f.rawData.items || null,
      themeData: f.input === 'theme-picker' ? {
        option1: f.rawData.option1 || null,
        option2: f.rawData.option2 || null,
        choice: f.rawData.choice || null,
        justification: f.rawData.justification || null
      } : null,
      iterations: its
    };
  });

  return {
    id: student.id, name: student.name,
    currentLesson: cur,
    unlockedLessons: unlocked,
    state: state, needsAttention: needsAttention, complete: complete,
    progress: { done: doneCount, total: required.length },
    setup: { done: setupDone, total: setupFields.length },
    lessonsStatus: lessonsStatus,
    readyToBuild: readyToBuild,
    readyToPublish: readyToPublish,
    built: p.built || null,
    published: p.published || null,
    aiFields: aiFields.map(f => ({
      id: f.id, label: f.label, input: f.input, status: f.status,
      iterations: f.iterations, accepted: f.accepted, min: f.min, midflow: f.midflow,
      lastTs: f.lastTs
    })),
    lastActivity: lastField ? { label: lastField, prompt: lastPrompt, ts: lastTs } : null,
    journal: journal
  };
}

function handleTeacherOverview(req, res, a) {
  if (a.session.role !== 'teacher') return sendJson(res, 403, { error: 'Teachers only.' });
  const cls = (classes.classes || []).find(c => c.code === a.session.classCode);
  /* Optional ?lesson=N: the console can be switched between lessons. Each
     student view (AI fields, journal, latest prompt, state) is then built
     for that lesson instead of the student's current lesson. */
  let sel = DEFAULT_LESSON;
  const q = new URL(req.url, 'http://localhost').searchParams.get('lesson');
  if (q) {
    const n = Number(q);
    if (lessons[n]) sel = n;
  }
  const resp = {
    lesson: sel,
    title: lessons[sel].title,
    lessons: Object.keys(lessons).map(function (n) {
      return { lesson: Number(n), title: lessons[n].title };
    }),
    class: { code: a.session.classCode, name: a.session.className || (cls ? cls.name : a.session.classCode) },
    students: [],
    summary: { total: 0, complete: 0, working: 0, notStarted: 0, needsAttention: 0, readyToBuild: 0, built: 0, readyToPublish: 0, published: 0 }
  };
  if (!cls) return sendJson(res, 200, resp);

  const students = cls.students || [];
  resp.students = students.map(s => buildStudentView(s, sel));
  resp.summary = {
    total: resp.students.length,
    complete: resp.students.filter(s => s.state === 'complete').length,
    working: resp.students.filter(s => s.state === 'working').length,
    notStarted: resp.students.filter(s => s.state === 'not-started').length,
    needsAttention: resp.students.filter(s => s.needsAttention).length,
    readyToBuild: resp.students.filter(s => s.readyToBuild).length,
    built: resp.students.filter(s => s.built).length,
    readyToPublish: resp.students.filter(s => s.readyToPublish).length,
    published: resp.students.filter(s => s.published).length
  };
  sendJson(res, 200, resp);
}

/* ---------- static files ---------- */

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
               '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
               '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
               '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif' };

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/') rel = '/login.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (file.indexOf(PUBLIC) !== 0) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, content) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(content);
  });
}

/* Preview / download route: serves files from the track root (rehearsal
   images, dist exports, demo-assets) so the platform UI and the teacher's
   "download site" link work without bundling everything into /public.
   The path is locked to TRACK_ROOT - nothing escapes the project. */
function servePreview(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel.indexOf('/') === 0) rel = rel.slice(1);
  const file = path.normalize(path.join(TRACK_ROOT, rel));
  if (file.indexOf(TRACK_ROOT) !== 0) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, content) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    /* ?download=1 -> attachment so the teacher can hand the single-file
       site to the family as a file (Lesson 5 export). */
    const isDownload = new URL(req.url, 'http://localhost').searchParams.get('download') === '1';
    const headers = { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' };
    if (isDownload) {
      headers['Content-Disposition'] = 'attachment; filename="' + path.basename(file) + '"';
    }
    res.writeHead(200, headers);
    res.end(content);
  });
}

/* ---------- main ---------- */

const server = http.createServer(async (req, res) => {
  const u = req.url.split('?')[0];

  if (u === '/api/login' && req.method === 'POST') {
    return handleLogin(req, res, await readBody(req));
  }
  if (u.indexOf('/api/') === 0) {
    const a = auth(req);
    if (!a) return sendJson(res, 401, { error: 'Not logged in.' });
    const body = req.method === 'POST' ? await readBody(req) : {};

    /* teacher-only endpoints */
    if (u === '/api/teacher/overview' && req.method === 'GET') {
      if (a.session.role !== 'teacher') return sendJson(res, 403, { error: 'Teachers only.' });
      return handleTeacherOverview(req, res, a);
    }
    if (u === '/api/teacher/unlock-lesson' && req.method === 'POST') {
      if (a.session.role !== 'teacher') return sendJson(res, 403, { error: 'Teachers only.' });
      return handleUnlockLesson(req, res, a, body);
    }
    if (u === '/api/teacher/build-site' && req.method === 'POST') {
      if (a.session.role !== 'teacher') return sendJson(res, 403, { error: 'Teachers only.' });
      return handleBuildSite(req, res, a, body);
    }
    if (u === '/api/teacher/export-site' && req.method === 'POST') {
      if (a.session.role !== 'teacher') return sendJson(res, 403, { error: 'Teachers only.' });
      return handleExportSite(req, res, a, body);
    }

    /* student-only endpoints: a teacher session must not touch them */
    const studentOnly = ['/api/me', '/api/prompt', '/api/submit-text',
      '/api/save-edit', '/api/save-eval', '/api/save-direct', '/api/reset', '/api/reset-all', '/api/lesson-switch',
      '/api/image-prompt', '/api/image-eval', '/api/image-best', '/api/image-worst', '/api/image-unmark', '/api/image-accept',
      '/api/image-regenerate', '/api/image-publish',
      '/api/theme-prompt', '/api/theme-second', '/api/theme-choose', '/api/theme-justify'];
    if (studentOnly.indexOf(u) !== -1 && a.session.role !== 'student') {
      return sendJson(res, 403, { error: 'Students only.' });
    }

    if (u === '/api/me' && req.method === 'GET') return handleMe(req, res, a);
    if (u === '/api/prompt' && req.method === 'POST') return handlePrompt(req, res, a, body);
    if (u === '/api/submit-text' && req.method === 'POST') return handleSubmitText(req, res, a, body);
    if (u === '/api/save-edit' && req.method === 'POST') return handleSaveEdit(req, res, a, body);
    if (u === '/api/save-eval' && req.method === 'POST') return handleSaveEval(req, res, a, body);
    if (u === '/api/save-direct' && req.method === 'POST') return handleSaveDirect(req, res, a, body);
    if (u === '/api/lesson-switch' && req.method === 'POST') return handleLessonSwitch(req, res, a, body);
    if (u === '/api/image-prompt' && req.method === 'POST') return handleImagePrompt(req, res, a, body);
    if (u === '/api/image-eval' && req.method === 'POST') return handleImageEval(req, res, a, body);
    if (u === '/api/image-best' && req.method === 'POST') return handleImageBest(req, res, a, body);
    if (u === '/api/image-worst' && req.method === 'POST') return handleImageWorst(req, res, a, body);
    if (u === '/api/image-unmark' && req.method === 'POST') return handleImageUnmark(req, res, a, body);
    if (u === '/api/image-accept' && req.method === 'POST') return handleImageAccept(req, res, a, body);
    if (u === '/api/image-regenerate' && req.method === 'POST') return handleImageRegenerate(req, res, a, body);
    if (u === '/api/image-publish' && req.method === 'POST') return handleImagePublish(req, res, a, body);
    if (u === '/api/theme-prompt' && req.method === 'POST') return handleThemePrompt(req, res, a, body);
    if (u === '/api/theme-second' && req.method === 'POST') return handleThemeSecond(req, res, a, body);
    if (u === '/api/theme-choose' && req.method === 'POST') return handleThemeChoose(req, res, a, body);
    if (u === '/api/theme-justify' && req.method === 'POST') return handleThemeJustify(req, res, a, body);
    if (u === '/api/reset' && req.method === 'POST') return handleReset(req, res, a);
    if (u === '/api/reset-all' && req.method === 'POST') return handleResetAll(req, res, a);
    if (u === '/api/logout' && req.method === 'POST') return handleLogout(req, res, a);
    return sendJson(res, 404, { error: 'Unknown API call.' });
  }

  /* files outside /public (rehearsal images, dist exports) */
  if (u.indexOf('/preview/') === 0 && req.method === 'GET') {
    return servePreview(req, res, u.slice('/preview'.length));
  }

  if (req.method === 'GET') return serveStatic(req, res, req.url);
  res.writeHead(405); res.end('method not allowed');
});

server.listen(PORT, () => {
  console.log('Platform running:  http://localhost:' + PORT);
  console.log('Students: code DEMO, Lumi/1111, Ziggy/2222, Neo/3333');
  console.log('Teacher:  code DEMO, PIN 0000  ->  /teacher.html');
});
