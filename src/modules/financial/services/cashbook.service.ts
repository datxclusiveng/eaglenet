import { AppDataSource } from "../../../../database/data-source";
import { CashbookEntry, EntryType, TransactionNature } from "../entities/CashbookEntry";
import { generateEglId } from "../../../utils/helpers";

const repo = () => AppDataSource.getRepository(CashbookEntry);

export async function createCashbookEntry(data: {
  date: string;
  natureOfTransaction: TransactionNature;
  entryType: EntryType;
  amount: number;
  bankName?: string;
  bankAccountId?: string;
  description?: string;
  voucherId?: string;
  createdById: string;
}): Promise<CashbookEntry> {
  const referenceNumber = generateEglId("REF" as any).replace("-REF-", "-CASH-");

  const entry = repo().create({
    ...data,
    referenceNumber,
  });

  return repo().save(entry);
}

export async function listCashbookEntries(opts: {
  skip: number;
  take: number;
  natureOfTransaction?: TransactionNature;
  entryType?: EntryType;
  startDate?: string;
  endDate?: string;
  bankName?: string;
}): Promise<[CashbookEntry[], number]> {
  const where: any = {};
  if (opts.natureOfTransaction) where.natureOfTransaction = opts.natureOfTransaction;
  if (opts.entryType) where.entryType = opts.entryType;
  if (opts.bankName) where.bankName = opts.bankName;

  const qb = repo().createQueryBuilder("entry")
    .leftJoinAndSelect("entry.createdBy", "createdBy")
    .leftJoinAndSelect("entry.bankAccount", "bankAccount")
    .leftJoinAndSelect("entry.voucher", "voucher")
    .where("entry.is_deleted = :isDeleted", { isDeleted: false });

  if (opts.natureOfTransaction) qb.andWhere("entry.natureOfTransaction = :nature", { nature: opts.natureOfTransaction });
  if (opts.entryType) qb.andWhere("entry.entryType = :entryType", { entryType: opts.entryType });
  if (opts.bankName) qb.andWhere("entry.bankName = :bankName", { bankName: opts.bankName });
  if (opts.startDate) qb.andWhere("entry.date >= :startDate", { startDate: opts.startDate });
  if (opts.endDate) qb.andWhere("entry.date <= :endDate", { endDate: opts.endDate });

  qb.orderBy("entry.date", "DESC")
    .addOrderBy("entry.createdAt", "DESC")
    .skip(opts.skip)
    .take(opts.take);

  return qb.getManyAndCount();
}

export async function getCashbookEntryById(id: string): Promise<CashbookEntry | null> {
  return repo().findOne({
    where: { id, isDeleted: false },
    relations: ["createdBy", "bankAccount", "voucher"],
  });
}

export async function updateCashbookEntry(
  id: string,
  data: Partial<{
    date: string;
    natureOfTransaction: TransactionNature;
    entryType: EntryType;
    amount: number;
    bankName: string;
    bankAccountId: string;
    description: string;
    voucherId: string;
  }>
): Promise<CashbookEntry> {
  const entry = await repo().findOneOrFail({ where: { id, isDeleted: false } });
  Object.assign(entry, data);
  return repo().save(entry);
}

export async function listMyCashbookEntries(opts: {
  userId: string;
  skip: number;
  take: number;
  natureOfTransaction?: TransactionNature;
  entryType?: EntryType;
  startDate?: string;
  endDate?: string;
}): Promise<[CashbookEntry[], number]> {
  const qb = repo().createQueryBuilder("entry")
    .leftJoinAndSelect("entry.createdBy", "createdBy")
    .leftJoinAndSelect("entry.bankAccount", "bankAccount")
    .leftJoinAndSelect("entry.voucher", "voucher")
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

export async function softDeleteCashbookEntry(id: string): Promise<void> {
  const entry = await repo().findOneOrFail({ where: { id, isDeleted: false } });
  entry.isDeleted = true;
  await repo().save(entry);
}
