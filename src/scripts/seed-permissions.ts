import { AppDataSource } from "../../database/data-source";
import { Permission, PermissionScope } from "../modules/permissions/entities/Permission";

const permissions = [
  // Shipment
  { resource: "shipment", action: "create", scope: PermissionScope.ALL },
  { resource: "shipment", action: "read", scope: PermissionScope.ALL },
  { resource: "shipment", action: "update", scope: PermissionScope.ALL },
  { resource: "shipment", action: "delete", scope: PermissionScope.ALL },
  { resource: "shipment", action: "approve", scope: PermissionScope.ALL },
  
  // Customs
  { resource: "customs", action: "read", scope: PermissionScope.ALL },
  { resource: "customs", action: "update", scope: PermissionScope.ALL },
  
  // Invoice
  { resource: "invoice", action: "create", scope: PermissionScope.ALL },
  { resource: "invoice", action: "read", scope: PermissionScope.ALL },
  { resource: "invoice", action: "update", scope: PermissionScope.ALL },
  { resource: "invoice", action: "reconcile", scope: PermissionScope.ALL },
  
  // Payment
  { resource: "payment", action: "create", scope: PermissionScope.ALL },
  { resource: "payment", action: "read", scope: PermissionScope.ALL },
  { resource: "payment", action: "process", scope: PermissionScope.ALL },
  
  // Document
  { resource: "document", action: "create", scope: PermissionScope.ALL },
  { resource: "document", action: "read", scope: PermissionScope.ALL },
  { resource: "document", action: "update", scope: PermissionScope.ALL },
  { resource: "document", action: "verify", scope: PermissionScope.ALL },
  
  // Workflow
  { resource: "workflow", action: "create", scope: PermissionScope.ALL },
  { resource: "workflow", action: "read", scope: PermissionScope.ALL },
  { resource: "workflow", action: "update", scope: PermissionScope.ALL },
  { resource: "workflow", action: "attach", scope: PermissionScope.ALL },
  
  // Audit
  { resource: "audit", action: "read", scope: PermissionScope.ALL },
  
  // Department
  { resource: "department", action: "create", scope: PermissionScope.ALL },
  { resource: "department", action: "read", scope: PermissionScope.ALL },
  { resource: "department", action: "update", scope: PermissionScope.ALL },
  { resource: "department", action: "delete", scope: PermissionScope.ALL },
  
  // User
  { resource: "user", action: "create", scope: PermissionScope.ALL },
  { resource: "user", action: "read", scope: PermissionScope.ALL },
  { resource: "user", action: "update", scope: PermissionScope.ALL },
  { resource: "user", action: "deactivate", scope: PermissionScope.ALL },
  { resource: "user", action: "upgrade", scope: PermissionScope.ALL },

  // Role & Permissions
  { resource: "role", action: "create", scope: PermissionScope.ALL },
  { resource: "role", action: "read", scope: PermissionScope.ALL },
  { resource: "role", action: "update", scope: PermissionScope.ALL },
  { resource: "permission", action: "create", scope: PermissionScope.ALL },
  { resource: "permission", action: "read", scope: PermissionScope.ALL },

  // Customer CRM
  { resource: "customer", action: "create", scope: PermissionScope.ALL },
  { resource: "customer", action: "read", scope: PermissionScope.ALL },
];

export async function seedPermissions() {
  try {
    console.log("Checking system permissions...");
    const repo = AppDataSource.getRepository(Permission);

    for (const p of permissions) {
      const exists = await repo.findOneBy({ resource: p.resource, action: p.action, scope: p.scope });
      if (!exists) {
        const perm = repo.create(p);
        await repo.save(perm);
        console.log(`[SEED] Created missing permission: ${p.resource}:${p.action}`);
      }
    }

    console.log("System permissions are up to date.");
  } catch (err) {
    console.error("Auto-seeding permissions failed:", err);
  }
}
