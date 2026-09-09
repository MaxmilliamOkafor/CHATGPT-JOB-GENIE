const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx={window:{},console:{log(){},warn(){}}};
vm.runInNewContext(fs.readFileSync(require.resolve('../content-quality-engine.js'),'utf8'),ctx);
const quality=ctx.window.ContentQualityEngine;
test('style cleanup preserves sentence grammar, voice and paragraphs deterministically',()=>{
 const source='I have built reporting tools. I have tested them. I have maintained them.\nThe services were deployed by another team.';
 for(let i=0;i<12;i++) assert.equal(quality.humaniseText(source),source);
});
// A HEDGE IN FRONT OF A NUMBER IS AN APOLOGY, NOT A MEASUREMENT.
//
// This used to assert the opposite -- that "~40%" must survive, on the
// grounds that removing the tilde invents precision. It left one rule
// contradicting another: "approximately" is already a banned WORD in
// this engine, so the ban was simply evaded by writing it as
// punctuation, and the CV shipped hedging its own best number. Nobody
// reads "40%" on a CV as a claim to four significant figures.
//
// The figure itself is never touched, and a hedge that is not standing
// in front of a number is left exactly where it is.
test('style cleanup removes the hedge in front of a figure, never the figure',()=>{
 const source='Reduced runtime by approximately 40%, saving around 20 hours and about £500. The estimate was ~40%.';
 const cleaned=quality.stripApproximations(source);
 assert.equal(cleaned,'Reduced runtime by 40%, saving 20 hours and £500. The estimate was 40%.');
 for(const figure of ['40%','20 hours','£500']) assert.ok(cleaned.includes(figure),figure);
});
test('and a hedge that is not in front of a number is left alone',()=>{
 for(const kept of ['roughly speaking it worked','the tilde ~ in prose stays','about the migration']){
  assert.equal(quality.stripApproximations(kept),kept);
 }
});
