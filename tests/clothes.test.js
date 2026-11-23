/**
 * 검증·생성·수정·안내 메시지·가져오기·성능 테스트
 * (검색/필터 테스트는 tests/filter.test.js)
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const logic = require('../js/clothes.js');

const FIXED = '2026-11-01T00:00:00.000Z';

// ------------------------------------------------------------ FR-01 등록 / NFR-03 검증
test('[FR-01] 이름만 입력해도 의류를 등록할 수 있다 (사진 없이 등록)', () => {
  const item = logic.createClothing({ name: '검은색 기본 니트' }, { id: 'a1', now: FIXED });
  assert.equal(item.id, 'a1');
  assert.equal(item.name, '검은색 기본 니트');
  assert.equal(item.clothingImage, null);
  assert.deepEqual(item.seasons, []);
});

test('[FR-01] 계절은 중복을 제거하고 봄→겨울 순서로 저장한다', () => {
  const item = logic.createClothing({ name: '코트', seasons: ['겨울', '봄', '겨울'] });
  assert.deepEqual(item.seasons, ['봄', '겨울']);
});

test('[FR-01] 이름의 앞뒤 공백은 제거되어 저장된다', () => {
  assert.equal(logic.createClothing({ name: '  면 셔츠  ' }).name, '면 셔츠');
});

test('[FR-02] 세탁 방식·물 온도·건조 방법·주의사항이 의류에 함께 저장된다', () => {
  const item = logic.createClothing({
    name: '울 니트', washingMethod: '손세탁', waterTemperature: '30℃ 이하',
    dryingMethod: '눕혀서 건조', notes: '비틀지 말 것',
  });
  assert.equal(item.washingMethod, '손세탁');
  assert.equal(item.waterTemperature, '30℃ 이하');
  assert.equal(item.dryingMethod, '눕혀서 건조');
  assert.equal(item.notes, '비틀지 말 것');
});

test('[예외][NFR-03] 옷 이름이 비어 있으면 검증에 실패하고 안내 메시지를 준다', () => {
  const result = logic.validateClothing({ name: '' });
  assert.equal(result.valid, false);
  assert.equal(result.errors.name, '옷 이름을 입력해 주세요.');
});

test('[예외][NFR-03] 공백만 입력한 이름도 빈 이름으로 처리한다', () => {
  assert.equal(logic.validateClothing({ name: '    ' }).valid, false);
});

test('[예외][NFR-03] 이름이 숫자 등 문자열이 아니면 거부한다', () => {
  assert.equal(logic.validateClothing({ name: 123 }).valid, false);
  assert.equal(logic.validateClothing(null).valid, false);
  assert.equal(logic.validateClothing(undefined).valid, false);
});

test('[예외][NFR-03] 이름이 40자를 넘으면 거부한다', () => {
  const result = logic.validateClothing({ name: '가'.repeat(41) });
  assert.equal(result.valid, false);
  assert.match(result.errors.name, /40자/);
});

test('[경계][NFR-03] 이름은 40자까지 허용하고 재질·물 온도·주의사항의 최대 길이도 검사한다', () => {
  assert.equal(logic.validateClothing({
    name: '가'.repeat(40),
    material: '면'.repeat(50),
    waterTemperature: '찬'.repeat(50),
    notes: '주'.repeat(500),
  }).valid, true);

  const result = logic.validateClothing({
    name: '옷',
    material: '면'.repeat(51),
    waterTemperature: '찬'.repeat(51),
    notes: '주'.repeat(501),
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.material, /50자/);
  assert.match(result.errors.waterTemperature, /50자/);
  assert.match(result.errors.notes, /500자/);
});

test('[예외] 존재하지 않는 계절 태그는 거부한다', () => {
  assert.equal(logic.validateClothing({ name: '옷', seasons: ['장마'] }).valid, false);
  assert.equal(logic.validateClothing({ name: '옷', seasons: '봄' }).valid, false);
});

test('[예외] 잘못된 입력으로 createClothing을 호출하면 오류를 던진다', () => {
  assert.throws(() => logic.createClothing({ name: '' }), /옷 이름을 입력해 주세요/);
});

// ------------------------------------------------------------ 이미지 검증 (NFR-03)
test('[예외][NFR-03] 지원하지 않는 이미지 형식(pdf, svg)은 거부한다', () => {
  const pdf = logic.validateImageFile({ type: 'application/pdf', size: 1000 });
  assert.equal(pdf.valid, false);
  assert.match(pdf.error, /지원하지 않는 이미지 형식/);
  assert.equal(logic.validateImageFile({ type: 'image/svg+xml', size: 1000 }).valid, false);
});

test('[예외][NFR-03] 5MB를 넘는 이미지는 거부한다', () => {
  const big = logic.validateImageFile({ type: 'image/png', size: 5 * 1024 * 1024 + 1 });
  assert.equal(big.valid, false);
  assert.match(big.error, /5MB/);
});

test('[경계][NFR-03] 정확히 5MB인 이미지는 허용한다', () => {
  const exactLimit = logic.validateImageFile({
    type: 'image/png',
    size: 5 * 1024 * 1024,
  });
  assert.equal(exactLimit.valid, true);
  assert.equal(exactLimit.error, null);
});

test('[FR-01] jpg/png/webp/gif 이미지와 "사진 없음"은 통과한다', () => {
  ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].forEach((type) => {
    assert.equal(logic.validateImageFile({ type, size: 1000 }).valid, true);
  });
  assert.equal(logic.validateImageFile(null).valid, true);
});

// ------------------------------------------------------------ FR-06 수정
test('[FR-06] 수정하면 내용은 바뀌고 id와 등록일은 유지된다', () => {
  const original = logic.createClothing({ name: '니트', washingMethod: '세탁기' }, { id: 'k1', now: FIXED });
  const updated = logic.updateClothing(original, { washingMethod: '손세탁' }, { now: '2026-12-01T00:00:00.000Z' });
  assert.equal(updated.id, 'k1');
  assert.equal(updated.createdAt, FIXED);
  assert.equal(updated.washingMethod, '손세탁');
  assert.equal(updated.updatedAt, '2026-12-01T00:00:00.000Z');
  assert.equal(original.washingMethod, '세탁기', '원본 객체는 변경되지 않는다');
});

test('[예외][FR-06] 수정 시 이름을 비우면 오류를 던진다', () => {
  const original = logic.createClothing({ name: '니트' });
  assert.throws(() => logic.updateClothing(original, { name: '' }));
});

test('[FR-06] 수정 시 계절도 중복 제거와 순서 정규화 규칙을 따른다', () => {
  const original = logic.createClothing({ name: '겉옷', seasons: ['봄'] });
  const updated = logic.updateClothing(original, { seasons: ['겨울', '가을', '겨울'] });
  assert.deepEqual(updated.seasons, ['가을', '겨울']);
  assert.deepEqual(original.seasons, ['봄']);
});

// ------------------------------------------------------------ FR-07 안내 메시지
test('[FR-07] 등록된 의류가 하나도 없으면 등록을 유도하는 안내를 보여 준다', () => {
  assert.match(logic.getEmptyMessage({ total: 0 }), /등록된 의류가 없습니다/);
});

test('[FR-07] 검색 결과가 없으면 입력한 조건을 포함한 안내를 보여 준다', () => {
  const message = logic.getEmptyMessage({ total: 10, query: '패딩', season: '여름' });
  assert.match(message, /검색 결과가 없습니다/);
  assert.match(message, /패딩/);
  assert.match(message, /여름/);
});

// ------------------------------------------------------------ 정렬
test('최근에 등록한 의류가 먼저 정렬된다', () => {
  const items = [
    { id: 'old', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'new', createdAt: '2026-06-01T00:00:00Z' },
  ];
  const sorted = logic.sortByNewest(items);
  assert.deepEqual(sorted.map((c) => c.id), ['new', 'old']);
  assert.deepEqual(items.map((c) => c.id), ['old', 'new'], '원본 배열은 변경되지 않는다');
});

// ------------------------------------------------------------ 가져오기/내보내기
test('내보내기 데이터에 앱 이름, 버전, 시각과 의류 목록이 포함된다', () => {
  const items = [{ id: 'x1', name: '니트' }];
  assert.deepEqual(logic.buildExportData(items, FIXED), {
    app: 'CareCloset',
    version: 1,
    exportedAt: FIXED,
    items,
  });
});

test('내보낸 데이터를 다시 가져오면 같은 의류가 복원된다', () => {
  const items = [logic.createClothing({ name: '니트', seasons: ['겨울'] }, { id: 'x1', now: FIXED })];
  const text = JSON.stringify(logic.buildExportData(items, FIXED));
  const result = logic.parseImportedData(text);
  assert.equal(result.error, null);
  assert.equal(result.skipped, 0);
  assert.deepEqual(result.items, items);
});

test('[예외] 잘못된 JSON 파일을 가져오면 오류 메시지를 반환한다', () => {
  assert.equal(logic.parseImportedData('이건 JSON이 아님').error, '올바른 JSON 파일이 아닙니다.');
  assert.ok(logic.parseImportedData('{"foo": 1}').error);
});

test('[예외] 가져오기 중 이름이 없는 항목은 건너뛰고 나머지는 가져온다', () => {
  const text = JSON.stringify([{ name: '정상 옷' }, { name: '' }, null, 'abc']);
  const result = logic.parseImportedData(text);
  assert.equal(result.items.length, 1);
  assert.equal(result.skipped, 3);
});

test('Python 생성기가 만든 샘플 데이터(30벌)를 모두 가져올 수 있다', () => {
  const file = path.join(__dirname, '..', 'sample', 'sample_clothes.json');
  const result = logic.parseImportedData(fs.readFileSync(file, 'utf-8'));
  assert.equal(result.error, null);
  assert.equal(result.items.length, 30);
  assert.equal(result.skipped, 0);
});

// ------------------------------------------------------------ NFR-01 성능
test('[NFR-01] 의류 100개에서 검색+계절 필터가 1초 이내(실제로는 수 ms)에 끝난다', () => {
  const items = Array.from({ length: 100 }, (_, i) => ({
    id: String(i), name: `${i % 2 ? '검은색' : '크림색'} 니트 ${i}`, seasons: i % 3 === 0 ? ['겨울'] : ['봄', '가을'],
  }));
  const start = process.hrtime.bigint();
  for (let round = 0; round < 100; round += 1) logic.filterClothes(items, { query: '니트', season: '겨울' });
  const averageMs = Number(process.hrtime.bigint() - start) / 1e6 / 100;
  console.log(`      (평균 처리 시간: ${averageMs.toFixed(4)}ms / 1회)`);
  assert.ok(averageMs < 1000);
});
