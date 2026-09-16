const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildEvidenceSources,classifyTerm}=require('../website/supabase/functions/_shared/evidence.ts');
test('role descriptions and achievements can support missing requirements',()=>{
 const sources=buildEvidenceSources({professionalExperience:[{title:'Analyst',company:'Example',description:'Gathered business requirements from nine stakeholder groups.',achievements:[{text:'Created reporting dashboards in Tableau.'}]}]});
 assert.notEqual(classifyTerm('business requirements',sources).tier,'unsupported');
 assert.equal(classifyTerm('Tableau',sources).tier,'demonstrated');
 assert.ok(!sources.some(s=>s.text.includes('[object Object]')));
});
test('stored-profile aliases and project technology lists remain explicit evidence',()=>{
 const sources=buildEvidenceSources({professional_experience:[{title:'Engineer',technologies:['Terraform']}],relevant_projects:[{name:'Sample',technologies:['Kafka'],tech_stack:['Python']} ]});
 for(const term of ['Terraform','Kafka','Python']) assert.equal(classifyTerm(term,sources).tier,'explicit');
 assert.equal(classifyTerm('Salesforce',sources).tier,'unsupported');
});
test('separate records preserve negation without negating unrelated tools',()=>{
 const sources=buildEvidenceSources({relevantProjects:[{name:'Sample',technologies:['No Kafka experience','Python']}]});
 assert.equal(classifyTerm('Kafka',sources).tier,'unsupported');assert.equal(classifyTerm('Python',sources).tier,'explicit');
});
test('duplicate aliases do not multiply the same evidence',()=>{
 const role={title:'Engineer',company:'Example',description:'Built SQL reporting.'};
 const sources=buildEvidenceSources({professionalExperience:[role],professional_experience:[role]});
 assert.equal(sources.filter(s=>s.text==='Built SQL reporting.').length,1);
});
