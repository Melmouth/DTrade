/* frontend/src/components/Chart/components/Overlays.jsx */
import { useMemo } from 'react';
import { LineSeries } from 'lightweight-charts';
import { useSeries } from '../hooks/useSeries';
import { calculateIndicator } from '../../../indicators/registry';
import { hydrateBackendData } from '../../../utils/calculations/formatters';

// --- ADAPTER CRITIQUE POUR LE PREVIEW (Fix Sliders) ---
// Transforme le format "Split" du Worker { upper:[], lower:[] } 
// vers le format "Merged" attendu par les graphiques [{ time, upper, lower }]
function zipWorkerData(workerData) {
    if (!workerData) return [];
    
    // Cas 1 : Déjà un tableau (SMA/RSI simple calculé par worker)
    if (Array.isArray(workerData)) return workerData;

    // Cas 2 : Objet de bandes (Bollinger calculé par worker)
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
    
    // NETTOYAGE AGRESSIF (Protection Crash)
    // Filtre toutes les données invalides avant de les passer au moteur graphique
    const cleanData = useMemo(() => {
        if (!Array.isArray(data)) return [];
        return data
            .map(d => ({
                time: d.time,
                value: Number(d.value) // Force le typage Number
            }))
            .filter(d => 
                d.time !== undefined && d.time !== null &&
                d.value !== undefined && d.value !== null && 
                !Number.isNaN(d.value) &&
                isFinite(d.value) // Exclut Infinity (division par zéro)
            );
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
    // Split memoïsé
    const { upper, lower, basis } = useMemo(() => {
        if (!data) return { upper: [], lower: [], basis: [] };
        
        // Tri de sécurité (Lightweight Charts exige un tri strict par temps)
        const sorted = [...data].sort((a,b) => a.time - b.time);
        
        // Helper de transformation safe
        const extract = (key) => sorted
            .map(d => ({ time: d.time, value: Number(d[key]) }))
            .filter(d => 
                d.value !== undefined && d.value !== null && 
                !Number.isNaN(d.value) && 
                isFinite(d.value)
            );

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

export default function Overlays({ indicators, chartData, dailyData, priceLineVisible }) {
    
    // Filtrage et Rendu
    return indicators.filter(i => i.visible !== false).map(ind => {
        let points = null;

        // 1. Data Source Strategy
        if (ind.isPreview && ind.data) {
            // === FIX DU BUG SLIDERS ===
            // Preview Mode (Worker JS) : On bypass l'hydratation backend
            // On utilise l'adapter pour convertir le format Worker -> Chart
            points = zipWorkerData(ind.data);
        }
        else if (ind.data && (Array.isArray(ind.data) || typeof ind.data === 'object')) {
            // Backend Data + Hydration (Gestion des données Daily sur Chart Intraday)
            points = hydrateBackendData(ind.data, chartData, ind.granularity);
        } 
        else {
            // Frontend Calc Fallback (Calcul à la volée si pas de data backend)
            const config = { 
                id: ind.type, 
                params: ind.params, 
                granularity: ind.granularity || 'days' 
            };
            const rawPoints = calculateIndicator(config, chartData, dailyData);
            
            // Si le fallback renvoie aussi un format objet (ex: Bollinger), on le zip
            points = (!Array.isArray(rawPoints) && rawPoints?.upper) 
                ? zipWorkerData(rawPoints) 
                : rawPoints;
        }

        if (!points) return null;

        // 2. Type Detection (Auto-détection Bandes vs Ligne)
        const isBandStructure = !Array.isArray(points) || (points.length > 0 && points[0].upper !== undefined);
        const isBand = ind.style === 'BAND' || isBandStructure;

        // 3. Component Selection
        return isBand ? (
            <BandOverlay key={ind.id} data={points} color={ind.color} visible={true} />
        ) : (
            <SingleLine key={ind.id} data={points} color={ind.color} visible={true} />
        );
    });
}