import cron from "node-cron";
import { AppDataSource } from "../../database/data-source";
import { markOverdueInvoices } from "../modules/financial/services/invoice.service";

export const startOverdueInvoiceJob = () => {
  // Run daily at 1:00 AM
  cron.schedule("0 1 * * *", async () => {
    console.log("[OverdueInvoice] Checking for overdue invoices...");
    try {
      if (!AppDataSource.isInitialized) {
        console.warn("[OverdueInvoice] DataSource not initialized, skipping.");
        return;
      }
      const count = await markOverdueInvoices();
      if (count > 0) {
        console.log(`[OverdueInvoice] Marked ${count} invoice(s) as overdue.`);
      }
    } catch (err: any) {
      console.error("[OverdueInvoice] Failed to mark overdue invoices:", err.message);
    }
  });

  console.log("[OverdueInvoice] Job scheduled: Runs daily at 1:00 AM.");
};
