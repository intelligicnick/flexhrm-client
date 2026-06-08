import React, { useState, useEffect } from "react";

const ConfettiRain = () => {
  const [particles, setParticles] = useState<{ id: number; left: number; color: string; delay: number; duration: number; size: number }[]>([]);
  useEffect(() => {
    const colors = ["#ff791a", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];
    const newParticles = Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100, // percentage
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 2,
      duration: 2.5 + Math.random() * 2,
      size: 6 + Math.random() * 8
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full animate-confetti-fall"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            top: `-20px`,
            opacity: 0.8
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(105vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti-fall {
          animation-name: confetti-fall;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
};

export default ConfettiRain;
