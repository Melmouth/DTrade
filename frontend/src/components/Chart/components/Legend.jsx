/* frontend/src/components/Chart/components/Legend.jsx */
import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { useChart } from '../ChartContext';

export default function Legend({ mainSeries, volumeSeries, chartType, visibleFields = {}, visible = true }) {
    const { chart } = useChart();
    const [values, setValues] = useState(null);

    useEffect(() => {
        if (!chart || !mainSeries) return;

        const handleCrosshair = (param) => {
            if (!param.point || !param.seriesData) { return; }

            const mainData = param.seriesData.get(mainSeries);
            const volData = volumeSeries ? param.seriesData.get(volumeSeries) : null;

            if (mainData) {
                // Compatible Candle (object) et Line (value)
                const val = mainData.value !== undefined ? mainData.value : mainData.close;
                
                setValues({
                    open: mainData.open ?? val,
                    high: mainData.high ?? val,
                    low: mainData.low ?? val,
                    close: mainData.close ?? val,
                    volume: volData ? volData.value : 0,
                    // Couleur dynamique basée sur la bougie
                    color: (mainData.close ?? val) >= (mainData.open ?? val) ? 'text-neon-green' : 'text-neon-red'
                });
            }
        };

        chart.subscribeCrosshairMove(handleCrosshair);
        return () => chart.unsubscribeCrosshairMove(handleCrosshair);
    }, [chart, mainSeries, volumeSeries]);

    if (!visible || !values) return null;

    const fmt = (n) => n?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtVol = (v) => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(1)+'K' : v;

    // Helper pour rendu conditionnel
    const Item = ({ label, val, show }) => {
        if (!show) return null;
        return (
            <span className="mr-3 md:mr-4 whitespace-nowrap">
                <span className="text-slate-600 font-bold text-[10px] md:text-xs tracking-wider">{label}</span> 
                <span className={`ml-1 font-mono ${values.color}`}>{fmt(val)}</span>
            </span>
        );
    };

    return (
        <div className="absolute top-2 left-2 z-10 pointer-events-none font-mono text-xs hidden sm:block">
           <div className="flex items-center bg-black/80 backdrop-blur-md px-3 py-1.5 border border-slate-800 shadow-xl rounded-sm">
             <Zap size={12} className="text-neon-orange mr-3 animate-pulse hidden md:block" />
             
             {chartType === 'candle' ? (
               <div className="flex">
                 <Item label="OPN" val={values.open} show={visibleFields.open} />
                 <Item label="HGH" val={values.high} show={visibleFields.high} />
                 <Item label="LOW" val={values.low} show={visibleFields.low} />
                 <Item label="CLS" val={values.close} show={visibleFields.close} />
               </div>
             ) : (
                <span className="mr-4"><span className="text-slate-600 font-bold">VAL</span> <span className="text-neon-blue">{fmt(values.close)}</span></span>
             )}

             {visibleFields.volume && (
                <span className="border-l border-slate-800 pl-3 ml-1 flex items-baseline">
                    <span className="text-slate-600 font-bold text-[10px] md:text-xs mr-1">VOL</span> 
                    <span className="text-slate-400">{fmtVol(values.volume)}</span>
                </span>
             )}
           </div>
        </div>
    );
}