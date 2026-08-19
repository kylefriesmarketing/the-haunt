/* smoke.mjs — loads the-haunt.html in headless Chromium, drives a real night start, screenshots, checks console. */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto('file://' + join(here, 'the-haunt.html'));
await page.waitForTimeout(1600);
await page.screenshot({ path: 'shot-1-title.png' });

// clear any old save, start fresh
await page.evaluate(() => localStorage.clear());
await page.reload(); await page.waitForTimeout(1200);
await page.click('#btnNew'); await page.waitForTimeout(400);
await page.click('#btnGo'); await page.waitForTimeout(400);
await page.screenshot({ path: 'shot-2-season.png' });
await page.click('#btnBuild'); await page.waitForTimeout(400);
await page.screenshot({ path: 'shot-3-build.png' });

// buy a couple of stations via the page's own logic
await page.evaluate(() => {
  const H = window.HAUNT; const s = H.Game.S;
  s.cash = 3000;
  s.build.slots.s_clown_a = { type: 'airCannon', tier: 2 };
  s.build.slots.s_clown_b = { type: 'flashCam', tier: 1 };
  s.build.slots.s_cel_a = { type: 'dropPanel', tier: 1 };
  s.build.slots.s_last_a = { type: 'soundSting', tier: 1 };
  s.crewAssign = { n_dinner: 'priya', n_last: 'bo', n_surgery: 'grace' };
});
await page.click('#btnToCast'); await page.waitForTimeout(400);
await page.screenshot({ path: 'shot-4-castcall.png' });
await page.click('#btnDoors'); await page.waitForTimeout(2500);
await page.screenshot({ path: 'shot-5-night-backstage.png' });

// walk east down the spine toward the corn peek, then fire a body scare when the sim says a group is close
await page.evaluate(() => { const P = window.HAUNT.Player; P.x = 17.2; P.z = 14.2; P.yaw = Math.PI; });
await page.waitForTimeout(400);
// wait until a group approaches n_corn, then trigger the station via keyboard path
await page.evaluate(async () => {
  const H = window.HAUNT;
  await new Promise(res => {
    const iv = setInterval(() => {
      const N = H.Game.night; if (!N) return;
      const n = N.nodeById.n_corn;
      for (const grp of N.groups) {
        if (grp.mergedInto) continue;
        let lead = null;
        for (const gg of grp.guests) if (!gg.out) lead = lead === null ? gg.s : Math.max(lead, gg.s);
        if (lead !== null && Math.abs(lead - n.s) < 0.6) { clearInterval(iv); res(); return; }
      }
    }, 60);
    setTimeout(() => { clearInterval(iv); res(); }, 30000);
  });
});
await page.evaluate(() => { const H = window.HAUNT; H.Player.x = 18; H.Player.z = 13.2; });
await page.keyboard.press('KeyE');
await page.waitForTimeout(600);
await page.screenshot({ path: 'shot-6-scare.png' });
const stats = await page.evaluate(() => {
  const N = window.HAUNT.Game.night;
  return N ? { t: N.t.toFixed(1), spawned: N.spawned, tally: N.tally, drawer: N.drawer, stations: Object.keys(N.stations).length } : null;
});
console.log('NIGHT STATE:', JSON.stringify(stats));

// let the night run at speed to reach the sting
await page.evaluate(() => { const G = window.HAUNT.Game; const N = G.night; const iv = setInterval(() => { if (!G.night || G.night.done) { clearInterval(iv); return; } for (let i = 0; i < 240; i++) G.night.tick(1 / 30); G.night.events.length = 0; }, 30); });
await page.waitForTimeout(6000);
await page.screenshot({ path: 'shot-7-sting.png' });
const state = await page.evaluate(() => window.HAUNT.Game.state);
console.log('STATE AFTER FASTFORWARD:', state);

// endings screen renders?
await page.evaluate(() => { window.HAUNT.Game.S.nightIdx = 99; });
await page.click('#btnOnward').catch(() => {});
await page.waitForTimeout(600);
await page.screenshot({ path: 'shot-8-endings.png' });
const endState = await page.evaluate(() => window.HAUNT.Game.state);
console.log('ENDINGS STATE:', endState);

console.log('CONSOLE ERRORS:', errors.length ? errors.slice(0, 12) : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
