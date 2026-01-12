import { InventoryRowRaw, InventoryRow, SeasonInfo, SeasonType, YearBucket, SourceYearType, GraphDataRowRaw, GraphDataRow } from './types';

/**
 * CSV 파일에서 숫자 값을 안전하게 파싱
 */
function parseNumber(value: string | null | undefined): number {
  if (!value) return 0;
  const cleaned = value.trim().replace(/,/g, '').replace(/\s+/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * CSV 파일에서 문자열 값을 안전하게 파싱
 */
function parseString(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/**
 * CSV 파일의 원시 데이터를 InventoryRowRaw로 변환
 */
export function parseCSVRow(row: Record<string, string>, sourceYearType: SourceYearType): InventoryRowRaw {
  const country = parseString(row['Country']).toUpperCase();
  
  return {
    period: parseString(row['period']),
    country: country,
    exRate: parseNumber(row['Ex-rate']),

    itemCode: parseString(row['ITEM CODE']),
    itemDesc1: parseString(row['ITEM DESC1']),
    itemDesc2: parseString(row['ITEM DESC2']) || null,

    storeCode: parseString(row['STORE']),
    storeName: parseString(row['STORE NAME']),

    salesDiv: parseString(row['SALES DIV']),
    season: parseString(row['SEASON']),

    brand: parseString(row['BRAND']),
    brandName: parseString(row['BRAND NAME']),

    category: parseString(row['CATEGORY']),
    categoryName: parseString(row['CATEGORY NAME']),
    subcategory: parseString(row['SUBCATEGORY']),
    subcategoryName: parseString(row['SUBCATEGORY NAME']),

    salesQty: parseNumber(row['Sales (Qty)']),
    acSalesQty: parseNumber(row['AC Sales (Qty)']),
    stockQty: parseNumber(row['Stock (Qty)']),

    netAcPC: parseNumber(row['Net AcP.C']),
    netAcPP: parseNumber(row['Net AcP.P']),

    acSalesCost: parseNumber(
      row['AC Sales\n(Cost)'] || 
      row['AC Sales (Cost)'] ||
      row['AC Sales\r\n(Cost)']
    ),
    acSalesNetAmount: parseNumber(
      row['AC Sales\n(Net Amount)'] || 
      row['AC Sales (Net Amount)'] ||
      row['AC Sales\r\n(Net Amount)']
    ),
    acSalesGross: parseNumber(
      row['AC Sales\n(Gross Sales)'] || 
      row['AC Sales (Gross Sales)'] ||
      row['AC Sales\r\n(Gross Sales)']
    ),

    grossSalesMonth: parseNumber(row['Gross Sales ($)']),
    netSalesMonth: parseNumber(row['Net Sales ($)']),
    cogsMonth: parseNumber(row['COGS ($)']),

    stockCost: parseNumber(row['Stock Cost ($)']),
    stockPriceTag: parseNumber(row['Stock Price ($)']),

    sourceYearType: sourceYearType,
  };
}

/**
 * 시즌 코드 파싱
 */
export function parseSeason(seasonCodeRaw: string | null | undefined, currentFwYear: number = 25): SeasonInfo {
  const seasonCode = (seasonCodeRaw ?? '').trim();
  if (!seasonCode) {
    return {
      seasonCode: '',
      seasonType: 'OTHER',
      seasonYear: null,
      yearBucket: 'InSeason',
    };
  }

  const suffix = seasonCode.slice(-1);
  const yearPart = seasonCode.slice(0, -1);
  const year = /^\d+$/.test(yearPart) ? parseInt(yearPart, 10) : null;

  let seasonType: SeasonType = 'OTHER';
  if (suffix === 'F') seasonType = 'FW';
  else if (suffix === 'S') seasonType = 'S';
  else if (suffix === 'N') seasonType = 'ACC';

  let yearBucket: YearBucket = 'InSeason';
  if (seasonType === 'FW' && year !== null) {
    const diff = currentFwYear - year;
    if (diff <= 0) {
      yearBucket = 'InSeason';
    } else if (diff === 1) {
      yearBucket = 'Y1';
    } else if (diff === 2) {
      yearBucket = 'Y2';
    } else {
      yearBucket = 'Y3Plus';
    }
  } else {
    yearBucket = 'InSeason';
  }

  return {
    seasonCode,
    seasonType,
    seasonYear: year,
    yearBucket,
  };
}

/**
 * FX 정규화 적용
 */
export function applyFxNormalization(row: InventoryRowRaw, seasonInfo: SeasonInfo): InventoryRow {
  const country = row.country;
  let fxRate = 1;
  
  if (country === 'HK') {
    fxRate = 1;
  } else if (country === 'MC') {
    fxRate = 1.03;
  } else if (country === 'TW') {
    fxRate = 4.02;
  }

  // MC와 TW는 모두 FX 조정 적용 (HK는 원본 그대로)
  const applyFx = (value: number): number => {
    if (country === 'HK') return value;
    return value / fxRate;
  };

  const grossSalesFx = applyFx(row.grossSalesMonth);
  const netSalesFx = applyFx(row.netSalesMonth);
  const stockPriceFx = applyFx(row.stockPriceTag);
  const stockCostFx = applyFx(row.stockCost);
  const acSalesGrossFx = applyFx(row.acSalesGross);
  const netAcPPFx = applyFx(row.netAcPP);
  const acSalesCostFx = applyFx(row.acSalesCost);
  const acSalesNetAmountFx = applyFx(row.acSalesNetAmount);
  const cogsFx = applyFx(row.cogsMonth);

  const discountRateMonth = grossSalesFx > 0 ? 1 - (netSalesFx / grossSalesFx) : null;

  return {
    ...row,
    fxRate,
    grossSalesFx,
    netSalesFx,
    stockPriceFx,
    stockCostFx,
    acSalesGrossFx,
    netAcPPFx,
    acSalesCostFx,
    acSalesNetAmountFx,
    cogsFx,
    discountRateMonth,
    seasonInfo,
  };
}

/**
 * OFF-SEASON FW 필터링
 * FW 시즌이면서 Y1, Y2, Y3Plus인 경우만 포함
 * ACC(N)과 S시즌(S)은 제외
 */
export function isOffSeasonFW(row: InventoryRow | { seasonInfo: SeasonInfo }): boolean {
  const info = row.seasonInfo;
  return (
    info.seasonType === 'FW' &&
    (info.yearBucket === 'Y1' || info.yearBucket === 'Y2' || info.yearBucket === 'Y3Plus')
  );
}

/**
 * CSV 행 파싱 (쌍따옴표 처리)
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = i < line.length - 1 ? line[i + 1] : '';

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // 이스케이프된 따옴표
        currentValue += '"';
        i++; // 다음 문자 건너뛰기
      } else {
        // 따옴표 시작/종료
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  values.push(currentValue.trim());
  return values;
}

/**
 * CSV 텍스트를 파싱하여 객체 배열로 변환
 * 헤더가 여러 줄에 걸쳐 있는 경우 처리
 */
export function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  // 헤더가 여러 줄에 걸쳐 있는 경우를 처리
  // 첫 줄부터 시작하여 쌍따옴표가 닫힐 때까지 합침
  let headerEndIndex = 1;
  let headerLines = [lines[0]];
  let inQuotes = false;
  
  // 첫 줄에서 따옴표 상태 확인
  for (let i = 0; i < lines[0].length; i++) {
    if (lines[0][i] === '"' && (i === 0 || lines[0][i - 1] !== '"')) {
      inQuotes = !inQuotes;
    }
  }
  
  // 따옴표가 닫히지 않았으면 다음 줄들을 합침
  let currentLineIndex = 1;
  while (inQuotes && currentLineIndex < lines.length && currentLineIndex < 5) {
    headerLines.push(lines[currentLineIndex]);
    for (let i = 0; i < lines[currentLineIndex].length; i++) {
      if (lines[currentLineIndex][i] === '"' && (i === 0 || lines[currentLineIndex][i - 1] !== '"')) {
        inQuotes = !inQuotes;
      }
    }
    currentLineIndex++;
    headerEndIndex = currentLineIndex;
  }
  
  // 헤더 라인들을 합치기 (줄바꿈을 공백으로)
  const combinedHeader = headerLines.join(' ');
  
  // 헤더 파싱
  const headers = parseCSVLine(combinedHeader);
  
  // 헤더 정리: 따옴표 제거 및 공백 정리
  const cleanedHeaders = headers.map(h => {
    let cleaned = h.trim();
    // 앞뒤 따옴표 제거
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1);
    }
    // 내부 줄바꿈을 공백으로
    cleaned = cleaned.replace(/\r?\n/g, ' ').trim();
    return cleaned;
  });

  // 데이터 파싱
  const rows: Record<string, string>[] = [];
  for (let i = headerEndIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    
    // 헤더 수와 값 수가 다르면 건너뛰기 (마지막 값이 비어있을 수 있음)
    if (values.length >= cleanedHeaders.length - 1) {
      const row: Record<string, string> = {};
      cleanedHeaders.forEach((header, index) => {
        row[header] = values[index] ?? '';
      });
      rows.push(row);
    }
  }

  return rows;
}

/**
 * CSV 파일 로드 및 변환
 */
export async function loadCSVFile(filePath: string): Promise<string> {
  const response = await fetch(filePath);
  if (!response.ok) {
    throw new Error(`Failed to load CSV file: ${filePath}`);
  }
  return await response.text();
}

/**
 * 두 CSV 파일을 로드하고 정규화된 데이터로 변환
 */
export async function loadAndNormalizeData(
  pyFilePath: string,
  cyFilePath: string,
  currentFwYear: number = 25
): Promise<InventoryRow[]> {
  const [pyCsv, cyCsv] = await Promise.all([
    loadCSVFile(pyFilePath),
    loadCSVFile(cyFilePath),
  ]);

  const pyRows = parseCSV(pyCsv);
  const cyRows = parseCSV(cyCsv);

  const allRows: InventoryRow[] = [];

  // PY 데이터 처리
  for (const row of pyRows) {
    try {
      const raw = parseCSVRow(row, 'PY');
      const seasonInfo = parseSeason(raw.season, currentFwYear);
      const normalized = applyFxNormalization(raw, seasonInfo);
      allRows.push(normalized);
    } catch (error) {
      console.warn('Error parsing PY row:', error, row);
    }
  }

  // CY 데이터 처리
  for (const row of cyRows) {
    try {
      const raw = parseCSVRow(row, 'CY');
      const seasonInfo = parseSeason(raw.season, currentFwYear);
      const normalized = applyFxNormalization(raw, seasonInfo);
      allRows.push(normalized);
    } catch (error) {
      console.warn('Error parsing CY row:', error, row);
    }
  }

  return allRows;
}

/**
 * 그래프용 CSV 파일의 원시 데이터를 GraphDataRowRaw로 변환
 */
export function parseGraphCSVRow(row: Record<string, string>): GraphDataRowRaw {
  return {
    Period: parseString(row['Period']),
    Year: parseString(row['Year']),
    Season_Code: parseString(row['Season_Code']),
    Gross_Sales: parseNumber(row['Gross_Sales']),
    Net_Sales: parseNumber(row['Net_Sales']),
    Stock_Price: parseNumber(row['Stock_Price']),
    Stock_Cost: parseNumber(row['Stock_Cost']),
    Country: parseString(row['Country']).toUpperCase(),
  };
}

/**
 * 그래프용 CSV 데이터를 FX 정규화하고 시즌 정보를 추가하여 GraphDataRow로 변환
 * 
 * 중요: 전년(2024년) 데이터는 currentFwYear=24로, 당년(2025년) 데이터는 currentFwYear=25로 파싱
 * - 2024년 데이터: 24F=당시즌, 23F=과시즌1년차, 22F=과시즌2년차, 21F~=과시즌3년차~
 * - 2025년 데이터: 25F=당시즌, 24F=과시즌1년차, 23F=과시즌2년차, 22F~=과시즌3년차~
 */
export function normalizeGraphDataRow(raw: GraphDataRowRaw): GraphDataRow {
  const country = raw.Country;
  
  // Period에서 연도 추론: "2406" -> 2024, "2506" -> 2025
  // Period가 더 정확하므로 Period를 우선 사용
  const periodYear = parseInt(raw.Period.substring(0, 2), 10);
  let year: number;
  if (periodYear >= 24 && periodYear <= 99) {
    year = 2000 + periodYear;
  } else if (periodYear >= 0 && periodYear < 24) {
    year = 2000 + periodYear;
  } else {
    // Period 파싱 실패 시 Year 컬럼 사용
    year = parseInt(raw.Year, 10);
    if (isNaN(year) || year === 0) {
      year = 2025; // 기본값
    }
  }
  
  // Period 기반으로 currentFwYear 결정
  // Period가 2406~2412 (2024년)이면 currentFwYear = 24
  // Period가 2506~2512 (2025년)이면 currentFwYear = 25
  // 전년(2024년) 기준: 24F=당시즌, 23F=과시즌1년차, 22F=과시즌2년차, 21F~=과시즌3년차~
  // 당년(2025년) 기준: 25F=당시즌, 24F=과시즌1년차, 23F=과시즌2년차, 22F~=과시즌3년차~
  const currentFwYear = periodYear === 24 ? 24 : 25;
  
  // FX 정규화
  let fxRate = 1;
  if (country === 'HK') {
    fxRate = 1;
  } else if (country === 'MC') {
    fxRate = 1.03;
  } else if (country === 'TW') {
    fxRate = 4.02;
  }
  
  const applyFx = (value: number): number => {
    if (country === 'HK') return value;
    return value / fxRate;
  };
  
  // 택가매출 기준: Gross_Sales (택가매출)
  const grossSalesFx = applyFx(raw.Gross_Sales);
  const netSalesFx = applyFx(raw.Net_Sales);
  const stockPriceFx = applyFx(raw.Stock_Price);
  const stockCostFx = applyFx(raw.Stock_Cost);
  
  // 시즌 정보 파싱 (Year 기준으로 currentFwYear 적용)
  const seasonInfo = parseSeason(raw.Season_Code, currentFwYear);
  
  // 할인율 계산
  const discountRate = grossSalesFx > 0 ? 1 - (netSalesFx / grossSalesFx) : null;
  
  return {
    ...raw,
    period: raw.Period,
    year: year,
    seasonCode: raw.Season_Code,
    grossSalesFx, // 택가매출 (FX 정규화)
    netSalesFx,
    stockPriceFx,
    stockCostFx,
    country: country,
    seasonInfo,
    discountRate,
  };
}

/**
 * 그래프용 CSV 파일 파싱 및 정규화
 */
export function parseGraphCSV(csvText: string): GraphDataRow[] {
  const rows = parseCSV(csvText);
  const graphData: GraphDataRow[] = [];
  
  for (const row of rows) {
    try {
      const raw = parseGraphCSVRow(row);
      const normalized = normalizeGraphDataRow(raw);
      graphData.push(normalized);
    } catch (error) {
      console.warn('Error parsing graph CSV row:', error, row);
    }
  }
  
  return graphData;
}

/**
 * 과시즌 목표 CSV 파일의 원시 데이터를 TargetDataRowRaw로 변환
 */
import type { TargetDataRowRaw, TargetDataRow } from './types';

export function parseTargetCSVRow(row: Record<string, string>): TargetDataRowRaw {
  return {
    PERIOD: parseString(row['PERIOD']),
    SEASON_NAME: parseString(row['SEASON_NAME']),
    SEASON: parseString(row['SEASON']),
    CATEGORY: parseString(row['CATEGORY']),
    AMOUNT: parseNumber(row['AMOUNT']),
  };
}

/**
 * 과시즌 목표 CSV 데이터를 정규화하여 TargetDataRow로 변환
 */
export function normalizeTargetDataRow(raw: TargetDataRowRaw, currentFwYear: number = 25): TargetDataRow {
  // Season 코드에서 시즌 정보 추출 (예: "22FW" -> seasonInfo)
  const seasonInfo = parseSeason(raw.SEASON, currentFwYear);
  
  return {
    period: raw.PERIOD,
    seasonName: raw.SEASON_NAME,
    season: raw.SEASON,
    category: raw.CATEGORY,
    amount: raw.AMOUNT,
    seasonInfo,
  };
}

/**
 * 과시즌 목표 CSV 파일을 파싱하고 정규화
 */
export async function parseTargetCSV(csvText: string, currentFwYear: number = 25): Promise<TargetDataRow[]> {
  const rows = parseCSV(csvText);
  const result: TargetDataRow[] = [];

  for (const row of rows) {
    try {
      const raw = parseTargetCSVRow(row);
      const normalized = normalizeTargetDataRow(raw, currentFwYear);
      result.push(normalized);
    } catch (error) {
      console.warn('Error parsing target row:', error, row);
    }
  }

  return result;
}
