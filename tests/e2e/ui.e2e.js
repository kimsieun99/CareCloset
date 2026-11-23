/**
 * 브라우저 통합(E2E) 테스트 - 선택 사항
 * 실제 Chromium에서 index.html을 열어 "등록 → 조회 → 검색/필터 → 수정 → 삭제" 흐름을 점검한다.
 *
 * 실행 방법 (Playwright 설치 필요):
 *   npm install --no-save playwright && npx playwright install chromium
 *   node tests/e2e/ui.e2e.js
 *   SCREENSHOT_DIR=docs/screenshots node tests/e2e/ui.e2e.js   # 스크린샷도 저장
 */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const URL = 'file://' + path.join(ROOT, 'index.html');
const FIX = (name) => path.join(__dirname, 'fixtures', name);
const SHOT_DIR = process.env.SCREENSHOT_DIR;

let passed = 0;
const failures = [];
async function check(title, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`✔ ${title}`);
  } catch (error) {
    failures.push(title);
    console.log(`✖ ${title}\n    ${error.message.split('\n')[0]}`);
  }
}
function expect(actual, expected, label = '') {
  if (actual !== expected) throw new Error(`${label} 기대값: ${JSON.stringify(expected)}, 실제값: ${JSON.stringify(actual)}`);
}
function expectTrue(value, label) { if (!value) throw new Error(label); }

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  let alertCount = 0;
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'alert') alertCount += 1; // 스크립트가 실행되면 alert가 뜬다
    if (dialog.type() === 'confirm') await dialog.accept(); // 삭제 확인창은 수락
    else await dialog.dismiss();
  });

  const shot = async (name, options = {}) => {
    if (!SHOT_DIR) return;
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(SHOT_DIR, name), ...options });
  };
  const cards = () => page.locator('.card');
  const emptyText = async () => ((await page.locator('#empty-message').isVisible()) ? page.locator('#empty-message').innerText() : '');

  async function fillAndSave({ name, material = '', seasons = [], clothing, label, washing, water, drying, notes = '' }) {
    await page.click('#open-add');
    await page.fill('#f-name', name);
    await page.fill('#f-material', material);
    for (const season of seasons) await page.check(`input[name="seasons"][value="${season}"]`);
    if (clothing) await page.setInputFiles('#f-clothing-image', FIX(clothing));
    if (label) await page.setInputFiles('#f-label-image', FIX(label));
    if (washing) await page.selectOption('#f-washing', washing);
    if (water) await page.selectOption('#f-water', water);
    if (drying) await page.selectOption('#f-drying', drying);
    await page.fill('#f-notes', notes);
    if (clothing) await page.waitForSelector('#clothing-preview-row:not([hidden])');
    if (label) await page.waitForSelector('#label-preview-row:not([hidden])');
    await page.click('#save-btn');
    await page.waitForSelector('#form-dialog', { state: 'hidden' });
  }

  await page.goto(URL);

  await page.waitForSelector('#empty-message:not([hidden])'); // 저장소 조회가 끝나 첫 화면이 그려질 때까지 대기
  await check('[FR-07] 처음에는 "등록된 의류가 없습니다" 안내가 보인다', async () => {
    expectTrue((await emptyText()).includes('등록된 의류가 없습니다'), '빈 목록 안내 없음');
    await shot('01_empty.png');
  });

  await check('[NFR-03] 이름을 비우고 저장하면 오류 메시지가 나오고 폼이 유지된다', async () => {
    await page.click('#open-add');
    await page.click('#save-btn');
    expect(await page.locator('#err-name').innerText(), '옷 이름을 입력해 주세요.');
    expectTrue(await page.locator('#form-dialog').isVisible(), '폼이 닫힘');
    await shot('02_validation_error.png');
  });

  await check('[안정성] 저장 요청을 두 번 보내도 의류가 한 번만 등록된다', async () => {
    await page.fill('#f-name', '중복 제출 방지 테스트');
    await page.evaluate(() => {
      const form = document.getElementById('clothing-form');
      form.requestSubmit();
      form.requestSubmit();
    });
    await page.waitForSelector('#form-dialog', { state: 'hidden' });
    expect(await cards().count(), 1);

    await page.locator('.card').click();
    await page.click('#detail-delete');
    await page.waitForSelector('#detail-dialog', { state: 'hidden' });
    expect(await cards().count(), 0);
    await page.click('#open-add');
  });

  await check('[NFR-03] 이미지가 아닌 파일(pdf)을 고르면 형식 오류 안내가 나온다', async () => {
    try {
      await page.setInputFiles('#f-clothing-image', FIX('not-image.pdf'));
      expectTrue((await page.locator('#err-clothingImage').innerText()).includes('지원하지 않는 이미지 형식'), '형식 오류 안내 없음');
      expect(await page.locator('#clothing-preview-row').isHidden(), true, '미리보기가 표시됨');
    } finally {
      await page.click('#form-dialog .dialog-actions [data-close]'); // 실패해도 폼을 닫아 다음 테스트에 영향이 없게 한다
    }
  });

  await check('[FR-01,02] 사진·세탁 택 사진·세탁 정보를 입력해 의류를 등록한다', async () => {
    await fillAndSave({
      name: '검은색 기본 니트', material: '울 혼방', seasons: ['가을', '겨울'], clothing: 'knit.png', label: 'label.png',
      washing: '손세탁', water: '30℃ 이하', drying: '눕혀서 건조', notes: '비틀어 짜지 말고 눕혀서 말리기',
    });
    expect(await cards().count(), 1);
  });

  await check('[FR-01] 사진 없이도 등록되고 기본 이미지가 표시된다', async () => {
    await fillAndSave({ name: '하늘색 면 셔츠', material: '면 100%', seasons: ['봄', '여름', '가을'], washing: '세탁기', water: '40℃ 이하', drying: '그늘에서 자연 건조' });
    await fillAndSave({ name: '크림색 니트', material: '울 100%', seasons: ['겨울'], clothing: 'hood.png', washing: '손세탁' });
    expect(await cards().count(), 3);
    expectTrue(await page.locator('.thumb-placeholder').count() >= 1, '기본 이미지 없음');
    await shot('03_list.png');
  });

  await check('[NFR-04] 새로고침해도 등록한 데이터가 유지된다', async () => {
    await page.reload();
    await page.waitForSelector('.card');
    expect(await cards().count(), 3);
  });

  await check('[FR-04] 이름 일부("니트")로 검색하면 일치하는 의류만 보인다', async () => {
    await page.fill('#search-input', '니트');
    expect(await cards().count(), 2);
    await shot('04_search.png');
  });

  await check('[FR-07] 일치하는 의류가 없으면 "검색 결과가 없습니다" 안내가 나온다', async () => {
    await page.fill('#search-input', '패딩');
    expect(await cards().count(), 0);
    expectTrue((await emptyText()).includes('검색 결과가 없습니다'), '검색 결과 없음 안내 없음');
    await shot('05_no_result.png');
  });

  await check('[FR-05] 겨울 태그를 선택하면 겨울 의류만 보인다', async () => {
    await page.fill('#search-input', '');
    await page.click('.chip[data-season="겨울"]');
    expect(await cards().count(), 2);
    expect(await page.locator('.chip[data-season="겨울"]').getAttribute('aria-pressed'), 'true');
  });

  await check('[FR-05] 검색어 "니트" + 여름 필터는 결과 없음, "니트" + 겨울은 2개', async () => {
    await page.fill('#search-input', '니트');
    expect(await cards().count(), 2);
    await page.click('.chip[data-season="여름"]');
    expect(await cards().count(), 0);
    expectTrue((await emptyText()).includes('여름'), '조건 안내에 계절 없음');
    await page.click('.chip[data-season=""]');
    await page.fill('#search-input', '');
    expect(await cards().count(), 3);
  });

  await check('[FR-03] 카드를 누르면 사진과 세탁 정보를 한 화면에서 확인한다', async () => {
    await page.locator('.card', { hasText: '검은색 기본 니트' }).click();
    const text = await page.locator('#detail-dialog').innerText();
    for (const expected of ['울 혼방', '손세탁', '30℃ 이하', '눕혀서 건조', '비틀어 짜지 말고']) {
      expectTrue(text.includes(expected), `상세 화면에 "${expected}" 없음`);
    }
    expect(await page.locator('#detail-dialog img').count(), 2);
    await shot('06_detail.png');
  });

  await check('[FR-06] 수정하면 변경한 세탁 방식이 상세 화면에 반영된다', async () => {
    await page.click('#detail-edit');
    expect(await page.inputValue('#f-name'), '검은색 기본 니트');
    expect(await page.inputValue('#f-washing'), '손세탁');
    await page.selectOption('#f-washing', '세탁기');
    await page.selectOption('#f-water', '__custom__');
    await page.fill('#f-water-custom', '35℃');
    await page.click('#save-btn');
    await page.waitForSelector('#form-dialog', { state: 'hidden' });
    await page.locator('.card', { hasText: '검은색 기본 니트' }).click();
    const text = await page.locator('#detail-dialog').innerText();
    expectTrue(text.includes('세탁기') && text.includes('35℃'), '수정 내용 미반영');
    await page.click('#detail-dialog [data-close]');
  });

  await check('[FR-06] 삭제하면 목록에서 사라진다', async () => {
    await page.locator('.card', { hasText: '크림색 니트' }).click();
    await page.click('#detail-delete');
    await page.waitForSelector('#detail-dialog', { state: 'hidden' });
    expect(await cards().count(), 2);
  });

  await check('[보안] 이름에 HTML 태그를 입력해도 실행되지 않고 글자로 표시된다', async () => {
    await fillAndSave({ name: '<img src=x onerror=alert(1)>' });
    await page.waitForTimeout(300);
    expect(alertCount, 0, '스크립트가 실행됨');
    expect(await page.locator('.card-title', { hasText: '<img src=x' }).count(), 1, '글자로 표시되지 않음');
    await page.locator('.card', { hasText: '<img src=x' }).click();
    await page.click('#detail-delete');
    await page.waitForSelector('#detail-dialog', { state: 'hidden' });
  });

  await check('[NFR-01] 샘플 30벌을 가져온 뒤 검색·필터가 1초 이내에 반영된다', async () => {
    await page.click('.data-tools summary');
    await page.setInputFiles('#import-input', path.join(ROOT, 'sample', 'sample_clothes.json'));
    await page.waitForFunction(() => document.querySelectorAll('.card').length === 32);
    const elapsed = await page.evaluate(() => {
      const input = document.getElementById('search-input');
      const start = performance.now();
      input.value = '니트';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('.chip[data-season="겨울"]').click();
      return performance.now() - start;
    });
    console.log(`      (검색+필터 화면 반영 시간: ${elapsed.toFixed(1)}ms)`);
    expectTrue(elapsed < 1000, `처리 시간 ${elapsed}ms`);
    await page.fill('#search-input', '');
    await page.click('.chip[data-season=""]');
    await shot('07_sample_data.png', { fullPage: false });
  });

  await check('[NFR-05] 모바일 화면(375px)에서 가로 스크롤 없이 주요 기능을 쓸 수 있다', async () => {
    await page.setViewportSize({ width: 375, height: 760 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expectTrue(overflow <= 0, `가로 넘침 ${overflow}px`);
    expectTrue(await page.locator('#search-input').isVisible(), '검색창 안 보임');
    expectTrue(await page.locator('#open-add').isVisible(), '등록 버튼 안 보임');
    await shot('08_mobile_list.png');
    await page.locator('.card').first().click();
    expectTrue(await page.locator('#detail-dialog').isVisible(), '모바일 상세 안 열림');
    await shot('09_mobile_detail.png');
    await page.click('#detail-dialog [data-close]');
  });

  await check('브라우저 콘솔에 오류가 없다', async () => {
    expect(consoleErrors.length, 0, consoleErrors.join(' | '));
  });

  await browser.close();
  console.log(`\nE2E 결과: ${passed}개 통과, ${failures.length}개 실패`);
  if (failures.length) process.exit(1);
})();
