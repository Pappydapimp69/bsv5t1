// The first climb through the player's own controls: the Climb card, K to grab the foot, W to climb, the dusk card,
// the night (Climb refused with the time to dawn), dawn, and K again. Enter answers each card, as a keyboard player would.
// Scaffolding only where waiting would be the whole test: the opening film is skipped, the first day starts at its
// climb step beside the left foot, the climber is lifted to the knee ledge, and game time is stepped instead of waited.
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

async function main() {
  const browser = await chromium.launch();
  const shots = process.env.SHOTS;
  try {
    const page = await browser.newPage({viewport: {width: 1100, height: 700}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/three.min.js', route => route.abort());
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);

    const sim = (seconds) => page.evaluate(s => __col.step(Math.round(s / C.DT)), seconds);
    const feedText = () => page.evaluate(() => feed.map(f => f.text).join(' | '));
    const card = async (id) => {
      await page.waitForFunction(i => menu && tutStep() && tutStep().id === i, id);
      const body = await page.evaluate(() => menu.body);
      await page.waitForTimeout(750); // the card ignores presses for 0.7 s
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => !menu);
      await page.evaluate(() => { S.fly = null; });
      return body;
    };
    const snap = async name => { if (shots) await page.screenshot({path: path.join(shots, name + '.png')}); };
    const checks = {};

    await page.evaluate(() => {
      __col.start('human', 7, true);
      S.t = OPENING.len + 2;
      S.introCam = false;
      S.tut.i = FIRST_DAY.findIndex(step => step.id === 'climb');
      const foot = S.g.feet[0];
      S.you.x = foot.x + 60;
      S.you.y = foot.y + 60;
    });
    checks.climbCardNamesClimb = (await card('climb')).includes('press Climb');

    await page.keyboard.press('KeyK');
    await sim(.5);
    checks.kGrabsTheFoot = await page.evaluate(() => S.you.mode === 'climb');
    checks.kneeCardTeachesLedges = (await card('knee')).includes('Rest on ledges');
    await page.keyboard.down('KeyW');
    await sim(3);
    await page.keyboard.up('KeyW');
    checks.wClimbs = await page.evaluate(() => S.you.mode === 'climb' && S.you.cl.y > 3);

    await page.evaluate(() => {
      const h = S.you;
      h.cl.x = h.leg ? 21.5 : 9.5;
      h.cl.y = 46.5;
      h.cl.move = h.cl.path = null;
    });
    await sim(.2);
    const duskCard = await card('dusk');
    checks.duskCardSaysWorkIsLost = duskCard.includes('lost with its kit') && duskCard.includes('Stay on');
    checks.duskPulledToFortyFive = await page.evaluate(() => Math.abs(duskIn() - 45) < .5 && !S.night);
    checks.stillOnTheKnee = await page.evaluate(() => S.you.mode === 'climb' && S.you.cl.y >= 46);

    await sim(16);
    checks.warnedThirtySecondsAhead = (await feedText()).includes('Dusk in 30 s: the chained giant will shake you off');
    await page.waitForTimeout(100);
    await snap('1-dusk-warning');
    checks.panelCountsToDusk = /Dusk 0:2\d/.test(await page.textContent('#gd'));

    await sim(29.6);
    const atDusk = await page.evaluate(() => ({night: S.night, mode: S.you.mode, loss: S.duskLoss, nearFoot: nearFoot(S.you) >= 0}));
    checks.duskShookYouOff = atDusk.night && atDusk.mode === 'ground' && atDusk.nearFoot;
    checks.lossNamesHeight = /shook you off at \d+ ft/.test(atDusk.loss || '');
    const dawnCard = await card('dawn');
    checks.dawnCardRepeatsTheLoss = /shook you off at \d+ ft/.test(dawnCard) && dawnCard.includes('press Climb');
    checks.lossMessageSurvivedTheCard = (await feedText()).includes('shook you off at');

    await page.keyboard.press('KeyK');
    await sim(.2);
    checks.climbRefusedAtNight = await page.evaluate(() => S.you.mode === 'ground');
    checks.refusalSaysWhen = /Night: climb again at dawn, in \d+ s/.test(await feedText());
    await page.waitForTimeout(100);
    await snap('2-night');
    checks.panelCountsToDawn = /Dawn 0:\d\d/.test(await page.textContent('#gd'));

    const left = await page.evaluate(() => dawnIn());
    await sim(left + .5);
    checks.dawnCame = await page.evaluate(() => !S.night && S.day === 2);
    checks.dawnSaysClimbAgain = (await feedText()).includes('The giant can be climbed again');
    await page.evaluate(() => { const f = S.g.feet[0]; S.you.x = f.x + 60; S.you.y = f.y + 60; }); // the night's drift
    await page.keyboard.press('KeyK');
    await sim(.5);
    checks.kClimbsAgainAtDawn = await page.evaluate(() => S.you.mode === 'climb');
    checks.firstDayFinishes = await page.evaluate(() => S.tut.done && feed.some(f => f.text.includes('first day is done')));
    await page.waitForTimeout(100);
    await snap('3-dawn-climb');

    // a build still underway at dusk: the warning and the dusk message both name it and its lost kit
    Object.assign(checks, await page.evaluate(() => {
      const state = __col.newGame('human', 3), h = state.you, site = state.sites.find(x => !x.build);
      mount(h, 0);
      h.kits.ladder = 1;
      state.t = C.DUSK - DUSK_WARN - 1;
      const started = placeOnSite(h, site, 'ladder');
      h.job.dur = 1e6;
      feed.length = 0;
      __col.step(Math.round(2 / C.DT));
      const warnsAboutLadder = feed.some(f => f.text.includes('your unfinished ladder will be lost with its kit'));
      __col.step(Math.round((DUSK_WARN + 1) / C.DT));
      const lossNamesBuild = started && /your ladder on the .+ was only \d+% built: it and its kit are lost/.test(state.duskLoss || '') && !h.job && !site.pending && h.kits.ladder === 0;
      return {warnsAboutLadder, lossNamesBuild};
    }));

    for (const [check, passed] of Object.entries(checks)) assert.ok(passed, check);
    assert.deepEqual(errors, [], errors.join("; "));
    console.log(Object.keys(checks).length + ' first-climb day, night and dawn checks passed');
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
