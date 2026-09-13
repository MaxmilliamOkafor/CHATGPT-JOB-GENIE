const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.join(__dirname,'..','careers-address-finder.js');
const mod=new Module(file,module); mod.filename=file;
mod._compile(fs.readFileSync(file,'utf8'),file);
const F=mod.exports;
const response=html=>({ok:true,headers:{get:()=> 'text/html'},text:async()=>html});
test('ATS slugs and company names never become guessed domains',()=>{
 assert.deepEqual(F.guessDomains('Acme','https://job-boards.greenhouse.io/acme/jobs/1'),[]);
 assert.deepEqual(F.guessDomains('Acme',''),[]);
});
test('host boundaries and co.uk remain exact',()=>{
 const html='careers@other.co.uk careers@evilacme.co.uk careers@acme.co.uk';
 assert.deepEqual(F.harvest(html,'acme.co.uk','https://acme.co.uk/careers').map(x=>x.email),['careers@acme.co.uk']);
});
test('recruiting mailto keeps evidence; unrelated personal addresses are excluded',()=>{
 const hits=F.harvest('<p>Recruiter Jane: <a href="mailto:jane%40acme.com">Contact Jane</a></p><p>CEO <a href="mailto:boss@acme.com">Boss</a></p>','acme.com','https://acme.com/team');
 assert.equal(hits.length,1);assert.equal(hits[0].email,'jane@acme.com');assert.equal(hits[0].requiresReview,true);
 assert.equal(hits[0].source,'https://acme.com/team');
});
test('accommodation-only recruiting inbox is not a follow-up target',()=>{
 assert.equal(F.harvest('<p>For disability accommodations contact careers@acme.com</p>','acme.com','https://acme.com').length,0);
});
// ORDINARY CAREERS-PAGE PROSE IS NOT A VETO.
//
// The mailbox blocklist was being tested against the 240 characters
// around the address as well as against the mailbox name, and it carries
// words like support, media, sales and press. Those are furniture on a
// careers page, so "We support flexible working. Email careers@acme.com"
// threw away the exact address this file exists to find.
//
// A mailbox called careers@ states its own purpose. Only prose that
// establishes a DIFFERENT purpose -- an adjustments or accessibility
// inbox -- may overrule it, and the full blocklist still applies to the
// mailbox name itself.
test('page furniture near the address does not discard it',()=>{
 for(const html of [
  '<p>We support flexible working. Email <a href="mailto:careers@acme.com">careers@acme.com</a>.</p>',
  '<p>For media enquiries see below. Careers: <a href="mailto:careers@acme.com">careers@acme.com</a></p>',
  '<p>Our sales and billing teams sit here too. Apply: <a href="mailto:talent@acme.com">talent@acme.com</a></p>',
 ]) assert.equal(F.harvest(html,'acme.com','https://acme.com/careers').length,1,html);
});
test('a purpose-built adjustments inbox is still refused, however it is spelled',()=>{
 assert.equal(F.harvest('<p>To request a disability adjustment email <a href="mailto:careers-adjust@acme.com">careers-adjust@acme.com</a></p>','acme.com','https://acme.com').length,0);
 assert.equal(F.harvest('<p>Accommodations: <a href="mailto:accommodations@acme.com">accommodations@acme.com</a></p>','acme.com','https://acme.com').length,0);
});
test('unsafe URL schemes and local destinations are rejected',()=>{
 for(const url of ['http://acme.com','https://127.0.0.1','https://[::1]','https://server.local','https://user:pass@acme.com','https://acme.com:8080']) assert.equal(F.publicUrl(url),null,url);
});
test('ATS structured employer URL drives no-key discovery',async()=>{
 const old=global.fetch;const calls=[];
 global.fetch=async(url,opts)=>{calls.push(url);assert.equal(opts.credentials,'omit');assert.equal(opts.redirect,'error');
 return response(url.includes('greenhouse')?'<script type="application/ld+json">{"@type":"JobPosting","hiringOrganization":{"url":"https://acme.co.uk"}}</script>':'<p>Careers: <a href="mailto:careers@acme.co.uk">Email recruiting</a></p>');};
 try{const result=await F.find({jdUrl:'https://job-boards.greenhouse.io/wrongslug/jobs/1'});assert.equal(result.email,'careers@acme.co.uk');assert.equal(calls.some(x=>x.includes('wrongslug.com')),false);}finally{global.fetch=old;}
});
test('website candidates share the request budget',async()=>{
 const old=global.fetch; const calls=[];
 global.fetch=async url=>{calls.push(url);return response(url.includes('greenhouse')?'<script type="application/ld+json">{"@type":"JobPosting","hiringOrganization":{"url":"https://acme.com","sameAs":"https://acme.co.uk"}}</script>':url.includes('acme.co.uk')?'careers@acme.co.uk':'');};
 try{const r=await F.find({jdUrl:'https://job-boards.greenhouse.io/acme/jobs/1',maxPages:4});assert.equal(r.email,'careers@acme.co.uk');assert.ok(calls.length<=4);}finally{global.fetch=old;}
});
test('follows actual careers links rather than fixed paths only',async()=>{
 const old=global.fetch;
 global.fetch=async url=>response(url==='https://acme.com/'?'<a href="/work-with-us">Careers</a>':url.endsWith('/work-with-us')?'recruiting@acme.com':'');
 try{const r=await F.find({jdUrl:'https://acme.com/jobs/1',maxPages:3});assert.equal(r.email,'recruiting@acme.com');assert.ok(r.source.endsWith('/work-with-us'));}finally{global.fetch=old;}
});
test('missing published employer domain returns a useful status, not a guess',async()=>{
 const old=global.fetch; global.fetch=async()=>response('No contact published');
 try{const r=await F.find({companyName:'Acme',jdUrl:'https://job-boards.greenhouse.io/acme/jobs/1'});assert.equal(r.email,'');assert.equal(r.status,'employer-domain-unconfirmed');}finally{global.fetch=old;}
});

test('each lookup refetches and never returns a removed cached address',async()=>{
 const old=global.fetch;let published=true;
 global.fetch=async(url,opts)=>{assert.equal(opts.cache,'no-store');return response(published?'careers@acme.com':'Contact form only');};
 try{
  const first=await F.find({jdUrl:'https://acme.com/jobs/1',maxPages:1});
  assert.ok(Number.isFinite(Date.parse(first.contacts[0].checkedAt)));
  assert.equal(first.contacts[0].mailboxVerified,false);
  published=false;
  const second=await F.find({jdUrl:'https://acme.com/jobs/1',maxPages:1});
  assert.equal(second.email,'');
 }finally{global.fetch=old;}
});

test('employer careers subdomain accepts its parent company mailbox',async()=>{
 const old=global.fetch;global.fetch=async()=>response('careers@acme.co.uk');
 try{const r=await F.find({jdUrl:'https://careers.acme.co.uk/jobs/1',maxPages:1});assert.equal(r.email,'careers@acme.co.uk');}finally{global.fetch=old;}
});
