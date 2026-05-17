// Replay speed is measured as: how many milliseconds of recording
// time are consumed per 100ms of real playback time.
//
// At 1× speed:  1000ms of recording plays per 100ms real → 10× faster than real
// At 10× speed: 10000ms of recording plays per 100ms real → 100× faster than real
// "Watch in 60s": dynamically computed so entire recording fits in 60 real seconds
// "Watch in 30s": dynamically computed so entire recording fits in 30 real seconds

export interface SpeedOption {
  label:     string   // display label, e.g. "1×" or "30s"
  msPerTick: number   // recording ms consumed per 100ms real tick
  isPreset:  boolean  // true for multiplier presets, false for watch-in-N modes
}

export function computePresetSpeeds(): SpeedOption[] {
  return [
    { label: '1×',  msPerTick: 1000,  isPreset: true },
    { label: '2×',  msPerTick: 2000,  isPreset: true },
    { label: '5×',  msPerTick: 5000,  isPreset: true },
    { label: '10×', msPerTick: 10000, isPreset: true },
    { label: '30×', msPerTick: 30000, isPreset: true },
  ]
}

// Compute a SpeedOption so the entire recording plays in `targetSeconds` real seconds.
// The playback loop fires every 100ms, so:
//   (totalDurationMs / msPerTick) * 0.1s = targetSeconds
//   → msPerTick = totalDurationMs / (targetSeconds * 10)
export function computeWatchInSeconds(
  totalDurationMs: number,
  targetSeconds:   number
): SpeedOption {
  const msPerTick = Math.ceil(totalDurationMs / (targetSeconds * 10))
  return {
    label:     `${targetSeconds}s`,
    msPerTick: Math.max(msPerTick, 500),  // minimum 500ms per tick to avoid UI freeze
    isPreset:  false,
  }
}

// Estimate real playback duration for a given speed and total recording length.
export function estimateRealDuration(speed: SpeedOption, totalDurationMs: number): string {
  const realMs = (totalDurationMs / speed.msPerTick) * 100
  if (realMs < 60000) return `~${Math.round(realMs / 1000)}s`
  return `~${Math.round(realMs / 60000)}m`
}

// Format a millisecond duration as "Xm Ys" or "Ys".
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const minutes      = Math.floor(totalSeconds / 60)
  const seconds      = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}
