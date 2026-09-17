const {test}=require('node:test');
const assert=require('node:assert/strict');
const {measureCoverage,evaluateRevision}=require('../website/supabase/functions/_shared/coverage.ts');
const draft='Alex Sample\nSUMMARY\nAnalyst building reliable reporting systems.\nEXPERIENCE\nSample Company\nJanuary 2020 - Present\n- Built reporting workflows in Python.\nTECHNICAL SKILLS\nPython\nEDUCATION\nBSc';
test('keywords in a cover letter cannot suppress a CV improvement',()=>{
 const revised=draft.replace('TECHNICAL SKILLS\nPython','TECHNICAL SKILLS\nPython, SQL');
 const result=evaluateRevision({draft,revised,coverLetterDraft:'Python SQL',coverLetterRevised:'Python SQL',terms:['Python','SQL']});
 assert.equal(result.coverageBefore,50);assert.equal(result.coverageAfter,100);assert.equal(result.accept,true);
});
test('cover-letter-only changes cannot count as a successful CV revision',()=>{
 const result=evaluateRevision({draft,revised:draft,coverLetterDraft:'Python',coverLetterRevised:'Python SQL',terms:['Python','SQL']});
 assert.equal(result.coverageBefore,50);assert.equal(result.coverageAfter,50);assert.equal(result.accept,false);
});
test('a substring is not full technical coverage',()=>{
 assert.equal(measureCoverage('JavaScript reactive systems',['Java','React']).percent,0);
});
