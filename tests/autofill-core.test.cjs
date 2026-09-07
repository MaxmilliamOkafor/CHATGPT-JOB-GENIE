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
