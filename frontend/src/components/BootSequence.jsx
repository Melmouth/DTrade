import { useState, useEffect, useMemo } from 'react';

const LOGS = [
  "INITIALIZING DEIMOS KERNEL...",
  "LOADING NEURAL INTERFACES...",
  "BYPASSING SECURITY PROTOCOLS...",
  "CONNECTING TO OMEGA SERVER...",
  "DECRYPTING PAYLOAD...",
  "SYSTEM OVERRIDE REQUIRED."
];

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

const NEON_COLORS = ['#06b6d4', '#d946ef', '#22c55e', '#eab308', '#f43f5e', '#ffffff'];

export default function BootSequence({ onComplete }) {
  const [phase, setPhase] = useState('logs'); 
  const [logLines, setLogLines] = useState([]);

  // --- LOGS ---
  useEffect(() => {
    if (phase !== 'logs') return;
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex >= LOGS.length) {
        clearInterval(interval);
        setTimeout(() => setPhase('ascii'), 500);
        return;
      }
      setLogLines(prev => [...prev, LOGS[currentIndex]]);
      currentIndex++;
    }, 200);
    return () => clearInterval(interval);
  }, [phase]);

  // --- FIN ---
  useEffect(() => {
    if (phase === 'ascii') {
      const timer = setTimeout(onComplete, 4000); 
      return () => clearTimeout(timer);
    }
  }, [phase, onComplete]);

  // --- RENDU ASCII OPTIMISÉ ---
  const renderedAscii = useMemo(() => {
    return ASCII_ART.map((line, lineIdx) => (
      <div key={lineIdx} className="leading-[0.85] whitespace-pre text-center">
        {line.split('').map((char, charIdx) => {
          if (char === ' ') return <span key={charIdx}> </span>;
          
          const randomDelay = Math.random() * 2.5; 
          const randomColor = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
          const randomX = Math.random() * 20 - 10; 
          const randomY = Math.random() * 20 - 10; 
          const randomRotate = Math.random() * 360;

          return (
            <span
              key={charIdx}
              className="inline-block chaos-char"
              style={{
                '--delay': `${randomDelay}s`,
                '--target-color': randomColor,
                '--x': `${randomX}em`, 
                '--y': `${randomY}em`,
                '--r': `${randomRotate}deg`
              }}
            >
              {char}
            </span>
          );
        })}
      </div>
    ));
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center font-mono overflow-hidden select-none cursor-wait">
      
      {/* Background FX */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(6,182,212,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.05)_1px,transparent_1px)] bg-[size:30px_30px]"></div>
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)]"></div>
      
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

      {/* Phase 2: ASCII Fullscreen */}
      {phase === 'ascii' && (
        <div 
            className="relative z-20 font-bold text-cyan-500 w-full h-full flex items-center justify-center"
            style={{ fontSize: 'min(1.2vw, 3.5vh)' }}
        >
           <div>{renderedAscii}</div>
        </div>
      )}

      {/* Animation CSS Standard (Correction VITE) */}
      <style>{`
        .chaos-char {
          color: #06b6d4; 
          opacity: 1;
          will-change: transform, opacity, filter, color;
          animation: chaos-anim 1.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
          animation-delay: var(--delay);
        }

        @keyframes chaos-anim {
          0% {
            color: #06b6d4;
            opacity: 1;
            transform: translate(0,0) scale(1);
            filter: blur(0);
          }
          20% {
            color: var(--target-color);
            opacity: 1;
            transform: translate(0,0) scale(1.2);
            filter: blur(0);
            text-shadow: 0 0 0.5em var(--target-color);
          }
          100% {
            color: white;
            opacity: 0;
            transform: translate(var(--x), var(--y)) rotate(var(--r)) scale(0);
            filter: blur(0.2em);
          }
        }
      `}</style>
    </div>
  );
}