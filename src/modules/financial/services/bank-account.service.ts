import { AppDataSource } from "../../../../database/data-source";
import { BankAccount, BankAccountType } from "../entities/BankAccount";

const bankAccountRepo = () => AppDataSource.getRepository(BankAccount);

export async function createBankAccount(data: {
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankAddress?: string;
  sortCode?: string;
  swiftCode?: string;
  intermediaryBank?: string;
  intermediarySwift?: string;
  tin?: string;
  additionalInfo?: string;
  currency: string;
  accountType: BankAccountType;
  isDefault?: boolean;
  createdById: string;
}): Promise<BankAccount> {
  // If marked as default, unset other defaults of same type+currency
  if (data.isDefault) {
    await bankAccountRepo().update(
      { accountType: data.accountType, currency: data.currency, isDefault: true },
      { isDefault: false }
    );
  }

  // If first account of this type+currency, make it default automatically
  const existingCount = await bankAccountRepo().count({
    where: { accountType: data.accountType, currency: data.currency },
  });
  const isDefault = data.isDefault || existingCount === 0;

  const account = bankAccountRepo().create({
    ...data,
    isDefault,
  });

  return bankAccountRepo().save(account);
}

export async function listBankAccounts(opts: {
  skip: number;
  take: number;
  accountType?: BankAccountType;
  currency?: string;
  includeInactive?: boolean;
}): Promise<[BankAccount[], number]> {
  const where: any = {};

  if (opts.accountType) {
    where.accountType = opts.accountType;
  }
  if (opts.currency) {
    where.currency = opts.currency;
  }
  if (!opts.includeInactive) {
    where.isActive = true;
  }

  return bankAccountRepo().findAndCount({
    where,
    relations: ["createdBy"],
    order: { createdAt: "DESC" },
    skip: opts.skip,
    take: opts.take,
  });
}

export async function getBankAccountById(id: string): Promise<BankAccount | null> {
  return bankAccountRepo().findOne({
    where: { id },
    relations: ["createdBy"],
  });
}

export async function updateBankAccount(
  id: string,
  data: Partial<{
    accountName: string;
    accountNumber: string;
    bankName: string;
    bankAddress: string;
    sortCode: string;
    swiftCode: string;
    intermediaryBank: string;
    intermediarySwift: string;
    tin: string;
    additionalInfo: string;
    currency: string;
    accountType: BankAccountType;
    isActive: boolean;
    isDefault: boolean;
  }>
): Promise<BankAccount> {
  const account = await bankAccountRepo().findOneOrFail({ where: { id } });

  // If setting as default, unset other defaults of same type+currency
  if (data.isDefault && !account.isDefault) {
    await bankAccountRepo().update(
      { accountType: account.accountType, currency: account.currency, isDefault: true },
      { isDefault: false }
    );
  }

  Object.assign(account, data);
  return bankAccountRepo().save(account);
}

export async function softDeleteBankAccount(id: string): Promise<void> {
  const account = await bankAccountRepo().findOneOrFail({ where: { id } });
  // Don't allow deleting the default account if it's the only one of its type
  if (account.isDefault) {
    const count = await bankAccountRepo().count({
      where: { accountType: account.accountType, currency: account.currency },
    });
    if (count <= 1) {
      throw new Error("Cannot delete the only bank account of this type/currency. Create another account first.");
    }
  }
  await bankAccountRepo().softDelete(id);
}

export async function setDefaultBankAccount(id: string): Promise<BankAccount> {
  const account = await bankAccountRepo().findOneOrFail({ where: { id } });

  // Unset other defaults of same type+currency
  await bankAccountRepo().update(
    { accountType: account.accountType, currency: account.currency, isDefault: true },
    { isDefault: false }
  );

  account.isDefault = true;
  return bankAccountRepo().save(account);
}

export async function getDefaultBankAccount(
  accountType: BankAccountType,
  currency: string
): Promise<BankAccount | null> {
  return bankAccountRepo().findOne({
    where: { accountType, currency, isDefault: true, isActive: true },
  });
}

export async function getActiveBankAccountsByType(
  accountType: BankAccountType,
  currency?: string
): Promise<BankAccount[]> {
  const where: any = { accountType, isActive: true };
  if (currency) where.currency = currency;
  return bankAccountRepo().find({ where, order: { isDefault: "DESC", createdAt: "DESC" } });
}
