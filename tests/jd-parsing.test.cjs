const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx={window:{},console:{log(){},warn(){}}};
vm.runInNewContext(fs.readFileSync(require.resolve('../universal-jd-parser.js'),'utf8'),ctx);
const parser=ctx.window.UniversalJDParser;
test('top Apply now button never truncates the following requirements',()=>{
 const result=parser.processAnyJobDescription('Apply now\nSummary\nBuild data platforms.\nRequirements\nPython and SQL.');
 assert.match(result.text,/Python and SQL/);assert.ok(!result.text.includes('Apply now'));
});
test('form disability and veteran terms never become job requirements',()=>{
 const result=parser.processAnyJobDescription('Summary\nBuild platforms.\nMinimum Qualifications\nSalesforce certification required.\nApply for this job\nFirst Name\nVoluntary Self-Identification\nDisability\nVeteran');
 assert.match(result.text,/Salesforce certification required/);assert.ok(!result.text.includes('Disability'));
});
test('benefits and employer sections do not swallow later preferred requirements',()=>{
 const result=parser.processAnyJobDescription('Who We Are\nA leading company\nSummary\nBuild products.\nBenefits\nHealth insurance\nPreferred Qualifications\nC++, C#, .NET and CI/CD');
 assert.match(result.text,/C\+\+, C#, .NET and CI\/CD/);assert.ok(!result.text.includes('Health insurance'));
});
test('cache keys distinguish equal-length changes in the middle of a posting',()=>{
 const prefix='A'.repeat(600),suffix='Z'.repeat(600);
 assert.notEqual(parser.getCacheKey(prefix+'Python'+suffix),parser.getCacheKey(prefix+'Golang'+suffix));
});
test('narrative and non-English requirements are retained without known headings',()=>{
 for(const text of ['We need a nurse who can assess patients and maintain clinical records.','Kenntnisse in Python und SQL erforderlich.','Experience building application forms and working with privacy requirements.']) assert.equal(parser.processAnyJobDescription(text).text,text);
});
