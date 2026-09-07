const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
require('../dynamic-score.js');
const sandbox={window:{addEventListener(){},DynamicScore:global.DynamicScore},document:{addEventListener(){}},console:{log(){},warn(){},error(){}}};
vm.runInNewContext(fs.readFileSync(require.resolve('../popup.js'),'utf8')+'\nthis.PopupClass=ATSTailor;',sandbox);
const popup=Object.create(sandbox.PopupClass.prototype);
test('popup coverage rejects Java inside JavaScript',()=>{
 const result=popup.calculateMatchScore('JavaScript',{all:['Java','JavaScript']});
 assert.equal(result.matchScore,50); assert.equal(result.missingKeywords[0],'Java');
});
test('score boost preserves candidate text and reports missing skills',async()=>{
 const cv='Engineer with Python experience.';
 const result=await popup.boostCVTo95Plus(cv,{all:['Python','Kubernetes']});
 assert.equal(result.tailoredCV,cv); assert.equal(result.finalScore,50);
 assert.equal(result.missingKeywords[0],'Kubernetes');
 assert.equal(popup.fastKeywordInjection(cv,{all:['Kubernetes']},['Kubernetes']).tailoredCV,cv);
});
test('candidate location never becomes the job location',()=>{
 popup.currentJob={location:'New York, US'}; popup._cachedProfile={city:'Paris',country:'France'};
 assert.equal(popup.getApplicationLocation(),'Paris, France');
 popup._cachedProfile={}; assert.equal(popup.getApplicationLocation(),'');
});
