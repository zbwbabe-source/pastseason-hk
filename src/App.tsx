import { useState, useEffect, useCallback } from 'react';
import { OffSeasonInventoryDashboard } from './OffSeasonInventoryDashboard';
import { parseCSV } from './utils';

function App() {
  const [pyRowsRaw, setPyRowsRaw] = useState<Record<string, string>[] | undefined>();
  const [cyRowsRaw, setCyRowsRaw] = useState<Record<string, string>[] | undefined>();
  const [pyFileName, setPyFileName] = useState<string>('');
  const [cyFileName, setCyFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 기본 파일 경로
  const defaultPyPath = '/HQST05_2412_merged_inventory.csv';
  const defaultCyPath = '/HQST05_2512_merged_inventory.csv';

  // 기본 파일 자동 로드
  useEffect(() => {
    async function loadDefaultFiles() {
      try {
        setLoading(true);
        setError(null);

        const [pyResponse, cyResponse] = await Promise.all([
          fetch(defaultPyPath).catch(() => null),
          fetch(defaultCyPath).catch(() => null),
        ]);

        if (pyResponse && pyResponse.ok && cyResponse && cyResponse.ok) {
          const [pyText, cyText] = await Promise.all([
            pyResponse.text(),
            cyResponse.text(),
          ]);

          const pyParsed = parseCSV(pyText);
          const cyParsed = parseCSV(cyText);

          if (pyParsed.length > 0 && cyParsed.length > 0) {
            setPyRowsRaw(pyParsed);
            setCyRowsRaw(cyParsed);
            setPyFileName('HQST05_2412_merged_inventory.csv');
            setCyFileName('HQST05_2512_merged_inventory.csv');
          }
        }
      } catch (err) {
        console.warn('기본 파일 로드 실패 (파일 업로드 사용 가능):', err);
      } finally {
        setLoading(false);
      }
    }

    loadDefaultFiles();
  }, []);

  const handleFileUpload = useCallback((file: File, type: 'PY' | 'CY') => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseCSV(text);
        
        if (parsed.length === 0) {
          throw new Error('CSV 파일을 파싱할 수 없습니다. 파일 형식을 확인해주세요.');
        }

        if (type === 'PY') {
          setPyRowsRaw(parsed);
          setPyFileName(file.name);
        } else {
          setCyRowsRaw(parsed);
          setCyFileName(file.name);
        }
        
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '파일 처리 중 오류가 발생했습니다.';
        setError(errorMessage);
        console.error('Error parsing CSV:', err);
      }
    };

    reader.onerror = () => {
      const errorMessage = '파일을 읽는 중 오류가 발생했습니다.';
      setError(errorMessage);
    };

    reader.readAsText(file, 'UTF-8');
  }, []);

  const handlePyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file, 'PY');
    }
  };

  const handleCyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file, 'CY');
    }
  };

  const handleReset = () => {
    setPyRowsRaw(undefined);
    setCyRowsRaw(undefined);
    setPyFileName('');
    setCyFileName('');
    setError(null);
    // 기본 파일 다시 로드 시도
    setLoading(true);
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const hasData = pyRowsRaw && cyRowsRaw;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <div className="text-xl text-gray-700">CSV 파일을 로드하는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            OFF-SEASON FW 재고 대시보드
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Prior Year (PY) 및 Current Year (CY) CSV 파일을 분석합니다
          </p>
        </div>
      </header>

      {/* 파일 업로드 섹션 */}
      {!hasData && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">
              CSV 파일 업로드
            </h2>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-blue-800 text-sm">
                💡 기본 파일을 찾을 수 없습니다. 아래에서 CSV 파일을 업로드해주세요.
              </p>
            </div>

            <div className="space-y-6">
              {/* PY 파일 업로드 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prior Year (PY) CSV 파일
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center px-6 py-3 border-2 border-gray-300 border-dashed rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      <div className="text-center">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          stroke="currentColor"
                          fill="none"
                          viewBox="0 0 48 48"
                          aria-hidden="true"
                        >
                          <path
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-medium text-blue-600">클릭하여 파일 선택</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">CSV 파일만 지원</p>
                      </div>
                    </div>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handlePyFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
                {pyFileName && (
                  <div className="mt-2 text-sm text-green-600 font-medium">
                    ✓ {pyFileName}
                  </div>
                )}
              </div>

              {/* CY 파일 업로드 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Year (CY) CSV 파일
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center px-6 py-3 border-2 border-gray-300 border-dashed rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      <div className="text-center">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          stroke="currentColor"
                          fill="none"
                          viewBox="0 0 48 48"
                          aria-hidden="true"
                        >
                          <path
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-medium text-blue-600">클릭하여 파일 선택</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">CSV 파일만 지원</p>
                      </div>
                    </div>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCyFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
                {cyFileName && (
                  <div className="mt-2 text-sm text-green-600 font-medium">
                    ✓ {cyFileName}
                  </div>
                )}
              </div>

              {/* 상태 표시 */}
              {pyRowsRaw && cyRowsRaw && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-800 font-medium">
                        두 파일이 모두 업로드되었습니다. 데이터를 분석하는 중...
                      </p>
                      <p className="text-green-600 text-sm mt-1">
                        PY: {pyRowsRaw.length}행, CY: {cyRowsRaw.length}행
                      </p>
                    </div>
                    <button
                      onClick={handleReset}
                      className="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200 transition-colors"
                    >
                      재설정
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 대시보드 */}
      {hasData && (
        <div>
          <div className="bg-white border-b shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">
                    PY: <span className="font-medium">{pyFileName}</span> ({pyRowsRaw.length}행) | 
                    CY: <span className="font-medium">{cyFileName}</span> ({cyRowsRaw.length}행)
                  </p>
                </div>
                <p className="text-xs text-gray-500 italic">
                  추후 자동업데이트 예정
                </p>
              </div>
            </div>
          </div>
          <OffSeasonInventoryDashboard
            pyRowsRaw={pyRowsRaw}
            cyRowsRaw={cyRowsRaw}
            currentFwYear={25}
          />
        </div>
      )}
    </div>
  );
}

export default App;
