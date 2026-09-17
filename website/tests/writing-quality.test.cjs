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
test('style cleanup preserves approximate metrics instead of inventing precision',()=>{
 const source='Reduced runtime by approximately 40%, saving around 20 hours and about £500. The estimate was ~40%.';
 assert.equal(quality.stripApproximations(source),source);
 assert.ok(quality.removeBannedContent(source).includes('approximately 40%'));
});
