import { useEffect, useEffectEvent, useState } from 'react';
import { useChart } from '../ChartContext';

export function useSeries(SeriesConstructor, data, options = {}, visible = true, onSeriesCreated = null) {
  const { chart } = useChart();
  const [seriesInstance, setSeriesInstance] = useState(null);
  const initialize = useEffectEvent(chart => {
    const series = chart.addSeries(SeriesConstructor, options);
    if (Array.isArray(data) && data.length) series.setData(data);
    onSeriesCreated?.(series);
    return series;
  });
  const notifyRemoved = useEffectEvent(() => onSeriesCreated?.(null));

  useEffect(() => {
    if (!chart) return;
    let series;
    try { series = initialize(chart); }
    catch (error) { console.error('Chart series initialization failed', error); return; }
    // Publish the instance created by the external imperative chart API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeriesInstance(series);
    return () => {
      try { chart.removeSeries(series); } catch { /* Parent chart may already be disposed. */ }
      setSeriesInstance(null);
      notifyRemoved();
    };
  }, [chart, SeriesConstructor]);

  useEffect(() => {
    if (!seriesInstance || !Array.isArray(data)) return;
    try { seriesInstance.setData(data); }
    catch (error) { console.warn('Chart data update failed', error.message); }
  }, [data, seriesInstance]);

  useEffect(() => {
    if (!seriesInstance) return;
    try { seriesInstance.applyOptions({ ...options, visible }); }
    catch (error) { console.warn('Chart options update failed', error.message); }
  }, [options, visible, seriesInstance]);
  return seriesInstance;
}
