import { useState, useEffect, useMemo } from 'react';

const LOGS = [
  "INITIALIZING DEIMOS KERNEL...",
  "LOADING NEURAL INTERFACES...",
  "BYPASSING SECURITY PROTOCOLS...",
  "CONNECTING TO OMEGA SERVER...",
  "DECRYPTING PAYLOAD...",
  "SYSTEM OVERRIDE REQUIRED."
];

// J'ai gardé ton ASCII mais optimisé la structure pour React
const ASCII_ART = [                                                                                                                              
"DDDDDDDDDDDDD      EEEEEEEEEEEEEEEEEEEEEEIIIIIIIIIIMMMMMMMM              MMMMMMMM     OOOOOOOOO        SSSSSSSSSSSSSSS ",
"D::::::::::::DDD   E::::::::::::::::::::EI::::::::IM:::::::M             M:::::::M   OO:::::::::OO    SS:::::::::::::::S",
"D:::::::::::::::DD E::::::::::::::::::::EI::::::::IM::::::::M           M::::::::M OO:::::::::::::OO S:::::SSSSSS::::::S",
"DDD:::::DDDDD:::::DEE::::::EEEEEEEEE::::EII::::::IIM:::::::::M         M:::::::::MO:::::::OOO:::::::OS:::::S     SSSSSSS",
"  D:::::D    D:::::D E:::::E       EEEEEE  I::::I  M::::::::::M       M::::::::::MO::::::O   O::::::OS:::::S            ",
"  D:::::D     D:::::DE:::::E               I::::I  M:::::::::::M     M:::::::::::MO:::::O     O:::::OS:::::S            ",
"  D:::::D     D:::::DE::::::EEEEEEEEEE     I::::I  M:::::::M::::M   M::::M:::::::MO:::::O     O:::::O S::::SSSS         ",
"  D:::::D     D:::::DE:::::::::::::::E     I::::I  M::::::M M::::M M::::M M::::::MO:::::O     O:::::O  SS::::::SSSSS    ",
"  D:::::D     D:::::DE:::::::::::::::E     I::::I  M::::::M  M::::M::::M  M::::::MO:::::O     O:::::O    SSS::::::::SS  ",
"  D:::::D     D:::::DE::::::EEEEEEEEEE     I::::I  M::::::M   M:::::::M   M::::::MO:::::O     O:::::O       SSSSSS::::S ",
"  D:::::D     D:::::DE:::::E               I::::I  M::::::M    M:::::M    M::::::MO:::::O     O:::::O            S:::::S",
"  D:::::D    D:::::D E:::::E       EEEEEE  I::::I  M::::::M     MMMMM     M::::::MO::::::O   O::::::O            S:::::S",
"DDD:::::DDDDD:::::DEE::::::EEEEEEEE:::::EII::::::IIM::::::M               M::::::MO:::::::OOO:::::::OSSSSSSS     S:::::S",
"D:::::::::::::::DD E::::::::::::::::::::EI::::::::IM::::::M               M::::::M OO:::::::::::::OO S::::::SSSSSS:::::S",
"D::::::::::::DDD   E::::::::::::::::::::EI::::::::IM::::::M               M::::::M   OO:::::::::OO   S:::::::::::::::SS ",
"DDDDDDDDDDDDD      EEEEEEEEEEEEEEEEEEEEEEIIIIIIIIIIMMMMMMMM               MMMMMMMM     OOOOOOOOO      SSSSSSSSSSSSSSS   ",
];

const NEON_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#fda4af', '#fdba74', '#fde047', '#bef264', '#86efac', '#6ee7b7', '#5eead4',
  '#67e8f9', '#7dd3fc', '#93c5fd', '#a5b4fc', '#c4b5fd', '#d8b4fe', '#f0abfc', '#f9a8d4'
];

export default function BootSequence({ onComplete }) {
  // AJOUT phase 'cleanup' : Permet de vider le DOM avant de lancer l'App
  const [phase, setPhase] = useState('logs'); 
  const [logLines, setLogLines] = useState([]);

  // --- 1. LOGS SEQUENCER ---
  useEffect(() => {
    if (phase !== 'logs') return;
    
    let currentIndex = 0;
    const interval = setInterval(() => {
      // Si on a tout affiché, on passe à la suite
      if (currentIndex >= LOGS.length) {
        clearInterval(interval);
        setTimeout(() => setPhase('ascii'), 200);
        return;
      }
      setLogLines(prev => [...prev, LOGS[currentIndex]]);
      currentIndex++;
    }, 150);
    
    return () => clearInterval(interval);
  }, [phase]);

  // --- 2. ASCII TIMER ---
  useEffect(() => {
    if (phase === 'ascii') {
      // On réduit un peu le temps total pour la réactivité
      const timer = setTimeout(() => setPhase('cleanup'), 3500); 
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // --- 3. CLEANUP & EXIT (CRUCIAL POUR LA PERF) ---
  useEffect(() => {
    if (phase === 'cleanup') {
      // On laisse 100ms au navigateur pour "respirer" et vider la mémoire vidéo
      // avant de demander le rendu de l'application lourde.
      const timer = setTimeout(onComplete, 100);
      return () => clearTimeout(timer);
    }
  }, [phase, onComplete]);

  // --- RENDU ASCII ---
  const renderedAscii = useMemo(() => {
    if (phase !== 'ascii') return null; // Ne rien calculer si pas nécessaire

    return ASCII_ART.map((line, lineIdx) => (
      <div key={lineIdx} className="leading-[0.85] whitespace-pre text-center">
        {line.split('').map((char, charIdx) => {
          if (char === ' ') return ' ';
          
          // Réduction des calculs aléatoires
          const delay = (Math.random() * 2).toFixed(2); // Max 2s delay
          const color = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
          const x = (Math.random() * 10 - 5).toFixed(0); 
          const y = (Math.random() * 10 - 5).toFixed(0); 
          const r = (Math.random() * 90).toFixed(0);

          return (
            <span
              key={charIdx}
              className="inline-block chaos-char"
              style={{
                '--d': `${delay}s`,
                '--c': color,
                '--x': `${x}em`, 
                '--y': `${y}em`,
                '--r': `${r}deg`
              }}
            >
              {char}
            </span>
          );
        })}
      </div>
    ));
  }, [phase]);

  // Si on est en phase de nettoyage, on rend un écran noir vide.
  // C'est ça qui "débloque" le thread pour charger l'App.
  if (phase === 'cleanup') {
    return <div className="fixed inset-0 bg-black z-[100]" />;
  }

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center font-mono overflow-hidden select-none cursor-wait">
      
      {/* Background FX (Optimisé: opacity fixe) */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[size:30px_30px] bg-grid-pattern"></div>
      
      {/* Phase 1: Logs */}
      {phase === 'logs' && (
        <div className="w-full max-w-lg p-6 z-10">
          {logLines.map((line, i) => (
            <div key={i} className="text-xs md:text-sm text-cyan-800 border-l-2 border-cyan-900/50 pl-4 mb-1 font-bold">
              <span className={i === logLines.length - 1 ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" : ""}>
                {line}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Phase 2: ASCII */}
      {phase === 'ascii' && (
        <div 
            className="relative z-20 font-bold text-cyan-500 w-full h-full flex items-center justify-center"
            style={{ fontSize: 'min(1.0vw, 3.0vh)' }} // Légèrement réduit pour éviter l'overflow
        >
           {/* will-change appliqué UNIQUEMENT au conteneur parent pour éviter 2000 couches composites */}
           <div className="will-change-transform">{renderedAscii}</div>
        </div>
      )}

      <style>{`
        /* Suppression du filter: blur et text-shadow qui tuent les perfs */
        .chaos-char {
          color: #06b6d4; 
          opacity: 1;
          animation: chaos-anim 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
          animation-delay: var(--d);
        }

        @keyframes chaos-anim {
          0% {
            color: #06b6d4;
            opacity: 1;
            transform: translate(0,0) scale(1);
          }
          30% {
            color: var(--c);
            opacity: 1;
            transform: translate(0,0) scale(1.5);
          }
          100% {
            color: white;
            opacity: 0;
            /* Rotation réduite pour moins de calculs de pixels */
            transform: translate(var(--x), var(--y)) rotate(var(--r)) scale(0);
          }
        }
        
        .bg-grid-pattern {
            background-image: linear-gradient(rgba(6,182,212,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6,182,212,0.05) 1px, transparent 1px);
        }
      `}</style>
    </div>
  );
}