const intEnv = (name: string, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
};

export const GOALGRID_LIMITS = {
  simulation: {
    defaultIterations: intEnv("GOALGRID_SIM_DEFAULT_ITERATIONS", 1, 1, 1_000),
    maxIterations: intEnv("GOALGRID_SIM_MAX_ITERATIONS", 1_000, 1, 1_000),
    maxConcurrentRuns: intEnv("GOALGRID_SIM_MAX_CONCURRENT", 2, 1, 20),
    maxRuntimeMs: intEnv("GOALGRID_SIM_MAX_RUNTIME_MS", 30_000, 1_000, 120_000),
    retentionDays: intEnv("GOALGRID_SIM_RETENTION_DAYS", 30, 1, 3650),
    multiPro: intEnv("GOALGRID_SIM_MULTI_PRO", 1_000, 1, 1_000),
    multiPremium: intEnv("GOALGRID_SIM_MULTI_PREMIUM", 1_000, 1, 1_000),
    seasonPro: intEnv("GOALGRID_SIM_SEASON_PRO", 200, 1, 1_000),
    seasonPremium: intEnv("GOALGRID_SIM_SEASON_PREMIUM", 1_000, 1, 1_000),
  },
  community: {
    postsPerHour: intEnv("GOALGRID_POSTS_PER_HOUR", 20, 1, 500),
    commentsPerHour: intEnv("GOALGRID_COMMENTS_PER_HOUR", 20, 1, 500),
    likesPerHour: intEnv("GOALGRID_LIKES_PER_HOUR", 60, 1, 1_000),
    reportsPerDay: intEnv("GOALGRID_REPORTS_PER_DAY", 10, 1, 200),
    followsPerHour: intEnv("GOALGRID_FOLLOWS_PER_HOUR", 30, 1, 500),
    maxPostLength: intEnv("GOALGRID_MAX_POST_LENGTH", 500, 50, 10_000),
    maxFilesPerPost: intEnv("GOALGRID_MAX_FILES_PER_POST", 2, 1, 10),
  },
  model: {
    candidateMaxModels: intEnv("GOALGRID_MODEL_CANDIDATE_MAX", 30, 8, 40),
    activeMaxModels: intEnv("GOALGRID_MODEL_ACTIVE_MAX", 15, 3, 15),
  },
  ai: {
    requestsPerHour: intEnv("GOALGRID_AI_REQUESTS_PER_HOUR", 10, 1, 500),
    tokenBudgetPerHour: intEnv("GOALGRID_AI_TOKENS_PER_HOUR", 120_000, 1_000, 5_000_000),
    maxOutputTokens: intEnv("GOALGRID_AI_MAX_OUTPUT_TOKENS", 2_500, 100, 20_000),
  },
  uploads: {
    maxFileSize: intEnv("GOALGRID_UPLOAD_MAX_BYTES", 1_000_000, 10_000, 20_000_000),
    maxFilesPerPost: intEnv("GOALGRID_UPLOAD_MAX_FILES", 2, 1, 10),
  },
  system: {
    maxJobDuration: intEnv("GOALGRID_MAX_JOB_DURATION_MS", 60_000, 1_000, 600_000),
    maxQueueDepth: intEnv("GOALGRID_MAX_QUEUE_DEPTH", 1_000, 1, 1_000_000),
  },
} as const;
