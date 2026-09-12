/** Free public-source recruiting contact discovery. No guessed mailboxes or broker calls. */
(function (global) {
  'use strict';
  const ATS = /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|workday\.com|smartrecruiters\.com|icims\.com|taleo\.net|jobvite\.com|bamboohr\.com|workable\.com|recruitee\.com|teamtailor\.com|personio\.(com|de)|linkedin\.com|indeed\.com|glassdoor\.com|jobright\.ai)$/i;
  const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi;
  const RECRUITING = /\b(recruit(?:er|ing|ment)|talent acquisition|hiring|careers|job applications)\b/i;
  const BLOCKED = /(?:noreply|no-reply|privacy|legal|accommodat|disabilit|accessib|support|security|press|media|sales|billing|unsubscribe|dpo|gdpr)/i;
  const PATHS = ['/careers', '/jobs', '/careers/contact', '/contact', '/about/careers', '/company/careers'];
  const decode = s => String(s || '').replace(/&amp;/gi, '&').replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => { const v = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1),16) : Number(n); return v <= 0x10ffff ? String.fromCodePoint(v) : ''; });
  const plain = s => decode(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  function publicUrl(raw, base) {
    try {
      const u = new URL(decode(raw), base);
      const h = u.hostname.toLowerCase();
      if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || !h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':') || /\.(local|localhost|internal|test|invalid)$/.test(h)) return null;
      u.hash = ''; return u;
    } catch (_) { return null; }
  }
  const sameDomain = (host, domain) => host === domain || host.endsWith('.' + domain);
  function _score(email) {
    const local = String(email).split('@')[0];
    if (BLOCKED.test(local)) return -1;
    return /^(recruiting|recruitment|talent|talentacquisition|careers?|jobs?|hiring|apply|applications|hr|people|resumes?|cv)([._-][a-z]{1,20})?$/i.test(local) ? 100 : -1;
  }
  // Retained for callers: only a supplied first-party URL is a domain source.
  function guessDomains(companyName, jdUrl) {
    const u = publicUrl(jdUrl);
    return u && !ATS.test(u.hostname) ? [u.hostname.replace(/^(www|jobs|careers|apply)\./i, '')] : [];
  }
  async function fetchPage(url) {
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      // Do not follow an unvalidated redirect into a different origin or local service.
      const r = await fetch(url, {signal: ctrl.signal, credentials:'omit', redirect:'error', cache:'no-store'});
      if (!r.ok || !/text\/html|application\/xhtml/i.test(r.headers.get('content-type') || '')) return '';
      return (await r.text()).slice(0,400000);
    } catch (_) { return ''; } finally { clearTimeout(timer); }
  }
  function employerUrls(html) {
    const urls = [];
    const walk = node => {
      if (!node || typeof node !== 'object') return;
      if ([].concat(node['@type'] || []).includes('JobPosting')) {
        const org = node.hiringOrganization;
        if (org && typeof org === 'object') for (const raw of [org.url, ...[].concat(org.sameAs || [])]) {
          const u = publicUrl(raw);
          if (u && !ATS.test(u.hostname)) urls.push(u.href);
        }
      }
      Object.values(node).forEach(v => { if (v && typeof v === 'object') walk(v); });
    };
    for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try { walk(JSON.parse(m[1])); } catch (_) {}
    }
    return [...new Set(urls)];
  }
  function harvest(html, domain, source) {
    const clean = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    const contacts = new Map();
    function add(raw, context, kind) {
      let email; try { email = decodeURIComponent(decode(raw)).replace(/^mailto:/i,'').split('?')[0].trim().toLowerCase(); } catch (_) { return; }
      if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/i.test(email)) return;
      if (!sameDomain(email.split('@')[1], domain) || BLOCKED.test(email.split('@')[0]) || BLOCKED.test(context)) return;
      const generic = _score(email) > 0;
      if (!generic && (kind !== 'mailto' || !RECRUITING.test(context))) return;
      contacts.set(email, {email, source, context:context.slice(0,240), contactType:generic ? 'recruiting-inbox' : 'published-recruiting-contact', score:generic ? 100 : 90, verification:'published-source', checkedAt:new Date().toISOString(), mailboxVerified:false, requiresReview:true});
    }
    for (const m of clean.matchAll(/<a\b[^>]*href\s*=\s*["']mailto:([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const start = Math.max(clean.lastIndexOf('<p',m.index),clean.lastIndexOf('<li',m.index),clean.lastIndexOf('<div',m.index));
      const nearby = clean.slice(Math.max(start, m.index - 160),m.index + m[0].length);
      add(m[1], plain(nearby), 'mailto');
    }
    for (const m of clean.matchAll(EMAIL)) add(m[0],plain(clean.slice(Math.max(0,m.index-100),m.index+m[0].length+100)), 'text');
    return [...contacts.values()];
  }
  async function find({companyName, jdUrl, orgUrl, maxPages = 8} = {}) {
    const limit = Math.min(12,Math.max(1,Number(maxPages)||8));
    const tried = [], found = new Map(); let seeds = [];
    const supplied = publicUrl(orgUrl);
    if (supplied && !ATS.test(supplied.hostname)) seeds.push(supplied.href);
    const jd = publicUrl(jdUrl);
    if (!seeds.length && jd) {
      if (!ATS.test(jd.hostname)) seeds.push(jd.origin);
      else { tried.push(jd.href); seeds = employerUrls(await fetchPage(jd.href)); }
    }
    const queues = seeds.slice(0,3).map(raw => {
      const u = publicUrl(raw); const domain = u.hostname.replace(/^(www|jobs|careers|apply)\./i,'');
      return {domain, urls:[u.href,...PATHS.map(p=>u.origin+p)]};
    });
    const visited = new Set(tried);
    // Round-robin keeps one unavailable website from consuming every request.
    while (tried.length < limit && queues.some(q=>q.urls.length)) {
      for (const q of queues) {
        if (tried.length >= limit || !q.urls.length) continue;
        const url = q.urls.shift(); if (visited.has(url)) continue;
        visited.add(url); tried.push(url);
        const html = await fetchPage(url); if (!html) continue;
        for (const c of harvest(html,q.domain,url)) if (!found.has(c.email)) found.set(c.email,c);
        for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
          if (!/careers?|recruit|talent|hiring|contact|our team/i.test(plain(m[2]))) continue;
          const next = publicUrl(m[1],url);
          if (next && sameDomain(next.hostname,q.domain) && !visited.has(next.href) && !q.urls.includes(next.href)) q.urls.unshift(next.href);
        }
      }
      if (found.size) break;
    }
    const contacts=[...found.values()].sort((a,b)=>b.score-a.score).slice(0,5);
    return {email:contacts[0]?.email || '', source:contacts[0]?.source || '', candidates:contacts.map(c=>c.email), contacts, domainsTried:tried, status:contacts.length?'published-contact-found':seeds.length?'no-published-contact':'employer-domain-unconfirmed'};
  }
  const api={find,guessDomains,_score,employerUrls,harvest,publicUrl};
  global.CareersAddressFinder=api;
  if(typeof module!=='undefined' && module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
