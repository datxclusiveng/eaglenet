import { AppDataSource } from "../../database/data-source";
import { Permission, PermissionScope } from "../modules/permissions/entities/Permission";

// Every resource:action pair for both DEPARTMENT and ALL scopes
const resources = {
  shipment: ["create", "read", "update", "delete", "approve"],
  customs: ["read", "update"],
  invoice: ["create", "read", "update", "delete", "verify", "approve", "reconcile", "submit"],
  "bank-account": ["create", "read", "update", "delete"],
  payment: ["create", "read", "update", "delete", "process"],
  voucher: ["create", "read", "update", "delete", "verify", "approve"],
  cashbook: ["create", "read", "update", "delete"],
  document: ["create", "read", "update", "delete", "verify"],
  workflow: ["create", "read", "update", "attach"],
  audit: ["read"],
  department: ["create", "read", "update", "delete"],
  user: ["create", "read", "update", "deactivate", "upgrade"],
  role: ["create", "read", "update"],
  permission: ["create", "read"],
  customer: ["create", "read"],
  message: ["create", "read", "update", "delete"],
  channel: ["create", "read", "update", "delete"],
  mail: ["read", "send"],
  search: ["read"],
};

const permissionEntries: Array<{ resource: string; action: string; scope: PermissionScope }> = [];

for (const [resource, actions] of Object.entries(resources)) {
  for (const action of actions) {
    permissionEntries.push({ resource, action, scope: PermissionScope.DEPARTMENT });
    permissionEntries.push({ resource, action, scope: PermissionScope.ALL });
  }
}

export async function seedPermissions() {
  try {
    console.log("Checking system permissions...");
    const repo = AppDataSource.getRepository(Permission);

    for (const p of permissionEntries) {
      const exists = await repo.findOneBy({ resource: p.resource, action: p.action, scope: p.scope });
      if (!exists) {
        const perm = repo.create(p);
        await repo.save(perm);
        console.log(`[SEED] Created missing permission: ${p.resource}:${p.action} (${p.scope})`);
      }
    }

    console.log("System permissions are up to date.");
  } catch (err) {
    console.error("Auto-seeding permissions failed:", err);
  }
}
