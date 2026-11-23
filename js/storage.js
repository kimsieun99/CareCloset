/**
 * 브라우저 저장소(IndexedDB) 접근 모듈
 *
 * LocalStorage는 용량이 약 5MB라 사진을 여러 장 저장하기 어렵다.
 * IndexedDB는 훨씬 큰 용량을 쓸 수 있고 새로고침 후에도 데이터가 유지되어 이를 선택했다. (NFR-04)
 */
(function (root) {
  'use strict';

  const DB_NAME = 'CareClosetDB';
  const DB_VERSION = 1;
  const STORE = 'clothes';

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) {
        reject(new Error('이 브라우저는 데이터 저장(IndexedDB)을 지원하지 않습니다.'));
        return;
      }
      const request = root.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('저장소를 열 수 없습니다.'));
    });
  }

  /** 하나의 트랜잭션 안에서 작업을 실행한다. action(store)가 반환한 request의 결과를 돌려준다. */
  async function withStore(mode, action) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => { db.close(); resolve(request ? request.result : undefined); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error || new Error('저장 공간이 부족할 수 있습니다.')); };
    });
  }

  root.CareClosetStorage = {
    getAll: () => withStore('readonly', (store) => store.getAll()),
    save: (item) => withStore('readwrite', (store) => store.put(item)),
    saveMany: (items) => withStore('readwrite', (store) => { items.forEach((item) => store.put(item)); }),
    remove: (id) => withStore('readwrite', (store) => store.delete(id)),
  };
})(self);
