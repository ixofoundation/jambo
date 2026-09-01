/**
 * Registry of flows that get a Remotion composition.
 * Each entry must have a captured manifest at public/captures/<id>/manifest.json
 * (produced by the matching capture/flows/<id>.ts script) before it can render.
 */
export const FLOWS: { id: string; title: string }[] = [
  { id: "sign-in", title: "Sign in to jambo" },
  { id: "submit-claim", title: "Submit a claim" },
  { id: "apply-as-agent", title: "Apply as an agent" },
  { id: "home-tour", title: "Navigate your home screen" },
];
