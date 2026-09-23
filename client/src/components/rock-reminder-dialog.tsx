import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { QuarterlyGoal, RockReminderDismissal } from "@shared/schema";

type ReminderType = "month_start" | "two_weeks" | "one_week";

interface PendingReminder {
  type: ReminderType;
  quarterlyGoalId?: number;
  periodDate: string;
  title: string;
  message: string;
  key: string;
}

function getReminderKey(type: ReminderType, periodDate: string, quarterlyGoalId?: number): string {
  return `${type}:${periodDate}:${quarterlyGoalId || 'null'}`;
}

export default function RockReminderDialog() {
  const queryClient = useQueryClient();
  const [currentReminder, setCurrentReminder] = useState<PendingReminder | null>(null);
  const dismissedKeysRef = useRef<Set<string>>(new Set());

  const { data: dismissals = [], isLoading: dismissalsLoading } = useQuery<RockReminderDismissal[]>({
    queryKey: ['/api/rock-reminders'],
  });

  const { data: quarterlyGoals = [], isLoading: goalsLoading } = useQuery<QuarterlyGoal[]>({
    queryKey: ['/api/quarterly-goals'],
  });

  const dismissMutation = useMutation({
    mutationFn: async (data: { reminderType: string; quarterlyGoalId?: number; periodDate: string; snooze?: boolean }) => {
      return await apiRequest('/api/rock-reminders/dismiss', 'POST', data);
    },
    onMutate: async () => {
      if (currentReminder) {
        dismissedKeysRef.current.add(currentReminder.key);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rock-reminders'] });
      setCurrentReminder(null);
    },
    onError: () => {
      if (currentReminder) {
        dismissedKeysRef.current.delete(currentReminder.key);
      }
    },
  });

  useEffect(() => {
    // Wait until data is fully loaded before showing any reminders
    if (dismissalsLoading || goalsLoading) return;
    if (dismissMutation.isPending) return;

    const pendingReminders: PendingReminder[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const isDismissedOrSnoozed = (dismissal: RockReminderDismissal): boolean => {
      if (!dismissal.snoozedUntil) return true;
      return dismissal.snoozedUntil > todayStr;
    };

    const firstOfMonth = new Date(currentYear, currentMonth, 1);
    const firstOfMonthStr = firstOfMonth.toISOString().split('T')[0];
    const monthStartKey = getReminderKey('month_start', firstOfMonthStr);
    const hasMonthStartDismissal = dismissals.some(
      (d) => d.reminderType === 'month_start' && d.periodDate === firstOfMonthStr && isDismissedOrSnoozed(d)
    ) || dismissedKeysRef.current.has(monthStartKey);

    if (today.getDate() >= 1 && !hasMonthStartDismissal) {
      pendingReminders.push({
        type: 'month_start',
        periodDate: firstOfMonthStr,
        title: 'Monthly Rock Review',
        message: "Don't forget to review and update your rock and ensure you make progress on it.",
        key: monthStartKey,
      });
    }

    for (const goal of quarterlyGoals) {
      const endDate = new Date(goal.endDate);
      const timeDiff = endDate.getTime() - today.getTime();
      const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

      if (daysRemaining <= 14 && daysRemaining > 7) {
        const twoWeeksKey = getReminderKey('two_weeks', goal.endDate, goal.id);
        const hasTwoWeeksDismissal = dismissals.some(
          (d) => d.reminderType === 'two_weeks' && d.quarterlyGoalId === goal.id && d.periodDate === goal.endDate && isDismissedOrSnoozed(d)
        ) || dismissedKeysRef.current.has(twoWeeksKey);
        if (!hasTwoWeeksDismissal) {
          pendingReminders.push({
            type: 'two_weeks',
            quarterlyGoalId: goal.id,
            periodDate: goal.endDate,
            title: 'Quarter End Approaching',
            message: `WARNING - There is only 2 weeks left until the end of the quarter (${goal.name}). Your rock should be in the final stages by now. Last push to get it wrapped up.`,
            key: twoWeeksKey,
          });
        }
      }

      if (daysRemaining <= 7 && daysRemaining > 0) {
        const oneWeekKey = getReminderKey('one_week', goal.endDate, goal.id);
        const hasOneWeekDismissal = dismissals.some(
          (d) => d.reminderType === 'one_week' && d.quarterlyGoalId === goal.id && d.periodDate === goal.endDate && isDismissedOrSnoozed(d)
        ) || dismissedKeysRef.current.has(oneWeekKey);
        if (!hasOneWeekDismissal) {
          pendingReminders.push({
            type: 'one_week',
            quarterlyGoalId: goal.id,
            periodDate: goal.endDate,
            title: 'Final Week Warning',
            message: `WARNING - There is only 1 week left until the end of the quarter (${goal.name}). Your rock should be in the final stages by now. Last push to get it wrapped up.`,
            key: oneWeekKey,
          });
        }
      }
    }

    pendingReminders.sort((a, b) => {
      const priority: Record<ReminderType, number> = { one_week: 1, two_weeks: 2, month_start: 3 };
      return priority[a.type] - priority[b.type];
    });

    if (pendingReminders.length > 0 && !currentReminder) {
      setCurrentReminder(pendingReminders[0]);
    }
  }, [dismissals, quarterlyGoals, currentReminder, dismissMutation.isPending, dismissalsLoading, goalsLoading]);

  const handleDismiss = (snooze: boolean = false) => {
    if (!currentReminder) return;

    dismissMutation.mutate({
      reminderType: currentReminder.type,
      quarterlyGoalId: currentReminder.quarterlyGoalId,
      periodDate: currentReminder.periodDate,
      snooze,
    });
  };

  if (!currentReminder) return null;

  const isWarning = currentReminder.type === 'one_week' || currentReminder.type === 'two_weeks';

  return (
    <AlertDialog open={true}>
      <AlertDialogContent className={isWarning ? "border-amber-500 border-2" : ""}>
        <AlertDialogHeader>
          <AlertDialogTitle className={isWarning ? "text-amber-600" : "text-blue-600"}>
            {currentReminder.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            {currentReminder.message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => handleDismiss(true)}
            disabled={dismissMutation.isPending}
          >
            Remind me next time
          </Button>
          <AlertDialogAction 
            onClick={() => handleDismiss(false)}
            disabled={dismissMutation.isPending}
            className={isWarning ? "bg-amber-600 hover:bg-amber-700" : ""}
          >
            {dismissMutation.isPending ? "..." : "OK"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
