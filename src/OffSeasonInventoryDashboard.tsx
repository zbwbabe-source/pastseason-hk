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
 * 연차별 카테고리 테이블 섹션 (접었다 폈다 가능)
 */
type CategoryData = {
  tagSalesActual: number;
  netSalesActual: number;
  tagSalesTarget: number;
  discountRateTarget: number;
  discountRateActual: number;
  stock2511: number;
  stock2512Actual: number;
  stock2512Target: number;
};

type YearBucketSectionProps = {
  bucketLabel: string;
  categories: Record<string, CategoryData>;
  isOpen: boolean;
  onToggle: () => void;
};

const YearBucketSection: React.FC<YearBucketSectionProps> = ({ bucketLabel, categories, isOpen, onToggle }) => {
  // 합계 계산 ('합계' 카테고리는 제외)
  const categoryEntries = Object.entries(categories).filter(([cat]) => cat !== '합계');
  const totalTarget = categoryEntries.reduce((sum, [_, d]) => sum + d.tagSalesTarget, 0);
  const totalActual = categoryEntries.reduce((sum, [_, d]) => sum + d.tagSalesActual, 0);
  const totalStock2512Target = categoryEntries.reduce((sum, [_, d]) => sum + d.stock2512Target, 0);
  const totalStock2512Actual = categoryEntries.reduce((sum, [_, d]) => sum + d.stock2512Actual, 0);
  const totalAchievementRate = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
  
  return (
    <div className="mb-4 last:mb-0 border border-gray-200 rounded-lg">
      {/* 헤더 (토글 버튼) */}
      <button
        type="button"
        onClick={onToggle}
        data-bucket-open={isOpen}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-t-lg transition"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-800">{bucketLabel}</h3>
          <span className="text-sm text-gray-500">
            판매 달성률: 
            <span className={`ml-1 font-semibold ${
              totalAchievementRate >= 100 ? 'text-green-600'
              : totalAchievementRate >= 80 ? 'text-yellow-600'
              : 'text-red-600'
            }`}>
              {totalAchievementRate.toFixed(1)}%
            </span>
          </span>
        </div>
        <span className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      
      {/* 테이블 내용 (토글) */}
      {isOpen && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">카테고리</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">판매 목표</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">판매 실적</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">달성률 (%)</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">할인율 목표</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">할인율 실적</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">할인율 차이</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">목표 재고</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">실적 재고</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(categories)
                .filter(([category]) => category !== '합계') // '합계'는 자동 계산되므로 제외
                .map(([category, data]) => {
                const achievementRate = data.tagSalesTarget > 0 
                  ? (data.tagSalesActual / data.tagSalesTarget) * 100 
                  : 0;
                const discountDiff = (data.discountRateActual - data.discountRateTarget) * 100;
                
                return (
                  <tr key={category} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 text-left text-gray-900 font-medium whitespace-nowrap">{category}</td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {(data.tagSalesTarget / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}K
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {(data.tagSalesActual / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}K
                    </td>
                    <td className={`px-4 py-2 text-right font-semibold ${
                      achievementRate >= 100 ? 'bg-green-50 text-green-700'
                      : achievementRate >= 80 ? 'bg-yellow-50 text-yellow-700'
                      : 'bg-red-50 text-red-700'
                    }`}>
                      {achievementRate.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {(data.discountRateTarget * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-2 text-right text-orange-600 font-medium">
                      {(data.discountRateActual * 100).toFixed(1)}%
                    </td>
                    <td className={`px-4 py-2 text-right font-semibold ${
                      discountDiff > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {discountDiff > 0 ? '+' : ''}{discountDiff.toFixed(1)}%p
                    </td>
                    <td className="px-4 py-2 text-right text-blue-700 font-medium">
                      {(data.stock2512Target / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}K
                    </td>
                    <td className={`px-4 py-2 text-right font-semibold ${
                      data.stock2512Actual > data.stock2512Target 
                        ? 'bg-red-50 text-red-700 border-l-4 border-red-500' 
                        : data.stock2512Actual < data.stock2512Target
                        ? 'bg-green-50 text-green-700 border-l-4 border-green-500'
                        : 'text-blue-900'
                    }`}>
                      {(data.stock2512Actual / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}K
                      {data.stock2512Actual !== data.stock2512Target && (
                        <span className="ml-1 text-xs">
                          {data.stock2512Actual > data.stock2512Target 
                            ? `⚠️ +${((data.stock2512Actual - data.stock2512Target) / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}K`
                            : `✓ ${((data.stock2512Actual - data.stock2512Target) / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}K`
                          }
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {/* 합계 행 */}
              <tr className="bg-blue-50 border-t-2 border-blue-300 font-semibold">
                <td className="px-4 py-2 text-left text-blue-900 whitespace-nowrap">합계</td>
                <td className="px-4 py-2 text-right text-blue-900">
                  {(totalTarget / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}K
                </td>
                <td className="px-4 py-2 text-right text-blue-900">
                  {(totalActual / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}K
                </td>
                <td className={`px-4 py-2 text-right font-bold ${
                  totalAchievementRate >= 100 ? 'bg-green-100 text-green-800' 
                  : totalAchievementRate >= 80 ? 'bg-yellow-100 text-yellow-800' 
                  : 'bg-red-100 text-red-800'
                }`}>
                  {totalAchievementRate.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                </td>
                <td className="px-4 py-2 text-right text-blue-900">-</td>
                <td className="px-4 py-2 text-right text-blue-900 font-bold">
                  {(() => {
                    const totalGross = categoryEntries.reduce((sum, [_, d]) => sum + d.tagSalesActual, 0);
                    const totalNet = categoryEntries.reduce((sum, [_, d]) => sum + d.netSalesActual, 0);
                    const rate = totalGross > 0 ? (1 - totalNet / totalGross) * 100 : 0;
                    return rate.toFixed(1) + '%';
                  })()}
                </td>
                <td className="px-4 py-2 text-right text-blue-900">-</td>
                <td className="px-4 py-2 text-right text-blue-900">
                  {(totalStock2512Target / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}K
                </td>
                <td className={`px-4 py-2 text-right font-bold ${
                  totalStock2512Actual > totalStock2512Target 
                    ? 'bg-red-100 text-red-800 border-l-4 border-red-600' 
                    : totalStock2512Actual < totalStock2512Target
                    ? 'bg-green-100 text-green-800 border-l-4 border-green-600'
                    : 'text-blue-900'
                }`}>
                  {(totalStock2512Actual / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}K
                  {totalStock2512Actual !== totalStock2512Target && (
                    <span className="ml-1 text-xs">
                      {totalStock2512Actual > totalStock2512Target 
                        ? `⚠️ +${((totalStock2512Actual - totalStock2512Target) / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}K`
                        : `✓ ${((totalStock2512Actual - totalStock2512Target) / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}K`
                      }
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
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
  
  // 연차별 열림/닫힘 상태 관리 (Y1, Y2, Y3Plus 순서)
  const [yearBucketStates, setYearBucketStates] = useState<boolean[]>([true, true, true]);
  
  // AI 분석 섹션 토글 상태
  const [aiAnalysisOpen, setAiAnalysisOpen] = useState(true);
  
  // 전체 과시즌 합계 토글 상태
  const [totalSectionOpen, setTotalSectionOpen] = useState(true);

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
    subcategory: string; // SUBCATEGORY 축약형 (O열)
    subcategoryName: string;
    itemDesc2: string | null;
    seasonCode: string;
    yearBucket: YearBucket;
    stockQty: number; // 재고 수량
    stockTagK: number;
    monthGrossK: number;
    monthNetK: number;
    discountRate: number | null;
    inventoryDays: number | null;
    ratio: number;
  };

  type StagnantByBucket = Record<YearBucket, StagnantItem[]>;

  // 품번별 분석 (CY, OFF-SEASON FW, HK/MC만) - 모든 카테고리
  const itemAnalysis = useMemo(() => {
    const cyFiltered = filteredData.filter(
      row => row.sourceYearType === 'CY' && 
             isOffSeasonFW(row) && 
             (row.country === 'HK' || row.country === 'MC')
    );

    // 품번별로 집계
    const itemMap = new Map<string, {
      itemCode: string;
      mappedCategory: string; // INNER/OUTER/BOTTOM/의류기타
      subcategory: string; // SUBCATEGORY 축약형 (O열)
      subcategoryName: string;
      itemDesc2: string | null;
      seasonCode: string;
      yearBucket: YearBucket;
      stockQty: number; // 재고 수량
      stockTag: number;
      monthGross: number;
      monthNet: number;
      cogs: number;
    }>();

    cyFiltered.forEach(row => {
      const existing = itemMap.get(row.itemCode);
      if (existing) {
        existing.stockQty += row.stockQty;
        existing.stockTag += row.stockPriceFx;
        existing.monthGross += row.grossSalesFx;
        existing.monthNet += row.netSalesFx;
        existing.cogs += row.cogsFx;
      } else {
        itemMap.set(row.itemCode, {
          itemCode: row.itemCode,
          mappedCategory: row.mappedCategory,
          subcategory: row.subcategory, // O열 축약형
          subcategoryName: row.subcategoryName,
          itemDesc2: row.itemDesc2,
          seasonCode: row.seasonInfo.seasonCode,
          yearBucket: row.seasonInfo.yearBucket,
          stockQty: row.stockQty,
          stockTag: row.stockPriceFx,
          monthGross: row.grossSalesFx,
          monthNet: row.netSalesFx,
          cogs: row.cogsFx,
        });
      }
    });

    // Item 형식으로 변환 (mappedCategory와 subcategory 포함)
    type ItemAnalysisData = StagnantItem & { 
      mappedCategory: string;
      subcategory: string;
    };
    const items: ItemAnalysisData[] = [];
    itemMap.forEach((data, itemCode) => {
      const stockTagK = data.stockTag / 1000;
      const monthGrossK = data.monthGross / 1000;
      const monthNetK = data.monthNet / 1000;
      const ratio = data.stockTag > 0 ? data.monthGross / data.stockTag : 0;
      const discountRate = data.monthGross > 0 ? 1 - (data.monthNet / data.monthGross) : null;
      const inventoryDays = data.cogs > 0 ? (data.stockTag / data.cogs) * 30 : null;

      items.push({
        itemCode,
        mappedCategory: data.mappedCategory,
        subcategory: data.subcategory,
        subcategoryName: data.subcategoryName,
        itemDesc2: data.itemDesc2,
        seasonCode: data.seasonCode,
        yearBucket: data.yearBucket,
        stockQty: data.stockQty,
        stockTagK,
        monthGrossK,
        monthNetK,
        discountRate,
        inventoryDays,
        ratio,
      });
    });

    // 연차별로 그룹화하고 재고택가 기준 정렬
    type ItemAnalysisByBucket = Record<YearBucket, ItemAnalysisData[]>;
    const result: ItemAnalysisByBucket = {
      Y1: items.filter(i => i.yearBucket === 'Y1').sort((a, b) => b.stockTagK - a.stockTagK),
      Y2: items.filter(i => i.yearBucket === 'Y2').sort((a, b) => b.stockTagK - a.stockTagK),
      Y3Plus: items.filter(i => i.yearBucket === 'Y3Plus').sort((a, b) => b.stockTagK - a.stockTagK),
      InSeason: [],
    };

    console.log('품번별 분석:', result);
    return result;
  }, [filteredData]);

  // 정체재고 계산 (CY, OFF-SEASON FW, HK/MC만)
  const stagnantByBucket = useMemo(() => {
    const cyFiltered = filteredData.filter(
      row => row.sourceYearType === 'CY' && isOffSeasonFW(row) && (row.country === 'HK' || row.country === 'MC')
    );

    // 품번별로 집계
    const itemMap = new Map<string, {
      itemCode: string;
      subcategory: string; // SUBCATEGORY 축약형 (O열)
      subcategoryName: string;
      itemDesc2: string | null;
      seasonCode: string;
      yearBucket: YearBucket;
      stockQty: number; // 재고 수량
      stockTag: number;
      monthGross: number;
      monthNet: number;
    }>();

    for (const row of cyFiltered) {
      const key = row.itemCode;
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          itemCode: row.itemCode,
          subcategory: row.subcategory, // O열 축약형
          subcategoryName: row.subcategoryName,
          itemDesc2: row.itemDesc2,
          seasonCode: row.seasonInfo.seasonCode,
          yearBucket: row.seasonInfo.yearBucket,
          stockQty: 0,
          stockTag: 0,
          monthGross: 0,
          monthNet: 0,
        });
      }
      const item = itemMap.get(key)!;
      item.stockQty += row.stockQty;
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
            subcategory: item.subcategory,
            subcategoryName: item.subcategoryName,
            itemDesc2: item.itemDesc2,
            seasonCode: item.seasonCode,
            yearBucket: item.yearBucket,
            stockQty: item.stockQty,
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

  // 카테고리별 목표 대비 분석 (Graph 데이터 사용)
  const categoryAnalysis = useMemo(() => {
    console.log('=== 카테고리별 분석 ===');
    
    type CategoryData = {
      tagSalesActual: number;
      netSalesActual: number;
      tagSalesTarget: number;
      discountRateTarget: number;
      discountRateActual: number;
      stock2511: number; // 2511 기말재고 (기초)
      stock2512Actual: number; // 2512 기말재고 실적
      stock2512Target: number; // 2512 기말재고 목표 (기초 - 판매목표)
    };
    
    const result: Record<string, Record<string, CategoryData>> = {};
    
    // 연차별 (Y1, Y2, Y3Plus)로 처리
    ['Y1', 'Y2', 'Y3Plus'].forEach(bucket => {
      result[bucket] = {
        'INNER': { tagSalesActual: 0, netSalesActual: 0, tagSalesTarget: 0, discountRateTarget: 0, discountRateActual: 0, stock2511: 0, stock2512Actual: 0, stock2512Target: 0 },
        'OUTER': { tagSalesActual: 0, netSalesActual: 0, tagSalesTarget: 0, discountRateTarget: 0, discountRateActual: 0, stock2511: 0, stock2512Actual: 0, stock2512Target: 0 },
        'BOTTOM': { tagSalesActual: 0, netSalesActual: 0, tagSalesTarget: 0, discountRateTarget: 0, discountRateActual: 0, stock2511: 0, stock2512Actual: 0, stock2512Target: 0 },
        '의류기타': { tagSalesActual: 0, netSalesActual: 0, tagSalesTarget: 0, discountRateTarget: 0, discountRateActual: 0, stock2511: 0, stock2512Actual: 0, stock2512Target: 0 },
      };
    });
    
    // 2511 기말재고 집계 (기초)
    graphData
      .filter(row => 
        row.period === '2511' && 
        (row.country === 'HK' || row.country === 'MO') && 
        isOffSeasonFW(row)
      )
      .forEach(row => {
        const bucket = row.seasonInfo.yearBucket;
        const category = row.mappedCategory;
        
        if (bucket in result && category in result[bucket]) {
          result[bucket][category].stock2511 += row.stockPriceFx;
        }
      });
    
    // 2512 실적 집계 (판매 + 재고)
    graphData
      .filter(row => 
        row.period === '2512' && 
        (row.country === 'HK' || row.country === 'MO') && 
        isOffSeasonFW(row)
      )
      .forEach(row => {
        const bucket = row.seasonInfo.yearBucket;
        const category = row.mappedCategory;
        
        if (bucket in result && category in result[bucket]) {
          result[bucket][category].tagSalesActual += row.grossSalesFx;
          result[bucket][category].netSalesActual += row.netSalesFx;
          result[bucket][category].stock2512Actual += row.stockPriceFx;
        }
      });
    
    // 목표 집계 (targetData에서)
    targetData.filter(t => t.period === '2025-12').forEach(target => {
      const bucket = target.seasonInfo.yearBucket;
      const category = target.category;
      
      if (bucket in result && category in result[bucket]) {
        result[bucket][category].tagSalesTarget += target.tagSales;
        result[bucket][category].discountRateTarget = target.discountRate;
      }
    });
    
    // 할인율 실적 및 목표재고 계산
    Object.keys(result).forEach(bucket => {
      Object.keys(result[bucket]).forEach(category => {
        const data = result[bucket][category];
        if (data.tagSalesActual > 0) {
          data.discountRateActual = 1 - (data.netSalesActual / data.tagSalesActual);
        }
        // 목표재고 = 기초재고 - 판매목표
        data.stock2512Target = data.stock2511 - data.tagSalesTarget;
      });
      
      // 각 연차별 합계 계산
      const categories = ['INNER', 'OUTER', 'BOTTOM', '의류기타'];
      const total: CategoryData = {
        tagSalesActual: 0,
        netSalesActual: 0,
        tagSalesTarget: 0,
        discountRateTarget: 0,
        discountRateActual: 0,
        stock2511: 0,
        stock2512Actual: 0,
        stock2512Target: 0,
      };
      
      categories.forEach(cat => {
        const data = result[bucket][cat];
        total.tagSalesActual += data.tagSalesActual;
        total.netSalesActual += data.netSalesActual;
        total.tagSalesTarget += data.tagSalesTarget;
        total.stock2511 += data.stock2511;
        total.stock2512Actual += data.stock2512Actual;
      });
      
      // 합계의 할인율 계산
      if (total.tagSalesActual > 0) {
        total.discountRateActual = 1 - (total.netSalesActual / total.tagSalesActual);
      }
      
      // 합계의 목표재고
      total.stock2512Target = total.stock2511 - total.tagSalesTarget;
      
      // 합계의 목표 할인율 (가중평균)
      let weightedDiscountTarget = 0;
      let totalTarget = 0;
      categories.forEach(cat => {
        const data = result[bucket][cat];
        if (data.tagSalesTarget > 0) {
          weightedDiscountTarget += data.discountRateTarget * data.tagSalesTarget;
          totalTarget += data.tagSalesTarget;
        }
      });
      total.discountRateTarget = totalTarget > 0 ? weightedDiscountTarget / totalTarget : 0;
      
      result[bucket]['합계'] = total;
    });
    
    console.log('Category analysis:', result);
    return result;
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

        {/* 과시즌재고현황 섹션 */}
        <section className="mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border-2 border-purple-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📊</span>
                <h2 className="text-xl font-bold text-purple-900">과시즌재고현황</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  // 현재 하나라도 열려있으면 전체 닫기, 모두 닫혀있으면 전체 열기
                  const hasOpen = yearBucketStates.some(state => state) || totalSectionOpen;
                  const newState = !hasOpen;
                  setYearBucketStates([newState, newState, newState]);
                  setTotalSectionOpen(newState);
                }}
                className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-300 rounded-lg hover:bg-purple-100 transition"
              >
                {(yearBucketStates.some(state => state) || totalSectionOpen) ? '전체 접기' : '전체 펼치기'}
              </button>
            </div>
            
            {/* AI 분석 섹션 */}
            {(() => {
              // 연차별 분석
              const y1Data = categoryAnalysis.Y1;
              const y2Data = categoryAnalysis.Y2;
              const y3Data = categoryAnalysis.Y3Plus;
              
              // 1년차 분석
              const y1Total = y1Data['합계'];
              const y1AchievementRate = y1Total ? (y1Total.tagSalesActual / Math.max(y1Total.tagSalesTarget, 1)) * 100 : 0;
              
              // 2년차 분석
              const y2Total = y2Data['합계'];
              const y2AchievementRate = y2Total ? (y2Total.tagSalesActual / Math.max(y2Total.tagSalesTarget, 1)) * 100 : 0;
              const y2DiscountActual = y2Total && y2Total.tagSalesActual > 0 ? (1 - y2Total.netSalesActual / y2Total.tagSalesActual) * 100 : 0;
              const y2DiscountDiff = y2Total ? y2DiscountActual - y2Total.discountRateTarget * 100 : 0;
              
              // 3년차 분석
              const y3Total = y3Data['합계'];
              const y3AchievementRate = y3Total ? (y3Total.tagSalesActual / Math.max(y3Total.tagSalesTarget, 1)) * 100 : 0;
              const y3DiscountActual = y3Total && y3Total.tagSalesActual > 0 ? (1 - y3Total.netSalesActual / y3Total.tagSalesActual) * 100 : 0;
              const y3DiscountDiff = y3Total ? y3DiscountActual - y3Total.discountRateTarget * 100 : 0;
              
              // 카테고리별 분석 (전체 연차 합산)
              const categoryPerformance: Record<string, { sales: number; achievement: number; discountDiff: number; stockVariance: number }> = {};
              
              ['INNER', 'OUTER', 'BOTTOM', '의류기타'].forEach(cat => {
                const y1Cat = y1Data[cat];
                const y2Cat = y2Data[cat];
                const y3Cat = y3Data[cat];
                
                const totalSales = (y1Cat?.tagSalesActual || 0) + (y2Cat?.tagSalesActual || 0) + (y3Cat?.tagSalesActual || 0);
                const totalTarget = (y1Cat?.tagSalesTarget || 0) + (y2Cat?.tagSalesTarget || 0) + (y3Cat?.tagSalesTarget || 0);
                const avgAchievement = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;
                
                const y1DiscountActualCat = y1Cat && y1Cat.tagSalesActual > 0 ? (1 - y1Cat.netSalesActual / y1Cat.tagSalesActual) * 100 : 0;
                const y2DiscountActualCat = y2Cat && y2Cat.tagSalesActual > 0 ? (1 - y2Cat.netSalesActual / y2Cat.tagSalesActual) * 100 : 0;
                const y3DiscountActualCat = y3Cat && y3Cat.tagSalesActual > 0 ? (1 - y3Cat.netSalesActual / y3Cat.tagSalesActual) * 100 : 0;
                
                const avgDiscountDiff = [
                  y1DiscountActualCat - (y1Cat?.discountRateTarget || 0) * 100,
                  y2DiscountActualCat - (y2Cat?.discountRateTarget || 0) * 100,
                  y3DiscountActualCat - (y3Cat?.discountRateTarget || 0) * 100,
                ].reduce((sum, val) => sum + val, 0) / 3;
                
                const totalStockVariance = 
                  ((y1Cat?.stock2512Actual || 0) - (y1Cat?.stock2512Target || 0)) +
                  ((y2Cat?.stock2512Actual || 0) - (y2Cat?.stock2512Target || 0)) +
                  ((y3Cat?.stock2512Actual || 0) - (y3Cat?.stock2512Target || 0));
                
                categoryPerformance[cat] = {
                  sales: totalSales,
                  achievement: avgAchievement,
                  discountDiff: avgDiscountDiff,
                  stockVariance: totalStockVariance,
                };
              });
              
              // 카테고리 성과 순위
              const sortedCategories = Object.entries(categoryPerformance)
                .sort((a, b) => b[1].achievement - a[1].achievement);
              
              // 분석 텍스트 생성
              let analysisText = '';
              
              // 연차별 분석
              analysisText += '📌 연차별 실적: ';
              if (y1AchievementRate >= 90) {
                analysisText += `1년차는 판매목표 대비 ${y1AchievementRate.toFixed(1)}% 달성으로 양호한 실적을 보였습니다. `;
              } else {
                analysisText += `1년차는 판매목표 대비 ${y1AchievementRate.toFixed(1)}% 달성으로 미흡한 실적입니다. `;
              }
              
              analysisText += `2년차와 3년차는 각각 ${y2AchievementRate.toFixed(1)}%, ${y3AchievementRate.toFixed(1)}% 달성으로 목표 미달입니다. `;
              
              analysisText += '\n\n';
              
              // 할인율 분석
              analysisText += '💡 할인율 전략: ';
              
              // 할인율 차이가 음수 = 실적이 목표보다 낮음 = 할인을 덜 함
              const y2NeedsMoreDiscount = y2DiscountDiff < 0;
              const y3NeedsMoreDiscount = y3DiscountDiff < 0;
              
              if (y2NeedsMoreDiscount || y3NeedsMoreDiscount) {
                if (y2NeedsMoreDiscount && y3NeedsMoreDiscount) {
                  analysisText += `2년차(${y2DiscountDiff.toFixed(1)}%p)와 3년차(${y3DiscountDiff.toFixed(1)}%p) 모두 `;
                  analysisText += '목표 대비 할인율이 낮아 판매 부진의 주요 원인으로 보입니다. 공격적인 할인 프로모션이 필요합니다. ';
                } else if (y2NeedsMoreDiscount) {
                  analysisText += `2년차(${y2DiscountDiff.toFixed(1)}%p)는 목표 대비 할인율이 낮습니다. `;
                  analysisText += `3년차(${y3DiscountDiff.toFixed(1)}%p)는 할인율이 높으나 판매 실적이 부진합니다. `;
                } else {
                  analysisText += `3년차(${y3DiscountDiff.toFixed(1)}%p)는 목표 대비 할인율이 낮습니다. `;
                  analysisText += `2년차(${y2DiscountDiff.toFixed(1)}%p)는 할인율이 높으나 판매 실적이 부진합니다. `;
                }
              } else {
                analysisText += `2년차(${y2DiscountDiff > 0 ? '+' : ''}${y2DiscountDiff.toFixed(1)}%p)와 3년차(${y3DiscountDiff > 0 ? '+' : ''}${y3DiscountDiff.toFixed(1)}%p)의 할인율이 목표보다 높게 운영되었으나, 판매 실적이 부진합니다. `;
              }
              
              analysisText += '\n\n';
              
              // 카테고리별 분석
              analysisText += '🎯 카테고리별 분석: ';
              
              // 의류기타 성과 분석
              const etcPerformance = categoryPerformance['의류기타'];
              if (etcPerformance && etcPerformance.achievement > 100) {
                analysisText += `비니 판매 증가로 의류기타가 ${etcPerformance.achievement.toFixed(1)}% 목표 초과 달성했습니다. `;
              }
              
              // BOTTOM 카테고리 성과 분석
              const bottomPerformance = categoryPerformance['BOTTOM'];
              if (bottomPerformance && bottomPerformance.achievement < 50) {
                analysisText += `과시즌 바지(BOTTOM)는 ${bottomPerformance.achievement.toFixed(1)}% 달성으로 전 연차 공통적으로 실적이 부진합니다. `;
              }
              
              // 기타 카테고리 요약
              const otherCategories = sortedCategories.filter(([cat]) => cat !== '의류기타' && cat !== 'BOTTOM');
              if (otherCategories.length > 0) {
                const bestOther = otherCategories[0];
                const worstOther = otherCategories[otherCategories.length - 1];
                if (bestOther[0] !== worstOther[0]) {
                  analysisText += `${bestOther[0]}는 ${bestOther[1].achievement.toFixed(1)}%로 양호하나, ${worstOther[0]}는 ${worstOther[1].achievement.toFixed(1)}%로 개선이 필요합니다.`;
                }
              }
              
              analysisText += '\n\n';
              
              // 정체재고 수량 및 택금액 분석
              const totalStagnantQty = stagnantByBucket.Y1.reduce((sum, item) => sum + item.stockQty, 0) +
                                       stagnantByBucket.Y2.reduce((sum, item) => sum + item.stockQty, 0) +
                                       stagnantByBucket.Y3Plus.reduce((sum, item) => sum + item.stockQty, 0);
              const y1StagnantQty = stagnantByBucket.Y1.reduce((sum, item) => sum + item.stockQty, 0);
              const y2StagnantQty = stagnantByBucket.Y2.reduce((sum, item) => sum + item.stockQty, 0);
              const y3StagnantQty = stagnantByBucket.Y3Plus.reduce((sum, item) => sum + item.stockQty, 0);
              
              // 정체재고 택금액 계산 (K 단위)
              const totalStagnantStockTagK = stagnantByBucket.Y1.reduce((sum, item) => sum + item.stockTagK, 0) +
                                           stagnantByBucket.Y2.reduce((sum, item) => sum + item.stockTagK, 0) +
                                           stagnantByBucket.Y3Plus.reduce((sum, item) => sum + item.stockTagK, 0);
              const y1StagnantStockTagK = stagnantByBucket.Y1.reduce((sum, item) => sum + item.stockTagK, 0);
              const y2StagnantStockTagK = stagnantByBucket.Y2.reduce((sum, item) => sum + item.stockTagK, 0);
              const y3StagnantStockTagK = stagnantByBucket.Y3Plus.reduce((sum, item) => sum + item.stockTagK, 0);
              
              analysisText += '📦 정체재고 수량: ';
              analysisText += `총 ${totalStagnantQty.toLocaleString('ko-KR')}개(QTY), 택금액 ${formatNumberK(totalStagnantStockTagK * 1000)}의 정체재고가 있으며, `;
              analysisText += `1년차 ${y1StagnantQty.toLocaleString('ko-KR')}개(${formatNumberK(y1StagnantStockTagK * 1000)}), `;
              analysisText += `2년차 ${y2StagnantQty.toLocaleString('ko-KR')}개(${formatNumberK(y2StagnantStockTagK * 1000)}), `;
              analysisText += `3년차 이상 ${y3StagnantQty.toLocaleString('ko-KR')}개(${formatNumberK(y3StagnantStockTagK * 1000)})로 구성되어 있습니다. `;
              analysisText += `(정체재고 기준: 당월 택가매출이 재고택가의 0.1% 미만인 품번) `;
              if (y3StagnantQty > y1StagnantQty && y3StagnantQty > y2StagnantQty) {
                analysisText += '3년차 이상 재고가 가장 많아 즉각적인 처분이 필요합니다.';
              } else if (y2StagnantQty > y1StagnantQty) {
                analysisText += '2년차 재고가 많아 할인 프로모션을 통한 소진이 시급합니다.';
              } else {
                analysisText += '1년차 재고가 상대적으로 많아 조기 할인 전략을 검토해야 합니다.';
              }
              
              return (
                <div className="mb-6 bg-gradient-to-r from-purple-50 to-indigo-50 border-l-4 border-purple-500 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAiAnalysisOpen(!aiAnalysisOpen)}
                    className="w-full flex items-center justify-between p-4 hover:bg-purple-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🤖</span>
                      <div className="text-sm font-bold text-purple-900">AI 분석 요약</div>
                    </div>
                    <span className={`text-purple-600 transition-transform ${aiAnalysisOpen ? 'rotate-180' : ''}`}>
                      ▾
                    </span>
                  </button>
                  {aiAnalysisOpen && (
                    <div className="px-4 pb-4">
                      <div className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                        {analysisText}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            
            {/* 전체 과시즌 합계 */}
            {(() => {
              // Y1, Y2, Y3Plus 전체 합계 계산
              const allBuckets = ['Y1', 'Y2', 'Y3Plus'] as const;
              const totalCategories: Record<string, CategoryData> = {
                'INNER': { tagSalesActual: 0, netSalesActual: 0, tagSalesTarget: 0, discountRateTarget: 0, discountRateActual: 0, stock2511: 0, stock2512Actual: 0, stock2512Target: 0 },
                'OUTER': { tagSalesActual: 0, netSalesActual: 0, tagSalesTarget: 0, discountRateTarget: 0, discountRateActual: 0, stock2511: 0, stock2512Actual: 0, stock2512Target: 0 },
                'BOTTOM': { tagSalesActual: 0, netSalesActual: 0, tagSalesTarget: 0, discountRateTarget: 0, discountRateActual: 0, stock2511: 0, stock2512Actual: 0, stock2512Target: 0 },
                '의류기타': { tagSalesActual: 0, netSalesActual: 0, tagSalesTarget: 0, discountRateTarget: 0, discountRateActual: 0, stock2511: 0, stock2512Actual: 0, stock2512Target: 0 },
              };
              
              // 모든 연차의 카테고리별 합계 계산
              allBuckets.forEach(bucket => {
                const bucketData = categoryAnalysis[bucket];
                ['INNER', 'OUTER', 'BOTTOM', '의류기타'].forEach(cat => {
                  const data = bucketData[cat];
                  if (data) {
                    totalCategories[cat].tagSalesActual += data.tagSalesActual;
                    totalCategories[cat].netSalesActual += data.netSalesActual;
                    totalCategories[cat].tagSalesTarget += data.tagSalesTarget;
                    totalCategories[cat].stock2511 += data.stock2511;
                    totalCategories[cat].stock2512Actual += data.stock2512Actual;
                    totalCategories[cat].stock2512Target += data.stock2512Target;
                  }
                });
              });
              
              // 할인율 계산
              Object.keys(totalCategories).forEach(cat => {
                const data = totalCategories[cat];
                if (data.tagSalesActual > 0) {
                  data.discountRateActual = 1 - (data.netSalesActual / data.tagSalesActual);
                }
                // 할인율 목표는 가중평균으로 계산
                let weightedTarget = 0;
                let totalTarget = 0;
                allBuckets.forEach(bucket => {
                  const bucketData = categoryAnalysis[bucket];
                  const bucketCat = bucketData[cat];
                  if (bucketCat && bucketCat.tagSalesTarget > 0) {
                    weightedTarget += bucketCat.discountRateTarget * bucketCat.tagSalesTarget;
                    totalTarget += bucketCat.tagSalesTarget;
                  }
                });
                data.discountRateTarget = totalTarget > 0 ? weightedTarget / totalTarget : 0;
              });
              
              // YearBucketSection 컴포넌트가 자동으로 합계를 계산하므로 '합계'를 추가하지 않음
              
              return (
                <YearBucketSection 
                  key="total"
                  bucketLabel="과시즌 합계 (24F, 23F, 22F~)"
                  categories={totalCategories}
                  isOpen={totalSectionOpen}
                  onToggle={() => setTotalSectionOpen(!totalSectionOpen)}
                />
              );
            })()}
            
            {/* 연차별 테이블 */}
            {(['Y1', 'Y2', 'Y3Plus'] as const).map((bucket, index) => {
              const bucketLabel = bucket === 'Y1' ? '1년차 (24F)' : bucket === 'Y2' ? '2년차 (23F)' : '3년차~ (22F~)';
              const categories = categoryAnalysis[bucket];
              
              return (
                <YearBucketSection 
                  key={bucket} 
                  bucketLabel={bucketLabel} 
                  categories={categories}
                  isOpen={yearBucketStates[index]}
                  onToggle={() => {
                    const newStates = [...yearBucketStates];
                    newStates[index] = !newStates[index];
                    setYearBucketStates(newStates);
                  }}
                />
              );
            })}
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
                      <span className="text-gray-500 w-12">1년차:</span>
                      <span className="text-gray-700 font-medium w-16 text-right">{formatNumberK(cyY1Stock)}</span>
                      <span className={`text-xs font-medium w-14 text-right ${y1StockYoyRatio !== null && y1StockYoyRatio >= 100 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatPercentRatio(y1StockYoyRatio)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 w-12">2년차:</span>
                      <span className="text-gray-700 font-medium w-16 text-right">{formatNumberK(cyY2Stock)}</span>
                      <span className={`text-xs font-medium w-14 text-right ${y2StockYoyRatio !== null && y2StockYoyRatio >= 100 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatPercentRatio(y2StockYoyRatio)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 w-12">3년차~:</span>
                      <span className="text-gray-700 font-medium w-16 text-right">{formatNumberK(cyY3PlusStock)}</span>
                      <span className="text-xs font-medium text-gray-500 w-14 text-right">
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
                      <span className="text-gray-500 w-12">1년차:</span>
                      <span className="text-gray-700 font-medium w-16 text-right">{formatNumberK(cyY1Sales)}</span>
                      <span className={`text-xs font-medium w-14 text-right ${y1SalesYoyRatio !== null && y1SalesYoyRatio >= 100 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatPercentRatio(y1SalesYoyRatio)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 w-12">2년차:</span>
                      <span className="text-gray-700 font-medium w-16 text-right">{formatNumberK(cyY2Sales)}</span>
                      <span className={`text-xs font-medium w-14 text-right ${y2SalesYoyRatio !== null && y2SalesYoyRatio >= 100 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatPercentRatio(y2SalesYoyRatio)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 w-12">3년차~:</span>
                      <span className="text-gray-700 font-medium w-16 text-right">{formatNumberK(cyY3PlusSales)}</span>
                      <span className="text-xs font-medium text-gray-500 w-14 text-right">
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
                      <span className="text-gray-500 w-12">1년차:</span>
                      <span className="text-orange-600 font-medium w-16 text-right">{cyY1Discount.toFixed(1)}%</span>
                      <span className="text-orange-600 text-xs font-medium w-16 text-right">
                        {formatPercentPoint(y1DiscountDiffPp)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 w-12">2년차:</span>
                      <span className="text-orange-600 font-medium w-16 text-right">{cyY2Discount.toFixed(1)}%</span>
                      <span className="text-orange-600 text-xs font-medium w-16 text-right">
                        {formatPercentPoint(y2DiscountDiffPp)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 w-12">3년차~:</span>
                      <span className="text-orange-600 font-medium w-16 text-right">{cyY3PlusDiscount.toFixed(1)}%</span>
                      <span className="text-orange-600 text-xs font-medium w-16 text-right">
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
                      <span className="text-gray-500 w-12">1년차:</span>
                      <span className="text-gray-700 font-medium w-16 text-right">{y1InventoryDays}일</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 w-12">2년차:</span>
                      <span className="text-gray-700 font-medium w-16 text-right">{y2InventoryDays}일</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 w-12">3년차~:</span>
                      <span className="text-gray-700 font-medium w-16 text-right">{y3PlusInventoryDays}일</span>
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

        {/* 품번별 상세 분석 섹션 */}
        <section className="mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border-2 border-indigo-200">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🔍</span>
              <h2 className="text-xl font-bold text-indigo-900">품번별 상세 분석</h2>
            </div>
            <p className="text-xs text-gray-500 mb-6">재고택가 기준 상위 5개 품번 분석</p>
            
            {(['Y1', 'Y2', 'Y3Plus'] as const).map((bucket) => {
              const bucketLabel = bucket === 'Y1' ? '1년차 (24F)' : bucket === 'Y2' ? '2년차 (23F)' : '3년차~ (22F~)';
              const items = itemAnalysis[bucket];
              
              if (items.length === 0) return null;
              
              const ItemBucketTable = () => {
                const [selectedCategory, setSelectedCategory] = useState<string>('전체');
                const [showAll, setShowAll] = useState(false);
                
                // 정렬 상태 관리
                const [sortConfig, setSortConfig] = useState<{ column: string | null; direction: 'asc' | 'desc' }>({
                  column: 'stockTagK', // 기본값: 택가재고 내림차순
                  direction: 'desc',
                });
                
                // 카테고리 필터링
                const filteredItems = selectedCategory === '전체' 
                  ? items 
                  : items.filter(item => item.mappedCategory === selectedCategory);
                
                // 정렬 함수
                const handleSort = (column: string) => {
                  setSortConfig(prev => {
                    if (prev.column === column) {
                      // 같은 컬럼 클릭 시 정렬 방향 전환
                      return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
                    } else {
                      // 다른 컬럼 클릭 시 내림차순으로 시작
                      return { column, direction: 'desc' };
                    }
                  });
                };
                
                // 정렬된 아이템 반환
                const getSortedItems = (itemsToSort: typeof filteredItems) => {
                  if (!sortConfig.column) return itemsToSort;
                  
                  const sorted = [...itemsToSort].sort((a, b) => {
                    let aValue: number | null;
                    let bValue: number | null;
                    
                    switch (sortConfig.column) {
                      case 'stockTagK':
                        aValue = a.stockTagK;
                        bValue = b.stockTagK;
                        break;
                      case 'monthGrossK':
                        aValue = a.monthGrossK;
                        bValue = b.monthGrossK;
                        break;
                      case 'monthNetK':
                        aValue = a.monthNetK;
                        bValue = b.monthNetK;
                        break;
                      case 'discountRate':
                        aValue = a.discountRate;
                        bValue = b.discountRate;
                        break;
                      case 'inventoryDays':
                        aValue = a.inventoryDays;
                        bValue = b.inventoryDays;
                        break;
                      default:
                        return 0;
                    }
                    
                    // null 처리: null은 항상 뒤로
                    if (aValue === null && bValue === null) return 0;
                    if (aValue === null) return 1;
                    if (bValue === null) return -1;
                    
                    const diff = aValue - bValue;
                    return sortConfig.direction === 'asc' ? diff : -diff;
                  });
                  
                  return sorted;
                };
                
                // 정렬된 필터링된 아이템
                const sortedFilteredItems = getSortedItems(filteredItems);
                
                // 기본 5개, 더보기 클릭 시 전체 표시
                const displayItems = showAll ? sortedFilteredItems : sortedFilteredItems.slice(0, 5);
                
                // 정렬 아이콘 렌더링 함수
                const renderSortIcon = (column: string) => {
                  if (sortConfig.column !== column) {
                    return <span className="text-gray-300 ml-1">↕</span>;
                  }
                  return sortConfig.direction === 'asc' 
                    ? <span className="text-blue-600 ml-1">↑</span>
                    : <span className="text-blue-600 ml-1">↓</span>;
                };
                
                // 필터링된 항목의 합계 계산 (정렬된 필터링된 아이템 사용)
                const totalStockTag = sortedFilteredItems.reduce((sum, item) => sum + item.stockTagK, 0);
                const totalMonthGross = sortedFilteredItems.reduce((sum, item) => sum + item.monthGrossK, 0);
                const totalMonthNet = sortedFilteredItems.reduce((sum, item) => sum + item.monthNetK, 0);
                const totalDiscountRate = totalMonthGross > 0 ? (1 - totalMonthNet / totalMonthGross) * 100 : 0;
                const totalInventoryDays = sortedFilteredItems.length > 0 
                  ? sortedFilteredItems.reduce((sum, item) => sum + (item.inventoryDays || 0), 0) / sortedFilteredItems.length 
                  : 0;
                
                // 카테고리별 개수 집계
                const categoryCounts = {
                  '전체': items.length,
                  'INNER': items.filter(i => i.mappedCategory === 'INNER').length,
                  'OUTER': items.filter(i => i.mappedCategory === 'OUTER').length,
                  'BOTTOM': items.filter(i => i.mappedCategory === 'BOTTOM').length,
                  '의류기타': items.filter(i => i.mappedCategory === '의류기타').length,
                };
                
                return (
                  <>
                    {/* 카테고리 필터 버튼 */}
                    <div className="mb-4 flex gap-2 flex-wrap">
                      {Object.entries(categoryCounts).map(([cat, count]) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat);
                            setShowAll(false); // 필터 변경 시 접기
                          }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                            selectedCategory === cat
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {cat} ({count})
                        </button>
                      ))}
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse table-fixed">
                        <colgroup>
                          <col style={{width: '4%'}} />
                          <col style={{width: '8%'}} />
                          <col style={{width: '10%'}} />
                          <col style={{width: '8%'}} />
                          <col style={{width: '18%'}} />
                          <col style={{width: '6%'}} />
                          <col style={{width: '9%'}} />
                          <col style={{width: '9%'}} />
                          <col style={{width: '9%'}} />
                          <col style={{width: '9%'}} />
                          <col style={{width: '10%'}} />
                        </colgroup>
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="px-2 py-2 text-center text-gray-700 font-semibold">순위</th>
                            <th className="px-2 py-2 text-left text-gray-700 font-semibold">카테고리</th>
                            <th className="px-2 py-2 text-left text-gray-700 font-semibold">Item Code</th>
                            <th className="px-2 py-2 text-left text-gray-700 font-semibold">SUBCATEGORY</th>
                            <th className="px-2 py-2 text-left text-gray-700 font-semibold">ITEM DESC2</th>
                            <th className="px-2 py-2 text-center text-gray-700 font-semibold">시즌</th>
                            <th 
                              className="px-2 py-2 text-right text-gray-700 font-semibold cursor-pointer hover:bg-gray-100 select-none"
                              onClick={() => handleSort('stockTagK')}
                            >
                              <div className="flex items-center justify-end">
                                택가 재고
                                {renderSortIcon('stockTagK')}
                              </div>
                            </th>
                            <th 
                              className="px-2 py-2 text-right text-gray-700 font-semibold cursor-pointer hover:bg-gray-100 select-none"
                              onClick={() => handleSort('monthGrossK')}
                            >
                              <div className="flex items-center justify-end">
                                {periodLabel} 택가매출
                                {renderSortIcon('monthGrossK')}
                              </div>
                            </th>
                            <th 
                              className="px-2 py-2 text-right text-gray-700 font-semibold cursor-pointer hover:bg-gray-100 select-none"
                              onClick={() => handleSort('monthNetK')}
                            >
                              <div className="flex items-center justify-end">
                                {periodLabel} 실판매출
                                {renderSortIcon('monthNetK')}
                              </div>
                            </th>
                            <th 
                              className="px-2 py-2 text-right text-gray-700 font-semibold cursor-pointer hover:bg-gray-100 select-none"
                              onClick={() => handleSort('discountRate')}
                            >
                              <div className="flex items-center justify-end">
                                할인율 (%)
                                {renderSortIcon('discountRate')}
                              </div>
                            </th>
                            <th 
                              className="px-2 py-2 text-right text-gray-700 font-semibold cursor-pointer hover:bg-gray-100 select-none"
                              onClick={() => handleSort('inventoryDays')}
                            >
                              <div className="flex items-center justify-end">
                                재고일수 (일)
                                {renderSortIcon('inventoryDays')}
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayItems.map((item, index) => (
                            <tr key={item.itemCode} className="border-b hover:bg-gray-50">
                              <td className="px-2 py-2 text-center text-gray-600">{index + 1}</td>
                              <td className="px-2 py-2 text-left">
                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                  item.mappedCategory === 'INNER' ? 'bg-blue-100 text-blue-700' :
                                  item.mappedCategory === 'OUTER' ? 'bg-green-100 text-green-700' :
                                  item.mappedCategory === 'BOTTOM' ? 'bg-purple-100 text-purple-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {item.mappedCategory}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-left text-gray-900 font-medium break-all">{item.itemCode}</td>
                              <td className="px-2 py-2 text-left text-gray-700 break-all">{item.subcategory}</td>
                              <td className="px-2 py-2 text-left text-gray-700 break-all">{item.itemDesc2 || '-'}</td>
                              <td className="px-2 py-2 text-center text-gray-700">{item.seasonCode}</td>
                              <td className="px-2 py-2 text-right text-blue-700 font-semibold whitespace-nowrap">
                                {item.stockTagK.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="px-2 py-2 text-right text-gray-700 whitespace-nowrap">
                                {item.monthGrossK.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="px-2 py-2 text-right text-gray-700 whitespace-nowrap">
                                {item.monthNetK.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="px-2 py-2 text-right text-orange-600 font-medium whitespace-nowrap">
                                {item.discountRate !== null ? (item.discountRate * 100).toFixed(1) : '-'}
                              </td>
                              <td className="px-2 py-2 text-right text-gray-700 whitespace-nowrap">
                                {item.inventoryDays !== null ? Math.round(item.inventoryDays) : '-'}
                              </td>
                            </tr>
                          ))}
                          {/* 필터링된 항목 합계 행 */}
                          {sortedFilteredItems.length > 0 && (
                            <tr className="bg-indigo-50 border-t-2 border-indigo-300 font-semibold">
                              <td colSpan={6} className="px-2 py-2 text-left text-indigo-900 whitespace-nowrap">
                                {selectedCategory === '전체' ? '합계' : `${selectedCategory} 합계`} ({sortedFilteredItems.length}개)
                              </td>
                              <td className="px-2 py-2 text-right text-indigo-900 font-bold whitespace-nowrap">
                                {totalStockTag.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="px-2 py-2 text-right text-indigo-900 font-bold whitespace-nowrap">
                                {totalMonthGross.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="px-2 py-2 text-right text-indigo-900 font-bold whitespace-nowrap">
                                {totalMonthNet.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="px-2 py-2 text-right text-indigo-900 font-bold whitespace-nowrap">
                                {totalDiscountRate.toFixed(1)}
                              </td>
                              <td className="px-2 py-2 text-right text-indigo-900 font-bold whitespace-nowrap">
                                {Math.round(totalInventoryDays)}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    
                    {sortedFilteredItems.length > 5 && (
                      <div className="mt-3 text-center">
                        <button
                          type="button"
                          onClick={() => setShowAll(!showAll)}
                          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          {showAll ? '접기 ▲' : `더보기 (${sortedFilteredItems.length - 5}개 더) ▼`}
                        </button>
                      </div>
                    )}
                  </>
                );
              };
              
              return (
                <div key={bucket} className="mb-6 last:mb-0">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {bucketLabel} <span className="text-sm text-gray-500">총 {items.length}개 품번</span>
                    </h3>
                  </div>
                  
                  <ItemBucketTable />
                </div>
              );
            })}
          </div>
        </section>

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
      </div>
    </div>
  );
}

// 연차별 정체재고 분석 섹션 컴포넌트
type StagnantByVintageSectionProps = {
  itemsByBucket: Record<YearBucket, Array<{
    itemCode: string;
    subcategory: string; // SUBCATEGORY 축약형 (O열)
    subcategoryName: string;
    itemDesc2: string | null;
    seasonCode: string;
    yearBucket: YearBucket;
    stockQty: number; // 재고 수량
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
  
  // 각 연차별 토글 상태 관리
  const [bucketOpen, setBucketOpen] = useState<Record<YearBucket, boolean>>({
    Y1: true,
    Y2: true,
    Y3Plus: true,
    InSeason: true,
  });
  
  // 각 연차별 정렬 상태 관리
  const [sortConfig, setSortConfig] = useState<Record<YearBucket, { column: string | null; direction: 'asc' | 'desc' }>>({
    Y1: { column: 'stockTagK', direction: 'desc' }, // 기본값: 택가재고 내림차순
    Y2: { column: 'stockTagK', direction: 'desc' },
    Y3Plus: { column: 'stockTagK', direction: 'desc' },
    InSeason: { column: null, direction: 'asc' },
  });

  const yearBucketLabel: Record<YearBucket, string> = {
    InSeason: '당시즌',
    Y1: '24F (1년차)',
    Y2: '23F (2년차)',
    Y3Plus: '22F~ (3년차~)',
  };

  // 정렬 함수
  const handleSort = (bucket: YearBucket, column: string) => {
    setSortConfig(prev => {
      const current = prev[bucket];
      if (current.column === column) {
        // 같은 컬럼 클릭 시 정렬 방향 전환
        return {
          ...prev,
          [bucket]: { column, direction: current.direction === 'asc' ? 'desc' : 'asc' },
        };
      } else {
        // 다른 컬럼 클릭 시 내림차순으로 시작
        return {
          ...prev,
          [bucket]: { column, direction: 'desc' },
        };
      }
    });
  };

  // 정렬된 아이템 반환
  const getSortedItems = (bucket: YearBucket, items: Array<{
    itemCode: string;
    subcategory: string;
    subcategoryName: string;
    itemDesc2: string | null;
    seasonCode: string;
    yearBucket: YearBucket;
    stockQty: number; // 재고 수량
    stockTagK: number;
    monthGrossK: number;
    monthNetK: number;
    discountRate: number | null;
    inventoryDays: number | null;
    ratio: number;
  }>) => {
    const config = sortConfig[bucket];
    if (!config.column) return items;

    const sorted = [...items].sort((a, b) => {
      let aValue: number | null;
      let bValue: number | null;

      switch (config.column) {
        case 'stockTagK':
          aValue = a.stockTagK;
          bValue = b.stockTagK;
          break;
        case 'monthGrossK':
          aValue = a.monthGrossK;
          bValue = b.monthGrossK;
          break;
        case 'monthNetK':
          aValue = a.monthNetK;
          bValue = b.monthNetK;
          break;
        case 'discountRate':
          aValue = a.discountRate;
          bValue = b.discountRate;
          break;
        case 'inventoryDays':
          aValue = a.inventoryDays;
          bValue = b.inventoryDays;
          break;
        default:
          return 0;
      }

      // null 처리: null은 항상 뒤로
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      const diff = aValue - bValue;
      return config.direction === 'asc' ? diff : -diff;
    });

    return sorted;
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
                  
                  {/* 하단: AI 분석 (개선된 버전 - 시즌별/카테고리별 특징 포함) */}
                  {(() => {
                    const allStagnantItems = [...itemsByBucket.Y1, ...itemsByBucket.Y2, ...itemsByBucket.Y3Plus];
                    
                    // 카테고리별 분석
                    const categoryCount: Record<string, number> = {};
                    allStagnantItems.forEach(item => {
                      const cat = item.subcategoryName || 'Unknown';
                      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
                    });
                    const topCategories = Object.entries(categoryCount)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3);
                    
                    const zeroSalesCount = allStagnantItems.filter(item => item.monthGrossK < 0.001).length;
                    const zeroSalesPct = (zeroSalesCount / allStagnantItems.length) * 100;
                    
                    // 카테고리 특징 문구 생성
                    const categoryText = topCategories.length > 0 
                      ? `${topCategories.map(([cat, count]) => `${cat}(${count}개)`).join(', ')}에 집중되어 있습니다.`
                      : '다양한 카테고리에 분산되어 있습니다.';
                    
                    const zeroSalesText = zeroSalesPct > 50 
                      ? ` ${zeroSalesCount}개 품번(${zeroSalesPct.toFixed(0)}%)은 당월 판매가 전무합니다.`
                      : '';
                    
                    // 개선된 인사이트
                    const enhancedInsight = `${insight}\n\n${categoryText}${zeroSalesText}`;
                    
                    return (
                      <div className={`${insightBg} ${insightBorder} border rounded-lg p-3 flex items-start gap-2`}>
                        <span className="text-lg">{insightIcon}</span>
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-gray-700 mb-1">AI 분석</div>
                          <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{enhancedInsight}</div>
                        </div>
                      </div>
                    );
                  })()}
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
            {(['Y1', 'Y2', 'Y3Plus'] as const).map((bucket) => {
              const items = itemsByBucket[bucket];
              if (items.length === 0) return null;

              const sortedItems = getSortedItems(bucket, items);
              const currentSort = sortConfig[bucket];
              const isBucketOpen = bucketOpen[bucket];
              
              // 연차별 합계 계산
              const bucketTotalStockQty = items.reduce((sum, item) => sum + item.stockQty, 0);
              const bucketTotalStockTagK = stagnantStockByBucket[bucket];
              const bucketTotalMonthGrossK = items.reduce((sum, item) => sum + item.monthGrossK, 0);
              const bucketTotalMonthNetK = items.reduce((sum, item) => sum + item.monthNetK, 0);
              const bucketAvgDiscountRate = bucketTotalMonthGrossK > 0 
                ? (1 - bucketTotalMonthNetK / bucketTotalMonthGrossK) * 100 
                : null;

              // 정렬 아이콘 렌더링 함수
              const renderSortIcon = (column: string) => {
                if (currentSort.column !== column) {
                  return <span className="text-gray-300 ml-1">↕</span>;
                }
                return currentSort.direction === 'asc' 
                  ? <span className="text-blue-600 ml-1">↑</span>
                  : <span className="text-blue-600 ml-1">↓</span>;
              };

              return (
                <div key={bucket} className="mb-6 last:mb-0">
                  {/* 섹션 헤더 (토글 가능) */}
                  <button
                    type="button"
                    onClick={() => setBucketOpen(prev => ({ ...prev, [bucket]: !prev[bucket] }))}
                    className="w-full mb-2 flex items-center justify-between hover:bg-gray-50 p-2 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold text-gray-900 transition-transform ${isBucketOpen ? '' : 'opacity-70'}`}>
                        {yearBucketLabel[bucket]}
                      </span>
                      <span className="text-xs text-gray-500">총 {items.length}개 항목</span>
                      {totalStockByBucket[bucket] > 0 && (
                        <span className="text-xs text-gray-500">
                          (전체 재고대비 {((stagnantStockByBucket[bucket] / totalStockByBucket[bucket]) * 100).toFixed(1)}%)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {/* 합계 표시 (항상 표시) */}
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <span>재고(QTY): <span className="font-semibold">{bucketTotalStockQty.toLocaleString('ko-KR')}</span></span>
                        <span>택가재고: <span className="font-semibold text-red-500">{Math.round(bucketTotalStockTagK).toLocaleString('ko-KR')}K</span></span>
                        <span>택가매출: <span className="font-semibold">{formatNumber(bucketTotalMonthGrossK)}</span></span>
                        <span>실판매출: <span className="font-semibold">{formatNumber(bucketTotalMonthNetK)}</span></span>
                        {bucketAvgDiscountRate !== null && (
                          <span>할인율: <span className="font-semibold">{formatPercent(bucketAvgDiscountRate / 100)}</span></span>
                        )}
                      </div>
                      <span className={`text-xs text-gray-400 transition-transform ${isBucketOpen ? 'rotate-180' : ''}`}>
                        ▾
                      </span>
                    </div>
                  </button>

                  {/* 테이블 (접었을 때는 표시 안 함) */}
                  {isBucketOpen && showItems && (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs table-fixed" style={{ tableLayout: 'fixed' }}>
                          <colgroup>
                            <col style={{ width: '40px' }} />
                            <col style={{ width: '120px' }} />
                            <col style={{ width: '140px' }} />
                            <col style={{ width: '200px' }} />
                            <col style={{ width: '64px' }} />
                            <col style={{ width: '70px' }} />
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
                              <th className="px-2 py-1 text-left">SUBCATEGORY</th>
                              <th className="px-2 py-1 text-left">ITEM DESC2</th>
                              <th className="px-2 py-1 text-center w-16">시즌</th>
                              <th className="px-2 py-1 text-right">재고 (QTY)</th>
                              <th 
                                className="px-2 py-1 text-right cursor-pointer hover:bg-gray-100 select-none"
                                onClick={() => handleSort(bucket, 'stockTagK')}
                              >
                                <div className="flex items-center justify-end">
                                  택가 재고
                                  {renderSortIcon('stockTagK')}
                                </div>
                              </th>
                              <th 
                                className="px-2 py-1 text-right cursor-pointer hover:bg-gray-100 select-none"
                                onClick={() => handleSort(bucket, 'monthGrossK')}
                              >
                                <div className="flex items-center justify-end">
                                  {periodLabel} 택가매출
                                  {renderSortIcon('monthGrossK')}
                                </div>
                              </th>
                              <th 
                                className="px-2 py-1 text-right cursor-pointer hover:bg-gray-100 select-none"
                                onClick={() => handleSort(bucket, 'monthNetK')}
                              >
                                <div className="flex items-center justify-end">
                                  {periodLabel} 실판매출
                                  {renderSortIcon('monthNetK')}
                                </div>
                              </th>
                              <th 
                                className="px-2 py-1 text-right cursor-pointer hover:bg-gray-100 select-none"
                                onClick={() => handleSort(bucket, 'discountRate')}
                              >
                                <div className="flex items-center justify-end">
                                  할인율 (%)
                                  {renderSortIcon('discountRate')}
                                </div>
                              </th>
                              <th 
                                className="px-2 py-1 text-right cursor-pointer hover:bg-gray-100 select-none"
                                onClick={() => handleSort(bucket, 'inventoryDays')}
                              >
                                <div className="flex items-center justify-end">
                                  재고일수 (일)
                                  {renderSortIcon('inventoryDays')}
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedItems.slice(0, 3).map((item, index) => (
                              <tr key={item.itemCode} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                                <td className="px-2 py-1 text-right text-[11px] text-gray-500 w-10">
                                  {index + 1}
                                </td>
                                <td className="px-2 py-1 text-left text-gray-700 font-medium">{item.itemCode}</td>
                                <td className="px-2 py-1 text-left text-gray-700">{item.subcategory}</td>
                                <td className="px-2 py-1 text-left text-gray-700">{item.itemDesc2 || '-'}</td>
                                <td className="px-2 py-1 text-center text-gray-700 w-16">{item.seasonCode}</td>
                                <td className="px-2 py-1 text-right text-gray-700">
                                  {item.stockQty.toLocaleString('ko-KR')}
                                </td>
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
                          items={sortedItems}
                          periodLabel={periodLabel}
                        />
                      )}
                    </>
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
    subcategory: string; // SUBCATEGORY 축약형 (O열)
    subcategoryName: string;
    itemDesc2: string | null;
    seasonCode: string;
    stockQty: number; // 재고 수량
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
              <col style={{ width: '70px' }} />
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
                  <td className="px-2 py-1 text-left text-gray-700">{item.subcategory}</td>
                  <td className="px-2 py-1 text-left text-gray-700">{item.itemDesc2 || '-'}</td>
                  <td className="px-2 py-1 text-center text-gray-700 w-16">{item.seasonCode}</td>
                  <td className="px-2 py-1 text-right text-gray-700">
                    {item.stockQty.toLocaleString('ko-KR')}
                  </td>
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
