export type TapPoint = {
  /** CSS px in the capture viewport */
  x: number;
  y: number;
};

export type FlowStep = {
  /** Filename inside public/captures/<flowId>/ */
  screenshot: string;
  caption: string;
  tap?: TapPoint;
  /** Seconds this step stays on screen (default 3) */
  durationSeconds?: number;
};

export type FlowManifest = {
  id: string;
  title: string;
  subtitle?: string;
  viewport: { width: number; height: number };
  steps: FlowStep[];
};

export const FPS = 30;
export const TITLE_SECONDS = 2;
export const DEFAULT_STEP_SECONDS = 3;

export const stepDurationInFrames = (step: FlowStep): number =>
  Math.round((step.durationSeconds ?? DEFAULT_STEP_SECONDS) * FPS);

export const totalDurationInFrames = (manifest: FlowManifest): number =>
  TITLE_SECONDS * FPS +
  manifest.steps.reduce((sum, step) => sum + stepDurationInFrames(step), 0);
