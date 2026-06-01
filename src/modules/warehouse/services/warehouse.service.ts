import { AppDataSource } from "../../../../database/data-source";
import { WarehouseEntry, WarehouseDirection } from "../entities/WarehouseEntry";

const repo = () => AppDataSource.getRepository(WarehouseEntry);

export async function createWarehouseEntry(data: {
  sn: string;
  direction: WarehouseDirection;
  clients: string;
  awb: string;
  weight?: number;
  pkgs?: number;
  description?: string;
  dateIn: string;
  dateOut?: string;
  remarks?: string;
  createdById: string;
}): Promise<WarehouseEntry> {
  const entry = repo().create(data);
  return repo().save(entry);
}

export async function listWarehouseEntries(opts: {
  skip: number;
  take: number;
  direction?: WarehouseDirection;
  clients?: string;
  awb?: string;
  startDateIn?: string;
  endDateIn?: string;
  startDateOut?: string;
  endDateOut?: string;
}): Promise<[WarehouseEntry[], number]> {
  const qb = repo().createQueryBuilder("entry")
    .leftJoinAndSelect("entry.createdBy", "createdBy")
    .where("entry.is_deleted = :isDeleted", { isDeleted: false });

  if (opts.direction) qb.andWhere("entry.direction = :direction", { direction: opts.direction });
  if (opts.clients) qb.andWhere("entry.clients ILIKE :clients", { clients: `%${opts.clients}%` });
  if (opts.awb) qb.andWhere("entry.awb ILIKE :awb", { awb: `%${opts.awb}%` });
  if (opts.startDateIn) qb.andWhere("entry.dateIn >= :startDateIn", { startDateIn: opts.startDateIn });
  if (opts.endDateIn) qb.andWhere("entry.dateIn <= :endDateIn", { endDateIn: opts.endDateIn });
  if (opts.startDateOut) qb.andWhere("entry.dateOut >= :startDateOut", { startDateOut: opts.startDateOut });
  if (opts.endDateOut) qb.andWhere("entry.dateOut <= :endDateOut", { endDateOut: opts.endDateOut });

  qb.orderBy("entry.dateIn", "DESC")
    .addOrderBy("entry.createdAt", "DESC")
    .skip(opts.skip)
    .take(opts.take);

  return qb.getManyAndCount();
}

export async function getWarehouseEntryById(id: string): Promise<WarehouseEntry | null> {
  return repo().findOne({
    where: { id, isDeleted: false },
    relations: ["createdBy"],
  });
}

export async function updateWarehouseEntry(
  id: string,
  data: Partial<{
    sn: string;
    direction: WarehouseDirection;
    clients: string;
    awb: string;
    weight: number;
    pkgs: number;
    description: string;
    dateIn: string;
    dateOut: string;
    remarks: string;
  }>
): Promise<WarehouseEntry> {
  const entry = await repo().findOneOrFail({ where: { id, isDeleted: false } });
  Object.assign(entry, data);
  return repo().save(entry);
}

export async function listMyWarehouseEntries(opts: {
  userId: string;
  skip: number;
  take: number;
  direction?: WarehouseDirection;
  startDateIn?: string;
  endDateIn?: string;
  startDateOut?: string;
  endDateOut?: string;
}): Promise<[WarehouseEntry[], number]> {
  const qb = repo().createQueryBuilder("entry")
    .leftJoinAndSelect("entry.createdBy", "createdBy")
    .where("entry.created_by_id = :userId", { userId: opts.userId })
    .andWhere("entry.is_deleted = :isDeleted", { isDeleted: false });

  if (opts.direction) qb.andWhere("entry.direction = :direction", { direction: opts.direction });
  if (opts.startDateIn) qb.andWhere("entry.dateIn >= :startDateIn", { startDateIn: opts.startDateIn });
  if (opts.endDateIn) qb.andWhere("entry.dateIn <= :endDateIn", { endDateIn: opts.endDateIn });
  if (opts.startDateOut) qb.andWhere("entry.dateOut >= :startDateOut", { startDateOut: opts.startDateOut });
  if (opts.endDateOut) qb.andWhere("entry.dateOut <= :endDateOut", { endDateOut: opts.endDateOut });

  qb.orderBy("entry.dateIn", "DESC")
    .addOrderBy("entry.createdAt", "DESC")
    .skip(opts.skip)
    .take(opts.take);

  return qb.getManyAndCount();
}

export async function softDeleteWarehouseEntry(id: string): Promise<void> {
  const entry = await repo().findOneOrFail({ where: { id, isDeleted: false } });
  entry.isDeleted = true;
  await repo().save(entry);
}
