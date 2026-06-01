import NodeCache from "node-cache";

// Standard TTL: 5 minutes (300 seconds) for dynamic stats
// Check period: 1 minute (60 seconds)
export const appCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export const CacheKeys = {
    ALL_BRANCHES: "ALL_BRANCHES_KEY",
    getDashboardKey: (userId: string, departmentId?: string) => `dashboard_stats_${departmentId || "global"}_${userId}`,
    /** Permission map cache key prefix: "perm:{userId}:" — appended with tokenVersion */
    PERMISSION_PREFIX: "perm:",
};

/**
 * Invalidate the cached permission map for a specific user.
 * Call this whenever the user's roles, department assignments, or permissions change.
 */
export function invalidatePermissionCache(userId: string): void {
    const prefix = `${CacheKeys.PERMISSION_PREFIX}${userId}:`;
    const keys = appCache.keys().filter((k) => k.startsWith(prefix));
    if (keys.length > 0) {
        appCache.del(keys);
    }
}

/**
 * Invalidate permission caches for all users who hold a given role.
 * Call this when a role's permissions are modified.
 */
export async function invalidatePermissionCacheForRole(roleId: string, dataSource?: any): Promise<void> {
    if (!dataSource) {
        // Can't trace affected users without DB access — caller should handle this
        return;
    }
    try {
        const rows = await dataSource.query(
            `SELECT DISTINCT user_id FROM user_department_roles WHERE role_id = $1`,
            [roleId],
        );
        for (const row of rows) {
            invalidatePermissionCache(row.user_id);
        }
    } catch (err) {
        console.error("[Cache] Failed to invalidate permission cache for role:", err);
    }
}
