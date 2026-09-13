const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const TX=require('../keyword-taxonomy.js');
const ctx={window:{KeywordTaxonomy:TX}};vm.runInNewContext(fs.readFileSync(require.resolve('../dynamic-score.js'),'utf8'),ctx);
const DS=ctx.window.DynamicScore;
test('distinct tools retain distinct requirements and do not award each other credit',()=>{
 const terms=['Git','GitHub Actions','GitLab CI','Docker','ETL','ELT','Lean','Six Sigma'];
 const result=TX.measure('Git, generic containers, ETL and Lean',terms);
 assert.equal(result.total,8);assert.deepEqual(result.matched,['Git','ETL','Lean']);assert.equal(result.percent,38);
});
test('genuine aliases deduplicate and technical punctuation survives',()=>{
 const r=TX.measure('Postgres, K8s, C++, C#, .NET, Node.js',['PostgreSQL','Postgres','Kubernetes','K8s','C++','C#','.NET','Node.js']);
 assert.equal(r.percent,100);assert.equal(r.total,6);
});
test('negated tools never produce positive coverage but separate positive claims can',()=>{
 assert.equal(TX.measure('No experience with GitHub Actions. Built Git workflows.',['GitHub Actions']).percent,0);
 assert.equal(TX.measure('No Docker experience in the first role. Used Docker in the second.',['Docker']).percent,100);
});
test('empty drafts use a deduplicated valid denominator',()=>{
 const r=DS.calculateDynamicMatch('', ['SQL','sql','',null,42,'Python']);
 assert.equal(r.score,0);assert.equal(r.totalKeywords,2);assert.equal(r.missing.length,2);
});
test('meter arithmetic and totals reflect document matches, including the reported example',()=>{
 const terms=Array.from({length:18},(_,i)=>'requirement'+i);
 const r=DS.calculateDynamicMatch(terms.slice(0,10).join(', '),terms);
 assert.equal(r.score,56);assert.equal(r.matchCount,10);assert.equal(r.totalKeywords,18);
 assert.equal(r.matched.length+r.missing.length,18);
});

test('empty and populated drafts share the same alias denominator', () => {
  const terms = ['Postgres', 'PostgreSQL', 'SQL'];
  assert.equal(DS.calculateDynamicMatch('', terms).totalKeywords, 2);
  assert.equal(DS.calculateDynamicMatch('SQL', terms).totalKeywords, 2);
});

test('negative outcomes and not-only phrasing do not erase demonstrated tools', () => {
  for (const text of ['Deployed without downtime using Docker.', 'Used not only Docker but Kubernetes.', 'No prior experience with Java, but used Docker.']) {
    assert.equal(TX.measure(text, ['Docker']).percent, 100, text);
  }
});
