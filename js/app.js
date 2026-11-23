/**
 * CareCloset 화면 로직 (UI 컨트롤러)
 * - 핵심 규칙(검증·검색·필터)은 CareClosetLogic, 저장은 CareClosetStorage, 이미지 처리는 CareClosetImage에 맡긴다.
 * - 사용자가 입력한 문자열은 항상 textContent로 출력해 HTML이 삽입되지 않게 한다.
 */
(function () {
  'use strict';

  const Logic = window.CareClosetLogic;
  const Storage = window.CareClosetStorage;
  const ImageTool = window.CareClosetImage;

  const CUSTOM = '__custom__'; // "직접 입력" 선택지 값

  // ---------------------------------------------------------------- 상태
  const state = { items: [], query: '', season: '' };
  const formState = { editingId: null, clothingImage: null, labelImage: null, saving: false };

  // ---------------------------------------------------------------- DOM 참조
  const $ = (id) => document.getElementById(id);
  const els = {
    list: $('clothes-list'), summary: $('result-summary'), empty: $('empty-message'),
    search: $('search-input'), seasonFilter: $('season-filter'), toast: $('toast'),
    detailDialog: $('detail-dialog'), detailTitle: $('detail-title'), detailContent: $('detail-content'),
    formDialog: $('form-dialog'), form: $('clothing-form'), formTitle: $('form-title'), saveBtn: $('save-btn'),
    name: $('f-name'), material: $('f-material'), washing: $('f-washing'), water: $('f-water'),
    waterCustom: $('f-water-custom'), drying: $('f-drying'), notes: $('f-notes'),
    clothingInput: $('f-clothing-image'), labelInput: $('f-label-image'),
  };

  // ---------------------------------------------------------------- 작은 도우미
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  let toastTimer = null;
  function showToast(message, isError = false) {
    els.toast.textContent = message;
    els.toast.classList.toggle('is-error', isError);
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, 3500);
  }

  function fillSelect(select, options, emptyLabel, withCustom) {
    select.replaceChildren();
    const choices = [{ value: '', label: emptyLabel }, ...options.map((o) => ({ value: o, label: o }))];
    if (withCustom) choices.push({ value: CUSTOM, label: '직접 입력' });
    choices.forEach(({ value, label }) => {
      const option = el('option', '', label);
      option.value = value;
      select.append(option);
    });
  }

  function formatDate(iso) {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('ko-KR');
  }

  // ---------------------------------------------------------------- 목록 화면 (FR-03, 04, 05, 07)
  function createThumb(item) {
    if (item.clothingImage) {
      const img = el('img', 'card-thumb');
      img.src = item.clothingImage;
      img.alt = `${item.name} 사진`;
      img.loading = 'lazy';
      return img;
    }
    const placeholder = el('div', 'thumb-placeholder', '👕');
    placeholder.setAttribute('aria-hidden', 'true');
    return placeholder;
  }

  function createCard(item) {
    const li = el('li');
    const button = el('button', 'card');
    button.type = 'button';
    button.dataset.id = item.id;
    button.setAttribute('aria-label', `${item.name} 상세 보기`);

    const body = el('div', 'card-body');
    body.append(el('p', 'card-title', item.name));
    body.append(el('p', 'card-sub', item.material || '재질 미입력'));
    const tags = el('div', 'tags');
    item.seasons.forEach((season) => tags.append(el('span', 'tag', season)));
    body.append(tags);

    button.append(createThumb(item), body);
    li.append(button);
    return li;
  }

  function renderList() {
    const visible = Logic.sortByNewest(Logic.filterClothes(state.items, { query: state.query, season: state.season }));

    els.list.replaceChildren(...visible.map(createCard));
    els.summary.textContent = state.items.length ? `총 ${state.items.length}벌 중 ${visible.length}벌 표시` : '';

    const isEmpty = visible.length === 0;
    els.empty.hidden = !isEmpty;
    els.empty.textContent = isEmpty
      ? Logic.getEmptyMessage({ total: state.items.length, query: state.query, season: state.season })
      : '';
  }

  // ---------------------------------------------------------------- 상세 화면 (FR-03)
  function createFigure(src, alt, emptyText) {
    const figure = el('figure');
    if (src) {
      const img = el('img');
      img.src = src;
      img.alt = alt;
      figure.append(img);
    } else {
      figure.append(el('div', 'thumb-placeholder', '–'));
    }
    figure.append(el('figcaption', '', src ? alt : emptyText));
    return figure;
  }

  function openDetail(id) {
    const item = state.items.find((candidate) => candidate.id === id);
    if (!item) return;
    els.detailDialog.dataset.id = id;
    els.detailTitle.textContent = item.name;

    const images = el('div', 'detail-images');
    images.append(
      createFigure(item.clothingImage, '옷 사진', '옷 사진 없음'),
      createFigure(item.labelImage, '세탁 택 사진', '세탁 택 사진 없음')
    );

    const rows = [
      ['재질', item.material], ['계절', item.seasons.join(', ')], ['세탁 방식', item.washingMethod],
      ['물 온도', item.waterTemperature], ['건조 방법', item.dryingMethod], ['주의사항', item.notes],
      ['등록일', formatDate(item.createdAt)],
    ];
    const list = el('dl', 'detail-list');
    rows.forEach(([label, value]) => {
      list.append(el('dt', '', label), el('dd', '', value || '미입력'));
    });

    els.detailContent.replaceChildren(images, list);
    els.detailDialog.showModal();
  }

  // ---------------------------------------------------------------- 등록·수정 폼 (FR-01, 02, 06 / NFR-02, 03)
  function clearErrors() {
    document.querySelectorAll('.field-error').forEach((node) => { node.textContent = ''; });
    els.form.querySelectorAll('[aria-invalid]').forEach((node) => node.removeAttribute('aria-invalid'));
  }

  function showError(field, message) {
    const target = $(`err-${field}`);
    if (target) target.textContent = message;
    const input = { name: els.name, material: els.material, notes: els.notes, waterTemperature: els.waterCustom }[field];
    if (input) input.setAttribute('aria-invalid', 'true');
  }

  function updatePreview(kind) {
    const src = formState[`${kind}Image`];
    $(`${kind}-preview-row`).hidden = !src;
    if (src) $(`${kind}-preview`).src = src;
  }

  /** 저장된 값이 선택지에 있으면 그대로, 없으면 "직접 입력"으로 보여 준다. */
  function setSelectWithCustom(select, customInput, value, presets) {
    if (!value) { select.value = ''; }
    else if (presets.includes(value)) { select.value = value; }
    else { select.value = CUSTOM; customInput.value = value; }
    customInput.hidden = select.value !== CUSTOM;
  }

  function resetFormForOpen(item) {
    clearErrors();
    els.form.reset();
    els.waterCustom.hidden = true;
    formState.saving = false;
    formState.editingId = item ? item.id : null;
    formState.clothingImage = item ? item.clothingImage : null;
    formState.labelImage = item ? item.labelImage : null;
  }

  function setFormMode(item) {
    els.formTitle.textContent = item ? '의류 수정' : '의류 등록';
  }

  function fillFormFields(item) {
    if (item) {
      els.name.value = item.name;
      els.material.value = item.material;
      els.washing.value = Logic.WASHING_METHODS.includes(item.washingMethod) ? item.washingMethod : '';
      els.drying.value = Logic.DRYING_METHODS.includes(item.dryingMethod) ? item.dryingMethod : '';
      els.notes.value = item.notes;
      setSelectWithCustom(els.water, els.waterCustom, item.waterTemperature, Logic.WATER_TEMPERATURES);
      els.form.querySelectorAll('input[name="seasons"]').forEach((box) => { box.checked = item.seasons.includes(box.value); });
    }
  }

  function openForm(item) {
    resetFormForOpen(item);
    setFormMode(item);
    fillFormFields(item);
    updatePreview('clothing');
    updatePreview('label');
    els.formDialog.showModal();
    els.name.focus();
  }

  function collectFormData() {
    const water = els.water.value === CUSTOM ? els.waterCustom.value : els.water.value;
    return {
      name: els.name.value,
      material: els.material.value,
      seasons: [...els.form.querySelectorAll('input[name="seasons"]:checked')].map((box) => box.value),
      clothingImage: formState.clothingImage,
      labelImage: formState.labelImage,
      washingMethod: els.washing.value,
      waterTemperature: water,
      dryingMethod: els.drying.value,
      notes: els.notes.value,
    };
  }

  async function handleImageChange(kind, input) {
    const errorField = `${kind}Image`;
    $(`err-${errorField}`).textContent = '';
    const file = input.files[0];
    if (!file) return;

    const check = Logic.validateImageFile(file);
    if (!check.valid) {
      $(`err-${errorField}`).textContent = check.error;
      input.value = '';
      return;
    }
    try {
      formState[errorField] = await ImageTool.fileToResizedDataUrl(file);
      updatePreview(kind);
    } catch (error) {
      $(`err-${errorField}`).textContent = error.message;
      input.value = '';
    }
  }

  function validateFormData(data) {
    clearErrors();
    const { valid, errors } = Logic.validateClothing(data);
    if (!valid) {
      Object.entries(errors).forEach(([field, message]) => showError(field, message));
      const firstField = Object.keys(errors)[0];
      const focusTarget = { name: els.name, material: els.material, notes: els.notes, waterTemperature: els.waterCustom }[firstField];
      if (focusTarget) focusTarget.focus();
    }
    return valid;
  }

  async function saveSubmittedData(data) {
    const existing = state.items.find((item) => item.id === formState.editingId);
    const saved = existing ? Logic.updateClothing(existing, data) : Logic.createClothing(data);
    await Storage.save(saved);
    return { existing, saved };
  }

  function applySubmittedData(existing, saved) {
    state.items = existing
      ? state.items.map((item) => (item.id === saved.id ? saved : item))
      : [...state.items, saved];
    els.formDialog.close();
    renderList();
    showToast(existing ? '수정했습니다.' : '등록했습니다.');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const data = collectFormData();
    if (!validateFormData(data)) return;
    if (formState.saving) return;

    formState.saving = true;
    els.saveBtn.disabled = true;
    try {
      const { existing, saved } = await saveSubmittedData(data);
      applySubmittedData(existing, saved);
    } catch (error) {
      showToast(`저장에 실패했습니다. ${error.message}`, true);
    } finally {
      formState.saving = false;
      els.saveBtn.disabled = false;
    }
  }

  // ---------------------------------------------------------------- 삭제 (FR-06)
  async function deleteCurrent() {
    const id = els.detailDialog.dataset.id;
    const item = state.items.find((candidate) => candidate.id === id);
    if (!item || !window.confirm(`“${item.name}” 기록을 삭제할까요? 삭제하면 되돌릴 수 없습니다.`)) return;
    try {
      await Storage.remove(id);
      state.items = state.items.filter((candidate) => candidate.id !== id);
      els.detailDialog.close();
      renderList();
      showToast('삭제했습니다.');
    } catch (error) {
      showToast(`삭제에 실패했습니다. ${error.message}`, true);
    }
  }

  // ---------------------------------------------------------------- 백업 (내보내기/가져오기)
  function exportData() {
    const json = JSON.stringify(Logic.buildExportData(state.items), null, 2);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    link.download = `carecloset-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast(`${state.items.length}벌의 데이터를 내보냈습니다.`);
  }

  async function importData(file) {
    if (!file) return;
    const result = Logic.parseImportedData(await file.text());
    if (result.error) { showToast(result.error, true); return; }
    try {
      await Storage.saveMany(result.items);
      const byId = new Map(state.items.map((item) => [item.id, item]));
      result.items.forEach((item) => byId.set(item.id, item));
      state.items = [...byId.values()];
      renderList();
      const skippedText = result.skipped ? ` (형식이 맞지 않는 ${result.skipped}개는 건너뜀)` : '';
      showToast(`${result.items.length}벌을 가져왔습니다.${skippedText}`);
    } catch (error) {
      showToast(`가져오기에 실패했습니다. ${error.message}`, true);
    }
  }

  // ---------------------------------------------------------------- 이벤트 연결
  function bindEvents() {
    els.search.addEventListener('input', () => { state.query = els.search.value; renderList(); });

    els.seasonFilter.addEventListener('click', (event) => {
      const chip = event.target.closest('.chip');
      if (!chip) return;
      state.season = chip.dataset.season;
      els.seasonFilter.querySelectorAll('.chip').forEach((node) => {
        const active = node === chip;
        node.classList.toggle('is-active', active);
        node.setAttribute('aria-pressed', String(active));
      });
      renderList();
    });

    els.list.addEventListener('click', (event) => {
      const card = event.target.closest('.card');
      if (card) openDetail(card.dataset.id);
    });

    $('open-add').addEventListener('click', () => openForm(null));
    $('detail-edit').addEventListener('click', () => {
      const item = state.items.find((candidate) => candidate.id === els.detailDialog.dataset.id);
      els.detailDialog.close();
      if (item) openForm(item);
    });
    $('detail-delete').addEventListener('click', deleteCurrent);

    document.querySelectorAll('[data-close]').forEach((button) => {
      button.addEventListener('click', () => button.closest('dialog').close());
    });

    els.form.addEventListener('submit', handleSubmit);
    els.water.addEventListener('change', () => { els.waterCustom.hidden = els.water.value !== CUSTOM; });
    els.clothingInput.addEventListener('change', () => handleImageChange('clothing', els.clothingInput));
    els.labelInput.addEventListener('change', () => handleImageChange('label', els.labelInput));
    $('clothing-remove').addEventListener('click', () => { formState.clothingImage = null; els.clothingInput.value = ''; updatePreview('clothing'); });
    $('label-remove').addEventListener('click', () => { formState.labelImage = null; els.labelInput.value = ''; updatePreview('label'); });

    $('export-btn').addEventListener('click', exportData);
    $('import-input').addEventListener('change', async (event) => {
      await importData(event.target.files[0]);
      event.target.value = '';
    });
  }

  // ---------------------------------------------------------------- 시작
  async function init() {
    fillSelect(els.washing, Logic.WASHING_METHODS, '선택 안 함', false);
    fillSelect(els.water, Logic.WATER_TEMPERATURES, '선택 안 함', true);
    fillSelect(els.drying, Logic.DRYING_METHODS, '선택 안 함', false);
    bindEvents();

    try {
      state.items = await Storage.getAll();
    } catch (error) {
      showToast(`저장된 데이터를 불러오지 못했습니다. ${error.message}`, true);
    }
    renderList();
  }

  init();
})();
