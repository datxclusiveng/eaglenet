import { Entity, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm";
import { User } from "./User";
import { Department } from "../../departments/entities/Department";
import { Role } from "../../roles/entities/Role";

@Entity("user_department_roles")
export class UserDepartmentRole {
  @PrimaryColumn({ name: "user_id" })
  userId!: string;

  @PrimaryColumn({ name: "department_id" })
  departmentId!: string;

  @PrimaryColumn({ name: "role_id" })
  roleId!: string;

  @ManyToOne(() => User, (user) => user.departmentRoles, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @ManyToOne(() => Department, { onDelete: "CASCADE" })
  @JoinColumn({ name: "department_id" })
  department!: Department;

  @ManyToOne(() => Role, { onDelete: "CASCADE" })
  @JoinColumn({ name: "role_id" })
  role!: Role;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
