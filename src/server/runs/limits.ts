/** Limits of D10 and D23, overridable from the environment. */
function positiveInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** New runs accepted per day (UTC). */
export const runsPerDay = () => positiveInt("RUNS_PER_DAY", 10);

/** LLM calls one run may make before it is blocked (D8). */
export const llmCallsPerRun = () => positiveInt("LLM_CALLS_PER_RUN", 30);
