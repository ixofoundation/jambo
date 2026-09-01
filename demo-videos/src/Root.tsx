import React from "react";
import { Composition, staticFile } from "remotion";
import { FLOWS } from "./flows";
import { FlowVideo } from "./FlowVideo";
import { FPS, totalDurationInFrames, type FlowManifest } from "./manifest";

export const Root: React.FC = () => {
  return (
    <>
      {FLOWS.map((flow) => (
        <Composition
          key={flow.id}
          id={flow.id}
          component={FlowVideo}
          width={1920}
          height={1080}
          fps={FPS}
          durationInFrames={10 * FPS}
          defaultProps={{ manifest: null as FlowManifest | null }}
          calculateMetadata={async () => {
            const res = await fetch(
              staticFile(`captures/${flow.id}/manifest.json`),
            );
            if (!res.ok) {
              return { props: { manifest: null }, durationInFrames: 5 * FPS };
            }
            const manifest = (await res.json()) as FlowManifest;
            return {
              props: { manifest },
              durationInFrames: totalDurationInFrames(manifest),
            };
          }}
        />
      ))}
    </>
  );
};
