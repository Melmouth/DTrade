import { useMemo } from 'react';
import { LineSeries } from 'lightweight-charts';
import { useSeries } from '../hooks/useSeries';
import { calculateIndicator } from '../../../indicators/registry';
import { hydrateBackendData } from '../../../utils/calculations/formatters';

// --- ADAPTER WORKER (Format Split -> Merged) ---
function zipWorkerData(workerData) {
    if (!workerData) return [];
    if (Array.isArray(workerData)) return workerData;
    
    // Cas objet de bandes (Bollinger)
    if (workerData.upper && Array.isArray(workerData.upper)) {
        return workerData.upper.map((u, i) => ({
            time: u.time,
            upper: u.value,
            lower: workerData.lower?.[i]?.value,
            basis: workerData.basis?.[i]?.value
        }));
    }
    return [];
}

// Composant Helper pour une ligne simple
const SingleLine = ({ data, color, style = 'solid', visible }) => {
    // NETTOYAGE STRICT
    const cleanData = useMemo(() => {
        if (!Array.isArray(data)) return [];
        return data
            .map(d => ({
                time: d.time,
                value: Number(d.value)
            }))
            .filter(d => 
                d.time !== undefined && d.time !== null && !Number.isNaN(d.time) && d.time > 0 && // Filtre 1970
                d.value !== undefined && d.value !== null && !Number.isNaN(d.value) && isFinite(d.value)
            )
            .sort((a,b) => a.time - b.time);
    }, [data]);

    const opts = {
        color,
        lineWidth: style === 'dashed' ? 1 : 2,
        lineStyle: style === 'dashed' ? 2 : 0,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false
    };

    useSeries(LineSeries, cleanData, opts, visible);
    return null;
};

// Composant Helper pour une bande (3 lignes)
const BandOverlay = ({ data, color, visible }) => {
    const { upper, lower, basis } = useMemo(() => {
        if (!data) return { upper: [], lower: [], basis: [] };
        
        // Tri et Nettoyage centralisé
        const sorted = [...data]
            .filter(d => d.time > 0)
            .sort((a,b) => a.time - b.time);
        
        const extract = (key) => sorted
            .map(d => ({ time: d.time, value: Number(d[key]) }))
            .filter(d => !Number.isNaN(d.value) && isFinite(d.value));

        return {
            upper: extract('upper'),
            lower: extract('lower'),
            basis: extract('basis'),
        };
    }, [data]);

    return (
        <>
            <SingleLine data={upper} color={color} style="dashed" visible={visible} />
            <SingleLine data={lower} color={color} style="dashed" visible={visible} />
            <SingleLine data={basis} color={color} style="solid" visible={visible} />
        </>
    );
};

export default function Overlays({ indicators, chartData, dailyData, activePeriod }) {
    
    // DÉTECTION DU CONTEXTE GRAPHIQUE
    // Si activePeriod n'est pas fourni (cas legacy), on devine via les données
    // On définit le poids de la résolution actuelle pour la comparaison
    const getChartResolutionWeight = (p) => {
        if (['1d'].includes(p)) return 1;    // Très fin (1m)
        if (['5d'].includes(p)) return 5;    // Fin (5m/15m)
        if (['1mo'].includes(p)) return 60;  // Moyen (1h)
        return 1440;                         // Macro (Daily+)
    };

    const getIndicatorResolutionWeight = (res) => {
        if (res === '1m') return 1;
        if (['5m', '15m'].includes(res)) return 5;
        if (['1h', '60m'].includes(res)) return 60;
        return 1440; // 1d, 1wk, etc.
    };

    // Poids de la vue actuelle
    const chartWeight = activePeriod ? getChartResolutionWeight(activePeriod) : 1440;

    return indicators.filter(i => i.visible !== false).map(ind => {
        
        // --- 1. RBI FILTERING (Fix du Stretch) ---
        const res = ind.resolution || ind.granularity || 'days';
        const indWeight = getIndicatorResolutionWeight(res);

        // RÈGLE D'OR : Si l'indicateur est plus "fin" (ex: 1m) que le graph (ex: Daily), 
        // on le masque pour éviter le bruit et le bug d'échelle.
        if (indWeight < chartWeight) {
            return null; // On n'affiche rien
        }

        let points = null;

        // --- 2. SOURCE DES DONNÉES ---
        if (ind.isPreview && ind.data) {
            // A. Preview Worker (En cours d'édition)
            points = zipWorkerData(ind.data);
        }
        else if (ind.data && (Array.isArray(ind.data) || typeof ind.data === 'object')) {
            // B. Backend Data (Sauvegardé) + Hydratation Temporelle
            points = hydrateBackendData(ind.data, chartData, res);
        } 
        else {
            // C. Fallback Frontend (Calcul à la volée si pas de backend data)
            // C'est le bloc que j'avais omis et qui est important pour la robustesse
            const config = { 
                id: ind.type, 
                params: ind.params, 
                granularity: ind.granularity || 'days' 
            };
            const rawPoints = calculateIndicator(config, chartData, dailyData);
            
            points = (!Array.isArray(rawPoints) && rawPoints?.upper) 
                ? zipWorkerData(rawPoints) 
                : rawPoints;
        }

        if (!points || points.length === 0) return null;

        // --- 3. DÉTECTION TYPE (Bande vs Ligne) ---
        const isBandStructure = !Array.isArray(points) || (points.length > 0 && points[0].upper !== undefined);
        const isBand = ind.style === 'BAND' || isBandStructure;

        // --- 4. RENDU ---
        return isBand ? (
            <BandOverlay key={ind.id} data={points} color={ind.color} visible={true} />
        ) : (
            <SingleLine key={ind.id} data={points} color={ind.color} visible={true} />
        );
    });
}