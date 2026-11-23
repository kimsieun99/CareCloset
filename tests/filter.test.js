/**
 * 검색(FR-04) + 계절 필터(FR-05) + 조합 테스트
 *
 * 같은 테스트를 "리팩토링 후" 코드(기본)와 "리팩토링 전" 코드에 모두 실행할 수 있다.
 *   npm test                          -> js/clothes.js (리팩토링 후)
 *   TEST_BEFORE=1 npm run test:before -> docs/refactoring/filter_before.js (리팩토링 전)
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const filterClothes = process.env.TEST_BEFORE
  ? require('../docs/refactoring/filter_before.js').filterClothes
  : require('../js/clothes.js').filterClothes;

const sample = [
  { id: '1', name: '크림색 니트', seasons: ['가을', '겨울'] },
  { id: '2', name: '검은색 니트', seasons: ['겨울'] },
  { id: '3', name: '하늘색 면 셔츠', seasons: ['봄', '여름', '가을'] },
  { id: '4', name: 'Basic T-Shirt', seasons: ['여름'] },
  { id: '5', name: '기모 후드', seasons: [] },
];
const ids = (list) => list.map((c) => c.id);

test('[FR-04] 검색어가 비어 있으면 전체 목록을 반환한다', () => {
  assert.deepEqual(ids(filterClothes(sample, { query: '', season: '' })), ['1', '2', '3', '4', '5']);
});

test('[FR-04] 이름의 일부만 입력해도 포함된 의류를 찾는다', () => {
  assert.deepEqual(ids(filterClothes(sample, { query: '니트', season: '' })), ['1', '2']);
});

test('[FR-05] 계절 태그를 선택하면 해당 태그의 의류만 반환한다', () => {
  assert.deepEqual(ids(filterClothes(sample, { query: '', season: '겨울' })), ['1', '2']);
});

test('[FR-05] 여러 계절 태그를 가진 의류는 각 계절 필터에 모두 나타난다', () => {
  assert.ok(ids(filterClothes(sample, { query: '', season: '봄' })).includes('3'));
  assert.ok(ids(filterClothes(sample, { query: '', season: '가을' })).includes('3'));
});

test('[FR-05] 검색어와 계절을 함께 적용하면 두 조건을 모두 만족하는 의류만 반환한다', () => {
  assert.deepEqual(ids(filterClothes(sample, { query: '니트', season: '가을' })), ['1']);
});

test('[FR-07] 조건에 맞는 의류가 없으면 빈 배열을 반환한다', () => {
  assert.deepEqual(filterClothes(sample, { query: '패딩', season: '' }), []);
  assert.deepEqual(filterClothes(sample, { query: '셔츠', season: '겨울' }), []);
});

test('[예외] 검색어 앞뒤 공백은 무시한다', () => {
  assert.deepEqual(ids(filterClothes(sample, { query: '  니트  ', season: '' })), ['1', '2']);
});

test('[예외] 공백만 입력하면 검색어가 없는 것으로 보고 전체를 반환한다', () => {
  assert.equal(filterClothes(sample, { query: '   ', season: '' }).length, 5);
});

test('[예외] 영문 이름은 대소문자를 구분하지 않고 검색한다', () => {
  assert.deepEqual(ids(filterClothes(sample, { query: 't-shirt', season: '' })), ['4']);
});

test('[예외] 계절 태그가 없는 의류가 있어도 오류 없이 필터링한다', () => {
  assert.deepEqual(ids(filterClothes([{ id: '9', name: '모자' }], { query: '', season: '봄' })), []);
});

test('[예외] 목록이 배열이 아니면(null/undefined) 빈 배열을 반환한다', () => {
  assert.deepEqual(filterClothes(null, { query: '', season: '' }), []);
  assert.deepEqual(filterClothes(undefined, {}), []);
});

test('[예외] 옵션을 생략해도 전체 목록을 반환한다', () => {
  assert.equal(filterClothes(sample).length, 5);
});

test('[예외] 옵션이 null이어도 전체 목록을 안전하게 반환한다', () => {
  assert.equal(filterClothes(sample, null).length, 5);
});

test('[예외] 검색어와 계절이 null이어도 전체 목록을 안전하게 반환한다', () => {
  assert.equal(filterClothes(sample, { query: null, season: null }).length, 5);
});

test('[예외] null 항목과 이름이 없는 항목은 필터링 중 오류 없이 건너뛴다', () => {
  const mixed = [null, { id: '6' }, ...sample];
  assert.equal(filterClothes(mixed, { query: '', season: '' }).length, 6);
  assert.deepEqual(ids(filterClothes(mixed, { query: '니트', season: '' })), ['1', '2']);
});
