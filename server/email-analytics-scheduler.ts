import { eq } from "drizzle-orm";
import { db } from "./db";
import { emailAnalyticsSettings } from "@shared/schema";
import { syncEmailAnalytics } from "./email-analytics";

let timer: NodeJS.Timeout | undefined;
let running = false;
export function startEmailAnalyticsScheduler() {
  if (timer) return;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const settings = await db.select().from(emailAnalyticsSettings).where(eq(emailAnalyticsSettings.automaticRefreshEnabled, true));
      for (const setting of settings) {
        const intervalMinutes = Math.max(30, setting.syncIntervalMinutes);
        if (setting.syncIntervalMinutes !== intervalMinutes) {
          await db.update(emailAnalyticsSettings).set({ syncIntervalMinutes: intervalMinutes, updatedAt: new Date() }).where(eq(emailAnalyticsSettings.id, setting.id));
        }
        const due = !setting.lastMailboxSyncAt || Date.now() - setting.lastMailboxSyncAt.getTime() >= intervalMinutes * 60_000;
        if (due) {
          await syncEmailAnalytics(setting.organisationId);
        }
      }
    } catch (error) { console.error("[email-analytics] scheduled sync failed", error); }
    finally { running = false; }
  };
  timer = setInterval(() => void tick(), 60_000);
  timer.unref();
  void tick();
}