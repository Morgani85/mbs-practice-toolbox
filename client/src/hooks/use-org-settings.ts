import { useQuery } from "@tanstack/react-query";
import type { Organisation } from "@shared/schema";

export interface OrgSettings {
  vatCompletionDay: number;
  mgmtAccountsDay: number;
  bookkeepingUpperThreshold: number;
  bookkeepingLowerThreshold: number;
  bookkeepingPlatform: string;
  platformName: string;
  bookkeepingPlatformCustom: string | null;
}

export function useOrgSettings(): OrgSettings {
  const { data: org } = useQuery<Organisation>({
    queryKey: ["/api/organisation"],
  });

  const bookkeepingPlatform = (org as any)?.bookkeepingPlatform || "Dext Precision";
  const bookkeepingPlatformCustom = (org as any)?.bookkeepingPlatformCustom || null;
  const platformName =
    bookkeepingPlatform === "Other"
      ? bookkeepingPlatformCustom || "Other"
      : bookkeepingPlatform;

  return {
    vatCompletionDay: (org as any)?.vatCompletionDay ?? 28,
    mgmtAccountsDay: (org as any)?.mgmtAccountsDay ?? 15,
    bookkeepingUpperThreshold: (org as any)?.bookkeepingUpperThreshold ?? 85,
    bookkeepingLowerThreshold: (org as any)?.bookkeepingLowerThreshold ?? 70,
    bookkeepingPlatform,
    platformName,
    bookkeepingPlatformCustom,
  };
}
