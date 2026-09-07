const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const docx=require('../docx-generator.js');
function unpack(result) {
 assert.equal(result.success,true,result.error);
 const processResult=spawnSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON || 'python3',['-c',`
import sys,io,zipfile,json,xml.etree.ElementTree as E
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as z:
 assert z.testzip() is None
 for name in z.namelist(): E.fromstring(z.read(name))
 root=E.fromstring(z.read('word/document.xml'))
 ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
 print(json.dumps({'text':' '.join(n.text or '' for n in root.findall('.//w:t',ns)), 'tables':len(root.findall('.//w:tbl',ns)), 'textboxes':len(root.findall('.//w:txbxContent',ns))}))
`],{input:Buffer.from(result.base64,'base64'),encoding:'utf8'});
 assert.equal(processResult.status,0,processResult.stderr);
 return JSON.parse(processResult.stdout);
}
test('DOCX is valid OOXML with selectable Unicode and technical text',()=>{
 const result=unpack(docx.fromCvText('Alex Sample\nParis, France | candidate@example.invalid\n\nSUMMARY\nEngineer building accessible tools.\n\nEXPERIENCE\nSoftware Engineer | Sample Company | 2021 - 2024\nBuilt Python services with C++, C#, .NET and café data.\n\nEDUCATION\nBSc Computer Science\n\nSKILLS\nC++, C#, .NET, Python',{name:'Alex Sample'}));
 for(const term of ['Alex Sample','candidate@example.invalid','C++','C#','.NET','café','2021','2024']) assert.ok(result.text.includes(term),term);
 assert.equal(result.tables,0); assert.equal(result.textboxes,0);
});
test('long DOCX exports preserve the final content',()=>{
 const paragraphs=Array.from({length:60},(_,i)=>`Delivered project ${i} with reliable engineering and documented results.`);
 const result=unpack(docx.fromCvText('Alex Sample\n\nEXPERIENCE\n'+paragraphs.join('\n')));
 assert.ok(result.text.includes('Delivered project 59'));
});
