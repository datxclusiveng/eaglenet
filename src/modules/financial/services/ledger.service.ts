import { AppDataSource } from "../../../../database/data-source";
import { LedgerEntry, LedgerEntryType, LedgerItems, LedgerTransactionNature } from "../entities/LedgerEntry";
import { generateEglId } from "../../../utils/helpers";

const repo = () => AppDataSource.getRepository(LedgerEntry);

export async function createLedgerEntry(data: {
  date: string;
  description?: string;
  amount: number;
  cashReceivedFromBank?: number;
  natureOfTransaction: LedgerTransactionNature;
  entryType: LedgerEntryType;
  items?: LedgerItems;
  createdById: string;
}): Promise<LedgerEntry> {
  const referenceNumber = generateEglId("REF" as any).replace("-REF-", "-LDG-");

  const entry = repo().create({
    ...data,
    referenceNumber,
    items: data.items || {},
  });

  return repo().save(entry);
}

export async function listLedgerEntries(opts: {
  skip: number;
  take: number;
  natureOfTransaction?: LedgerTransactionNature;
  entryType?: LedgerEntryType;
  startDate?: string;
  endDate?: string;
}): Promise<[LedgerEntry[], number]> {
  const qb = repo().createQueryBuilder("entry")
    .leftJoinAndSelect("entry.createdBy", "createdBy")
    .where("entry.is_deleted = :isDeleted", { isDeleted: false });

  if (opts.natureOfTransaction) qb.andWhere("entry.natureOfTransaction = :nature", { nature: opts.natureOfTransaction });
  if (opts.entryType) qb.andWhere("entry.entryType = :entryType", { entryType: opts.entryType });
  if (opts.startDate) qb.andWhere("entry.date >= :startDate", { startDate: opts.startDate });
  if (opts.endDate) qb.andWhere("entry.date <= :endDate", { endDate: opts.endDate });

  qb.orderBy("entry.date", "DESC")
    .addOrderBy("entry.createdAt", "DESC")
    .skip(opts.skip)
    .take(opts.take);

  return qb.getManyAndCount();
}

export async function getLedgerEntryById(id: string): Promise<LedgerEntry | null> {
  return repo().findOne({
    where: { id, isDeleted: false },
    relations: ["createdBy"],
  });
}

export async function updateLedgerEntry(
  id: string,
  data: Partial<{
    date: string;
    description: string;
    amount: number;
    cashReceivedFromBank: number;
    natureOfTransaction: LedgerTransactionNature;
    entryType: LedgerEntryType;
    items: LedgerItems;
  }>
): Promise<LedgerEntry> {
  const entry = await repo().findOneOrFail({ where: { id, isDeleted: false } });
  Object.assign(entry, data);
  return repo().save(entry);
}

export async function softDeleteLedgerEntry(id: string): Promise<void> {
  const entry = await repo().findOneOrFail({ where: { id, isDeleted: false } });
  entry.isDeleted = true;
  await repo().save(entry);
}

export async function listMyLedgerEntries(opts: {
  userId: string;
  skip: number;
  take: number;
  natureOfTransaction?: LedgerTransactionNature;
  entryType?: LedgerEntryType;
  startDate?: string;
  endDate?: string;
}): Promise<[LedgerEntry[], number]> {
  const qb = repo().createQueryBuilder("entry")
    .leftJoinAndSelect("entry.createdBy", "createdBy")
    .where("entry.created_by_id = :userId", { userId: opts.userId })
    .andWhere("entry.is_deleted = :isDeleted", { isDeleted: false });

  if (opts.natureOfTransaction) qb.andWhere("entry.natureOfTransaction = :nature", { nature: opts.natureOfTransaction });
  if (opts.entryType) qb.andWhere("entry.entryType = :entryType", { entryType: opts.entryType });
  if (opts.startDate) qb.andWhere("entry.date >= :startDate", { startDate: opts.startDate });
  if (opts.endDate) qb.andWhere("entry.date <= :endDate", { endDate: opts.endDate });

  qb.orderBy("entry.date", "DESC")
    .addOrderBy("entry.createdAt", "DESC")
    .skip(opts.skip)
    .take(opts.take);

  return qb.getManyAndCount();
}
