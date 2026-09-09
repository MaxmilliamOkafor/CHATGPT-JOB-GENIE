const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup({enabled=true,password=false,loadProfile=async()=>({}),fillContainer=async()=>({filled:1,alreadySet:0})}={}){
 let change,mutation,scheduled=null;
 const context={window:{ATSPlatforms:{detect:()=> 'workday'},AutofillCore:{labelFor:()=>'',loadProfile,fillContainer}},
 document:{documentElement:{},querySelectorAll:()=>[],querySelector:s=>s==='input[type="password"]'?(password?{}:null):{}},
 location:{hostname:'company.myworkdayjobs.com',href:'https://company.myworkdayjobs.com/apply',pathname:'/apply'},
 chrome:{storage:{onChanged:{addListener:fn=>{change=fn}},local:{get:(_keys,callback)=>callback({autofill_enabled:enabled})}}},
 MutationObserver:class{constructor(fn){mutation=fn}observe(){}disconnect(){}},
 setTimeout:fn=>{scheduled=fn;return 1},clearTimeout:()=>{scheduled=null}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../autofill-runner.js'),'utf8'),context);
 return {runner:context.window.JobGenieAutofill,toggle:value=>change({autofill_enabled:{newValue:value}},'local'),mutate:()=>mutation(),scheduled:()=>scheduled};
}
test('disabled engine performs no profile lookup or writes',async()=>{
 let calls=0;const s=setup({enabled:false,loadProfile:async()=>{calls++;return {}}});
 assert.equal((await s.runner.run()).reason,'autofill-disabled');assert.equal(calls,0);
});
test('turning off during profile loading prevents the fill',async()=>{
 let release,filled=0;const s=setup({loadProfile:()=>new Promise(r=>release=r),fillContainer:async()=>{filled++;return {filled:1}}});
 const running=s.runner.run();await Promise.resolve();s.toggle(false);release({});
 assert.equal((await running).success,false);assert.equal(filled,0);
});
test('concurrent manual calls share one fill operation',async()=>{
 let fills=0;const s=setup({fillContainer:async()=>{fills++;return {filled:1}}});
 await Promise.all([s.runner.run(),s.runner.run()]);assert.equal(fills,1);
});
test('password pages are not autofilled',async()=>{
 const s=setup({password:true});assert.equal((await s.runner.run()).reason,'no-application-form');
});
test('new controls appearing during a pass schedule another scan',async()=>{
 let release,started;const entered=new Promise(r=>started=r);
 const s=setup({fillContainer:()=>new Promise(r=>{release=r;started()})});
 const running=s.runner.run();await entered;
 s.mutate();release({filled:1});await running;assert.equal(typeof s.scheduled(),'function');
});
