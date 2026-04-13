import { AppDataSource } from "../../../../database/data-source";
import { WorkflowStep, WorkflowStepStatus } from "../entities/WorkflowStep";
import { logActivity } from "../../shipments/services/activity.service";

const workflowRepo = () => AppDataSource.getRepository(WorkflowStep);

/**
 * Attaches a standard operational workflow to a shipment.
 */
export async function attachStandardWorkflow(
  shipmentId: string,
  departmentIds: { docs?: string; customs?: string; delivery?: string } = {}
): Promise<WorkflowStep[]> {
  const stepsData = [
    { name: "Document Verification", order: 1, dept: departmentIds.docs },
    { name: "Export Clearance", order: 2, dept: departmentIds.customs },
    { name: "Freight Transit", order: 3, dept: undefined },
    { name: "Import Clearance", order: 4, dept: departmentIds.customs },
    { name: "Final Delivery", order: 5, dept: departmentIds.delivery },
  ];

  const steps = stepsData.map((s) =>
    workflowRepo().create({
      shipmentId,
      name: s.name,
      stepOrder: s.order,
      departmentId: s.dept,
      status: WorkflowStepStatus.PENDING,
    })
  );

  return workflowRepo().save(steps);
}

/**
 * Get all workflow steps for a shipment ordered chronologically
 */
export async function getShipmentWorkflow(shipmentId: string): Promise<WorkflowStep[]> {
  return workflowRepo().find({
    where: { shipmentId },
    order: { stepOrder: "ASC" },
  });
}

/**
 * Update the status of a specific workflow step
 */
export async function updateWorkflowStep(
  stepId: string,
  userId: string,
  data: { status: WorkflowStepStatus; comments?: string }
): Promise<WorkflowStep> {
  const step = await workflowRepo().findOneOrFail({ where: { id: stepId } });

  step.status = data.status;
  if (data.comments !== undefined) step.comments = data.comments;

  if (data.status === WorkflowStepStatus.COMPLETED) {
    step.completedBy = userId;
    step.completedAt = new Date();
  }

  const saved = await workflowRepo().save(step);

  // Sync to general shipment activity log
  await logActivity(
    step.shipmentId,
    userId,
    `workflow_${data.status.toLowerCase()}`,
    { metadata: { step: step.name, comments: data.comments } }
  );

  return saved;
}
