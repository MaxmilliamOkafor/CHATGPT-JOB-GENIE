const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../autofill-core.js');
test('unknown screening facts are left for the candidate',()=>{
 for(const question of ['Do you require sponsorship?', 'Are you authorized to work?', 'Are you comfortable with this hybrid role?', 'Do you have a disability?', 'Have you been convicted of a crime?']) assert.equal(core.yesNoFor(question,{}),'',question);
 for(const label of ['Degree','Nationality','Country','Languages']) assert.ok(!core.answerFor(label,{}),label);
});
test('dropdown options must match completely',()=>{
 assert.equal(core.optionMatches('United States','United'),false);
 assert.equal(core.optionMatches('No, I require sponsorship','No'),true);
 assert.equal(core.optionMatches('Ireland','ireland'),true);
});
test('never guesses the length of a phone country prefix',()=>{
 assert.equal(core._nationalPhone('+12025550100',''),'+12025550100');
 assert.equal(core._nationalPhone('+12025550100','+1'),'2025550100');
});
test('submission and email default to opt-in',()=>{
 assert.equal(core.DEFAULT_ON.has('linkedin_autosubmit_enabled'),false);
 assert.equal(core.DEFAULT_ON.has('followup_enabled'),false);
});
test('explicit answers and supplied contact facts remain usable',()=>{
 assert.equal(core.answerFor('Email',{email:'candidate@example.com'}),'candidate@example.com');
 assert.equal(core.answerFor('Are you comfortable with this model?',{application_answers:{'Are you comfortable with this model?':'Yes'}}),'Yes');
});
test('residence does not imply permission to work',()=>{
 assert.deepEqual(core.authorisedCountries({country:'Ireland'}),[]);
 assert.equal(core.authorisedForQuestion('Authorized to work in Ireland?',{country:'Ireland'}),'');
 assert.equal(core.authorisedForQuestion('Authorized to work in Ireland?',{work_authorized_countries:['IE']}),'Yes');
});
test('custom dropdown requires selection evidence and honors linked listboxes',async()=>{
 const original=global.KeyboardEvent;
 global.KeyboardEvent=class {constructor(type,init){this.type=type;Object.assign(this,init);}};
 try {
  let selected=false, clicked=0;
  const doc={defaultView:{getComputedStyle(){return {display:'block',visibility:'visible',opacity:'1'};}},getElementById(id){return id==='answers'?{querySelectorAll(){return [option];}}:null;}};
  const option={textContent:'Yes',ownerDocument:doc,getBoundingClientRect(){return {width:100,height:30};},getAttribute(k){return k==='aria-selected'&&selected?'true':null;},click(){clicked++;}};
  const el={tagName:'BUTTON',ownerDocument:doc,textContent:'Select...',getAttribute(k){return k==='aria-controls'?'missing answers':null;},click(){},focus(){},dispatchEvent(){}};
  assert.equal(await core.fillCustomDropdown(el,'Yes'),false);
  assert.equal(clicked,1);
  option.click=()=>{selected=true;};
  assert.equal(await core.fillCustomDropdown(el,'Yes'),true);
 } finally {global.KeyboardEvent=original;}
});
