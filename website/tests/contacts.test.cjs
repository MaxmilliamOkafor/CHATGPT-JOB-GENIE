// Reserved .invalid domains and fictional names; no real recipient data.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const extractor=require('../jd-contact-extractor.js');
const enrichment=require('../contact-enrichment.js');
test('rejects accommodation inbox even when it is the only published email',()=>{
 assert.equal(extractor.extract({jdText:'For accommodations email accommodations@acme.invalid'}).email,'');
});
test('selects the hiring contact with local evidence',()=>{
 const r=extractor.extract({jdText:'For technical support: help@acme.invalid\nRecruiter: Alex Sample, alex.sample@acme.invalid\nCareers: careers@acme.invalid'});
 assert.equal(r.email,'alex.sample@acme.invalid'); assert.equal(r.contactName,'Alex Sample'); assert.equal(r.requiresReview,true);
});
test('does not pair unrelated names with a recruiting inbox',()=>{
 const r=extractor.extract({jdText:'Contact Morgan Example about our media program.\nApplications: careers@acme.invalid'});
 assert.equal(r.email,'careers@acme.invalid'); assert.equal(r.contactName,'');
});
test('excludes own email and rejects irrelevant named addresses',()=>{
 assert.equal(extractor.extract({jdText:'Recruiter: Alex Sample, alex.sample@acme.invalid',ownEmail:'alex.sample@acme.invalid'}).email,'');
 assert.equal(extractor.extract({jdText:'Our founder alex.sample@acme.invalid'}).email,'');
});
test('published mailto context rejects technical assistance',()=>{
 assert.equal(extractor.extract({pageSources:{emails:[{email:'candidatefeedback-applications@acme.invalid',source:'mailto',context:'Technical issues with this site'}]}}).email,'');
});
test('Apollo retains IDs and uses documented enrichment with personal data disabled',()=>{
 const provider=enrichment.PROVIDERS.apollo;
 const people=provider.parse({people:[{id:'fixture-id',first_name:'Alex',title:'Technical Recruiter',organization:{name:'Acme'}}]});
 assert.equal(people[0].id,'fixture-id'); assert.equal(people[0].email,'');
 const req=provider.lookupById('fixture-id',{apiKey:'fixture-key'});
 assert.equal(req.url,'https://api.apollo.io/api/v1/people/match');
 assert.deepEqual(JSON.parse(req.init.body),{id:'fixture-id',reveal_personal_emails:false,reveal_phone_number:false});
 assert.equal(provider.parsePerson({person:{id:'fixture-id',email:'alex@acme.invalid',email_status:'verified'}})[0].verified,true);
});
