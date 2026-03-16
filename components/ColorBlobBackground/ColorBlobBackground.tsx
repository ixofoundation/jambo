import { CSSProperties, ReactNode, useState } from 'react';

interface ColorBlobBackgroundProps {
  children: ReactNode;
  style?: CSSProperties;
}

interface BlobConfig {
  color: string;
  top: string;
  left: string;
  width: string;
  height: string;
  opacity: number;
}

// RGB ranges for earthy tones: [rMin, rMax, gMin, gMax, bMin, bMax]
const EARTHY_PALETTES: number[][] = [
  [168, 204, 88, 120, 55, 80], // terracotta
  [128, 168, 75, 110, 48, 72], // warm brown
  [100, 140, 128, 166, 68, 100], // olive green
  [185, 215, 155, 185, 110, 140], // sand / tan
  [175, 200, 150, 175, 80, 110], // muted gold
  [140, 170, 65, 90, 55, 75], // deep clay red
  [105, 140, 130, 155, 100, 130], // warm sage
  [145, 165, 105, 130, 120, 140], // dusty mauve
];

function randInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function generateRandomColor(): string {
  const p = EARTHY_PALETTES[Math.floor(Math.random() * EARTHY_PALETTES.length)];
  const r = Math.round(randInRange(p[0], p[1]));
  const g = Math.round(randInRange(p[2], p[3]));
  const b = Math.round(randInRange(p[4], p[5]));
  return `rgb(${r}, ${g}, ${b})`;
}

function generateBlobs(): { blobs: BlobConfig[]; baseColor: string } {
  // const count = Math.floor(Math.random() * 6) + 3;
  const count = 8;
  const blobs = Array.from({ length: count }, () => {
    const size = randInRange(60, 100);
    return {
      color: generateRandomColor(),
      top: `${randInRange(-20, 70)}%`,
      left: `${randInRange(-20, 70)}%`,
      width: `${size}%`,
      height: `${size}%`,
      opacity: randInRange(0.6, 0.8),
    };
  });
  return { blobs, baseColor: generateRandomColor() };
}

function ColorBlobBackground({ children, style }: ColorBlobBackgroundProps) {
  const [{ blobs, baseColor }] = useState(generateBlobs);

  return (
    <div style={{ position: 'relative', overflow: 'hidden', ...style }}>
      <div
        style={{
          position: 'absolute',
          top: '-80px',
          bottom: '-80px',
          left: '-80px',
          right: '-80px',
          inset: 0,
          zIndex: 0,
          backgroundColor: baseColor,
          filter: 'blur(60px)',
        }}
      >
        {blobs.map((blob, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: blob.top,
              left: blob.left,
              width: blob.width,
              height: blob.height,
              borderRadius: '50%',
              backgroundColor: blob.color,
              opacity: blob.opacity,
            }}
          />
        ))}
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}

export default ColorBlobBackground;
