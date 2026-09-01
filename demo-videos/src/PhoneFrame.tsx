import React from "react";
import { theme } from "./theme";

/**
 * A simple phone shell around the captured screenshot. Children are rendered
 * at exactly `screenWidth` x `screenHeight` (the capture viewport in CSS px),
 * and the whole frame is scaled by the parent via CSS transform.
 */
export const PhoneFrame: React.FC<{
  screenWidth: number;
  screenHeight: number;
  children: React.ReactNode;
}> = ({ screenWidth, screenHeight, children }) => {
  const bezel = 14;
  return (
    <div
      style={{
        width: screenWidth + bezel * 2,
        height: screenHeight + bezel * 2,
        borderRadius: 48,
        background: theme.phoneBezel,
        border: `2px solid ${theme.phoneFrame}`,
        boxShadow: "0 40px 80px rgba(0,0,0,0.55)",
        padding: bezel,
        position: "relative",
      }}
    >
      <div
        style={{
          width: screenWidth,
          height: screenHeight,
          borderRadius: 36,
          overflow: "hidden",
          position: "relative",
          background: "#fff",
        }}
      >
        {children}
      </div>
    </div>
  );
};
