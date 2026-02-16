/* frontend/src/components/Chart/ChartContext.jsx */
import { createContext, useContext } from 'react';

const ChartContext = createContext(null);

export const useChart = () => {
  const context = useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a ChartProvider (Chart/index.jsx)");
  }
  return context;
};

export default ChartContext;