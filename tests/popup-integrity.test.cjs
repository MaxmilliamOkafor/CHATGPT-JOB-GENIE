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
test('visible gauge agrees with 8 of 19 rather than a supplied inflated score',()=>{
 const elements={};
 for(const id of ['matchGaugeCircle','matchPercentage','matchSubtitle','keywordCountBadge']) elements[id]={textContent:'',setAttribute(k,v){this[k]=v;}};
 sandbox.document.getElementById=id=>elements[id];
 popup.updateMatchGauge(100,8,19);
 assert.equal(elements.matchPercentage.textContent,'42%');
 assert.equal(elements.keywordCountBadge.textContent,'8 of 19 keywords matched');
 assert.ok(Number(elements.matchGaugeCircle['stroke-dashoffset'])>0);
 assert.ok(!elements.matchSubtitle.textContent.includes('Perfect'));
 popup.updateMatchGauge(100,0,0);
 assert.equal(elements.matchPercentage.textContent,'—');
});
test('failed or absent DOCX rebuild cannot retain a previous job artifact',()=>{
 popup.generatedDocuments={cvDocx:'old-cv',coverDocx:'old-letter',cvDocxFileName:'old.docx'};
 popup.buildDocxArtifact();
 assert.equal(popup.generatedDocuments.cvDocx,undefined);
 assert.equal(popup.generatedDocuments.coverDocx,undefined);
});
