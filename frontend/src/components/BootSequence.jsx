import { useState, useEffect } from 'react';

const LOGS = [
  "INITIALIZING DEIMOS KERNEL v4.2...",
  "CHECKING MEMORY INTEGRITY... OK",
  "LOADING MARKET DATA MODULES...",
  "CONNECTING TO OMEGA PROTOCOL...",
  "DECRYPTING SECURE CHANNELS...",
  "ESTABLISHING NEURAL LINK...",
  "SYSTEM READY."
];

export default function BootSequence({ onComplete }) {
  const [lines, setLines] = useState([]);

  useEffect(() => {
    let delay = 0;
    LOGS.forEach((log, index) => {
      // Temps aléatoire entre chaque ligne pour effet réaliste
      delay += Math.random() * 300 + 100; 
      setTimeout(() => {
        setLines(prev => [...prev, log]);
        // Fin de séquence
        if (index === LOGS.length - 1) {
          setTimeout(onComplete, 800);
        }
      }, delay);
    });
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-black z-[100] flex items-start justify-start p-10 font-mono text-sm md:text-base">
      <div className="space-y-1 w-full max-w-2xl">
        {lines.map((line, i) => (
          <div key={i} className={`${i === lines.length - 1 ? 'text-neon-blue' : 'text-neon-green/80'}`}>
            <span className="opacity-50 mr-2">{`>>`}</span>
            {line}
          </div>
        ))}
        <div className="animate-blink text-neon-blue mt-2">_</div>
      </div>
    </div>
  );
}