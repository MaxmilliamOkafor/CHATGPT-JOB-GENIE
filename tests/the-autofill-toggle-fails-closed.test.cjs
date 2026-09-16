// "IT RANDOMLY AUTOFILLS" WAS NOT RANDOM. IT WAS A RACE.
//
// The third-party engine's kill switch read
//
//     window.__JG_AUTOFILL_DISABLED__ === true
//
// so an UNSET flag meant "allowed". The flag was written by
// autofill-controller.js after an ASYNC storage read, and the vendor
// bundle was registered at document_idle. On every page load there was
// a window in which the flag was undefined and all 220+ vendor value
// writes were permitted -- whatever the toggle said, on whatever page
// happened to be open. That is how a GitHub settings page came to be
// filled in with cover letter text.
//
// THE ENGINE THAT NEEDED THE GATE IS GONE.
//
// The gate script existed to restrain code nobody here wrote. This
// build injects its own filler instead -- ats-platforms, autofill-core,
// application-validator, autofill-runner -- which does nothing until it
// is called, so there is no unrestrained writer to race with. This file
// no longer asserts that the gate fails closed; it asserts that the
// thing the gate was holding back is not shipped at all, and that every
// remaining path still checks the toggle and the host before it acts.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const ctl = read('autofill-controller.js');
const wd = read('workday-handlers.js');
const bg = read('background.js');
const manifest = JSON.parse(read('manifest.json'));

console.log('1. THE VENDOR ENGINE IS NOT SHIPPED');
{
  t('  no autofill-engine directory',
    !fs.existsSync(path.join(DIR, 'autofill-engine')),
    'the unrestrained writer is back, and it needs its gate back with it');
  const injected = /const AUTOFILL_VENDOR_FILES = \[([^\]]*)\]/.exec(bg);
  t('  the service worker injects a file list at all', !!injected, 'no injection list found');
  t('  ...and every file in it is ours',
    !!injected && !/autofill-engine|ua-enhancement|filler\.js|contents\.js/.test(injected[1]),
    injected && injected[1]);
  t('  ...and each one exists',
    !!injected && injected[1].split(',').map((s) => s.trim().replace(/['"]/g, ''))
      .filter(Boolean).every((f) => fs.existsSync(path.join(DIR, f))),
    injected && injected[1]);
  const packaged = JSON.stringify(manifest);
  t('  the manifest does not package it either',
    !/autofill-engine/.test(packaged), 'the manifest still ships the vendor bundle');
}

console.log('\n2. NOTHING FILLS A FIELD UNTIL THE TOGGLE SAYS SO');
{
  t('  the controller mirrors one named preference',
    /const STORAGE_KEY = 'autofill_enabled'/.test(ctl), 'no single source for the switch');
  t('  the service worker re-reads the toggle before injecting',
    /chrome\.storage\.local\.get\(\['autofill_enabled'\]/.test(bg)
      && /autofill_enabled !== true/.test(bg),
    'a stale message could arm a page the user switched off');
  t('  ...and an unset preference means OFF',
    /autofill_enabled === true/.test(bg) || /autofill_enabled !== true/.test(bg),
    'undefined would read as enabled');
  t('  Workday re-reads the stored toggle rather than trusting a snapshot',
    /autofill_enabled/.test(wd), 'a snapshot that defaulted to enabled is how this started');
}

console.log('\n3. AND NEVER ON A PAGE THAT IS NOT AN APPLICATION');
{
  // Kept in two places on purpose -- the service worker decides whether
  // to inject, the controller decides whether to act once injected --
  // and pinned identical, because the first version of this drifted.
  const listOf = (src, name) => {
    const m = new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\];').exec(src);
    return m ? m[1].match(/'[^']+'/g).map((s) => s.replace(/'/g, '')).sort() : null;
  };
  const a = listOf(bg, 'AUTOFILL_DENYLIST_HOSTS');
  const b = listOf(ctl, 'DENYLIST_HOSTS');
  t('  both halves carry a denylist', !!a && !!b, JSON.stringify([!!a, !!b]));
  t('  ...and they are identical', !!a && !!b && a.join(',') === b.join(','),
    'they have drifted: ' + JSON.stringify({ background: a, controller: b }));
  for (const host of ['github.com', 'gitlab.com', 'stackoverflow.com']) {
    t('  ' + host + ' is never autofilled', !!a && a.indexOf(host) !== -1, 'missing from the denylist');
  }
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
