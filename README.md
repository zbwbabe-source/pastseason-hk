# 과시즌재고 대시보드

Hong Kong / Macau 재고 파일을 분석하는 과시즌재고 대시보드 웹 애플리케이션입니다.

## 기능

- **파일 업로드**: PY (Prior Year)와 CY (Current Year) CSV 파일을 브라우저에서 직접 업로드
- **데이터 전처리 및 정규화**: CSV 파일을 파싱하고 타입 변환
- **FX 정규화**: HK, MC, TW 통화 정규화
- **과시즌 FW 필터링**: 시즌별 재고 데이터 필터링
- **대시보드 표시**: Status (현황), Trend (추세), Plan (계획) 섹션

## 설치

```bash
npm install
```

## 실행

개발 서버 실행:

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` (또는 Vite가 제공하는 주소)를 열면 대시보드를 사용할 수 있습니다.

## 사용 방법

1. 웹 브라우저에서 애플리케이션을 엽니다
2. **Prior Year (PY) CSV 파일**을 업로드합니다
3. **Current Year (CY) CSV 파일**을 업로드합니다
4. 두 파일이 모두 업로드되면 자동으로 데이터가 분석되고 대시보드가 표시됩니다
5. "파일 변경" 버튼을 클릭하여 다른 파일로 변경할 수 있습니다

## CSV 파일 형식

CSV 파일은 다음 컬럼을 포함해야 합니다:

- period, Country, Ex-rate
- ITEM CODE, ITEM DESC1, ITEM DESC2
- STORE, STORE NAME
- SALES DIV, SEASON
- BRAND, BRAND NAME
- CATEGORY, CATEGORY NAME
- SUBCATEGORY, SUBCATEGORY NAME
- Sales (Qty), AC Sales (Qty), Stock (Qty)
- Net AcP.C, Net AcP.P
- AC Sales (Cost), AC Sales (Net Amount), AC Sales (Gross Sales)
- Gross Sales ($), Net Sales ($), COGS ($)
- Stock Cost ($), Stock Price ($)

## 기술 스택

- **React 18**: UI 라이브러리
- **TypeScript**: 타입 안전성
- **Tailwind CSS**: 스타일링
- **Vite**: 빌드 도구

## 빌드

프로덕션 빌드:

```bash
npm run build
```

빌드 미리보기:

```bash
npm run preview
```

## 표시 규칙

### YoY (Year-over-Year) 표시
- **형식**: 전년 대비 비율로 표시 (예: 110% = 전년 100, 당월 110)
- **소수점**: 소수점 없이 정수로 표시 (예: 110%, 95%)
- **전년 데이터 없음**: 3년차+ 항목은 전년 데이터가 없을 경우 "-"로 표시

### 할인율 증감
- **형식**: 퍼센트 포인트(pp) 변화로 표시 (예: +2.7%p, -1.5%p)
- **소수점**: 소수점 1자리까지 표시
- **전년 데이터 없음**: 3년차+ 항목은 전년 데이터가 없을 경우 "-"로 표시

### 재고 일수
- **계산 방식**: (재고원가 / COGS) × 30일
- **기준**: 1개월 판매 기준
- **표시**: 일 단위로 정수 표시 (예: 1371일)
- **재고원가**: Stock Cost ($), FX-normalized 값 사용
- **COGS**: COGS ($), FX-normalized 값 사용

## 라이선스

MIT
