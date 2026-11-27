import { useIsDark } from './useIsDark';

// Categorical slots 1-2 (income, expenses), a teal accent for balances and the
// blue/red diverging pair for signed values. Validated for CVD separation in both
// modes; orange is under 3:1 on white, so charts using it print values or offer a table.
export const CHART = {
  light: { income: '#257de0', expense: '#f47230', balance: '#0f8a8f', negative: '#ec4647', grid: '#e7e7e7', axis: '#c2c2c2', tick: '#666666', cursor: 'rgba(0,0,0,0.04)' },
  dark: { income: '#338ced', expense: '#e76624', balance: '#2fb5b9', negative: '#eb6263', grid: '#303030', axis: '#474747', tick: '#9c9c9c', cursor: 'rgba(255,255,255,0.05)' },
};

export type ChartColors = typeof CHART.light;

export const useChartColors = (): ChartColors => CHART[useIsDark() ? 'dark' : 'light'];
