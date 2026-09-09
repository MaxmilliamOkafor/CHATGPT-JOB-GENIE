const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const attachments=require('../document-attachments.js');
const generator=require('../docx-generator.js');
function popupSetup(){
 const notices=[], elements={attachBoth:{disabled:false},previewContent:{textContent:'',classList:{toggle(){}}}};
 let copied;
 const context={window:{addEventListener(){},DynamicScore:require('../dynamic-score.js')},document:{addEventListener(){},getElementById:id=>elements[id]},
 console:{log(){},warn(){},error(){}},DocxGenerator:generator,navigator:{clipboard:{writeText:async text=>{copied=text;}}},
 chrome:{tabs:{query:async()=>[{id:77}]}},setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(require.resolve('../dynamic-score.js'),'utf8'),context);
 vm.runInNewContext(fs.readFileSync(require.resolve('../popup.js'),'utf8')+'\nthis.Popup=ATSTailor;',context);
 const popup=Object.create(context.Popup.prototype);popup.generatedDocuments={cv:'Alex Sample\nSUMMARY\nPython developer.',coverLetter:'Dear Hiring Manager,\nI build tools.'};
 popup.showToast=(...args)=>notices.push(args);
 return {popup,notices,elements,context,copied:()=>copied};
}
test('copy text view uses the CV; cover view uses the letter',async()=>{
 const s=popupSetup();s.popup.currentPreviewTab='text';
 await s.popup.copyCurrentContent();assert.equal(s.copied(),s.popup.generatedDocuments.cvExportText);
 s.popup.currentPreviewTab='cover';await s.popup.copyCurrentContent();assert.equal(s.copied(),s.popup.generatedDocuments.coverExportText);
});
test('preview displays exact normalised text including ampersands and URL',()=>{
 const s=popupSetup();s.popup.generatedDocuments.cv='Alex Sample\nSUMMARY\nR&D with C++\nhttps://example.invalid/a?x=1&y=2';
 s.popup.currentPreviewTab='text';s.popup.updatePreviewContent();
 assert.equal(s.elements.previewContent.textContent,s.popup.generatedDocuments.cvExportText);
});
test('attach both reports partial failure and uses one tab',async()=>{
 const s=popupSetup(), calls=[];
 s.popup.attachDocument=async(type,tab)=>{calls.push([type,tab]);return {success:type==='cover',message:'Existing CV removal failed'};};
 const result=await s.popup.attachBothDocuments();
 assert.equal(result.success,false);assert.deepEqual(calls,[['cv',77],['cover',77]]);
 assert.equal(s.notices.at(-1)[1],'error');assert.match(s.notices.at(-1)[0],/CV: Existing CV removal failed/);
 assert.equal(s.elements.attachBoth.disabled,false);
});
test('concurrent Attach Both clicks share a single operation',async()=>{
 const s=popupSetup();let count=0;
 s.popup.attachDocument=async()=>{count++;return {success:true};};
 const results=await Promise.all([s.popup.attachBothDocuments(),s.popup.attachBothDocuments()]);
 assert.equal(count,2);assert.ok(results.every(r=>r.success));
});
test('attachment always rebuilds after source text changes',async()=>{
 const s=popupSetup(), payloads=[];
 s.popup.attachInAnyFrame=async(id,message)=>{payloads.push(message);return {success:true};};
 await s.popup.attachDocument('cv',77);
 s.popup.generatedDocuments.cv='Alex Sample\nSUMMARY\nUpdated C# developer.';
 await s.popup.attachDocument('cv',77);
 assert.notEqual(payloads[0].docx,payloads[1].docx);
 assert.equal(payloads[1].text,s.popup.generatedDocuments.cvExportText);
 assert.equal(payloads[1].filename,s.popup.generatedDocuments.cvDocxFileName);
});
function fixture({accept='',reject=false,existing=true,replaceNode=false}={}){
 let removed=0,written=0;
 const file={name:'New_CV.docx',size:123,lastModified:12345,type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
 const button={textContent:'×',getAttribute(){return null;},click(){removed++;existing=false;if(replaceNode) input={...input,files:[]};}};
 const scope={tagName:'DIV',className:'upload',textContent:'',parentElement:{tagName:'FORM'},querySelectorAll(selector){return selector==='input[type="file"]'?[input]:existing?[button]:[];},querySelector(selector){if(selector==='label')return {};if(reject&&written&&selector.includes('alert'))return {textContent:'Upload rejected'};return null;}};
 let input={accept,files:existing?[{name:'Old_CV.pdf'}]:[],dataset:{},parentElement:scope,getAttribute(){return null;},dispatchEvent(){written++;}};
 const doc={querySelectorAll:()=>[input],defaultView:{Event:class{constructor(type){this.type=type;}},DataTransfer:class{constructor(){this.files=[];this.items={add:f=>this.files.push(f)};}}}};
 return {file,doc,input:()=>input,removed:()=>removed,written:()=>written};
}
test('replaces an old CV through its scoped X and reacquires the input',async()=>{
 const f=fixture({replaceNode:true});const r=await attachments.replace({...f,matches:()=>true,timeout:250});
 assert.equal(r.success,true);assert.equal(f.removed(),1);assert.equal(f.input().files[0],f.file);
});
test('unsupported format leaves existing attachment intact',async()=>{
 const f=fixture({accept:'.pdf'});const r=await attachments.replace({...f,matches:()=>true});
 assert.equal(r.success,false);assert.equal(f.removed(),0);assert.equal(f.written(),0);
});
test('site rejection does not count as an attached file',async()=>{
 const f=fixture({reject:true,existing:false});const r=await attachments.replace({...f,matches:()=>true,timeout:250});
 assert.equal(r.success,false);assert.match(r.message,/rejected/);
});
test('a missing cover upload does not count as success',async()=>{
 const f=fixture();const r=await attachments.replace({...f,matches:()=>false});
 assert.equal(r.success,false);assert.equal(r.skipped,true);assert.equal(f.removed(),0);
});
test('same filename alone cannot establish the same file revision',()=>{
 assert.equal(attachments.sameFile({name:'CV.docx',size:5,lastModified:1},{name:'CV.docx',size:5,lastModified:2}),false);
});

test('DOCX download and attachment use identical bytes and filenames',async()=>{
 const s=popupSetup();let blob,anchor,attached;
 s.context.atob=value=>Buffer.from(value,'base64').toString('binary');s.context.Blob=Blob;
 s.context.URL={createObjectURL:value=>{blob=value;return 'blob:test';},revokeObjectURL(){}};
 s.context.document.createElement=()=>anchor={click(){}};
 s.context.document.body={appendChild(){},removeChild(){}};
 s.popup.attachInAnyFrame=async(id,message)=>{attached=message;return {success:true};};
 s.popup.downloadDocxVersion('cv');
 const downloaded=Buffer.from(await blob.arrayBuffer());const name=anchor.download;
 await s.popup.attachDocument('cv',77);
 assert.equal(downloaded.toString('base64'),attached.docx);assert.equal(name,attached.filename);
});
test('text download uses the currently reviewed cover letter',async()=>{
 const s=popupSetup();let blob,anchor;
 s.context.Blob=Blob;s.context.URL={createObjectURL:value=>{blob=value;return 'blob:test';},revokeObjectURL(){}};
 s.context.document.createElement=()=>anchor={click(){}};s.context.document.body={appendChild(){},removeChild(){}};
 s.popup.downloadTextVersion('cover');
 assert.equal(await blob.text(),s.popup.generatedDocuments.coverExportText);assert.equal(anchor.download,'Cover_Letter.txt');
});

test('contact formatting takes phone digits only from the saved profile',()=>{
 const s=popupSetup();s.popup._cachedProfile={phone:'+353 874 261 508'};
 s.popup.generatedDocuments.cv='Alex Sample\nDublin, Dublin, IE, Ireland | Ireland | +353 08 742 61508 | candidate@example.invalid\nSUMMARY\nEngineer';
 s.popup.prepareDocumentText();
 assert.match(s.popup.generatedDocuments.cv,/Dublin, Ireland \| \+353 874 261 508/);
});

test('legacy PDF payloads cannot create attachment files; DOCX names are corrected',()=>{
 const source=fs.readFileSync(require.resolve('../content.js'),'utf8');
 const start=source.indexOf('  function createPDFFile('),end=source.indexOf('  // ============ LOCATION SANITIZATION',start);
 const ctx={atob:s=>Buffer.from(s,'base64').toString('binary'),File:class{constructor(parts,name,opts){this.name=name;this.type=opts.type;}},console:{log(){},error(){}}};
 vm.runInNewContext(source.slice(start,end)+'\nthis.factory={createPDFFile,createDocxFile};',ctx);
 assert.equal(ctx.factory.createPDFFile(Buffer.from('%PDF-old').toString('base64'),'Old.pdf'),null);
 assert.equal(ctx.factory.createDocxFile(Buffer.from('%PDF-old').toString('base64'),'Old.docx'),null);
 const result=ctx.factory.createDocxFile(generator.fromCvText('Alex Sample\nSUMMARY\nEngineer.').base64,'CV.pdf');
 assert.equal(result.name,'CV.docx');assert.match(result.type,/wordprocessingml/);
});
test('labelled existing CV can be replaced when the employer hides the input',async()=>{
 const f=fixture({replaceNode:true});
 const query=f.doc.querySelectorAll;
 const group={getAttribute:name=>name==='aria-label'?'Resume/CV*':null,textContent:'Old_CV.pdf Accepted docx pdf',querySelector:()=>null,
 querySelectorAll:()=>[{textContent:'×',getAttribute:()=>null,click(){f.input().parentElement.querySelectorAll('button')[0].click();}}]};
 f.doc.querySelectorAll=selector=>selector.includes('fieldset')?[group]:f.removed()?query(selector):[];
 const result=await attachments.replace({...f,kind:'cv',matches:()=>true,timeout:250});
 assert.equal(result.success,true);assert.equal(f.removed(),1);assert.equal(f.input().files[0].name,'New_CV.docx');
});

function backgroundAttachmentSetup({cv=true,cover=true,throwCv=false}={}) {
 const source=fs.readFileSync(require.resolve('../content.js'),'utf8');
 const start=source.indexOf('  async function attachPreparedDocuments()'),end=source.indexOf('  function loadFilesAndStart()',start);
 const calls=[];
 const ctx={cvFile:cv?{name:'CV.docx'}:null,coverFile:cover?{name:'Letter.docx'}:null,isCVField(){},isCoverField(){},stopAttachLoops(){},document:{},
 alternativeFiles:()=>[],cvPlainText:'',coverLetterText:'',
 window:{JobGenieAttachments:{async replace({kind}){calls.push(kind);if(kind==='cv'&&throwCv)throw Error('Upload rejected');return {success:true};}}}};
 vm.runInNewContext(source.slice(start,end)+'\nthis.attach=attachPreparedDocuments;',ctx);
 return {ctx,calls};
}
test('background attachment does not report both files attached when cover is missing',async()=>{
 const {ctx,calls}=backgroundAttachmentSetup({cover:false});const result=await ctx.attach();
 assert.equal(result.success,false);assert.equal(result.cv.success,true);assert.equal(result.cover.success,false);
 assert.deepEqual(calls,['cv']);assert.match(result.message,/Cover letter: No current DOCX/);
 assert.equal(ctx.window.__JG_FILE_ATTACH_AUTHORISED__,false);
});
test('background attachment still tries the cover after a CV upload throws',async()=>{
 const {ctx,calls}=backgroundAttachmentSetup({throwCv:true});const result=await ctx.attach();
 assert.equal(result.success,false);assert.equal(result.cover.success,true);assert.deepEqual(calls,['cv','cover']);
 assert.match(result.message,/Upload rejected/);assert.equal(ctx.window.__JG_FILE_ATTACH_AUTHORISED__,false);
});
test('background attachment confirms success only after both operations succeed',async()=>{
 const {ctx}=backgroundAttachmentSetup();const result=await ctx.attach();assert.equal(result.success,true);
 assert.equal(result.message,'CV: attached. Cover letter: attached');
});

test('tailoring recovers omitted relevant saved skills in the existing skills section',()=>{
 const {popup}=popupSetup();
 const cv='Alex Sample\nSUMMARY\nAnalyst\nTECHNICAL SKILLS\nSQL\nEDUCATION\nBSc';
 const improved=popup.recoverOmittedProfileSkills(cv,{all:['SQL','Power BI','Tableau']},{skills:['SQL','Power BI','Unrelated tool']});
 assert.match(improved,/TECHNICAL SKILLS\nSQL, Power BI/);assert.ok(!improved.includes('Additional skills:'));assert.ok(!improved.includes('Tableau'));assert.ok(!improved.includes('Unrelated tool'));
 assert.ok(improved.endsWith('EDUCATION\nBSc'));assert.equal(popup.calculateMatchScore(improved,{all:['SQL','Power BI','Tableau']}).matchScore,67);
});
test('job keywords and strategy alone never authorize missing qualifications',()=>{
 const {popup}=popupSetup();const cv='Alex Sample\nSKILLS\nSQL';
 assert.equal(popup.recoverOmittedProfileSkills(cv,{all:['SQL','Python']},{skills:['not Python'],ats_strategy:'Add Python'}),cv);
});

test('keyword evidence includes saved role bullets and projects, never the strategy or job',()=>{
 const {popup}=popupSetup();
 const plan=popup.buildKeywordEvidencePlan({all:['forecasting','Attio','Python']},{professional_experience:[{bullets:['Built forecasting reports.']}],relevant_projects:[{technologies:['Python']}],ats_strategy:'Claim Attio expertise'});
 assert.equal(plan[0].evidence[0].text,'Built forecasting reports.');assert.match(plan[0].evidence[0].source,/professional_experience/);
 assert.equal(plan[1].evidence.length,0);assert.equal(plan[2].evidence[0].text,'Python');
});

 test('local recovery never appends a keyword dump or guesses a skill category',()=>{
 const {popup}=popupSetup();const cv='Alex Sample\nTECHNICAL SKILLS\nLanguages: SQL\nEDUCATION\nBSc';
 assert.equal(popup.recoverOmittedProfileSkills(cv,{all:['SQL','Power BI']},{skills:['SQL','Power BI']}),cv);
 });
