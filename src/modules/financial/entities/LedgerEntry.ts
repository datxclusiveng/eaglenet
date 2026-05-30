import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "../../users/entities/User";

export enum LedgerTransactionNature {
  CASH = "cash",
  BANK = "bank",
}

export enum LedgerEntryType {
  DEBIT = "debit",
  CREDIT = "credit",
}

export interface LedgerItems {
  faan?: string;
  nahco?: string;
  sahcol?: string;
  quarantineTreatmentStamping?: string;
  airFreightSeaFreightCharges?: string;
  allied?: string;
  truckingExpenses?: string;
  operationsExpensesLabourExpenses?: string;
  passagesTravelsHotelFeedingAccommodation?: string;
  maintenanceOfficeWarehouse?: string;
  maintenanceOfOfficeTrucks?: string;
  maintenanceOfOfficeCars?: string;
  fuelForCars?: string;
  dieselForTrucks?: string;
  fuelForGeneratorServicing?: string;
  engineOilLubricant?: string;
  renewalRegistrationOfVehiclesPapers?: string;
  itMaintenanceOnServerComputerAccessories?: string;
  printingAndStationaries?: string;
  salariesAndAllowancesBonus?: string;
  telexTelephoneAllowanceAndPostagesTransferCharges?: string;
  renewal?: string;
  registrationAndSubscription?: string;
  rent?: string;
  localTransportGateFees?: string;
  officeConsumables?: string;
  rateGovernmentLevies?: string;
  packingMaterials?: string;
  advertisement?: string;
  legalAndAuditFees?: string;
  utilityExpenses?: string;
  maintenanceOfficeEquipment?: string;
  payeRemittance?: string;
  vatRemittance?: string;
  importExportClearanceAgencyFeeStoragesDemurrages?: string;
  insuranceExpenses?: string;
  additionToFixAsset?: string;
  staffPensionRemittance?: string;
  nsitf?: string;
  citEducationTax?: string;
  staffCostTraining?: string;
  chargesSundry?: string;
  staffLoan?: string;
  businessProspectingExpenses?: string;
  damagesBusinessLosses?: string;
  interestOnLoan?: string;
  loanRepayment?: string;
  entertainmentExpenses?: string;
  medicalExpenses?: string;
  whtTax?: string;
  disposalExpenses?: string;
  officeSiteClearingExpensesDevelopment?: string;
  securityExpenses?: string;
  officeFenceArchDesignExpenses?: string;
  healthSafetyExpenses?: string;
  contraEntry?: string;
  giftsDonations?: string;
  sponsorshipFootDevelopment?: string;
  loanGranted?: string;
  penalty?: string;
  internalTransfer?: string;
}

@Entity("ledger_entries")
export class LedgerEntry {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "reference_number", unique: true })
  referenceNumber!: string;

  @Column({ type: "date" })
  date!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "decimal", precision: 14, scale: 2 })
  amount!: number;

  @Column({ name: "cash_received_from_bank", type: "decimal", precision: 14, scale: 2, nullable: true, default: 0 })
  cashReceivedFromBank?: number;

  @Column({
    name: "nature_of_transaction",
    type: "enum",
    enum: LedgerTransactionNature,
  })
  natureOfTransaction!: LedgerTransactionNature;

  @Column({
    name: "entry_type",
    type: "enum",
    enum: LedgerEntryType,
  })
  entryType!: LedgerEntryType;

  @Column({ name: "items", type: "jsonb", nullable: true, default: {} })
  items?: LedgerItems;

  @Column({ name: "created_by_id" })
  createdById!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by_id" })
  createdBy!: User;

  @Column({ name: "is_deleted", default: false })
  isDeleted!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt?: Date;
}
