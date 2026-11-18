const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {startServer} = require('./helpers/server');
const {presets} = require('../platform/config/lesson-4.json');

test('export all six palettes, partial image sets and resume legacy background journals', async t => {
  const server = await startServer();
  t.after(() => server.stop());
  async function post(route, data, token) {
    const res = await fetch(server.base + '/api/' + route, {method:'POST', headers:{
      'Content-Type':'application/json', Authorization:'Bearer ' + (token || '')},body:JSON.stringify(data)});
    const result = await res.json();
    assert(res.ok && (route === 'login' ? result.token : result.ok), result.error || route); return result;
  }
  const teacher = (await post('login',{role:'teacher',classCode:'DEMO',pin:'0000'})).token;
  const student = (await post('login',{classCode:'DEMO',name:'Lumi',pin:'1111'})).token;
  const file = path.join(server.data,'progress/lumi.json');
  const original = JSON.parse(fs.readFileSync(file));
  for (const [i,preset] of presets.entries()) {
    const p = structuredClone(original);
    p.theme = preset.id;
    for (const n of [1,2,3]) if (i % 3 === 0 || (i % 3 === 1 && n !== 2)) delete p.fields['hobby-image-'+n];
    if (i < 3) delete p.fields.background;
    fs.writeFileSync(file,JSON.stringify(p));
    await post('teacher/build-site',{studentId:'lumi'},teacher);
    const site = JSON.parse(fs.readFileSync(path.join(server.data,'lumi-export.json')));
    assert.equal(site.theme,preset.id);
    assert.equal(Boolean(site.images.background),i>=3);
    assert(site.images.avatar.src);
    for (const n of [1,2,3]) {
      const id = 'hobby-image-'+n;
      assert.equal(Boolean(site.images[id]),Boolean(p.fields[id]));
      if (site.images[id]) assert.equal(site.images[id].alt,site.slots['hobby-title-'+n]);
      assert(site.slots['hobby-text-'+n]);
    }
  }
  for (const count of [1,6]) {
    const p = structuredClone(original), bg = p.fields.background;
    bg.status='open'; bg.nextStep='I1-eval'; delete bg.value;
    bg.iterations=Array.from({length:count},()=>structuredClone(bg.iterations[0]));
    delete p.published; delete p.everPublished;
    fs.writeFileSync(file,JSON.stringify(p));
    const me = await (await fetch(server.base+'/api/me',{headers:{Authorization:'Bearer '+student}})).json();
    assert.equal(me.progress.fields.background.nextStep,'I'+count+'-review');
    assert.equal(me.progress.fields.background.iterations[count-1].pros,bg.iterations[0].pros);
    await post('image-publish',{field:'background',version:count},student);
    assert.equal(JSON.parse(fs.readFileSync(file)).fields.background.publishedVersion,count);
  }
});
