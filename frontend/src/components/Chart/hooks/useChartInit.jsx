/* frontend/src/components/Chart/hooks/useChartInit.js */
import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';

export function useChartInit(containerRef, height = 500) {
  const chartInstance = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Instanciation
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#050505' },
        textColor: '#64748b',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: 10,
      },
      width: containerRef.current.clientWidth,
      height: height,
      watermark: { visible: false },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.5)', style: 1 },
        horzLines: { color: 'rgba(30, 41, 59, 0.5)', style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { width: 1, color: '#00f3ff', style: 3, labelBackgroundColor: '#00f3ff' },
        horzLine: { width: 1, color: '#00f3ff', style: 3, labelBackgroundColor: '#00f3ff' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#1e293b',
      },
      rightPriceScale: { borderColor: '#1e293b' },
    });

    chartInstance.current = chart;
    setIsReady(true);

    // 2. Gestion Resize
    const handleResize = () => {
      if (containerRef.current && chartInstance.current) {
        chartInstance.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    // 3. Cleanup
    return () => {
      resizeObserver.disconnect();
      if (chartInstance.current) {
        chartInstance.current.remove();
        chartInstance.current = null;
        setIsReady(false);
      }
    };
  }, [containerRef, height]);

  return { chart: chartInstance.current, isReady };
}