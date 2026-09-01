import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";
import type { TapPoint } from "./manifest";

/**
 * Animated tap ripple positioned in capture-viewport CSS px
 * (rendered inside the PhoneFrame screen, which shares that coordinate space).
 */
export const TapIndicator: React.FC<{ tap: TapPoint; delayFrames?: number }> = ({
  tap,
  delayFrames = 10,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - delayFrames;
  if (t < 0) return null;

  const scale = spring({ frame: t, fps, config: { damping: 12, mass: 0.4 } });
  const rippleOpacity = interpolate(t, [0, 6, 30], [0, 0.9, 0], {
    extrapolateRight: "clamp",
  });
  const rippleScale = interpolate(t, [0, 30], [0.4, 2.4], {
    extrapolateRight: "clamp",
  });

  const dot = (size: number, opacity: number, s: number) => (
    <div
      style={{
        position: "absolute",
        left: tap.x - size / 2,
        top: tap.y - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        border: `4px solid ${theme.tap}`,
        opacity,
        transform: `scale(${s})`,
      }}
    />
  );

  return (
    <>
      {dot(56, rippleOpacity, rippleScale)}
      <div
        style={{
          position: "absolute",
          left: tap.x - 14,
          top: tap.y - 14,
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: theme.tap,
          opacity: 0.85,
          transform: `scale(${scale})`,
          boxShadow: `0 0 24px ${theme.tap}`,
        }}
      />
    </>
  );
};
