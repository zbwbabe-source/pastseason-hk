export type SourceYearType = "PY" | "CY";

export type SeasonType = "FW" | "S" | "ACC" | "OTHER";
export type YearBucket = "InSeason" | "Y1" | "Y2" | "Y3Plus";

export type SeasonInfo = {
  seasonCode: string;
  seasonType: SeasonType;
  seasonYear: number | null;
  yearBucket: YearBucket;
};

export type InventoryRowRaw = {
  period: string;
  country: string;
  exRate: number;

  itemCode: string;
  itemDesc1: string;
  itemDesc2: string | null;

  storeCode: string;
  storeName: string;

  salesDiv: string;
  season: string;

  brand: string;
  brandName: string;

  category: string;
  categoryName: string;
  subcategory: string;
  subcategoryName: string;

  salesQty: number;
  acSalesQty: number;
  stockQty: number;

  netAcPC: number;
  netAcPP: number;

  acSalesCost: number;
  acSalesNetAmount: number;
  acSalesGross: number;

  grossSalesMonth: number;
  netSalesMonth: number;
  cogsMonth: number;

  stockCost: number;
  stockPriceTag: number;

  sourceYearType: SourceYearType;
};

export type InventoryRow = InventoryRowRaw & {
  fxRate: number;
  grossSalesFx: number;
  netSalesFx: number;
  stockPriceFx: number;
  stockCostFx: number;
  acSalesGrossFx: number;
  netAcPPFx: number;
  acSalesCostFx: number;
  acSalesNetAmountFx: number;
  cogsFx: number;
  discountRateMonth: number | null;
  seasonInfo: SeasonInfo;
  mappedCategory: CategoryType; // 표준화된 카테고리
};

/**
 * 그래프용 CSV 파일의 원시 데이터 타입
 */
export type GraphDataRowRaw = {
  Period: string; // "2511" 형식
  Year: string; // "2024" or "2025"
  Season_Code: string; // "24F", "25N" 등
  Gross_Sales: number;
  Net_Sales: number;
  Stock_Price: number;
  Stock_Cost: number;
  Country: string; // "HK", "MC", "TW"
  Category: string; // "ATC", "OUT", "INN", "BOT" 등
};

/**
 * 그래프용 데이터 (FX 정규화 및 시즌 정보 포함)
 */
export type GraphDataRow = GraphDataRowRaw & {
  period: string; // Period와 동일
  year: number; // Year를 숫자로 변환
  seasonCode: string; // Season_Code와 동일
  grossSalesFx: number;
  netSalesFx: number;
  stockPriceFx: number;
  stockCostFx: number;
  country: string; // Country와 동일 (대문자)
  category: string; // Category 원본
  mappedCategory: CategoryType; // 표준화된 카테고리
  seasonInfo: SeasonInfo;
  discountRate: number | null;
};

/**
 * 카테고리 타입 (표준화)
 */
export type CategoryType = "INNER" | "OUTER" | "BOTTOM" | "의류기타";

/**
 * 과시즌 목표 데이터 (원본)
 */
export type TargetDataRowRaw = {
  PERIOD: string; // "Dec-25"
  SEASON_NAME: string; // "2022FW", "2023FW", etc.
  SEASON: string; // "22F", "23F", etc.
  CATEGORY: string; // "BOTTOM", "INNER", "OUTER", "Wear_etc"
  TAG_SALES: number; // 택가 판매 목표
  NET_SALES: number; // 실판매 목표
  DISCOUNT_RATE: number; // 목표 할인율
};

/**
 * 과시즌 목표 데이터 (정규화)
 */
export type TargetDataRow = {
  period: string; // "2025-12"
  seasonName: string; // "2022FW"
  season: string; // "22F"
  category: CategoryType; // 표준화된 카테고리
  tagSales: number; // 택가 판매 목표
  netSales: number; // 실판매 목표
  discountRate: number; // 목표 할인율
  seasonInfo: SeasonInfo;
};

