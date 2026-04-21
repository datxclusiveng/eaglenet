import { AppDataSource } from "../../../../database/data-source";
import { Shipment } from "../../shipments/entities/Shipment";
import { Document } from "../../documents/entities/Document";
import { User, UserRole } from "../../users/entities/User";
import { Invoice } from "../../financial/entities/Invoice";
import { PermissionScope } from "../../permissions/entities/Permission";

/**
 * Standardized search result format for the frontend.
 */
export interface SearchResult {
  id: string;
  type: "shipment" | "document" | "user" | "invoice";
  title: string;
  subtitle: string;
  url: string;
  departmentId?: string | null;
}

export interface SearchOptions {
  query: string;
  type?: "shipment" | "document" | "user" | "invoice";
  actor: User;
  scope?: PermissionScope;
  departmentId?: string | null;
}

/**
 * Unified global search with RBAC/ABAC scoping.
 */
export async function performGlobalSearch(options: SearchOptions): Promise<SearchResult[]> {
  const { query, type: entityType, actor, scope, departmentId } = options;
  const searchTerm = `%${query}%`;
  const isGlobalAdmin = actor.role === UserRole.SUPERADMIN || actor.role === UserRole.ADMIN;
  
  const results: SearchResult[] = [];

  // Helper to check if we should search this type
  const shouldSearch = (t: string) => !entityType || entityType === t;

  // 1. Search Shipments
  if (shouldSearch("shipment")) {
    const qb = AppDataSource.getRepository(Shipment).createQueryBuilder("s");
    qb.where("(s.trackingNumber ILIKE :q OR s.shipmentName ILIKE :q OR s.clientName ILIKE :q OR s.clientEmail ILIKE :q)", { q: searchTerm });

    if (!isGlobalAdmin) {
      if (scope === PermissionScope.DEPARTMENT && departmentId) {
        qb.andWhere("s.departmentId = :departmentId", { departmentId });
      } else if (scope === PermissionScope.OWN) {
        qb.andWhere("s.assignedOfficerId = :uid", { uid: actor.id });
      } else if (actor.role === UserRole.CUSTOMER) {
        qb.andWhere("s.clientEmail = :email", { email: actor.email });
      }
    }

    const shipments = await qb.take(10).getMany();
    shipments.forEach(s => {
      results.push({
        id: s.id,
        type: "shipment",
        title: s.shipmentName || s.trackingNumber,
        subtitle: `${s.trackingNumber} | ${s.originCity || "TBC"} → ${s.destinationCity || "TBC"}`,
        url: `/shipments/${s.id}`,
        departmentId: s.departmentId
      });
    });
  }

  // 2. Search Documents
  if (shouldSearch("document")) {
    const qb = AppDataSource.getRepository(Document).createQueryBuilder("d");
    // Search extracted text and name
    qb.where("(d.name ILIKE :q OR d.documentType ILIKE :q OR d.extractedText ILIKE :q)", { q: searchTerm });

    if (!isGlobalAdmin) {
      if (scope === PermissionScope.DEPARTMENT && departmentId) {
        qb.andWhere("d.departmentId = :departmentId", { departmentId });
      } else if (scope === PermissionScope.OWN) {
        qb.andWhere("d.uploaderId = :uid", { uid: actor.id });
      } else if (actor.role === UserRole.CUSTOMER) {
        // Tie documents to customer's own shipments via join if possible, 
        // or just by uploaderId if they uploaded it
        qb.leftJoin("d.shipment", "ds")
          .andWhere("(ds.clientEmail = :email OR d.uploaderId = :uid)", { email: actor.email, uid: actor.id });
      }
    }

    const documents = await qb.take(10).getMany();
    documents.forEach(d => {
      results.push({
        id: d.id,
        type: "document",
        title: d.name,
        subtitle: `Type: ${d.documentType} | Shipment Ref: ${d.shipmentId || "N/A"}`,
        url: `/documents/${d.id}`,
        departmentId: d.departmentId
      });
    });
  }

  // 3. Search Invoices
  if (shouldSearch("invoice")) {
    const qb = AppDataSource.getRepository(Invoice).createQueryBuilder("inv");
    qb.where("inv.invoiceNumber ILIKE :q", { q: searchTerm });

    if (!isGlobalAdmin) {
      if (actor.role === UserRole.CUSTOMER) {
        qb.leftJoin("inv.shipment", "is").andWhere("is.clientEmail = :email", { email: actor.email });
      } else if (scope === PermissionScope.DEPARTMENT && departmentId) {
        qb.leftJoin("inv.shipment", "is").andWhere("is.departmentId = :departmentId", { departmentId });
      }
    }

    const invoices = await qb.take(10).getMany();
    invoices.forEach(inv => {
      results.push({
        id: inv.id,
        type: "invoice",
        title: inv.invoiceNumber,
        subtitle: `Amount: $${inv.totalAmount} (${inv.status})`,
        url: `/invoices/${inv.id}`
      });
    });
  }

  // 4. Search Users (Admin or Dept Staff Search)
  if (shouldSearch("user")) {
    const qb = AppDataSource.getRepository(User).createQueryBuilder("u");
    qb.where("(u.firstName ILIKE :q OR u.lastName ILIKE :q OR u.email ILIKE :q)", { q: searchTerm });

    if (!isGlobalAdmin) {
        if (scope === PermissionScope.DEPARTMENT && departmentId) {
            // Find users in the same department
            qb.innerJoin("u.departmentRoles", "udr").andWhere("udr.departmentId = :departmentId", { departmentId });
        } else {
            // Regular users/customers can only find themselves effectively
            qb.andWhere("u.id = :uid", { uid: actor.id });
        }
    }

    const users = await qb.take(10).getMany();
    users.forEach(u => {
      results.push({
        id: u.id,
        type: "user",
        title: `${u.firstName} ${u.lastName}`,
        subtitle: u.email,
        url: `/users/${u.id}`
      });
    });
  }

  return results;
}
