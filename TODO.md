# Tae-hong 다음 버전 작업 목록

---

## 1. 상태값 체계 정비

현재 `status` 필드 값 → 아래 4단계로 통일

| 값 | 표시 | 색상 |
|---|---|---|
| `pending` | 대기 | 노랑 `#f59e0b` |
| `active` | 진행중 | 초록 `#10b981` |
| `force_stopped` | 강제종료 | 빨강 `#ef4444` |
| `ended` | 종료 | 회색 `#94a3b8` |

> 기존 `paused` → `force_stopped` 으로 마이그레이션 필요

**스니펫 — reception.html `renderStatus()`**
```js
const STATUS_MAP = {
  pending:       { label: '대기',     bg: '#fef3c7', color: '#d97706' },
  active:        { label: '진행중',   bg: '#d1fae5', color: '#059669' },
  force_stopped: { label: '강제종료', bg: '#fee2e2', color: '#dc2626' },
  ended:         { label: '종료',     bg: '#f1f5f9', color: '#64748b' },
};

function renderStatus(status) {
  const s = STATUS_MAP[status] || { label: status, bg: '#f1f5f9', color: '#94a3b8' };
  return `<span style="background:${s.bg};color:${s.color};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;">${s.label}</span>`;
}
```

---

## 2. 강제종료 실행 시 상태값 자동 변경 + 익일 종료

강제종료 서버(`macro-7-bizfit-stop`) 성공 응답 수신 후:
1. 해당 슬롯의 `status` → `force_stopped`
2. `endDate` → 내일 날짜로 자동 갱신

**스니펫 — 강제종료 완료 콜백 (reception.html)**
```js
// SSE entry_result 수신 후 처리
async function onBsEntrySuccess(mid) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10); // 'YYYY-MM-DD'

  // mid가 일치하는 active/pending 슬롯 전체에 적용
  const slots = await HA.getSlots();
  const targets = slots.filter(s => s.mid === mid && s.status !== 'ended');
  for (const s of targets) {
    await HA.updateSlot(s._key, {
      status:  'force_stopped',
      endDate: tomorrowStr,
    });
  }
}
```

**연결 위치**: `reception.html` 내 SSE `entry_result` 핸들러 안에서 `ok === true`일 때 호출

---

## 3. 엑셀 접수 — 검색키워드 컬럼 추가

### 컬럼 순서 (변경 후)
```
대행사 / 업체명 / URL / MID / 순위키워드 / 검색키워드 / 일수 / 시작일 / 일목표
```
인덱스: r[0]~r[8]

**스니펫 — `parseUexRows()` 수정**
```js
// 기존 r[5]=일수  →  r[5]=검색키워드, r[6]=일수, r[7]=시작일, r[8]=일목표
function parseUexRow(r) {
  return {
    agencyId:      (r[0] || '').toString().trim(),
    storeName:     (r[1] || '').toString().trim(),
    url:           (r[2] || '').toString().trim(),
    mid:           (r[3] || '').toString().trim(),
    rankKeyword:   (r[4] || '').toString().trim(),
    searchKeyword: (r[5] || '').toString().trim(),   // ← 신규
    days:          Number(r[6]) || 0,
    startDate:     fmtDate(r[7]),
    dailyTarget:   Number(r[8]) || 0,
  };
}
```

**스니펫 — 양식 다운로드 헤더 수정 (`downloadUexTemplate`)**
```js
const header = ['대행사','업체명','URL','MID','순위키워드','검색키워드','일수','시작일','일목표'];
```

**스니펫 — 미리보기 테이블 헤더 수정**
```html
<th>순위키워드</th>
<th>검색키워드</th>   <!-- ← 추가 -->
<th style="width:50px">일수</th>
```

---

## 4. 캠페인 타입/상세 — 이전 키워드 불러오기

동일 MID의 가장 최근 슬롯에서 `rankKeyword` / `searchKeyword` / `dailyTarget` 을 자동으로 가져와 폼에 채워주는 기능.

**스니펫 — `loadPrevKeywords(mid)` (reception.html)**
```js
async function loadPrevKeywords(mid) {
  const slots = await HA.getSlots(); // 최신순 정렬됨
  const prev  = slots.find(s => s.mid === mid && s.rankKeyword);
  if (!prev) return null;
  return {
    rankKeyword:   prev.rankKeyword   || '',
    searchKeyword: prev.searchKeyword || '',
    dailyTarget:   prev.dailyTarget   || 0,
  };
}

// 사용 예: MID 입력 blur 이벤트
midInput.addEventListener('blur', async () => {
  const data = await loadPrevKeywords(midInput.value.trim());
  if (!data) return;
  if (!rankKeywordInput.value) rankKeywordInput.value = data.rankKeyword;
  if (!searchKeywordInput.value) searchKeywordInput.value = data.searchKeyword;
  if (!dailyTargetInput.value)  dailyTargetInput.value  = data.dailyTarget;
});
```

**적용 위치**: 수동 접수 폼 + 엑셀 접수 미리보기(동일 MID가 이미 있으면 행마다 배지 표시)

---

*마지막 업데이트: 2026-06-26*
