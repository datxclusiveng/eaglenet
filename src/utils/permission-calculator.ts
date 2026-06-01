import { User, UserRole } from "../modules/users/entities/User";
import { UserDepartmentRole } from "../modules/users/entities/UserDepartmentRole";
import { PermissionScope } from "../modules/permissions/entities/Permission";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PermissionEntry {
  allowed: boolean;
  scope: PermissionScope | null;
  /** True when ABAC conditions exist — frontend may show the action but backend still enforces */
  conditional?: boolean;
}

export interface DepartmentPermission {
  departmentId: string;
  departmentName: string;
  roleName: string;
  permissions: string[]; // "resource:action" strings
}

export interface PermissionMap {
  /** Top-level system role for broad gating (admin panel, superadmin settings, etc.) */
  role: UserRole;
  /** Per-department breakdown (useful when the UI lets users switch department contexts) */
  departments: DepartmentPermission[];
  /**
   * Flat dictionary keyed by "resource:action".
   * Frontend does: permissions.map["invoice:delete"]?.allowed
   */
  map: Record<string, PermissionEntry>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const scopeRank: Record<PermissionScope, number> = {
  [PermissionScope.ALL]: 3,
  [PermissionScope.DEPARTMENT]: 2,
  [PermissionScope.OWN]: 1,
};

/**
 * Mirror of the fast-path whitelist from authorize.middleware.ts.
 * Keep these two in sync.
 */
const STAFF_FAST_PATH: Array<{ resource: string; action: string }> = [
  { resource: "shipment", action: "create" },
  { resource: "shipment", action: "read" },
  { resource: "document", action: "create" },
  { resource: "document", action: "read" },
  { resource: "document", action: "update" },
  { resource: "invoice", action: "read" },
  { resource: "payment", action: "create" },
  { resource: "payment", action: "read" },
  { resource: "search", action: "read" },
];

/**
 * Every resource:action pair that exists in the system.
 * Mirrors seed-permissions.ts — keep these two in sync.
 */
export const ALL_KNOWN_PERMISSIONS: Array<{ resource: string; action: string }> = [
  // shipment
  { resource: "shipment", action: "create" },
  { resource: "shipment", action: "read" },
  { resource: "shipment", action: "update" },
  { resource: "shipment", action: "delete" },
  { resource: "shipment", action: "approve" },
  // customs
  { resource: "customs", action: "read" },
  { resource: "customs", action: "update" },
  // invoice
  { resource: "invoice", action: "create" },
  { resource: "invoice", action: "read" },
  { resource: "invoice", action: "update" },
  { resource: "invoice", action: "delete" },
  { resource: "invoice", action: "verify" },
  { resource: "invoice", action: "approve" },
  { resource: "invoice", action: "reconcile" },
  { resource: "invoice", action: "submit" },
  // bank-account
  { resource: "bank-account", action: "create" },
  { resource: "bank-account", action: "read" },
  { resource: "bank-account", action: "update" },
  { resource: "bank-account", action: "delete" },
  // payment
  { resource: "payment", action: "create" },
  { resource: "payment", action: "read" },
  { resource: "payment", action: "update" },
  { resource: "payment", action: "delete" },
  { resource: "payment", action: "process" },
  // voucher
  { resource: "voucher", action: "create" },
  { resource: "voucher", action: "read" },
  { resource: "voucher", action: "update" },
  { resource: "voucher", action: "delete" },
  { resource: "voucher", action: "verify" },
  { resource: "voucher", action: "approve" },
  // cashbook
  { resource: "cashbook", action: "create" },
  { resource: "cashbook", action: "read" },
  { resource: "cashbook", action: "update" },
  { resource: "cashbook", action: "delete" },
  // ledger
  { resource: "ledger", action: "create" },
  { resource: "ledger", action: "read" },
  { resource: "ledger", action: "update" },
  { resource: "ledger", action: "delete" },
  // document
  { resource: "document", action: "create" },
  { resource: "document", action: "read" },
  { resource: "document", action: "update" },
  { resource: "document", action: "delete" },
  { resource: "document", action: "verify" },
  // workflow
  { resource: "workflow", action: "create" },
  { resource: "workflow", action: "read" },
  { resource: "workflow", action: "update" },
  { resource: "workflow", action: "attach" },
  // audit
  { resource: "audit", action: "read" },
  // department
  { resource: "department", action: "create" },
  { resource: "department", action: "read" },
  { resource: "department", action: "update" },
  { resource: "department", action: "delete" },
  // user
  { resource: "user", action: "create" },
  { resource: "user", action: "read" },
  { resource: "user", action: "update" },
  { resource: "user", action: "deactivate" },
  { resource: "user", action: "upgrade" },
  // role
  { resource: "role", action: "create" },
  { resource: "role", action: "read" },
  { resource: "role", action: "update" },
  // permission
  { resource: "permission", action: "create" },
  { resource: "permission", action: "read" },
  // customer
  { resource: "customer", action: "create" },
  { resource: "customer", action: "read" },
  // message
  { resource: "message", action: "create" },
  { resource: "message", action: "read" },
  { resource: "message", action: "update" },
  { resource: "message", action: "delete" },
  // channel
  { resource: "channel", action: "create" },
  { resource: "channel", action: "read" },
  { resource: "channel", action: "update" },
  { resource: "channel", action: "delete" },
  // mail
  { resource: "mail", action: "read" },
  { resource: "mail", action: "send" },
  // warehouse
  { resource: "warehouse", action: "create" },
  { resource: "warehouse", action: "read" },
  { resource: "warehouse", action: "update" },
  { resource: "warehouse", action: "delete" },
  // search
  { resource: "search", action: "read" },
];

// ─── Core Computation ─────────────────────────────────────────────────────────

/**
 * Compute the full permission map for a user.
 *
 * @param user        - The authenticated user (must include departmentRoles with role.permissions loaded)
 * @param allKnown    - The universe of all known resource:action pairs (defaults to ALL_KNOWN_PERMISSIONS)
 * @returns           - A PermissionMap ready to include in API responses
 */
export function computePermissionMap(
  user: User,
  allKnown: Array<{ resource: string; action: string }> = ALL_KNOWN_PERMISSIONS,
): PermissionMap {
  // ── 1. Top-level role ───────────────────────────────────────────────────
  const role = user.role;

  // ── 2. SUPERADMIN / ADMIN get everything unlocked ───────────────────────
  if (role === UserRole.SUPERADMIN || role === UserRole.ADMIN) {
    const map: Record<string, PermissionEntry> = {};
    for (const { resource, action } of allKnown) {
      map[`${resource}:${action}`] = { allowed: true, scope: PermissionScope.ALL };
    }
    return {
      role,
      departments: buildDepartmentBreakdown(user),
      map,
    };
  }

  // ── 3. STAFF: start from fast-path whitelist ────────────────────────────
  const map: Record<string, PermissionEntry> = {};

  // Seed all known permissions as denied first
  for (const { resource, action } of allKnown) {
    map[`${resource}:${action}`] = { allowed: false, scope: null };
  }

  // Apply fast-path baseline (scope: own)
  for (const { resource, action } of STAFF_FAST_PATH) {
    map[`${resource}:${action}`] = { allowed: true, scope: PermissionScope.OWN };
  }

  // ── 4. Overlay departmental role permissions ────────────────────────────
  const departmentRoles: UserDepartmentRole[] = user.departmentRoles ?? [];

  for (const udr of departmentRoles) {
    if (!udr.role?.permissions) continue;

    for (const perm of udr.role.permissions) {
      const key = `${perm.resource}:${perm.action}`;
      const existing = map[key];

      // Determine if this permission has ABAC conditions
      const hasConditions = perm.conditions && Object.keys(perm.conditions).length > 0;

      if (!existing || existing.allowed === false) {
        // First time seeing this permission → set it
        map[key] = {
          allowed: true,
          scope: perm.scope,
          ...(hasConditions ? { conditional: true } : {}),
        };
      } else {
        // Already have this permission from another role or fast-path → keep highest scope
        const existingRank = existing.scope ? scopeRank[existing.scope] : 0;
        const newRank = scopeRank[perm.scope];
        if (newRank > existingRank) {
          map[key] = {
            allowed: true,
            scope: perm.scope,
            ...(hasConditions ? { conditional: true } : {}),
          };
        }
        // If same rank but new one has conditions, preserve the conditional flag
        if (newRank === existingRank && hasConditions && !existing.conditional) {
          map[key].conditional = true;
        }
      }
    }
  }

  return {
    role,
    departments: buildDepartmentBreakdown(user),
    map,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDepartmentBreakdown(user: User): DepartmentPermission[] {
  const departmentRoles: UserDepartmentRole[] = user.departmentRoles ?? [];
  return departmentRoles.map((udr) => ({
    departmentId: udr.departmentId,
    departmentName: udr.department?.name ?? "Unknown",
    roleName: udr.role?.name ?? "Unknown",
    permissions: (udr.role?.permissions ?? []).map(
      (p) => `${p.resource}:${p.action}`,
    ),
  }));
}

/**
 * Build an empty deny-all map for when we can't load permissions.
 * Frontend treats every entry as forbidden.
 */
export function emptyPermissionMap(): PermissionMap {
  const map: Record<string, PermissionEntry> = {};
  for (const { resource, action } of ALL_KNOWN_PERMISSIONS) {
    map[`${resource}:${action}`] = { allowed: false, scope: null };
  }
  return { role: UserRole.STAFF, departments: [], map };
}
