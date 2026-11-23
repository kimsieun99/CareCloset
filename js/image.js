/**
 * 이미지 처리 모듈
 * 선택한 사진을 검증하고, 저장 용량을 줄이기 위해 긴 변 800px의 JPEG로 줄여 data URL로 변환한다.
 */
(function (root) {
  'use strict';

  const MAX_DIMENSION = 800;
  const JPEG_QUALITY = 0.8;

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('이미지를 읽을 수 없습니다. 손상된 파일이 아닌지 확인해 주세요.'));
      };
      img.src = url;
    });
  }

  /** 파일을 검증한 뒤 축소된 JPEG data URL을 반환한다. 검증에 실패하면 Error를 던진다. */
  async function fileToResizedDataUrl(file) {
    const check = root.CareClosetLogic.validateImageFile(file);
    if (!check.valid) throw new Error(check.error);

    const img = await loadImage(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // 투명 PNG가 검게 저장되지 않도록 흰 배경을 깐다
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  }

  root.CareClosetImage = { fileToResizedDataUrl };
})(self);
