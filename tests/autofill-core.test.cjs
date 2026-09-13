const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../autofill-core.js');
test('unknown screening facts are left for the candidate',()=>{
 for(const question of ['Do you require sponsorship?', 'Are you authorized to work?', 'Are you comfortable with this hybrid role?', 'Have you been convicted of a crime?']) assert.equal(core.yesNoFor(question,{}),'',question);
 for(const label of ['Degree','Nationality','Country','Languages']) assert.ok(!core.answerFor(label,{}),label);
});
// DECLINING IS NOT A CLAIM, AND A BLANK EEO QUESTION IS STILL A BLOCKED FORM.
//
// The four EEO questions were swept into the same rule as everything
// else and left empty. They are frequently required, and every one of
// those forms offers "prefer not to say" as one of its own answers --
// so refusing to pick it asserts nothing about the candidate that
// silence did not, and costs the submission. Nothing else moved: work
// authorisation, sponsorship, criminal record and every preference
// still go unanswered without the profile.
test('the EEO questions decline rather than blocking the form',()=>{
 for(const question of ['Do you have a disability?','Are you a protected veteran?']) assert.equal(core.yesNoFor(question,{}),'Prefer not to say',question);
 for(const label of ['Gender','Race/Ethnicity']) assert.equal(core.answerFor(label,{}),'Prefer not to say',label);
 // and a stated preference always wins over declining
 assert.equal(core.yesNoFor('Do you have a disability?',{disability_status:'No'}),'No');
});
test('every phrasing of declining is the same answer',()=>{
 const greenhouse=[{textContent:'I identify as one or more of the classifications of a protected veteran'},
  {textContent:'I am not a protected veteran'},{textContent:"I don't wish to answer"}];
 assert.equal(core.soleMatch(greenhouse,'Prefer not to say').textContent,"I don't wish to answer");
 // with no way to decline offered, nothing is chosen
 assert.equal(core.soleMatch(greenhouse.slice(0,2),'Prefer not to say'),null);
 // and a decline answer can never pick up a real one
 assert.equal(core._isDecline('I am not a protected veteran'),false);
 assert.equal(core._isDecline('Decline to self-identify'),true);
});
test('every DEFAULTS key is a string, never undefined',()=>{
 for(const [key,value] of Object.entries(core.DEFAULTS)) assert.equal(typeof value,'string',key);
 for(const question of ['What is your notice period?','What is your earliest available start date?','How did you hear about us?','Are you willing to relocate?'])
  assert.equal(typeof core.answerFor(question,{}),'string',question);
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
