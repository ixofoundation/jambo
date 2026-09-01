import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  FPS,
  TITLE_SECONDS,
  stepDurationInFrames,
  type FlowManifest,
  type FlowStep,
} from "./manifest";
import { PhoneFrame } from "./PhoneFrame";
import { TapIndicator } from "./TapIndicator";
import { theme } from "./theme";

const TitleCard: React.FC<{ title: string; subtitle?: string }> = ({
  title,
  subtitle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const appear = spring({ frame, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 30% 20%, ${theme.bgAccent}, ${theme.bg})`,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: theme.fontFamily,
      }}
    >
      <div
        style={{
          transform: `translateY(${(1 - appear) * 40}px)`,
          opacity: appear,
          textAlign: "center",
        }}
      >
        <div
          style={{
            color: theme.brand,
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: 6,
            textTransform: "uppercase",
            marginBottom: 24,
          }}
        >
          {theme.eyebrow}
        </div>
        <div style={{ color: theme.text, fontSize: 92, fontWeight: 800 }}>
          {title}
        </div>
        {subtitle ? (
          <div style={{ color: theme.textDim, fontSize: 38, marginTop: 24 }}>
            {subtitle}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const StepView: React.FC<{
  manifest: FlowManifest;
  step: FlowStep;
  index: number;
}> = ({ manifest, step, index }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });
  const captionAppear = spring({ frame, fps, config: { damping: 16 } });

  const { width: vw, height: vh } = manifest.viewport;
  const frameOuterHeight = vh + 14 * 2 + 4;
  const scale = (height - 140) / frameOuterHeight;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 70% 80%, ${theme.bgAccent}, ${theme.bg})`,
        flexDirection: "row",
        alignItems: "center",
        fontFamily: theme.fontFamily,
        opacity: fadeIn,
      }}
    >
      {/* Phone */}
      <div
        style={{
          flex: "0 0 46%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div style={{ transform: `scale(${scale})` }}>
          <PhoneFrame screenWidth={vw} screenHeight={vh}>
            <Img
              src={staticFile(`captures/${manifest.id}/${step.screenshot}`)}
              style={{ width: vw, height: vh, display: "block" }}
            />
            {step.tap ? <TapIndicator tap={step.tap} /> : null}
          </PhoneFrame>
        </div>
      </div>

      {/* Caption panel */}
      <div style={{ flex: 1, paddingRight: 120, maxWidth: 900 }}>
        <div
          style={{
            opacity: captionAppear,
            transform: `translateX(${(1 - captionAppear) * 30}px)`,
          }}
        >
          <div
            style={{
              color: theme.brand,
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 3,
              marginBottom: 20,
            }}
          >
            STEP {index + 1} / {manifest.steps.length}
          </div>
          <div
            style={{
              color: theme.text,
              fontSize: 54,
              fontWeight: 700,
              lineHeight: 1.25,
            }}
          >
            {step.caption}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 48 }}>
            {manifest.steps.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === index ? 44 : 14,
                  height: 14,
                  borderRadius: 7,
                  background: i <= index ? theme.brand : theme.brandSoft,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const FlowVideo: React.FC<{ manifest: FlowManifest | null }> = ({
  manifest,
}) => {
  if (!manifest) {
    return (
      <AbsoluteFill
        style={{
          background: theme.bg,
          alignItems: "center",
          justifyContent: "center",
          color: theme.textDim,
          fontFamily: theme.fontFamily,
          fontSize: 40,
        }}
      >
        No manifest captured yet — run the matching capture script first.
      </AbsoluteFill>
    );
  }

  let from = TITLE_SECONDS * FPS;
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <Sequence durationInFrames={TITLE_SECONDS * FPS} name="Title">
        <TitleCard title={manifest.title} subtitle={manifest.subtitle} />
      </Sequence>
      {manifest.steps.map((step, i) => {
        const duration = stepDurationInFrames(step);
        const seq = (
          <Sequence
            key={i}
            from={from}
            durationInFrames={duration}
            name={`Step ${i + 1}`}
          >
            <StepView manifest={manifest} step={step} index={i} />
          </Sequence>
        );
        from += duration;
        return seq;
      })}
    </AbsoluteFill>
  );
};
