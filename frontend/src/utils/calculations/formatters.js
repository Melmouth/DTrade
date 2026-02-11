/**
 * ==========================================
 * FORMATTERS & HELPERS
 * ==========================================
 */

export function formatSeries(chartData, computedData) {
    const res = [];
    const isArrayMode = Array.isArray(computedData);

    for (let i = 0; i < chartData.length; i++) {
        const point = chartData[i];
        let val = undefined;

        if (isArrayMode) {
            val = computedData[i];
        } else {
            if (point.date) {
                const dateKey = point.date.split('T')[0];
                val = computedData.get(dateKey);
            }
        }

        if (val !== undefined && val !== null && !isNaN(val)) {
            res.push({ time: new Date(point.date).getTime() / 1000, value: val });
        }
    }
    return res;
}

export function getSource(chartData, dailyData, granularity) {
    if (granularity === 'data') return chartData;
    return dailyData;
}

export function getField(source, field = 'close') {
    return source.map(d => d ? d[field] : null);
}

export function wrapOutput(chartData, source, resultArr, granularity) {
    if (granularity === 'data') {
        return formatSeries(chartData, resultArr);
    }
    // Days : Convertir Array -> Map(Date -> Val)
    const map = new Map();
    for (let i = 0; i < source.length; i++) {
        if (resultArr[i] !== null) {
            map.set(source[i].raw_date, resultArr[i]);
        }
    }
    return formatSeries(chartData, map);
}