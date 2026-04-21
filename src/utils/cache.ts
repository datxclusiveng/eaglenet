import NodeCache from "node-cache";

// Standard TTL: 5 minutes (300 seconds) for dynamic stats
// Check period: 1 minute (60 seconds)
export const appCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export const CacheKeys = {
    ALL_BRANCHES: "ALL_BRANCHES_KEY",
    getDashboardKey: (userId: string, departmentId?: string) => `dashboard_stats_${departmentId || "global"}_${userId}`
};
