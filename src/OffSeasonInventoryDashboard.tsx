import { useEffect, useState, useMemo } from 'react';
import { isOffSeasonFW, parseCSV, parseCSVRow, parseSeason, applyFxNormalization, parseGraphCSV, parseTargetCSV } from './utils';
import { InventoryRow, YearBucket, GraphDataRow, TargetDataRow } from './types';
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';

type Props = {
  pyFilePath?: string;
  cyFilePath?: string;
  pyRowsRaw?: Record<string, string>[];
  cyRowsRaw?: Record<string, string>[];
  currentFwYear?: number;
};

/**
 * 숫자 포맷팅 (K 단위)
 */
function formatNumberK(value: number): string {
  const kValue = Math.round(value / 1000);
  if (kValue >= 1000) {
    const mValue = (kValue / 1000).toFixed(1);
    return `${mValue}M`;
  }
  return `${kValue.toLocaleString('ko-KR')}K`;
}

/**
 * 숫자 포맷팅 (일반)
 */
function formatNumber(value: number): string {
  if (value >= 1000) {
    return value.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
  }
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

/**
 * 퍼센트 포맷팅
 */
function formatPercent(value: number): string {
  return value.toFixed(1) + '%';
}

/**
 * YoY 비율 포맷팅 (전년 대비 비율) - 예: 110% (전년 100, 당월 110)
 * 소수점 없이 정수로 표시
 */
function formatPercentRatio(value: number | null): string {
  if (value === null || isNaN(value)) {
    return '-';
  }
  return `${Math.round(value)}%`;
}

/**
 * 퍼센트 포인트 포맷팅
 */
function formatPercentPoint(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%p`;
}

/**
 * 오프시즌 FW 재고 대시보드
 */
export function OffSeasonInventoryDashboard({
  pyFilePath,
  cyFilePath,
  pyRowsRaw,
  cyRowsRaw,
  currentFwYear = 25,
}: Props) {
  const [data, setData] = useState<InventoryRow[]>([]);
  const [graphData, setGraphData] = useState<GraphDataRow[]>([]);
  const [targetData, setTargetData] = useState<TargetDataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        let allRows: InventoryRow[] = [];

        if (pyRowsRaw && cyRowsRaw) {
          // 이미 파싱된 데이터 사용
          // PY는 baseYear=24, CY는 baseYear=25 사용
          for (const row of pyRowsRaw) {
            try {
              const raw = parseCSVRow(row, 'PY');
              const seasonInfo = parseSeason(raw.season, 24); // PY는 24년 기준
              const normalized = applyFxNormalization(raw, seasonInfo);
              allRows.push(normalized);
            } catch (err) {
              console.warn('Error parsing PY row:', err);
            }
          }

          for (const row of cyRowsRaw) {
            try {
              const raw = parseCSVRow(row, 'CY');
              const seasonInfo = parseSeason(raw.season, 25); // CY는 25년 기준
              const normalized = applyFxNormalization(raw, seasonInfo);
              allRows.push(normalized);
            } catch (err) {
              console.warn('Error parsing CY row:', err);
            }
          }
        } else if (pyFilePath && cyFilePath) {
          // CSV 파일 로드
          const [pyCsv, cyCsv] = await Promise.all([
            fetch(pyFilePath).then(r => r.text()),
            fetch(cyFilePath).then(r => r.text()),
          ]);

          const pyParsed = parseCSV(pyCsv);
          const cyParsed = parseCSV(cyCsv);

          for (const row of pyParsed) {
            try {
              const raw = parseCSVRow(row, 'PY');
              const seasonInfo = parseSeason(raw.season, 24); // PY는 24년 기준
              const normalized = applyFxNormalization(raw, seasonInfo);
              allRows.push(normalized);
            } catch (err) {
              console.warn('Error parsing PY row:', err);
            }
          }

          for (const row of cyParsed) {
            try {
              const raw = parseCSVRow(row, 'CY');
              const seasonInfo = parseSeason(raw.season, 25); // CY는 25년 기준
              const normalized = applyFxNormalization(raw, seasonInfo);
              allRows.push(normalized);
            } catch (err) {
              console.warn('Error parsing CY row:', err);
            }
          }
        } else {
          // 파일이 없으면 빈 데이터로 설정 (로딩 상태 해제)
          setData([]);
          setLoading(false);
          return;
        }

        setData(allRows);
        console.log('Total rows loaded:', allRows.length);
        if (allRows.length > 0) {
          console.log('Sample row:', allRows[0]);
          console.log('Sample season:', allRows[0].season);
          console.log('Sample seasonInfo:', allRows[0].seasonInfo);
          console.log('Sample country:', allRows[0].country);
          console.log('Sample grossSalesFx:', allRows[0].grossSalesFx);
          console.log('Sample stockPriceFx:', allRows[0].stockPriceFx);
        }

        // 그래프용 CSV 파일 로드
        try {
          const graphCsvPath = '/HKMC_Inventory Graph_2512.csv';
          const graphCsvResponse = await fetch(graphCsvPath);
          if (graphCsvResponse.ok) {
            const graphCsvText = await graphCsvResponse.text();
            const parsedGraphData = parseGraphCSV(graphCsvText);
            setGraphData(parsedGraphData);
            console.log('Graph data loaded:', parsedGraphData.length, 'rows');
          } else {
            console.warn('그래프 CSV 파일을 찾을 수 없습니다:', graphCsvPath);
            setGraphData([]);
          }
        } catch (err) {
          console.warn('그래프 CSV 파일 로드 실패:', err);
          setGraphData([]);
        }
        
        // 목표 CSV 파일 로드
        try {
          const targetCsvPath = '/hkmc_past_season_target.csv';
          const targetCsvResponse = await fetch(targetCsvPath);
          if (targetCsvResponse.ok) {
            const targetCsvText = await targetCsvResponse.text();
            const parsedTargetData = await parseTargetCSV(targetCsvText, 25);
            setTargetData(parsedTargetData);
            console.log('Target data loaded:', parsedTargetData.length, 'rows');
          } else {
            console.warn('목표 CSV 파일을 찾을 수 없습니다:', targetCsvPath);
            setTargetData([]);
          }
        } catch (err) {
          console.warn('목표 CSV 파일 로드 실패:', err);
          setTargetData([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [pyFilePath, cyFilePath, pyRowsRaw, cyRowsRaw, currentFwYear]);

  // 필터링: HK, MC만 포함하고 OFF-SEASON FW만 포함
  const filteredData = useMemo(() => {
    const filtered = data.filter(row => {
      const isHKorMC = row.country === 'HK' || row.country === 'MC';
      const isOffSeason = isOffSeasonFW(row);
      return isHKorMC && isOffSeason;
    });
    
    // 디버깅 로그
    console.log('=== 데이터 필터링 디버깅 ===');
    console.log('Total data rows:', data.length);
    console.log('Filtered data rows:', filtered.length);
    console.log('CY rows:', filtered.filter(r => r.sourceYearType === 'CY').length);
    console.log('PY rows:', filtered.filter(r => r.sourceYearType === 'PY').length);
    
    if (filtered.length > 0) {
      console.log('Sample filtered row:', filtered[0]);
      console.log('Sample season info:', filtered[0].seasonInfo);
      console.log('Sample grossSalesFx:', filtered[0].grossSalesFx);
      console.log('Sample stockPriceFx:', filtered[0].stockPriceFx);
      console.log('Sample cogsFx:', filtered[0].cogsFx);
    } else {
      // 필터링 후 데이터가 없을 때 원인 분석
      const hkOrMcRows = data.filter(r => r.country === 'HK' || r.country === 'MC');
      console.log('HK/MC rows:', hkOrMcRows.length);
      const fwRows = data.filter(r => r.seasonInfo.seasonType === 'FW');
      console.log('FW rows:', fwRows.length);
      const offSeasonRows = data.filter(isOffSeasonFW);
      console.log('Off-season FW rows (all countries):', offSeasonRows.length);
      
      if (hkOrMcRows.length > 0) {
        console.log('Sample HK/MC row season:', hkOrMcRows[0].season);
        console.log('Sample HK/MC row seasonInfo:', hkOrMcRows[0].seasonInfo);
      }
    }
    
    // 국가별 통계
    const countryStats = data.reduce((acc, row) => {
      acc[row.country] = (acc[row.country] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('Country distribution:', countryStats);
    
    // 시즌별 통계 (상위 10개)
    const seasonStats = data.reduce((acc, row) => {
      const key = `${row.seasonInfo.seasonType}-${row.seasonInfo.yearBucket}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const sortedSeasonStats = Object.entries(seasonStats).sort((a: [string, number], b: [string, number]) => b[1] - a[1]).slice(0, 10);
    console.log('Season distribution (top 10):', sortedSeasonStats);
    
    return filtered;
  }, [data]);

  // CY 데이터
  const cyOffSeasonFW = filteredData.filter(row => row.sourceYearType === 'CY');
  const pyOffSeasonFW = filteredData.filter(row => row.sourceYearType === 'PY');

  // 메트릭 계산
  // 2-1) 판매 (Sales) - Gross Sales FX-normalized
  const cySales = cyOffSeasonFW.reduce((sum, row) => sum + row.grossSalesFx, 0);
  const pySales = pyOffSeasonFW.reduce((sum, row) => sum + row.grossSalesFx, 0);
  // YoY 비율 계산: (cy / py) * 100 (예: 전년 100, 당월 110이면 110%)
  const salesYoyRatio = pySales > 0 ? (cySales / pySales) * 100 : null;

  // 연차별 판매금액 계산 (CY)
  const cySalesByYear = cyOffSeasonFW.reduce((acc, row) => {
    const bucket = row.seasonInfo.yearBucket;
    if (bucket === 'Y1' || bucket === 'Y2' || bucket === 'Y3Plus') {
      acc[bucket] = (acc[bucket] || 0) + row.grossSalesFx;
    }
    return acc;
  }, {} as Record<string, number>);

  // 연차별 판매금액 계산 (PY)
  const pySalesByYear = pyOffSeasonFW.reduce((acc, row) => {
    const bucket = row.seasonInfo.yearBucket;
    if (bucket === 'Y1' || bucket === 'Y2' || bucket === 'Y3Plus') {
      acc[bucket] = (acc[bucket] || 0) + row.grossSalesFx;
    }
    return acc;
  }, {} as Record<string, number>);

  const cyY1Sales = cySalesByYear['Y1'] || 0;
  const cyY2Sales = cySalesByYear['Y2'] || 0;
  const cyY3PlusSales = cySalesByYear['Y3Plus'] || 0;
  const pyY1Sales = pySalesByYear['Y1'] || 0;
  const pyY2Sales = pySalesByYear['Y2'] || 0;
  const pyY3PlusSales = pySalesByYear['Y3Plus'] || 0;

  // YoY 비율 계산: (cy / py) * 100 (예: 전년 100, 당월 110이면 110%)
  const y1SalesYoyRatio = pyY1Sales > 0 ? (cyY1Sales / pyY1Sales) * 100 : null;
  const y2SalesYoyRatio = pyY2Sales > 0 ? (cyY2Sales / pyY2Sales) * 100 : null;
  const y3PlusSalesYoyRatio = pyY3PlusSales > 0 ? (cyY3PlusSales / pyY3PlusSales) * 100 : null;

  // 2-2) 할인율 (Discount Rate)
  const cyGross = cyOffSeasonFW.reduce((sum, row) => sum + row.grossSalesFx, 0);
  const cyNet = cyOffSeasonFW.reduce((sum, row) => sum + row.netSalesFx, 0);
  const pyGross = pyOffSeasonFW.reduce((sum, row) => sum + row.grossSalesFx, 0);
  const pyNet = pyOffSeasonFW.reduce((sum, row) => sum + row.netSalesFx, 0);
  const cyDiscount = cyGross > 0 ? (1 - cyNet / cyGross) * 100 : 0;
  const pyDiscount = pyGross > 0 ? (1 - pyNet / pyGross) * 100 : 0;
  const discountDiffPp = cyDiscount - pyDiscount;

  // 연차별 할인율 계산 (CY)
  const cyGrossByYear = cyOffSeasonFW.reduce((acc, row) => {
    const bucket = row.seasonInfo.yearBucket;
    if (bucket === 'Y1' || bucket === 'Y2' || bucket === 'Y3Plus') {
      acc[bucket] = (acc[bucket] || 0) + row.grossSalesFx;
    }
    return acc;
  }, {} as Record<string, number>);

  const cyNetByYear = cyOffSeasonFW.reduce((acc, row) => {
    const bucket = row.seasonInfo.yearBucket;
    if (bucket === 'Y1' || bucket === 'Y2' || bucket === 'Y3Plus') {
      acc[bucket] = (acc[bucket] || 0) + row.netSalesFx;
    }
    return acc;
  }, {} as Record<string, number>);

  // 연차별 할인율 계산 (PY)
  const pyGrossByYear = pyOffSeasonFW.reduce((acc, row) => {
    const bucket = row.seasonInfo.yearBucket;
    if (bucket === 'Y1' || bucket === 'Y2' || bucket === 'Y3Plus') {
      acc[bucket] = (acc[bucket] || 0) + row.grossSalesFx;
    }
    return acc;
  }, {} as Record<string, number>);

  const pyNetByYear = pyOffSeasonFW.reduce((acc, row) => {
    const bucket = row.seasonInfo.yearBucket;
    if (bucket === 'Y1' || bucket === 'Y2' || bucket === 'Y3Plus') {
      acc[bucket] = (acc[bucket] || 0) + row.netSalesFx;
    }
    return acc;
  }, {} as Record<string, number>);

  const cyY1Gross = cyGrossByYear['Y1'] || 0;
  const cyY1Net = cyNetByYear['Y1'] || 0;
  const cyY2Gross = cyGrossByYear['Y2'] || 0;
  const cyY2Net = cyNetByYear['Y2'] || 0;
  const cyY3PlusGross = cyGrossByYear['Y3Plus'] || 0;
  const cyY3PlusNet = cyNetByYear['Y3Plus'] || 0;

  const pyY1Gross = pyGrossByYear['Y1'] || 0;
  const pyY1Net = pyNetByYear['Y1'] || 0;
  const pyY2Gross = pyGrossByYear['Y2'] || 0;
  const pyY2Net = pyNetByYear['Y2'] || 0;
  const pyY3PlusGross = pyGrossByYear['Y3Plus'] || 0;
  const pyY3PlusNet = pyNetByYear['Y3Plus'] || 0;

  const cyY1Discount = cyY1Gross > 0 ? (1 - cyY1Net / cyY1Gross) * 100 : 0;
  const pyY1Discount = pyY1Gross > 0 ? (1 - pyY1Net / pyY1Gross) * 100 : 0;
  const y1DiscountDiffPp = cyY1Discount - pyY1Discount;

  const cyY2Discount = cyY2Gross > 0 ? (1 - cyY2Net / cyY2Gross) * 100 : 0;
  const pyY2Discount = pyY2Gross > 0 ? (1 - pyY2Net / pyY2Gross) * 100 : 0;
  const y2DiscountDiffPp = cyY2Discount - pyY2Discount;

  const cyY3PlusDiscount = cyY3PlusGross > 0 ? (1 - cyY3PlusNet / cyY3PlusGross) * 100 : 0;
  const pyY3PlusDiscount = pyY3PlusGross > 0 ? (1 - pyY3PlusNet / pyY3PlusGross) * 100 : 0;
  // 3년차는 전년 데이터가 없으면 null
  const y3PlusDiscountDiffPp = pyY3PlusGross > 0 ? (cyY3PlusDiscount - pyY3PlusDiscount) : null;

  // 2-3) 기말 (Ending Stock) - Stock Price FX-normalized
  const cyStock = cyOffSeasonFW.reduce((sum, row) => sum + row.stockPriceFx, 0);
  const pyStock = pyOffSeasonFW.reduce((sum, row) => sum + row.stockPriceFx, 0);
  // YoY 비율 계산: (cy / py) * 100 (예: 전년 100, 당월 110이면 110%)
  const stockYoyRatio = pyStock > 0 ? (cyStock / pyStock) * 100 : null;

  // 연차별 기말 재고 계산 (CY)
  const cyStockByYear = cyOffSeasonFW.reduce((acc, row) => {
    const bucket = row.seasonInfo.yearBucket;
    if (bucket === 'Y1' || bucket === 'Y2' || bucket === 'Y3Plus') {
      acc[bucket] = (acc[bucket] || 0) + row.stockPriceFx;
    }
    return acc;
  }, {} as Record<string, number>);

  // 연차별 기말 재고 계산 (PY)
  const pyStockByYear = pyOffSeasonFW.reduce((acc, row) => {
    const bucket = row.seasonInfo.yearBucket;
    if (bucket === 'Y1' || bucket === 'Y2' || bucket === 'Y3Plus') {
      acc[bucket] = (acc[bucket] || 0) + row.stockPriceFx;
    }
    return acc;
  }, {} as Record<string, number>);

  const cyY1Stock = cyStockByYear['Y1'] || 0;
  const cyY2Stock = cyStockByYear['Y2'] || 0;
  const cyY3PlusStock = cyStockByYear['Y3Plus'] || 0;
  const pyY1Stock = pyStockByYear['Y1'] || 0;
  const pyY2Stock = pyStockByYear['Y2'] || 0;
  const pyY3PlusStock = pyStockByYear['Y3Plus'] || 0;

  // YoY 비율 계산: (cy / py) * 100 (예: 전년 100, 당월 110이면 110%)
  const y1StockYoyRatio = pyY1Stock > 0 ? (cyY1Stock / pyY1Stock) * 100 : null;
  const y2StockYoyRatio = pyY2Stock > 0 ? (cyY2Stock / pyY2Stock) * 100 : null;
  const y3PlusStockYoyRatio = pyY3PlusStock > 0 ? (cyY3PlusStock / pyY3PlusStock) * 100 : null;

  // 2-4) 재고 일수 (Inventory Days) - stockCostFx 사용
  const cyStockCost = cyOffSeasonFW.reduce((sum, row) => sum + row.stockCostFx, 0);
  const cyCogs = cyOffSeasonFW.reduce((sum, row) => sum + row.cogsFx, 0);
  const inventoryDays = cyCogs > 0 ? Math.round((cyStockCost / cyCogs) * 30) : 0;

  // 연차별 재고 일수 계산 (CY)
  const cyStockCostByYear = cyOffSeasonFW.reduce((acc, row) => {
    const bucket = row.seasonInfo.yearBucket;
    if (bucket === 'Y1' || bucket === 'Y2' || bucket === 'Y3Plus') {
      acc[bucket] = (acc[bucket] || 0) + row.stockCostFx;
    }
    return acc;
  }, {} as Record<string, number>);

  const cyCogsByYear = cyOffSeasonFW.reduce((acc, row) => {
    const bucket = row.seasonInfo.yearBucket;
    if (bucket === 'Y1' || bucket === 'Y2' || bucket === 'Y3Plus') {
      acc[bucket] = (acc[bucket] || 0) + row.cogsFx;
    }
    return acc;
  }, {} as Record<string, number>);

  const cyY1StockCost = cyStockCostByYear['Y1'] || 0;
  const cyY1Cogs = cyCogsByYear['Y1'] || 0;
  const y1InventoryDays = cyY1Cogs > 0 ? Math.round((cyY1StockCost / cyY1Cogs) * 30) : 0;

  const cyY2StockCost = cyStockCostByYear['Y2'] || 0;
  const cyY2Cogs = cyCogsByYear['Y2'] || 0;
  const y2InventoryDays = cyY2Cogs > 0 ? Math.round((cyY2StockCost / cyY2Cogs) * 30) : 0;

  const cyY3PlusStockCost = cyStockCostByYear['Y3Plus'] || 0;
  const cyY3PlusCogs = cyCogsByYear['Y3Plus'] || 0;
  const y3PlusInventoryDays = cyY3PlusCogs > 0 ? Math.round((cyY3PlusStockCost / cyY3PlusCogs) * 30) : 0;

  // 현재 기간 추출 (CY 데이터에서)
  const currentPeriod = cyOffSeasonFW.length > 0 ? cyOffSeasonFW[0].period : '2512';
  const currentYear = currentPeriod.substring(0, 2);
  const currentMonth = currentPeriod.substring(2, 4);
  const periodLabel = `20${currentYear}년 ${parseInt(currentMonth)}월`;

  // 월별 데이터 집계 (6월~12월, 그래프용)
  type MonthlySalesData = {
    month: number; // 6, 7, 8, 9, 10, 11, 12
    pySales: number; // 전년 과시즌 판매 (택가매출 기준, K HKD)
    cySales: number; // 당년 과시즌 판매 (택가매출 기준, K HKD)
    pyDiscount: number | null; // 전년 할인율
    cyDiscount: number | null; // 당년 할인율
    yoyRatio: number | null; // YOY 비율 (당년/전년 * 100)
    discountDiff: number | null; // 할인율 차이 (%p)
  };

  type MonthlyInventoryData = {
    month: number;
    y1Stock: number; // 1년차 재고 (K HKD)
    y2Stock: number; // 2년차 재고 (K HKD)
    y3PlusStock: number; // 3년차~ 재고 (K HKD)
    totalStock: number; // 전체 재고 (K HKD)
  };

  const monthlySalesData = useMemo<MonthlySalesData[]>(() => {
    if (graphData.length === 0) {
      console.log('Graph data is empty');
      return [];
    }

    console.log('Total graph data rows:', graphData.length);
    if (graphData.length > 0) {
      console.log('Sample graph data row:', graphData[0]);
      console.log('Year distribution:', {
        2024: graphData.filter(r => r.year === 2024).length,
        2025: graphData.filter(r => r.year === 2025).length,
        other: graphData.filter(r => r.year !== 2024 && r.year !== 2025).length,
      });
      
      // Period 분포 확인 (6월~12월)
      const periods = ['2406', '2407', '2408', '2409', '2410', '2411', '2412', '2506', '2507', '2508', '2509', '2510', '2511', '2512'];
      const periodDist: Record<string, number> = {};
      periods.forEach(p => {
        periodDist[p] = graphData.filter(r => r.period === p).length;
      });
      console.log('Period distribution (6-12월):', periodDist);
      
      // Year별 Period 분포
      console.log('2024년 Period 분포:', {
        '2406': graphData.filter(r => r.year === 2024 && r.period === '2406').length,
        '2407': graphData.filter(r => r.year === 2024 && r.period === '2407').length,
        '2408': graphData.filter(r => r.year === 2024 && r.period === '2408').length,
        '2409': graphData.filter(r => r.year === 2024 && r.period === '2409').length,
        '2410': graphData.filter(r => r.year === 2024 && r.period === '2410').length,
        '2411': graphData.filter(r => r.year === 2024 && r.period === '2411').length,
        '2412': graphData.filter(r => r.year === 2024 && r.period === '2412').length,
      });
      console.log('2025년 Period 분포:', {
        '2506': graphData.filter(r => r.year === 2025 && r.period === '2506').length,
        '2507': graphData.filter(r => r.year === 2025 && r.period === '2507').length,
        '2508': graphData.filter(r => r.year === 2025 && r.period === '2508').length,
        '2509': graphData.filter(r => r.year === 2025 && r.period === '2509').length,
        '2510': graphData.filter(r => r.year === 2025 && r.period === '2510').length,
        '2511': graphData.filter(r => r.year === 2025 && r.period === '2511').length,
        '2512': graphData.filter(r => r.year === 2025 && r.period === '2512').length,
      });
      
      console.log('Country distribution:', {
        HK: graphData.filter(r => r.country === 'HK').length,
        MC: graphData.filter(r => r.country === 'MC').length,
        MO: graphData.filter(r => r.country === 'MO').length,
        TW: graphData.filter(r => r.country === 'TW').length,
      });
      
      // 과시즌 FW 필터링 테스트
      const offSeasonFW = graphData.filter(r => isOffSeasonFW(r));
      console.log('Off-season FW count:', offSeasonFW.length);
      if (offSeasonFW.length > 0) {
        console.log('Sample off-season FW row:', offSeasonFW[0]);
        console.log('Off-season FW by year:', {
          2024: offSeasonFW.filter(r => r.year === 2024).length,
          2025: offSeasonFW.filter(r => r.year === 2025).length,
        });
      }
    }

    const months = [6, 7, 8, 9, 10, 11, 12];
    const result: MonthlySalesData[] = [];

    for (const month of months) {
      // 전년 Period: 2406~2412 (2024년 데이터)
      const pyPeriod = `24${month.toString().padStart(2, '0')}`;
      // 당년 Period: 2506~2512 (2025년 데이터)
      const cyPeriod = `25${month.toString().padStart(2, '0')}`;

      // 전년 데이터 필터링
      // Period가 pyPeriod인 것 (2406~2412), HK/MC/MO만, 과시즌 FW만
      // Year 필터는 Period 기반으로 이미 설정되어 있으므로 Period만 확인
      const pyRows = graphData.filter(
        row =>
          row.period === pyPeriod && // Period가 2406~2412
          (row.country === 'HK' || row.country === 'MC' || row.country === 'MO') &&
          isOffSeasonFW(row) // 과시즌 FW만 (2024년 기준: 23F=Y1, 22F=Y2, 21F~=Y3Plus)
      );

      // 당년 데이터 필터링
      // Period가 cyPeriod인 것 (2506~2512), HK/MC/MO만, 과시즌 FW만
      const cyRows = graphData.filter(
        row =>
          row.period === cyPeriod && // Period가 2506~2512
          (row.country === 'HK' || row.country === 'MC' || row.country === 'MO') &&
          isOffSeasonFW(row) // 과시즌 FW만 (2025년 기준: 24F=Y1, 23F=Y2, 22F~=Y3Plus)
      );

      console.log(`${month}월 - PY rows: ${pyRows.length}, CY rows: ${cyRows.length}`);

      // 택가매출 합계 계산 (grossSalesFx = 택가매출 기준)
      const pyGross = pyRows.reduce((sum, row) => sum + row.grossSalesFx, 0);
      const pyNet = pyRows.reduce((sum, row) => sum + row.netSalesFx, 0);
      const cyGross = cyRows.reduce((sum, row) => sum + row.grossSalesFx, 0);
      const cyNet = cyRows.reduce((sum, row) => sum + row.netSalesFx, 0);

      // 할인율 계산
      const pyDiscount = pyGross > 0 ? 1 - pyNet / pyGross : null;
      const cyDiscount = cyGross > 0 ? 1 - cyNet / cyGross : null;

      // YOY 비율 계산
      const yoyRatio = pyGross > 0 ? (cyGross / pyGross) * 100 : null;

      // 할인율 차이 계산 (%p)
      const discountDiff = pyDiscount !== null && cyDiscount !== null
        ? (cyDiscount * 100) - (pyDiscount * 100)
        : null;

      result.push({
        month,
        pySales: pyGross / 1000, // K HKD로 변환 (택가매출 기준)
        cySales: cyGross / 1000, // K HKD로 변환 (택가매출 기준)
        pyDiscount: pyDiscount !== null ? pyDiscount * 100 : null, // 퍼센트로 변환
        cyDiscount: cyDiscount !== null ? cyDiscount * 100 : null,
        yoyRatio,
        discountDiff,
      });
    }

    console.log('Monthly sales data:', result);
    return result;
  }, [graphData]);

  const monthlyInventoryData = useMemo<MonthlyInventoryData[]>(() => {
    if (graphData.length === 0) {
      return [];
    }

    const months = [6, 7, 8, 9, 10, 11, 12];
    const result: MonthlyInventoryData[] = [];

    for (const month of months) {
      // 당년 Period만 사용 (재고는 당년 기준)
      const cyPeriod = `25${month.toString().padStart(2, '0')}`;

      // 당년 데이터 필터링
      // Period가 cyPeriod인 것 (2506~2512), HK/MC/MO만, 과시즌 FW만
      const cyRows = graphData.filter(
        row =>
          row.period === cyPeriod && // Period가 2506~2512
          (row.country === 'HK' || row.country === 'MC' || row.country === 'MO') &&
          isOffSeasonFW(row) // 과시즌 FW만 (2025년 기준: 24F=Y1, 23F=Y2, 22F~=Y3Plus)
      );

      // 연차별 재고 합계 계산 (택가 기준)
      const y1Stock = cyRows
        .filter(row => row.seasonInfo.yearBucket === 'Y1')
        .reduce((sum, row) => sum + row.stockPriceFx, 0);
      const y2Stock = cyRows
        .filter(row => row.seasonInfo.yearBucket === 'Y2')
        .reduce((sum, row) => sum + row.stockPriceFx, 0);
      const y3PlusStock = cyRows
        .filter(row => row.seasonInfo.yearBucket === 'Y3Plus')
        .reduce((sum, row) => sum + row.stockPriceFx, 0);

      result.push({
        month,
        y1Stock: y1Stock / 1000, // K HKD로 변환
        y2Stock: y2Stock / 1000,
        y3PlusStock: y3PlusStock / 1000,
        totalStock: (y1Stock + y2Stock + y3PlusStock) / 1000,
      });
    }

    console.log('Monthly inventory data:', result);
    return result;
  }, [graphData]);

  // 정체재고 분석을 위한 타입 정의
  type StagnantItem = {
    itemCode: string;
    subcategoryName: string;
    itemDesc2: string | null;
    seasonCode: string;
    yearBucket: YearBucket;
    stockTagK: number;
    monthGrossK: number;
    monthNetK: number;
    discountRate: number | null;
    inventoryDays: number | null;
    ratio: number;
  };

  type StagnantByBucket = Record<YearBucket, StagnantItem[]>;

  // 정체재고 계산 (CY, OFF-SEASON FW, HK/MC만)
  const stagnantByBucket = useMemo(() => {
    const cyFiltered = filteredData.filter(
      row => row.sourceYearType === 'CY' && isOffSeasonFW(row) && (row.country === 'HK' || row.country === 'MC')
    );

    // 품번별로 집계
    const itemMap = new Map<string, {
      itemCode: string;
      subcategoryName: string;
      itemDesc2: string | null;
      seasonCode: string;
      yearBucket: YearBucket;
      stockTag: number;
      monthGross: number;
      monthNet: number;
    }>();

    for (const row of cyFiltered) {
      const key = row.itemCode;
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          itemCode: row.itemCode,
          subcategoryName: row.subcategoryName,
          itemDesc2: row.itemDesc2,
          seasonCode: row.seasonInfo.seasonCode,
          yearBucket: row.seasonInfo.yearBucket,
          stockTag: 0,
          monthGross: 0,
          monthNet: 0,
        });
      }
      const item = itemMap.get(key)!;
      item.stockTag += row.stockPriceFx;
      item.monthGross += row.grossSalesFx;
      item.monthNet += row.netSalesFx;
    }

    // 정체 조건 적용: ratio < 0.001 (0.1% 미만)
    const stagnantItems: StagnantItem[] = [];
    for (const item of itemMap.values()) {
      if (item.stockTag > 0) {
        const ratio = item.monthGross / item.stockTag;
        if (ratio < 0.001) {
          const discountRate = item.monthGross > 0 ? (1 - item.monthNet / item.monthGross) * 100 : null;
          const inventoryDays = item.monthGross > 0 ? (item.stockTag / item.monthGross) * 30 : null;

          stagnantItems.push({
            itemCode: item.itemCode,
            subcategoryName: item.subcategoryName,
            itemDesc2: item.itemDesc2,
            seasonCode: item.seasonCode,
            yearBucket: item.yearBucket,
            stockTagK: item.stockTag / 1000,
            monthGrossK: item.monthGross / 1000,
            monthNetK: item.monthNet / 1000,
            discountRate,
            inventoryDays,
            ratio,
          });
        }
      }
    }

    // 연차별로 그룹핑 및 정렬
    const grouped: StagnantByBucket = {
      InSeason: [],
      Y1: [],
      Y2: [],
      Y3Plus: [],
    };

    for (const item of stagnantItems) {
      if (item.yearBucket === 'Y1' || item.yearBucket === 'Y2' || item.yearBucket === 'Y3Plus') {
        grouped[item.yearBucket].push(item);
      }
    }

    // 각 연차별로 택가재고 큰 순으로 정렬
    for (const bucket of ['Y1', 'Y2', 'Y3Plus'] as const) {
      grouped[bucket].sort((a, b) => {
        return b.stockTagK - a.stockTagK;
      });
    }

    return grouped;
  }, [filteredData]);

  // 월 목표대비 현황 계산
  const monthlyTargetStatus = useMemo(() => {
    console.log('=== 월 목표대비 현황 계산 ===');
    console.log('Graph data rows:', graphData.length);
    console.log('Target data rows:', targetData.length);

    // 2511과 2512 데이터 필터링 (HK + MO, 과시즌 FW)
    const nov2511 = graphData.filter(
      row => row.period === '2511' && (row.country === 'HK' || row.country === 'MO') && isOffSeasonFW(row)
    );
    const dec2512 = graphData.filter(
      row => row.period === '2512' && (row.country === 'HK' || row.country === 'MO') && isOffSeasonFW(row)
    );

    console.log('2511 off-season rows:', nov2511.length);
    console.log('2512 off-season rows:', dec2512.length);

    // 연차별 집계
    type YearlyData = {
      stock: number; // 택가 재고
      sales: number; // 택가 판매
      target: number; // 목표
    };

    const calculate = (rows: GraphDataRow[]): Record<YearBucket, YearlyData> => {
      const result: Record<YearBucket, YearlyData> = {
        Y1: { stock: 0, sales: 0, target: 0 },
        Y2: { stock: 0, sales: 0, target: 0 },
        Y3Plus: { stock: 0, sales: 0, target: 0 },
        InSeason: { stock: 0, sales: 0, target: 0 },
      };

      // 실적 집계
      rows.forEach(row => {
        const bucket = row.seasonInfo.yearBucket;
        if (bucket in result) {
          result[bucket].stock += row.stockPriceFx;
          result[bucket].sales += row.grossSalesFx;
        }
      });

      // 목표 집계는 항상 2512 기준 (2025-12)
      console.log(`Filtering targets for period: 2025-12`);
      const filteredTargets = targetData.filter(t => t.period === '2025-12');
      console.log(`Targets for 2025-12:`, filteredTargets.length);
      
      // 시즌별로 목표 합계
      const targetBySeason: Record<string, number> = {};
      filteredTargets.forEach(t => {
        const season = t.season; // "22FW", "23FW", "24FW" 등
        if (!targetBySeason[season]) {
          targetBySeason[season] = 0;
        }
        targetBySeason[season] += t.amount;
      });
      
      console.log('Target by season:', targetBySeason);
      
      // 시즌별 목표를 연차별로 분류
      // 25년 기준: 24FW=Y1, 23FW=Y2, 22FW=Y3Plus
      Object.entries(targetBySeason).forEach(([season, amount]) => {
        // "22FW" -> "22F"로 변환하여 parseSeason 사용
        const seasonCode = season.replace('FW', 'F').replace('SS', 'S');
        const seasonInfo = parseSeason(seasonCode, 25);
        console.log(`Season ${season} (${seasonCode}) -> yearBucket: ${seasonInfo.yearBucket}, amount: ${amount}`);
        
        if (seasonInfo.seasonType === 'FW') {
          const bucket = seasonInfo.yearBucket;
          if (bucket === 'Y1' || bucket === 'Y2' || bucket === 'Y3Plus') {
            result[bucket].target += amount;
          }
        }
      });

      return result;
    };

    const nov = calculate(nov2511);  // 목표는 2512 기준
    const dec = calculate(dec2512);  // 목표는 2512 기준

    console.log('November data:', nov);
    console.log('December data:', dec);

    return { nov, dec };
  }, [graphData, targetData]);


  // 계산 결과 디버깅
  console.log('=== 메트릭 계산 결과 ===');
  console.log('cySales:', cySales);
  console.log('pySales:', pySales);
  console.log('cyStock:', cyStock);
  console.log('pyStock:', pyStock);
  console.log('cyCogs:', cyCogs);
  console.log('cyOffSeasonFW count:', cyOffSeasonFW.length);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">데이터 로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-600">오류: {error}</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">홍콩마카오 &gt; 과시즌 재고</h1>
            <p className="text-sm text-gray-600 mt-1">단위: 1K HKD | 택가 기준</p>
          </div>
          <div className="text-lg font-semibold text-gray-700">
            {periodLabel}
          </div>
        </div>

        {/* 월 목표대비 현황 섹션 */}
        <section className="mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border-2 border-indigo-200">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl">🎯</span>
              <h2 className="text-xl font-bold text-indigo-900">월 목표대비 현황</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">구분</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">2511 기말재고</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">판매 목표</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">판매 실적</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">달성률 (%)</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">2512 기말재고 목표</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">2512 기말재고 실적</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 1년차 */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 text-left text-gray-900 font-medium whitespace-nowrap">1년차 (24F)</td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {(monthlyTargetStatus.nov.Y1.stock / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {(monthlyTargetStatus.dec.Y1.target / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {(monthlyTargetStatus.dec.Y1.sales / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </td>
                    <td className={`px-4 py-2 text-right font-semibold ${
                      monthlyTargetStatus.dec.Y1.target > 0 && 
                      (monthlyTargetStatus.dec.Y1.sales / monthlyTargetStatus.dec.Y1.target) * 100 >= 100
                        ? 'bg-green-50 text-green-700'
                        : monthlyTargetStatus.dec.Y1.target > 0 && 
                          (monthlyTargetStatus.dec.Y1.sales / monthlyTargetStatus.dec.Y1.target) * 100 >= 80
                        ? 'bg-yellow-50 text-yellow-700'
                        : 'bg-red-50 text-red-700'
                    }`}>
                      {monthlyTargetStatus.dec.Y1.target > 0
                        ? ((monthlyTargetStatus.dec.Y1.sales / monthlyTargetStatus.dec.Y1.target) * 100).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                        : '-'}%
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {((monthlyTargetStatus.nov.Y1.stock - monthlyTargetStatus.dec.Y1.target) / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {(monthlyTargetStatus.dec.Y1.stock / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                  {/* 2년차 */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 text-left text-gray-900 font-medium whitespace-nowrap">2년차 (23F)</td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {(monthlyTargetStatus.nov.Y2.stock / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {(monthlyTargetStatus.dec.Y2.target / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {(monthlyTargetStatus.dec.Y2.sales / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </td>
                    <td className={`px-4 py-2 text-right font-semibold ${
                      monthlyTargetStatus.dec.Y2.target > 0 && 
                      (monthlyTargetStatus.dec.Y2.sales / monthlyTargetStatus.dec.Y2.target) * 100 >= 100
                        ? 'bg-green-50 text-green-700'
                        : monthlyTargetStatus.dec.Y2.target > 0 && 
                          (monthlyTargetStatus.dec.Y2.sales / monthlyTargetStatus.dec.Y2.target) * 100 >= 80
                        ? 'bg-yellow-50 text-yellow-700'
                        : 'bg-red-50 text-red-700'
                    }`}>
                      {monthlyTargetStatus.dec.Y2.target > 0
                        ? ((monthlyTargetStatus.dec.Y2.sales / monthlyTargetStatus.dec.Y2.target) * 100).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                        : '-'}%
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {((monthlyTargetStatus.nov.Y2.stock - monthlyTargetStatus.dec.Y2.target) / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {(monthlyTargetStatus.dec.Y2.stock / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                  {/* 3년차~ */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 text-left text-gray-900 font-medium whitespace-nowrap">3년차~ (22F~)</td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {(monthlyTargetStatus.nov.Y3Plus.stock / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {(monthlyTargetStatus.dec.Y3Plus.target / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {(monthlyTargetStatus.dec.Y3Plus.sales / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </td>
                    <td className={`px-4 py-2 text-right font-semibold ${
                      monthlyTargetStatus.dec.Y3Plus.target > 0 && 
                      (monthlyTargetStatus.dec.Y3Plus.sales / monthlyTargetStatus.dec.Y3Plus.target) * 100 >= 100
                        ? 'bg-green-50 text-green-700'
                        : monthlyTargetStatus.dec.Y3Plus.target > 0 && 
                          (monthlyTargetStatus.dec.Y3Plus.sales / monthlyTargetStatus.dec.Y3Plus.target) * 100 >= 80
                        ? 'bg-yellow-50 text-yellow-700'
                        : 'bg-red-50 text-red-700'
                    }`}>
                      {monthlyTargetStatus.dec.Y3Plus.target > 0
                        ? ((monthlyTargetStatus.dec.Y3Plus.sales / monthlyTargetStatus.dec.Y3Plus.target) * 100).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                        : '-'}%
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {((monthlyTargetStatus.nov.Y3Plus.stock - monthlyTargetStatus.dec.Y3Plus.target) / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {(monthlyTargetStatus.dec.Y3Plus.stock / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                  {/* 합계 행 */}
                  <tr className="bg-blue-50 border-t-2 border-blue-300 font-semibold">
                    <td className="px-4 py-2 text-left text-blue-900 whitespace-nowrap">합계</td>
                    <td className="px-4 py-2 text-right text-blue-900 font-semibold">
                      {((monthlyTargetStatus.nov.Y1.stock + monthlyTargetStatus.nov.Y2.stock + monthlyTargetStatus.nov.Y3Plus.stock) / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-2 text-right text-blue-900 font-semibold">
                      {((monthlyTargetStatus.dec.Y1.target + monthlyTargetStatus.dec.Y2.target + monthlyTargetStatus.dec.Y3Plus.target) / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-2 text-right text-blue-900 font-semibold">
                      {((monthlyTargetStatus.dec.Y1.sales + monthlyTargetStatus.dec.Y2.sales + monthlyTargetStatus.dec.Y3Plus.sales) / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </td>
                    <td className={`px-4 py-2 text-right font-bold text-base ${(() => {
                      const totalTarget = monthlyTargetStatus.dec.Y1.target + monthlyTargetStatus.dec.Y2.target + monthlyTargetStatus.dec.Y3Plus.target;
                      const totalSales = monthlyTargetStatus.dec.Y1.sales + monthlyTargetStatus.dec.Y2.sales + monthlyTargetStatus.dec.Y3Plus.sales;
                      const rate = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;
                      return rate >= 100 ? 'bg-green-100 text-green-800' : rate >= 80 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
                    })()}`}>
                      {(() => {
                        const totalTarget = monthlyTargetStatus.dec.Y1.target + monthlyTargetStatus.dec.Y2.target + monthlyTargetStatus.dec.Y3Plus.target;
                        const totalSales = monthlyTargetStatus.dec.Y1.sales + monthlyTargetStatus.dec.Y2.sales + monthlyTargetStatus.dec.Y3Plus.sales;
                        return totalTarget > 0 ? ((totalSales / totalTarget) * 100).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : '-';
                      })()}
                    </td>
                    <td className="px-4 py-2 text-right text-blue-900 font-semibold">
                      {(() => {
                        const totalNovStock = monthlyTargetStatus.nov.Y1.stock + monthlyTargetStatus.nov.Y2.stock + monthlyTargetStatus.nov.Y3Plus.stock;
                        const totalTarget = monthlyTargetStatus.dec.Y1.target + monthlyTargetStatus.dec.Y2.target + monthlyTargetStatus.dec.Y3Plus.target;
                        return ((totalNovStock - totalTarget) / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 });
                      })()}
                    </td>
                    <td className="px-4 py-2 text-right text-blue-900 font-semibold">
                      {((monthlyTargetStatus.dec.Y1.stock + monthlyTargetStatus.dec.Y2.stock + monthlyTargetStatus.dec.Y3Plus.stock) / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

            {/* Status (현황) 섹션 - 4개 메트릭 카드 */}
            <section className="mb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 기말 */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-md p-4 border-2 border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">📦</span>
                    <div className="text-sm font-semibold text-blue-800">기말</div>
                  </div>
                  <div className="text-3xl font-bold text-blue-900 mb-1">
                    {formatNumberK(cyStock)}
                  </div>
                  <div className={`text-sm font-bold mb-3 px-2 py-1 rounded inline-block ${
                    stockYoyRatio && stockYoyRatio >= 100 
                      ? 'bg-red-100 text-red-700' 
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {formatPercentRatio(stockYoyRatio)}
                  </div>
                  {/* 연차별 기말 재고 */}
                  <div className="space-y-1.5 pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">1년차:</span>
                      <span className="text-gray-700 font-medium">{formatNumberK(cyY1Stock)}</span>
                      <span className={`text-xs font-medium ${y1StockYoyRatio !== null && y1StockYoyRatio >= 100 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatPercentRatio(y1StockYoyRatio)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">2년차:</span>
                      <span className="text-gray-700 font-medium">{formatNumberK(cyY2Stock)}</span>
                      <span className={`text-xs font-medium ${y2StockYoyRatio !== null && y2StockYoyRatio >= 100 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatPercentRatio(y2StockYoyRatio)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">3년차~:</span>
                      <span className="text-gray-700 font-medium">{formatNumberK(cyY3PlusStock)}</span>
                      <span className="text-xs font-medium text-gray-500">
                        {formatPercentRatio(y3PlusStockYoyRatio)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 판매 */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-md p-4 border-2 border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">💰</span>
                    <div className="text-sm font-semibold text-green-800">판매</div>
                  </div>
                  <div className="text-3xl font-bold text-green-900 mb-1">
                    {formatNumberK(cySales)}
                  </div>
                  <div className={`text-sm font-bold mb-3 px-2 py-1 rounded inline-block ${
                    salesYoyRatio && salesYoyRatio >= 100 
                      ? 'bg-green-200 text-green-800' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {formatPercentRatio(salesYoyRatio)}
                  </div>
                  {/* 연차별 판매금액 */}
                  <div className="space-y-1.5 pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">1년차:</span>
                      <span className="text-gray-700 font-medium">{formatNumberK(cyY1Sales)}</span>
                      <span className={`text-xs font-medium ${y1SalesYoyRatio !== null && y1SalesYoyRatio >= 100 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatPercentRatio(y1SalesYoyRatio)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">2년차:</span>
                      <span className="text-gray-700 font-medium">{formatNumberK(cyY2Sales)}</span>
                      <span className={`text-xs font-medium ${y2SalesYoyRatio !== null && y2SalesYoyRatio >= 100 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatPercentRatio(y2SalesYoyRatio)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">3년차~:</span>
                      <span className="text-gray-700 font-medium">{formatNumberK(cyY3PlusSales)}</span>
                      <span className="text-xs font-medium text-gray-500">
                        {formatPercentRatio(y3PlusSalesYoyRatio)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 할인율 */}
                <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                  <div className="text-sm text-gray-600 mb-2">할인율</div>
                  <div className="text-2xl font-bold text-orange-600 mb-1">
                    {cyDiscount.toFixed(1)}%
                  </div>
                  <div className="text-sm font-medium text-orange-600 mb-3">
                    {formatPercentPoint(discountDiffPp)}
                  </div>
                  {/* 연차별 할인율 */}
                  <div className="space-y-1.5 pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">1년차:</span>
                      <span className="text-orange-600 font-medium">{cyY1Discount.toFixed(1)}%</span>
                      <span className="text-orange-600 text-xs font-medium">
                        {formatPercentPoint(y1DiscountDiffPp)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">2년차:</span>
                      <span className="text-orange-600 font-medium">{cyY2Discount.toFixed(1)}%</span>
                      <span className="text-orange-600 text-xs font-medium">
                        {formatPercentPoint(y2DiscountDiffPp)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">3년차~:</span>
                      <span className="text-orange-600 font-medium">{cyY3PlusDiscount.toFixed(1)}%</span>
                      <span className="text-orange-600 text-xs font-medium">
                        {y3PlusDiscountDiffPp !== null ? formatPercentPoint(y3PlusDiscountDiffPp) : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 재고 일수 */}
                <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                  <div className="text-sm text-gray-600 mb-2">재고 일수</div>
                  <div className="text-2xl font-bold text-gray-900 mb-3">
                    {inventoryDays}일
                  </div>
                  {/* 연차별 재고 일수 */}
                  <div className="space-y-1.5 pt-2 border-t border-gray-100 mb-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">1년차:</span>
                      <span className="text-gray-700 font-medium">{y1InventoryDays}일</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">2년차:</span>
                      <span className="text-gray-700 font-medium">{y2InventoryDays}일</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">3년차~:</span>
                      <span className="text-gray-700 font-medium">{y3PlusInventoryDays}일</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">1개월 판매 기준</div>
                </div>
              </div>
            </section>

        {/* 연차별 정체재고 분석 섹션 */}
        <StagnantByVintageSection
          itemsByBucket={stagnantByBucket}
          periodLabel={periodLabel}
          totalStockByBucket={{
            Y1: cyY1Stock / 1000,
            Y2: cyY2Stock / 1000,
            Y3Plus: cyY3PlusStock / 1000,
          }}
        />

        {/* Trend (추세) 섹션 - 2개 그래프를 가로로 배치 */}
        <section className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* 판매추이 그래프 (YOY) */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">과시즌재고 판매추이 (YOY)</h2>
            {monthlySalesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={monthlySalesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  label={{ value: '월', position: 'insideBottom', offset: -5 }}
                  tickFormatter={(value) => `${value}월`}
                />
                <YAxis 
                  yAxisId="left"
                  label={{ value: 'YOY (%)', angle: -90, position: 'insideLeft' }}
                  domain={[0, 'auto']}
                  tickFormatter={(value) => value.toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '%'}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  label={{ value: '할인율 (%)', angle: 90, position: 'insideRight' }}
                  domain={[0, 100]}
                />
                <Tooltip 
                  formatter={(value: any, name?: string) => {
                    if (name === 'YOY') {
                      return value !== null ? [`${value.toFixed(1)}%`, name || ''] : ['-', name || ''];
                    } else if (name === '전년 할인율' || name === '당년 할인율') {
                      return value !== null ? [`${value.toFixed(1)}%`, name || ''] : ['-', name || ''];
                    }
                    return [value, name || ''];
                  }}
                  labelFormatter={(label) => `${label}월`}
                />
                <Legend />
                <Bar 
                  yAxisId="left" 
                  dataKey="yoyRatio" 
                  fill="#3b82f6" 
                  name="YOY"
                  radius={[4, 4, 0, 0]}
                />
                <Line 
                  yAxisId="right" 
                  type="monotone" 
                  dataKey="pyDiscount"
                  stroke="#f97316" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="전년 할인율"
                  connectNulls={false}
                  dot={{ r: 4 }}
                />
                <Line 
                  yAxisId="right" 
                  type="monotone" 
                  dataKey="cyDiscount"
                  stroke="#f97316" 
                  strokeWidth={3}
                  name="당년 할인율"
                  connectNulls={false}
                  dot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                데이터가 없습니다. (월별 데이터: {monthlySalesData.length}개)
              </div>
            )}
            
            {/* 데이터 테이블 */}
            {monthlySalesData.length > 0 && (
              <div className="mt-6 overflow-x-auto h-[400px] overflow-y-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">월</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">전년 판매</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">당년 판매</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">YOY (%)</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">전년 할인율 (%)</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">당년 할인율 (%)</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">할인율 차이 (%p)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlySalesData.map((data) => (
                      <tr key={data.month} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2 text-left text-gray-900 font-medium whitespace-nowrap">{data.month}월</td>
                        <td className="px-4 py-2 text-right text-gray-700">
                          {data.pySales.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700">
                          {data.cySales.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700">
                          {data.yoyRatio !== null ? `${data.yoyRatio.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%` : '-'}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700">
                          {data.pyDiscount !== null ? `${data.pyDiscount.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%` : '-'}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700">
                          {data.cyDiscount !== null ? `${data.cyDiscount.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%` : '-'}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700">
                          {data.pyDiscount !== null && data.cyDiscount !== null
                            ? `${(data.cyDiscount - data.pyDiscount).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%p`
                            : '-'}
                        </td>
                      </tr>
                    ))}
                    {/* 합계 행 */}
                    <tr className="bg-gray-50 border-t-2 border-gray-300 font-semibold">
                      <td className="px-4 py-2 text-left text-gray-900 whitespace-nowrap">합계</td>
                      <td className="px-4 py-2 text-right text-gray-900 font-semibold">
                        {monthlySalesData.reduce((sum, d) => sum + d.pySales, 0).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900 font-semibold">
                        {monthlySalesData.reduce((sum, d) => sum + d.cySales, 0).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900 font-semibold">
                        {(() => {
                          const totalPy = monthlySalesData.reduce((sum, d) => sum + d.pySales, 0);
                          const totalCy = monthlySalesData.reduce((sum, d) => sum + d.cySales, 0);
                          return totalPy > 0 ? `${((totalCy / totalPy) * 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%` : '-';
                        })()}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900 font-semibold">-</td>
                      <td className="px-4 py-2 text-right text-gray-900 font-semibold">-</td>
                      <td className="px-4 py-2 text-right text-gray-900 font-semibold">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 재고추세 그래프 */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">과시즌재고 재고추세</h2>
            {monthlyInventoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={monthlyInventoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  label={{ value: '월', position: 'insideBottom', offset: -5 }}
                  tickFormatter={(value) => `${value}월`}
                />
                <YAxis 
                  label={{ value: '재고금액 (K HKD)', angle: -90, position: 'insideLeft' }}
                  tickFormatter={(value) => value.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                />
                <Tooltip 
                  formatter={(value: any, name?: string) => {
                    return [`${value.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}K HKD`, name || ''];
                  }}
                  labelFormatter={(label) => `${label}월`}
                />
                <Legend />
                <Bar dataKey="y1Stock" stackId="stock" fill="#93c5fd" name="1년차" />
                <Bar dataKey="y2Stock" stackId="stock" fill="#fde68a" name="2년차" />
                <Bar dataKey="y3PlusStock" stackId="stock" fill="#fdba74" name="3년차~" />
              </BarChart>
            </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                데이터가 없습니다. (월별 데이터: {monthlyInventoryData.length}개)
              </div>
            )}

            {/* 데이터 테이블 */}
            {monthlyInventoryData.length > 0 && (
              <div className="mt-6 overflow-x-auto h-[400px] overflow-y-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">월</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">1년차 재고</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">2년차 재고</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">3년차~ 재고</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyInventoryData.map((data) => (
                      <tr key={data.month} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2 text-left text-gray-900 font-medium whitespace-nowrap">{data.month}월</td>
                        <td className="px-4 py-2 text-right text-gray-700">
                          {data.y1Stock.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700">
                          {data.y2Stock.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700">
                          {data.y3PlusStock.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700 font-semibold">
                          {data.totalStock.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          </div>
        </section>

        {/* Plan (계획) 섹션 */}
        <section className="mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">계획 (Plan)</h2>
            <p className="text-gray-600">계획 섹션 - 향후 구현 예정</p>
          </div>
        </section>
      </div>
    </div>
  );
}

// 연차별 정체재고 분석 섹션 컴포넌트
type StagnantByVintageSectionProps = {
  itemsByBucket: Record<YearBucket, Array<{
    itemCode: string;
    subcategoryName: string;
    itemDesc2: string | null;
    seasonCode: string;
    yearBucket: YearBucket;
    stockTagK: number;
    monthGrossK: number;
    monthNetK: number;
    discountRate: number | null;
    inventoryDays: number | null;
    ratio: number;
  }>>;
  periodLabel: string;
  totalStockByBucket: {
    Y1: number;
    Y2: number;
    Y3Plus: number;
  };
};

const StagnantByVintageSection: React.FC<StagnantByVintageSectionProps> = ({ itemsByBucket, periodLabel, totalStockByBucket }) => {
  const [open, setOpen] = useState(true);
  const [showItems, setShowItems] = useState(false);

  const yearBucketLabel: Record<YearBucket, string> = {
    InSeason: '당시즌',
    Y1: '24F (1년차)',
    Y2: '23F (2년차)',
    Y3Plus: '22F~ (3년차~)',
  };

  const totalStagnantCount = itemsByBucket.Y1.length + itemsByBucket.Y2.length + itemsByBucket.Y3Plus.length;

  // 연차별 정체재고 합계 계산 (K 단위)
  const stagnantStockByBucket = {
    Y1: itemsByBucket.Y1.reduce((sum, item) => sum + item.stockTagK, 0),
    Y2: itemsByBucket.Y2.reduce((sum, item) => sum + item.stockTagK, 0),
    Y3Plus: itemsByBucket.Y3Plus.reduce((sum, item) => sum + item.stockTagK, 0),
  };

  if (totalStagnantCount === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="rounded-xl border border-gray-200 bg-white">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex w-full items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="font-semibold text-sm text-gray-900">연차별 정체재고 분석</div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>총 {totalStagnantCount}개 품번</span>
            <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
          </div>
        </button>

        {open && (
          <div className="border-t border-gray-200 px-4 py-3">
            {/* 정체재고 기준 안내 */}
            <div className="mb-3 pb-2 border-b border-gray-100">
              <div className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">정체재고 기준:</span> 당월 택가매출이 재고택가의 0.1% 미만인 품번
              </div>
            </div>
            
            {/* 전체 재고대비 정체재고 비중 분석 */}
            {(() => {
              const totalStagnantStock = stagnantStockByBucket.Y1 + stagnantStockByBucket.Y2 + stagnantStockByBucket.Y3Plus;
              const totalStock = totalStockByBucket.Y1 + totalStockByBucket.Y2 + totalStockByBucket.Y3Plus;
              const percentage = totalStock > 0 ? (totalStagnantStock / totalStock) * 100 : 0;
              
              // 연차별 비중 계산
              const y1Pct = totalStockByBucket.Y1 > 0 ? (stagnantStockByBucket.Y1 / totalStockByBucket.Y1) * 100 : 0;
              const y2Pct = totalStockByBucket.Y2 > 0 ? (stagnantStockByBucket.Y2 / totalStockByBucket.Y2) * 100 : 0;
              const y3Pct = totalStockByBucket.Y3Plus > 0 ? (stagnantStockByBucket.Y3Plus / totalStockByBucket.Y3Plus) * 100 : 0;
              
              // AI 분석 인사이트 생성
              let insight = '';
              let insightBg = 'bg-gray-100';
              let insightBorder = 'border-gray-300';
              let insightIcon = '📊';
              
              // 정체재고 연차별 분포 분석
              const maxBucket = y1Pct >= y2Pct && y1Pct >= y3Pct ? '1년차' : y2Pct >= y3Pct ? '2년차' : '3년차~';
              const maxPct = Math.max(y1Pct, y2Pct, y3Pct);
              
              if (percentage >= 20) {
                insight = `정체재고 비중이 ${percentage.toFixed(1)}%로 매우 높습니다.\n${maxBucket} 정체재고가 ${maxPct.toFixed(1)}%로 가장 높으며, 총 ${totalStagnantCount}개 품번(${formatNumberK(totalStagnantStock * 1000)})이 정체 상태입니다.\n즉각적인 할인 프로모션(30% 이상) 및 MD 처분 전략 수립이 시급합니다.`;
                insightBg = 'bg-red-50';
                insightBorder = 'border-red-200';
                insightIcon = '🚨';
              } else if (percentage >= 15) {
                insight = `정체재고 비중이 ${percentage.toFixed(1)}%로 다소 높습니다.\n${maxBucket} 재고가 ${maxPct.toFixed(1)}%로 가장 많으며, ${totalStagnantCount}개 품번이 정체 중입니다.\n할인 프로모션(20-30%) 검토 및 연차별 재고 소진 계획이 필요합니다.`;
                insightBg = 'bg-orange-50';
                insightBorder = 'border-orange-200';
                insightIcon = '⚠️';
              } else if (percentage >= 10) {
                insight = `정체재고 비중이 ${percentage.toFixed(1)}%로 보통 수준입니다.\n${maxBucket}에 ${maxPct.toFixed(1)}%가 집중되어 있으며, 총 ${totalStagnantCount}개 품번입니다.\n지속적인 모니터링과 선별적 할인 프로모션(10-20%)을 권장합니다.`;
                insightBg = 'bg-yellow-50';
                insightBorder = 'border-yellow-200';
                insightIcon = '📋';
              } else if (percentage > 0) {
                insight = `정체재고 비중이 ${percentage.toFixed(1)}%로 양호합니다.\n${totalStagnantCount}개 품번만 정체 상태이며, ${maxBucket}에서 ${maxPct.toFixed(1)}%를 차지합니다.\n현재 재고 관리 상태가 우수하나, 정기적인 모니터링을 유지하세요.`;
                insightBg = 'bg-blue-50';
                insightBorder = 'border-blue-200';
                insightIcon = '✅';
              } else {
                insight = `정체재고가 없습니다. 재고 회전율이 우수합니다.\n모든 과시즌 재고가 적정 수준으로 판매되고 있으며, 재고 관리가 효율적입니다.\n현재의 재고 관리 전략을 유지하시기 바랍니다.`;
                insightBg = 'bg-green-50';
                insightBorder = 'border-green-200';
                insightIcon = '🎉';
              }
              
              return (
                <div className="mb-5 pb-4 border-b border-gray-200">
                  {/* 상단: 정체재고 비중 카드 */}
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {/* 전체 비중 */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-600 mb-1">전체</div>
                      <div className="text-xl font-bold text-red-600">{percentage.toFixed(1)}%</div>
                      <div className="text-[10px] text-gray-500 mt-1">
                        {formatNumberK(totalStagnantStock * 1000)} / {formatNumberK(totalStock * 1000)}
                      </div>
                    </div>
                    
                    {/* 1년차 */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-600 mb-1">1년차</div>
                      <div className="text-xl font-bold text-gray-800">{y1Pct.toFixed(1)}%</div>
                      <div className="text-[10px] text-gray-500 mt-1">{itemsByBucket.Y1.length}개 품번</div>
                    </div>
                    
                    {/* 2년차 */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-600 mb-1">2년차</div>
                      <div className="text-xl font-bold text-gray-800">{y2Pct.toFixed(1)}%</div>
                      <div className="text-[10px] text-gray-500 mt-1">{itemsByBucket.Y2.length}개 품번</div>
                    </div>
                    
                    {/* 3년차~ */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-600 mb-1">3년차~</div>
                      <div className="text-xl font-bold text-gray-800">{y3Pct.toFixed(1)}%</div>
                      <div className="text-[10px] text-gray-500 mt-1">{itemsByBucket.Y3Plus.length}개 품번</div>
                    </div>
                  </div>
                  
                  {/* 하단: AI 분석 */}
                  <div className={`${insightBg} ${insightBorder} border rounded-lg p-3 flex items-start gap-2`}>
                    <span className="text-lg">{insightIcon}</span>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gray-700 mb-1">AI 분석</div>
                      <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{insight}</div>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {/* 품번 펼치기/접기 버튼 */}
            <div className="mb-3 flex justify-center">
              <button
                type="button"
                onClick={() => setShowItems(!showItems)}
                className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                {showItems ? '품번 접기 ▲' : '품번 펼치기 ▼'}
              </button>
            </div>
            
            {/* 품번 테이블들 */}
            {showItems && (['Y1', 'Y2', 'Y3Plus'] as const).map((bucket) => {
              const items = itemsByBucket[bucket];
              if (items.length === 0) return null;

              return (
                <div key={bucket} className="mb-6 last:mb-0">
                  {/* 섹션 헤더 */}
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {yearBucketLabel[bucket]}
                      </span>
                      <span className="text-xs text-gray-500">총 {items.length}개 항목</span>
                      {totalStockByBucket[bucket] > 0 && (
                        <span className="text-xs text-gray-500">
                          (전체 재고대비 {((stagnantStockByBucket[bucket] / totalStockByBucket[bucket]) * 100).toFixed(1)}%)
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">단위: 1K HKD</span>
                  </div>

                  {/* 테이블 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs table-fixed" style={{ tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: '40px' }} />
                        <col style={{ width: '120px' }} />
                        <col style={{ width: '140px' }} />
                        <col style={{ width: '200px' }} />
                        <col style={{ width: '64px' }} />
                        <col style={{ width: '90px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '80px' }} />
                        <col style={{ width: '90px' }} />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-[11px] text-gray-500">
                          <th className="px-2 py-1 text-right w-10">순위</th>
                          <th className="px-2 py-1 text-left">Item Code</th>
                          <th className="px-2 py-1 text-left">SUBCATEGORY NAME</th>
                          <th className="px-2 py-1 text-left">ITEM DESC2</th>
                          <th className="px-2 py-1 text-center w-16">시즌</th>
                          <th className="px-2 py-1 text-right">택가 재고</th>
                          <th className="px-2 py-1 text-right">{periodLabel} 택가매출</th>
                          <th className="px-2 py-1 text-right">{periodLabel} 실판매출</th>
                          <th className="px-2 py-1 text-right">할인율 (%)</th>
                          <th className="px-2 py-1 text-right">재고일수 (일)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.slice(0, 3).map((item, index) => (
                          <tr key={item.itemCode} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                            <td className="px-2 py-1 text-right text-[11px] text-gray-500 w-10">
                              {index + 1}
                            </td>
                            <td className="px-2 py-1 text-left text-gray-700 font-medium">{item.itemCode}</td>
                            <td className="px-2 py-1 text-left text-gray-700">{item.subcategoryName}</td>
                            <td className="px-2 py-1 text-left text-gray-700">{item.itemDesc2 || '-'}</td>
                            <td className="px-2 py-1 text-center text-gray-700 w-16">{item.seasonCode}</td>
                            <td className="px-2 py-1 text-right text-red-500 font-semibold">
                              {Math.round(item.stockTagK).toLocaleString('ko-KR')}
                            </td>
                            <td className="px-2 py-1 text-right text-gray-700">
                              {formatNumber(item.monthGrossK)}
                            </td>
                            <td className="px-2 py-1 text-right text-gray-700">
                              {formatNumber(item.monthNetK)}
                            </td>
                            <td className="px-2 py-1 text-right text-gray-700">
                              {item.discountRate !== null ? formatPercent(item.discountRate) : '-'}
                            </td>
                            <td className={`px-2 py-1 text-right font-semibold ${item.inventoryDays !== null && item.inventoryDays > 365 ? 'text-red-500' : 'text-gray-700'}`}>
                              {item.inventoryDays !== null ? `${Math.round(item.inventoryDays)}일` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* 더보기/접기 토글 버튼 */}
                  {items.length > 3 && (
                    <StagnantBucketToggle
                      items={items}
                      periodLabel={periodLabel}
                    />
                  )}
                </div>
              );
            })}
          </div>
            )}
          </div>
    </div>
  );
};

// 연차별 정체재고 토글 컴포넌트 (나머지 항목 표시)
type StagnantBucketToggleProps = {
  items: Array<{
    itemCode: string;
    subcategoryName: string;
    itemDesc2: string | null;
    seasonCode: string;
    stockTagK: number;
    monthGrossK: number;
    monthNetK: number;
    discountRate: number | null;
    inventoryDays: number | null;
  }>;
  periodLabel: string;
};

const StagnantBucketToggle: React.FC<StagnantBucketToggleProps> = ({ items }) => {
  const [showAll, setShowAll] = useState(false);
  
  const remainingItems = items.slice(3);
  const hasMore = remainingItems.length > 0;

  if (!hasMore) return null;

  return (
    <>
      {showAll && (
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-xs table-fixed" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '140px' }} />
              <col style={{ width: '200px' }} />
              <col style={{ width: '64px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '90px' }} />
            </colgroup>
            <tbody>
              {remainingItems.map((item, index) => (
                <tr key={item.itemCode} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-2 py-1 text-right text-[11px] text-gray-500 w-10">
                    {index + 4}
                  </td>
                  <td className="px-2 py-1 text-left text-gray-700 font-medium">{item.itemCode}</td>
                  <td className="px-2 py-1 text-left text-gray-700">{item.subcategoryName}</td>
                  <td className="px-2 py-1 text-left text-gray-700">{item.itemDesc2 || '-'}</td>
                  <td className="px-2 py-1 text-center text-gray-700 w-16">{item.seasonCode}</td>
                  <td className="px-2 py-1 text-right text-red-500 font-semibold">
                    {Math.round(item.stockTagK).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-700">
                    {formatNumber(item.monthGrossK)}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-700">
                    {formatNumber(item.monthNetK)}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-700">
                    {item.discountRate !== null ? formatPercent(item.discountRate) : '-'}
                  </td>
                  <td className={`px-2 py-1 text-right font-semibold ${item.inventoryDays !== null && item.inventoryDays > 365 ? 'text-red-500' : 'text-gray-700'}`}>
                    {item.inventoryDays !== null ? `${Math.round(item.inventoryDays)}일` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-2 text-center">
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-blue-600 hover:text-blue-800 underline"
        >
          {showAll ? `접기 (상위 3개만 표시)` : `더보기 (나머지 ${remainingItems.length}개 항목)`}
        </button>
      </div>
    </>
  );
};
