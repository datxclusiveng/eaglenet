import { AppDataSource } from "../../../../database/data-source";
import { Shipment } from "../../shipments/entities/Shipment";
import { Document } from "../../documents/entities/Document";
import { User, UserRole } from "../../users/entities/User";
import { Invoice } from "../../financial/entities/Invoice";
import { ILike } from "typeorm";

/**
 * Standardized search result format for the frontend Command Palette.
 */
export interface SearchResult {
  id: string;
  type: "shipment" | "document" | "user" | "invoice";
  title: string;
  subtitle: string;
  url: string;
}

/**
 * Perform a unified global search across Shipments, Documents, Invoices, and Users.
 * Limits the blast radius based on the querying user's scope.
 */
export async function performGlobalSearch(query: string, user: User): Promise<SearchResult[]> {
  const searchTerm = `%${query}%`;
  const isCustomer = user.role === UserRole.CUSTOMER;
  const results: SearchResult[] = [];

  // 1. Search Shipments
  const shipmentRepo = AppDataSource.getRepository(Shipment);
  const shipmentQuery = shipmentRepo.createQueryBuilder("s")
    .where("(s.trackingNumber ILIKE :q OR s.originCity ILIKE :q OR s.destinationCity ILIKE :q)", { q: searchTerm });

  if (isCustomer) {
    shipmentQuery.andWhere("s.clientEmail = :email", { email: user.email });
  }

  const shipments = await shipmentQuery.take(5).getMany();
  shipments.forEach(s => {
    results.push({
      id: s.id,
      type: "shipment",
      title: s.trackingNumber,
      subtitle: `${s.originCity || "TBC"} → ${s.destinationCity || "TBC"}`,
      url: `/shipments/${s.id}`
    });
  });

  // 2. Search Documents
  const documentRepo = AppDataSource.getRepository(Document);
  const docQuery = documentRepo.createQueryBuilder("d")
    .leftJoinAndSelect("d.shipment", "ds")
    .where("(d.name ILIKE :q OR d.documentType ILIKE :q OR d.text_search_vector @@ plainto_tsquery('english', :plainQuery))", { 
      q: searchTerm,
      plainQuery: query
    });

  if (isCustomer) {
    // Only see documents tied to their shipment OR where they are the uploader
    docQuery.andWhere("(ds.clientEmail = :email OR d.uploaderId = :uid)", { email: user.email, uid: user.id });
  }

  const documents = await docQuery.take(5).getMany();
  documents.forEach(d => {
    results.push({
      id: d.id,
      type: "document",
      title: d.name,
      subtitle: `Type: ${d.documentType}`,
      url: `/documents/${d.id}`
    });
  });

  // 3. Search Invoices
  const invoiceRepo = AppDataSource.getRepository(Invoice);
  const invoiceQuery = invoiceRepo.createQueryBuilder("inv")
    .leftJoinAndSelect("inv.shipment", "is")
    .where("inv.invoiceNumber ILIKE :q", { q: searchTerm });

  if (isCustomer) {
    invoiceQuery.andWhere("is.clientEmail = :email", { email: user.email });
  }

  const invoices = await invoiceQuery.take(5).getMany();
  invoices.forEach(inv => {
    results.push({
      id: inv.id,
      type: "invoice",
      title: inv.invoiceNumber,
      subtitle: `Amount: $${inv.totalAmount} (${inv.status})`,
      url: `/invoices/${inv.id}`
    });
  });

  // 4. Search Users (Admins Only)
  if (!isCustomer) {
    const userRepo = AppDataSource.getRepository(User);
    const users = await userRepo.find({
      where: [
        { email: ILike(searchTerm) },
        { firstName: ILike(searchTerm) },
        { lastName: ILike(searchTerm) }
      ],
      take: 5
    });

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
