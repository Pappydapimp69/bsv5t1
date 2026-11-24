// The first climb, played through the keyboard: climb, see dusk coming, be put down at nightfall with the loss named,
// wait out the night, and climb again at dawn. Only the clock and the starting spot are moved; every action is a key.
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

async function main() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 800}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.getByText('Play as a human').click();
    const view = () => page.evaluate(() => ({ t: Math.round(S.t),
      mode: S.you.mode, ft: S.you.cl ? Math.round(S.you.cl.y * FT) : 0, card: menu ? document.getElementById('ov').innerText : '',
      goal: document.getElementById('goal').innerText, feed: document.getElementById('feed').innerText,
      clock: document.getElementById('gd').innerText, climb: document.querySelector('.ab[data-s="B"]').innerText,
    })).then(x => (seen.push(x), x));
    const wait = ms => page.waitForTimeout(ms);
    // after moving the clock, wait on the game itself rather than the wall clock, then let the screen paint
    const until = async fn => { await page.waitForFunction(fn, null, {timeout: 10000}); await wait(300) };
    const clearCards = async () => {
      for (let i = 0; i < 8 && await page.evaluate(() => !!menu || !!S.fly); i++) { await page.keyboard.press('Enter'); await wait(1200) }
    };
    const checks = {}, seen = [];

    // the first day's climbing lesson, standing beside the planted foot
    await page.evaluate(() => {
      S.t = OPENING.len + 1; S.tut.i = FIRST_DAY.findIndex(x => x.id === 'climb');
      const f = S.g.feet[0]; S.you.x = f.x + C.FOOT_R + 40; S.you.y = f.y;
    });
    await wait(1200); await clearCards();
    await page.keyboard.press('KeyK'); await wait(800);
    let v = await view();
    checks.climbStarts = v.mode === 'climb';
    checks.kneeCardSaysHowToClimb = /Hold W or Up to climb/.test(v.card);
    await clearCards();
    await page.keyboard.down('KeyW'); await wait(5000); await page.keyboard.up('KeyW');
    v = await view();
    const dayHeight = v.ft;
    checks.climbingGainsHeight = dayHeight > 15;

    // a minute before dusk: warned that nightfall will undo the climb
    await page.evaluate(() => { S.t = C.DUSK - 60.5 });
    await until(() => S.t > C.DUSK - 59.5);
    v = await view();
    checks.duskWarning = /Dusk in 60 s/.test(v.feed);
    const duskHeight = await page.evaluate(() => Math.round(S.you.cl.y * FT));

    // nightfall: put down at the foot, and a card says what was lost and how to go again
    await page.evaluate(() => { S.t = C.DUSK - .5 });
    await until(() => S.night && !!menu);
    v = await view();
    checks.putDownAtDusk = v.mode === 'ground';
    checks.nightCardNamesLoss = /Nightfall/.test(v.card) && new RegExp('You were ' + duskHeight + ' ft up').test(v.card);
    checks.nightCardSaysDawn = /Dawn comes in \d+ s/.test(v.card) && /press Climb \(K\)/.test(v.card);
    await clearCards();
    v = await view();
    checks.goalLineCountsToDawn = /Night climb again at dawn, in 0:\d\d/.test(v.goal);
    checks.panelCountsToDawn = /^Dawn 0:\d\d$/.test(v.clock);
    await page.keyboard.press('KeyK'); await wait(500);
    v = await view();
    checks.nightBlocksClimb = v.mode === 'ground' && /climb again at dawn/.test(v.climb);
    const tutBefore = await page.evaluate(() => S.tut.i);

    // dawn: told to climb again, and the same key does it from the bottom
    await page.evaluate(() => { S.t = C.DUSK + C.NIGHT - .5 });
    await until(() => !S.night);
    v = await view();
    checks.dawnPrompt = /Dawn: the giant can be climbed again/.test(v.feed) && /Dawn go to a planted foot and press Climb/.test(v.goal);
    checks.tutorialWaitedOutNight = await page.evaluate(i => S.tut.i === i && FIRST_DAY[S.tut.i].id === 'knee', tutBefore);
    await page.keyboard.press('KeyK'); await wait(800);
    await page.keyboard.down('KeyW'); await wait(3000); await page.keyboard.up('KeyW');
    v = await view();
    checks.climbAgainAtDawn = v.mode === 'climb' && v.ft > 15;
    checks.kneeGoalResumes = /Reach the knee/.test(v.goal);

    // the second nightfall does not stop play with the card again
    await page.evaluate(() => { S.t = 2 * (C.DUSK + C.NIGHT) - C.NIGHT - .5 });
    await until(() => S.night);
    v = await view();
    checks.cardOnlyOnce = v.mode === 'ground' && !/Nightfall/.test(v.card);

    // a half-built work on the giant is named as lost on the card
    await page.evaluate(() => {
      delete save.firstNight; S.t = 3 * (C.DUSK + C.NIGHT) - C.NIGHT - 1; mount(S.you, 0);
      const site = S.sites[0]; S.you.cl.x = site.c + .5; S.you.cl.y = site.r + .5; S.you.kits.ladder = 1; placeOnSite(S.you, site, 'ladder');
    });
    await until(() => S.night && !!menu);
    v = await view();
    checks.cardNamesLostBuild = /Your half-built ladder is lost, with its kit/.test(v.card);
    if (process.env.SHOTS) await page.screenshot({path: path.join(process.env.SHOTS, 'first-climb-night.png')});

    assert.deepEqual(errors, []);
    for (const [check, passed] of Object.entries(checks)) assert.ok(passed, check + '\n' + seen.map(x => JSON.stringify(x)).join('\n'));
    console.log(Object.keys(checks).length + ' first-climb day, night and dawn checks passed');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exit(1) });
