import { useMemo } from "react";

const StarField = () => {
  const stars = useMemo(() => {
    return Array.from({ length: 100 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.5 + 0.2,
      delay: Math.random() * 4,
      hue: Math.random() > 0.7 ? 42 : Math.random() > 0.5 ? 220 : 0,
      sat: Math.random() > 0.7 ? "60%" : "0%",
    }));
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Nebula layers */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(ellipse 600px 400px at 15% 30%, hsl(260 40% 20% / 0.6), transparent), " +
            "radial-gradient(ellipse 500px 500px at 85% 70%, hsl(230 50% 15% / 0.4), transparent), " +
            "radial-gradient(ellipse 800px 300px at 50% 10%, hsl(42 40% 12% / 0.3), transparent)",
        }}
      />
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            backgroundColor: `hsl(${star.hue} ${star.sat} 85%)`,
            opacity: star.opacity,
            animation: `twinkle ${3 + star.delay}s ease-in-out infinite`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default StarField;
