import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Dispatch,
  SetStateAction,
} from 'react';

export type FeeEstimate = {
  height: number;
  time: number;
  low_fee_per_kb: number;
  medium_fee_per_kb: number;
  high_fee_per_kb: number;
};

export function isValidFeeEstimate(obj: unknown): obj is FeeEstimate {
  if (!obj || typeof obj !== 'object') return false;
  const value = obj as Record<string, unknown>;
  return (
    Number.isSafeInteger(value.height) &&
    Number(value.height) >= 0 &&
    typeof value.time === 'number' &&
    Number.isFinite(value.time) &&
    value.time > 0 &&
    ['low_fee_per_kb', 'medium_fee_per_kb', 'high_fee_per_kb'].every(
      (key) =>
        typeof value[key] === 'number' &&
        Number.isFinite(value[key]) &&
        Number(value[key]) > 0
    )
  );
}

export type FeeType = 'low' | 'medium' | 'high' | 'custom';

const FEE_REQUEST_TIMEOUT_MS = 6000;

type UseRecommendedFeesArgs = {
  selectedCoin?: string | null;
};

type UseRecommendedFeesReturn = {
  data: FeeEstimate | null;
  currentFee: number | null;
  setSelectedFeePublisher: (value: string) => void;
  selectedFeePublisher: string;
  setSelectFeeType: Dispatch<SetStateAction<FeeType>>;
  selectFeeType: FeeType;
  setCustomFee: Dispatch<SetStateAction<number>>;
  customFee: number;
};

const fetchJsonWithTimeout = async (url: string): Promise<unknown> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, FEE_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Fee request failed: ${response.status}`);
    }

    return await response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const fetchQortalJson = (path: string): Promise<unknown> =>
  fetchJsonWithTimeout(path);

export const useRecommendedFees = ({
  selectedCoin,
}: UseRecommendedFeesArgs): UseRecommendedFeesReturn => {
  const [selectedFeePublisher, setSelectedFeePublisher] =
    useState<string>('JSON.Bridge');
  const [selectFeeType, setSelectFeeType] = useState<FeeType>('medium');
  const [customFee, setCustomFee] = useState<number>(0);
  const [feeData, setFeeData] = useState<{
    scope: string;
    value: unknown;
  } | null>(null);

  const coin = useMemo<string | null>(() => {
    if (!selectedCoin) return null;
    return selectedCoin;
  }, [selectedCoin]);

  const scope = `${selectedFeePublisher}:${coin ?? ''}`;
  useEffect(() => {
    let stopped = false;
    const getLatestFees = async () => {
      if (!selectedFeePublisher || !coin) return;
      try {
        const identifier = `coinInfo-${coin}`;
        const searchParams = new URLSearchParams({
          identifier,
          limit: '1',
          name: selectedFeePublisher,
          prefix: 'true',
          reverse: 'true',
          service: 'JSON',
        });
        const resources = await fetchQortalJson(
          `/arbitrary/resources/searchsimple?${searchParams.toString()}`
        );
        if (stopped) return;
        const location = Array.isArray(resources) ? resources[0] : null;
        if (
          !location ||
          location.name !== selectedFeePublisher ||
          typeof location.identifier !== 'string' ||
          !location.identifier.startsWith(identifier)
        )
          throw new Error('Fee resource unavailable');
        const value = await fetchQortalJson(
          `/arbitrary/JSON/${encodeURIComponent(location.name)}/${encodeURIComponent(location.identifier)}`
        );
        if (!stopped) setFeeData({ scope, value });
      } catch (error) {
        if (!stopped) {
          setFeeData(null);
          console.error(error);
        }
      }
    };
    void getLatestFees();
    const timer = window.setInterval(getLatestFees, 60000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [selectedFeePublisher, coin, scope]);

  const recommendedFeeData = useMemo<FeeEstimate | null>(() => {
    if (
      !feeData ||
      feeData.scope !== scope ||
      !isValidFeeEstimate(feeData.value)
    )
      return null;
    return feeData.value;
  }, [feeData, scope]);

  const selectFee = useMemo<number | null>(() => {
    if (!recommendedFeeData) return null;
    if (selectFeeType === 'high') {
      return recommendedFeeData.high_fee_per_kb;
    }
    if (selectFeeType === 'low') {
      return recommendedFeeData.low_fee_per_kb;
    }
    if (selectFeeType === 'medium') {
      return recommendedFeeData.medium_fee_per_kb;
    }
    return null;
  }, [recommendedFeeData, selectFeeType]);

  const handleSelectPublisher = useCallback((val: string) => {
    setFeeData(null);
    setSelectedFeePublisher(val);
  }, []);

  return {
    data: recommendedFeeData,
    currentFee: selectFeeType === 'custom' ? customFee : selectFee,
    setSelectedFeePublisher: handleSelectPublisher,
    selectedFeePublisher,
    setSelectFeeType,
    selectFeeType,
    setCustomFee,
    customFee,
  };
};
