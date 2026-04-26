import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../../database/data-source";
import { UserDepartmentRole } from "../modules/users/entities/UserDepartmentRole";
import { User, UserRole } from "../modules/users/entities/User";
import { PermissionScope } from "../modules/permissions/entities/Permission";

/**
 * Custom authorize middleware.
 * Usage: router.get("/", authorize("shipment", "read"), controller.method)
 */
export function authorize(resource: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user as User;
      if (!user) {
        return res.status(401).json({ status: "error", message: "Authentication required." });
      }

      // 1. Superadmins and Admins bypass all policy checks
      if (user.role === UserRole.SUPERADMIN || user.role === UserRole.ADMIN) {
        return next();
      }

      // 1.5. Fast-path whitelist for base STAFF actions.
      let isFastPathAllowed = false;
      if (user.role === UserRole.STAFF) {
        const allowed = [
          { resource: "shipment", action: "create" },
          { resource: "shipment", action: "read" },
          { resource: "document", action: "create" },
          { resource: "document", action: "read" },
          { resource: "document", action: "update" },
          { resource: "invoice", action: "read" },
          { resource: "payment", action: "create" },
          { resource: "payment", action: "read" },
          { resource: "search", action: "read" }
        ];
        isFastPathAllowed = allowed.some(r => r.resource === resource && r.action === action);
      }

      // 2. Load User's Departmental Roles and Permissions
      // Note: In production, we should cache this in Redis or the token payload if small.
      const userPermissions = await AppDataSource.getRepository(UserDepartmentRole).find({
        where: { userId: user.id },
        relations: ["role", "role.permissions", "department"],
      });

      if ((!userPermissions || userPermissions.length === 0) && !isFastPathAllowed) {
        // If no departmental roles and not in fast path, reject.
        return res.status(403).json({ 
          status: "error", 
          message: "Access Denied: No departmental clearance." 
        });
      }

      // 3. Find matching permission
      let hasAccess = false;
      let targetScope: PermissionScope | null = null;
      let matchedDepartmentId: string | null = null;

      for (const udr of userPermissions) {
        if (!udr.role?.permissions) continue;
        const found = udr.role.permissions.find(
          (p) => p.resource === resource && p.action === action
        );

        if (found) {
          let conditionsMet = true;
          if (found.conditions && Object.keys(found.conditions).length > 0) {
            for (const [key, val] of Object.entries(found.conditions)) {
              let userVal = val;
              if (val === "user.department_id") {
                userVal = udr.departmentId;
              } else if (typeof val === "string" && val.startsWith("user.")) {
                userVal = (user as any)[val.split(".")[1]];
              }

              const reqVal = req.body?.[key] || req.params?.[key] || req.query?.[key];
              if (reqVal !== undefined && String(reqVal) !== String(userVal)) {
                conditionsMet = false;
                break;
              }
            }
          }

          if (conditionsMet) {
            hasAccess = true;
            targetScope = found.scope;
            matchedDepartmentId = udr.departmentId;

            if (targetScope === PermissionScope.ALL) break;
          }
        }
      }

      if (!hasAccess && isFastPathAllowed) {
        hasAccess = true;
        targetScope = PermissionScope.OWN;
        if (userPermissions && userPermissions.length > 0) {
          matchedDepartmentId = userPermissions[0].departmentId;
        }
      }

      if (!hasAccess) {
        return res.status(403).json({ 
          status: "error", 
          message: `Access Denied: Insufficient permissions or ABAC conditions failed for ${resource}:${action}` 
        });
      }

      // 4. Attach scope info to request for the controller to use in data filtering
      (req as any).permissionScope = {
        scope: targetScope,
        departmentId: matchedDepartmentId,
      };

      next();
    } catch (err) {
      console.error("[AuthorizeMiddleware]", err);
      return res.status(500).json({ status: "error", message: "Authorization Error." });
    }
  };
}
