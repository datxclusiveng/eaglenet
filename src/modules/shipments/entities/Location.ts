import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export enum LocationType {
  AIRPORT = "AIRPORT",
  SEAPORT = "SEAPORT",
}

@Entity("locations")
export class Location {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  code!: string; // IATA (e.g. LOS) or UN/LOCODE

  @Column({ nullable: true })
  country?: string;

  @Column({
    type: "enum",
    enum: LocationType,
  })
  type!: LocationType;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
