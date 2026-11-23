/**
 * CareCloset 핵심 로직 모듈
 *
 * 화면(DOM)과 저장소(IndexedDB)에 의존하지 않는 "순수 함수"만 모아 두었다.
 * 덕분에 브라우저(<script>)와 Node.js(테스트) 양쪽에서 같은 코드를 그대로 사용할 수 있다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(); // Node.js (테스트)
  } else {
    root.CareClosetLogic = factory(); // 브라우저
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- 상수
  const SEASONS = ['봄', '여름', '가을', '겨울'];
  const WASHING_METHODS = ['손세탁', '세탁기', '드라이클리닝', '기타'];
  const WATER_TEMPERATURES = ['찬물', '30℃ 이하', '40℃ 이하', '60℃ 이하'];
  const DRYING_METHODS = ['그늘에서 자연 건조', '눕혀서 건조', '햇볕에서 건조', '건조기 사용 가능', '기타'];

  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 원본 5MB 제한 (저장 시에는 화면에서 리사이즈)

  const LIMITS = { name: 40, material: 50, shortText: 50, notes: 500 };

  // ---------------------------------------------------------------- 공통 도우미
  /** 비교용 문자열: 앞뒤 공백 제거 + 소문자 변환 (null/undefined도 안전) */
  function normalizeText(value) {
    return String(value ?? '').trim().toLowerCase();
  }

  function cleanText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /** 계절 배열을 중복 제거하고 봄→겨울 순서로 정렬한다. */
  function sortSeasons(seasons) {
    return SEASONS.filter((season) => Array.isArray(seasons) && seasons.includes(season));
  }

  // ---------------------------------------------------------------- 검증 (NFR-03)
  /** 이미지 파일({type, size})이 허용된 형식·용량인지 검사한다. 파일이 없으면 통과(사진은 선택 항목). */
  function validateImageFile(file) {
    if (!file) return { valid: true, error: null };
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { valid: false, error: '지원하지 않는 이미지 형식입니다. JPG, PNG, WEBP, GIF 파일을 선택해 주세요.' };
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return { valid: false, error: '이미지 용량이 너무 큽니다. 5MB 이하의 파일을 선택해 주세요.' };
    }
    return { valid: true, error: null };
  }

  function validateTextLength(errors, field, value, max, label) {
    if (value !== undefined && value !== null && String(value).trim().length > max) {
      errors[field] = `${label}은(는) ${max}자 이하로 입력해 주세요.`;
    }
  }

  /** 의류 입력값을 검증한다. 반환: { valid, errors: { 필드명: 메시지 } } */
  function validateClothing(data) {
    const errors = {};
    const input = data || {};

    if (typeof input.name !== 'string' || input.name.trim() === '') {
      errors.name = '옷 이름을 입력해 주세요.';
    } else {
      validateTextLength(errors, 'name', input.name, LIMITS.name, '옷 이름');
    }

    const seasons = input.seasons === undefined ? [] : input.seasons;
    if (!Array.isArray(seasons) || !seasons.every((season) => SEASONS.includes(season))) {
      errors.seasons = '계절은 봄, 여름, 가을, 겨울 중에서 선택해 주세요.';
    }

    validateTextLength(errors, 'material', input.material, LIMITS.material, '재질');
    validateTextLength(errors, 'waterTemperature', input.waterTemperature, LIMITS.shortText, '물 온도');
    validateTextLength(errors, 'notes', input.notes, LIMITS.notes, '주의사항');

    return { valid: Object.keys(errors).length === 0, errors };
  }

  // ---------------------------------------------------------------- 생성·수정 (FR-01, 02, 06)
  function assertValid(data) {
    const { valid, errors } = validateClothing(data);
    if (!valid) throw new Error(Object.values(errors)[0]);
  }

  /** 입력값을 저장용 의류 객체로 만든다. 잘못된 입력이면 Error를 던진다. */
  function createClothing(data, options = {}) {
    assertValid(data);
    const now = options.now || new Date().toISOString();
    return {
      id: options.id || generateId(),
      name: data.name.trim(),
      material: cleanText(data.material),
      seasons: sortSeasons(data.seasons),
      clothingImage: data.clothingImage || null,
      labelImage: data.labelImage || null,
      washingMethod: cleanText(data.washingMethod),
      waterTemperature: cleanText(data.waterTemperature),
      dryingMethod: cleanText(data.dryingMethod),
      notes: cleanText(data.notes),
      createdAt: now,
      updatedAt: now,
    };
  }

  /** 기존 의류에 변경 내용을 적용한 새 객체를 반환한다. id와 등록일은 유지한다. */
  function updateClothing(existing, changes, options = {}) {
    const merged = { ...existing, ...changes };
    const updated = createClothing(merged, { id: existing.id, now: existing.createdAt });
    updated.updatedAt = options.now || new Date().toISOString();
    return updated;
  }

  // ---------------------------------------------------------------- 검색·필터 (FR-04, 05, 07)
  function matchesQuery(item, query) {
    return query === '' || (!!item && normalizeText(item.name).includes(query));
  }

  function matchesSeason(item, season) {
    return season === '' || (!!item && Array.isArray(item.seasons) && item.seasons.includes(season));
  }

  function normalizeFilterOptions(options) {
    if (!options || typeof options !== 'object') return { query: '', season: '' };
    return {
      query: normalizeText(options.query),
      season: cleanText(options.season),
    };
  }

  function matchesAllFilters(item, query, season) {
    return !!item && matchesQuery(item, query) && matchesSeason(item, season);
  }

  /**
   * 이름 검색어와 계절 태그로 의류 목록을 거른다. (시간 복잡도 O(n))
   * - 검색어가 비어 있으면 이름 조건을 적용하지 않는다.
   * - 계절이 비어 있으면 계절 조건을 적용하지 않는다.
   * - 두 조건이 모두 있으면 둘 다 만족하는 의류만 남긴다.
   */
  function filterClothes(list, options = {}) {
    if (!Array.isArray(list)) return [];
    const { query, season } = normalizeFilterOptions(options);
    return list.filter((item) => matchesAllFilters(item, query, season));
  }

  /** 최근 등록한 의류가 먼저 보이도록 정렬한 새 배열을 반환한다. */
  function sortByNewest(list) {
    return [...list].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  /** 목록이 비어 있을 때 보여 줄 안내 문구 (FR-07) */
  function getEmptyMessage({ total = 0, query = '', season = '' } = {}) {
    if (total === 0) {
      return '등록된 의류가 없습니다. “의류 등록” 버튼으로 첫 옷을 추가해 보세요.';
    }
    const conditions = [];
    if (cleanText(query)) conditions.push(`“${cleanText(query)}”`);
    if (cleanText(season)) conditions.push(`${cleanText(season)} 태그`);
    return `검색 결과가 없습니다. (조건: ${conditions.join(' + ')})`;
  }

  // ---------------------------------------------------------------- 가져오기·내보내기
  function buildExportData(items, now = new Date().toISOString()) {
    return { app: 'CareCloset', version: 1, exportedAt: now, items };
  }

  /** 내보낸 JSON 문자열을 읽어 유효한 의류만 골라낸다. 반환: { items, skipped, error } */
  function parseImportedData(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return { items: [], skipped: 0, error: '올바른 JSON 파일이 아닙니다.' };
    }

    const rawItems = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.items) ? parsed.items : null;
    if (!rawItems) {
      return { items: [], skipped: 0, error: '의류 목록을 찾을 수 없는 파일입니다.' };
    }

    const items = [];
    let skipped = 0;
    rawItems.forEach((raw) => {
      if (!raw || typeof raw !== 'object' || !validateClothing(raw).valid) {
        skipped += 1;
        return;
      }
      const options = { id: typeof raw.id === 'string' ? raw.id : undefined };
      if (typeof raw.createdAt === 'string') options.now = raw.createdAt;
      items.push(createClothing(raw, options));
    });
    return { items, skipped, error: null };
  }

  return {
    SEASONS, WASHING_METHODS, WATER_TEMPERATURES, DRYING_METHODS,
    ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, LIMITS,
    normalizeText, validateImageFile, validateClothing,
    createClothing, updateClothing,
    filterClothes, sortByNewest, getEmptyMessage,
    buildExportData, parseImportedData,
  };
});
