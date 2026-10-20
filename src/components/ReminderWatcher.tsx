import { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { isDue, listReminders, markFired, remindersChanged } from "@/lib/copilot/reminders";

/** Checks the user's Co-Pilot reminders while the VDR is open; fires each once onto the bell. */
export default function ReminderWatcher() {
  const { deals, currentUser, addNotification } = useApp();
  const ref = useRef({ deals, currentUser, addNotification });
  ref.current = { deals, currentUser, addNotification };

  useEffect(() => {
    let stop = false;
    const run = async () => {
      const { deals, currentUser, addNotification } = ref.current;
      if (!currentUser?.id) return;
      let list;
      try { list = await listReminders(); } catch { return; }
      const now = new Date();
      let fired = false;
      for (const r of list) {
        if (stop || !isDue(r, deals, now)) continue;
        if (!(await markFired(r.id).catch(() => false))) continue;
        fired = true;
        const deal = deals.find((d) => d.id === r.deal_id);
        addNotification({
          id: `reminder-${r.id}`, userId: currentUser.id, type: "reminder",
          title: `Reminder: ${r.label}`,
          body: deal ? `${deal.issuerName} is now ${deal.stage}.` : "Your Co-Pilot reminder is due.",
          read: false, timestamp: now, dealId: r.deal_id ?? undefined,
        });
      }
      if (fired) remindersChanged();
    };
    run();
    const t = setInterval(run, 60_000);
    return () => { stop = true; clearInterval(t); };
  }, [deals]);
  return null;
}
