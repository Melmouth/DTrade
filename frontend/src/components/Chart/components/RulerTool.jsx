/* frontend/src/components/Chart/components/RulerTool.jsx */
import { useEffect, useRef } from 'react';
import { useChart } from '../ChartContext';

export default function RulerTool({ mainSeries }) {
    const { chart } = useChart();
    const measurementRef = useRef({
        active: false,
        startPrice: null,
        startLine: null,
        endLine: null,
        removeTimer: null
    });

    useEffect(() => {
        if (!chart || !mainSeries) return;

        // 1. CLICK HANDLER (Start / Stop Measure)
        const handleClick = (param) => {
            if (!param.point) return;

            // Clear previous auto-remove timer
            if (measurementRef.current.removeTimer) {
                clearTimeout(measurementRef.current.removeTimer);
                measurementRef.current.removeTimer = null;
            }

            if (!measurementRef.current.active) {
                // START
                const price = mainSeries.coordinateToPrice(param.point.y);
                if (price === null) return;

                measurementRef.current.active = true;
                measurementRef.current.startPrice = price;
                measurementRef.current.startLine = mainSeries.createPriceLine({
                    price, color: '#ffffff', lineStyle: 2, lineWidth: 1, 
                    axisLabelVisible: true, title: 'MEASURE START',
                });
            } else {
                // STOP (and cleanup after delay)
                measurementRef.current.active = false;
                measurementRef.current.removeTimer = setTimeout(() => {
                    try {
                        if (measurementRef.current.startLine) mainSeries.removePriceLine(measurementRef.current.startLine);
                        if (measurementRef.current.endLine) mainSeries.removePriceLine(measurementRef.current.endLine);
                    } catch(e) { console.warn(e); }
                    measurementRef.current.startLine = null;
                    measurementRef.current.endLine = null;
                }, 1500);
            }
        };

        // 2. MOVE HANDLER (Draw End Line)
        const handleMove = (param) => {
            if (measurementRef.current.active && param.point) {
                const currentPrice = mainSeries.coordinateToPrice(param.point.y);
                if (currentPrice !== null) {
                    const startPrice = measurementRef.current.startPrice;
                    const diff = currentPrice - startPrice;
                    const pct = (diff / startPrice) * 100;
                    const isUp = diff >= 0;
                    
                    const lineOpts = {
                        price: currentPrice,
                        color: isUp ? '#00ff41' : '#ff003c',
                        lineWidth: 2, lineStyle: 0, axisLabelVisible: true,
                        title: `${isUp ? '+' : ''}${diff.toFixed(2)} (${isUp ? '+' : ''}${pct.toFixed(2)}%)`,
                    };

                    if (measurementRef.current.endLine) {
                        measurementRef.current.endLine.applyOptions(lineOpts);
                    } else {
                        measurementRef.current.endLine = mainSeries.createPriceLine(lineOpts);
                    }
                }
            }
        };

        chart.subscribeClick(handleClick);
        chart.subscribeCrosshairMove(handleMove);

        return () => {
            chart.unsubscribeClick(handleClick);
            chart.unsubscribeCrosshairMove(handleMove);
            // Cleanup final
            if (measurementRef.current.removeTimer) clearTimeout(measurementRef.current.removeTimer);
        };
    }, [chart, mainSeries]);

    return null;
}