import { Request, Response } from "express";
import { User } from "../../users/entities/User";
import { WorkflowStepStatus } from "../entities/WorkflowStep";
import {
  attachStandardWorkflow,
  getShipmentWorkflow,
  updateWorkflowStep,
} from "../services/workflow.service";

// ─── POST /api/workflows/:shipmentId/attach ────────────────────────────────
export async function attachWorkflowHandler(req: Request, res: Response) {
  try {
    const shipmentId = req.params.shipmentId as string;
    const { docsDept, customsDept, deliveryDept } = req.body;

    const steps = await attachStandardWorkflow(shipmentId, {
      docs: docsDept,
      customs: customsDept,
      delivery: deliveryDept,
    });

    return res.status(201).json({ status: "success", data: steps });
  } catch (err) {
    console.error("[WorkflowController.attach]", err);
    return res.status(500).json({ status: "error", message: "Failed to attach workflow." });
  }
}

// ─── GET /api/workflows/:shipmentId ──────────────────────────────────────────
export async function getWorkflowHandler(req: Request, res: Response) {
  try {
    const shipmentId = req.params.shipmentId as string;
    const steps = await getShipmentWorkflow(shipmentId);

    return res.status(200).json({ status: "success", data: steps });
  } catch (err) {
    console.error("[WorkflowController.get]", err);
    return res.status(500).json({ status: "error", message: "Failed to get workflow." });
  }
}

// ─── PATCH /api/workflows/step/:stepId ────────────────────────────────────────
export async function updateStepHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const stepId = req.params.stepId as string;
    const { status, comments } = req.body as { status: WorkflowStepStatus; comments?: string };

    const updated = await updateWorkflowStep(stepId, user.id, { status, comments });

    return res.status(200).json({ status: "success", data: updated });
  } catch (err) {
    console.error("[WorkflowController.updateStep]", err);
    return res.status(500).json({ status: "error", message: "Failed to update workflow step." });
  }
}
