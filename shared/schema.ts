import { pgTable, text, serial, integer, date, timestamp, varchar, unique, jsonb, index, boolean, decimal, check } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";

function validateWeekEndingDate(dateInput: string | Date, ctx: z.RefinementCtx): void {
  let date: Date;
  
  if (dateInput instanceof Date) {
    date = dateInput;
  } else if (typeof dateInput === 'string') {
    const dateWithTime = dateInput.includes('T') ? dateInput : `${dateInput}T00:00:00Z`;
    date = new Date(dateWithTime);
  } else {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid date format",
    });
    return;
  }
  
  if (isNaN(date.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid date",
    });
    return;
  }
  
  const dayOfWeek = date.getUTCDay();
  const dayOfMonth = date.getUTCDate();
  
  if (dayOfWeek === 0) {
    return;
  }
  
  if (dayOfMonth === 1) {
    return;
  }
  
  if (dayOfMonth === 15) {
    return;
  }
  
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  
  if (dayOfMonth === lastDay) {
    return;
  }
  
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Date must be a Sunday, 1st, 15th, or last day of the month",
    path: ["weekEnding"],
  });
}

export function withWeekEndingValidation<T extends z.ZodObject<any>>(schema: T): z.ZodEffects<T> {
  return schema.superRefine((data, ctx) => {
    if (data.weekEnding) {
      validateWeekEndingDate(data.weekEnding, ctx);
    }
  });
}

// Organisations table — top-level multi-tenancy boundary
export const organisations = pgTable("organisations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: varchar("slug").unique(),
  subscriptionStatus: varchar("subscription_status").default('trialling'),
  subscriptionPlan: varchar("subscription_plan"),
  subscriptionInterval: varchar("subscription_interval"),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodEndsAt: timestamp("current_period_ends_at"),
  isSuspended: boolean("is_suspended").notNull().default(false),
  isOnboardingComplete: boolean("is_onboarding_complete").notNull().default(false),
  isExempt: boolean("is_exempt").notNull().default(false),
  exemptionReason: varchar("exemption_reason"),
  isDemoOrg: boolean("is_demo_org").default(false),
  logoUrl: text("logo_url"),
  phone: varchar("phone"),
  address: text("address"),
  city: varchar("city"),
  postcode: varchar("postcode"),
  website: varchar("website"),
  practiceType: varchar("practice_type"),
  // Practice Standards settings
  vatCompletionDay: integer("vat_completion_day").default(28),
  mgmtAccountsDay: integer("mgmt_accounts_day").default(15),
  bookkeepingUpperThreshold: integer("bookkeeping_upper_threshold").default(85),
  bookkeepingLowerThreshold: integer("bookkeeping_lower_threshold").default(70),
  bookkeepingPlatform: varchar("bookkeeping_platform").default('Dext Precision'),
  bookkeepingPlatformCustom: varchar("bookkeeping_platform_custom"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrganisationSchema = createInsertSchema(organisations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Organisation = typeof organisations.$inferSelect;
export type InsertOrganisation = typeof organisations.$inferInsert;

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for local authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  email: varchar("email").unique().notNull(),
  password: varchar("password"), // nullable for invited users who haven't set password yet
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("user"), // admin, manager, user, viewer
  isActive: boolean("is_active").notNull().default(true),
  permissions: text("permissions").array(), // Store specific permissions as text array
  invitationToken: varchar("invitation_token"), // For password setup
  invitationExpires: timestamp("invitation_expires"), // Token expiry
  resetToken: varchar("reset_token"), // For password reset
  resetExpires: timestamp("reset_expires"), // Reset token expiry
  passwordSetAt: timestamp("password_set_at"), // When password was first set
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Teams table
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  nameOrgUnique: unique("teams_name_organisation_id_key").on(table.name, table.organisationId),
}));

// Rolling 4-week targets per team
export const weeklyTargets = pgTable("weekly_targets", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  weekEnding: date("week_ending").notNull(),
  rollingFourWeekTarget: integer("rolling_four_week_target").notNull(), // Target for 4-week rolling period
  submittedBy: integer("submitted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Weekly results per team
export const weeklyResults = pgTable("weekly_results", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  weekEnding: date("week_ending").notNull(),
  actualCompleted: integer("actual_completed").notNull(),
  notes: text("notes"),
  submittedBy: integer("submitted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Accounts due tracking (separate from targets - this is what we're trying to reduce)
export const accountsDue = pgTable("accounts_due", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  weekEnding: date("week_ending").notNull(),
  accountsDue: integer("accounts_due").notNull(), // Current number of accounts due
  accountsDueInProgress: integer("accounts_due_in_progress").default(0).notNull(), // Of which still work in progress / not started
  notes: text("notes"),
  submittedBy: integer("submitted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// VAT-specific tables using same structure as accounts
export const vatTargets = pgTable("vat_targets", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  weekEnding: date("week_ending").notNull(),
  rollingFourWeekTarget: integer("rolling_four_week_target").notNull(), // Target for 4-week rolling period
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vatResults = pgTable("vat_results", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  weekEnding: date("week_ending").notNull(),
  actualCompleted: integer("actual_completed").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vatDue = pgTable("vat_due", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  weekEnding: date("week_ending").notNull(),
  quarterEnding: date("quarter_ending").notNull(), // VAT quarter ending date (e.g., 31 May 2025)
  vatDue: integer("vat_due").notNull(), // Current number of VAT returns due
  notes: text("notes"),
  submittedBy: integer("submitted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const healthChecksTargets = pgTable("health_checks_targets", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  weekEnding: date("week_ending").notNull(),
  targetCompleted: integer("target_completed").notNull().default(0),
  notes: text("notes"),
  submittedBy: integer("submitted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const healthChecksResults = pgTable("health_checks_results", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  weekEnding: date("week_ending").notNull(),
  actualCompleted: integer("actual_completed").notNull().default(0),
  notes: text("notes"),
  submittedBy: integer("submitted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const healthChecksDue = pgTable("health_checks_due", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  weekEnding: date("week_ending").notNull(),
  healthChecksDue: integer("health_checks_due").notNull().default(0),
  notes: text("notes"),
  submittedBy: integer("submitted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vatTurnoverChecks = pgTable("vat_turnover_checks", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  weekEnding: date("week_ending").notNull(),
  percentageComplete: integer("percentage_complete").notNull(),
  notes: text("notes"),
  submittedBy: integer("submitted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueEntry: unique().on(table.teamId, table.weekEnding),
}));

// MBS Bookkeeping Tables
export const mbsDextPrecision = pgTable("mbs_dext_precision", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").references(() => teams.id).notNull(),
  weekEnding: date("week_ending").notNull(),
  clientsBelow85Percent: integer("clients_below_85_percent").notNull(),
  clientsBelow70Percent: integer("clients_below_70_percent").notNull().default(0),
  lowestScoreClientDetails: text("lowest_score_client_details").notNull(),
  submittedBy: integer("submitted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueEntry: unique().on(table.teamId, table.weekEnding),
}));

export const mbsOldestItems = pgTable("mbs_oldest_items", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").references(() => teams.id).notNull(),
  weekEnding: date("week_ending").notNull(),
  oldestItemDays: integer("oldest_item_days").notNull(),
  target: integer("target").default(10).notNull(),
  worstPerformingClients: text("worst_performing_clients").notNull(),
  submittedBy: integer("submitted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueEntry: unique().on(table.teamId, table.weekEnding),
}));

export const clientDextPrecision = pgTable("client_dext_precision", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").references(() => teams.id).notNull(),
  weekEnding: date("week_ending").notNull(),
  clientsAbove85Percent: integer("clients_above_85_percent").notNull(),
  clientsBelow85Percent: integer("clients_below_85_percent").notNull(),
  lowestScoreClientDetails: text("lowest_score_client_details").notNull(),
  submittedBy: integer("submitted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueEntry: unique().on(table.teamId, table.weekEnding),
}));

export const clientOldestItems = pgTable("client_oldest_items", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").references(() => teams.id).notNull(),
  weekEnding: date("week_ending").notNull(),
  oldestItemDays: integer("oldest_item_days").notNull(),
  target: integer("target").default(10).notNull(),
  worstPerformingClients: text("worst_performing_clients").notNull(),
  submittedBy: integer("submitted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueEntry: unique().on(table.teamId, table.weekEnding),
}));

// MBS (Internal Bookkeeping) Results tables
export const mbsResults = pgTable("mbs_results", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  weekEnding: date("week_ending").notNull(),
  actualCompleted: integer("actual_completed").notNull().default(0),
  notes: text("notes"),
  submittedBy: integer("submitted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueEntry: unique().on(table.teamId, table.weekEnding),
}));

// Client Bookkeeping Results tables
export const clientBookkeepingResults = pgTable("client_bookkeeping_results", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  weekEnding: date("week_ending").notNull(),
  actualCompleted: integer("actual_completed").notNull().default(0),
  notes: text("notes"),
  submittedBy: integer("submitted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueEntry: unique().on(table.teamId, table.weekEnding),
}));

// Confirmation Statements tables
export const confirmationStatementsTargets = pgTable("confirmation_statements_targets", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  weekEnding: date("week_ending").notNull(),
  rollingFourWeekTarget: integer("rolling_four_week_target").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueEntry: unique().on(table.teamId, table.weekEnding),
}));

export const confirmationStatementsResults = pgTable("confirmation_statements_results", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  weekEnding: date("week_ending").notNull(),
  actualCompleted: integer("actual_completed").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueEntry: unique().on(table.teamId, table.weekEnding),
}));

export const confirmationStatementsDue = pgTable("confirmation_statements_due", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  weekEnding: date("week_ending").notNull(),
  statementsDue: integer("statements_due").notNull(),
  notes: text("notes"),
  submittedBy: integer("submitted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueEntry: unique().on(table.teamId, table.weekEnding),
}));

// Confirmation Statement Turnaround Time tracking
export const confirmationStatementTurnaround = pgTable("confirmation_statement_turnaround", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  weekEnding: date("week_ending").notNull(),
  turnaroundTimeDays: integer("turnaround_time_days").notNull(), // Days from earliest filing date to actual filing
  notes: text("notes"),
  submittedBy: integer("submitted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueEntry: unique().on(table.teamId, table.weekEnding),
}));

// Tax data tracking
export const taxData = pgTable("tax_data", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  weekEnding: date("week_ending").notNull(),
  personalTaxCompletedThisWeek: integer("personal_tax_completed_this_week").notNull().default(0), // Amount completed just this week (user enters)
  personalTaxTotalToComplete: integer("personal_tax_total_to_complete").notNull().default(0), // Annual target (user enters)
  taxYearStart: date("tax_year_start").notNull(), // April 6th each year
  notes: text("notes"),
  submittedBy: integer("submitted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueEntry: unique().on(table.teamId, table.weekEnding),
}));

// Revenue Analytics tables
export const revenueAnalyticsTargets = pgTable("revenue_analytics_targets", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  weekEnding: date("week_ending").notNull(),
  debtorsOver30Days: integer("debtors_over_30_days").notNull().default(0), // Target for debtors over 30 days
  clientsNotPayingMonthly: integer("clients_not_paying_monthly").notNull().default(0), // Target for clients not paying monthly
  valueClientsNotPayingMonthly: integer("value_clients_not_paying_monthly").notNull().default(0), // Target value of clients not paying monthly
  averageFeePerClient: integer("average_fee_per_client").notNull().default(0), // Target average fee per client per month
  numberOfClients: integer("number_of_clients").notNull().default(0), // Target number of clients
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueEntry: unique().on(table.teamId, table.weekEnding),
}));

export const revenueAnalyticsResults = pgTable("revenue_analytics_results", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  weekEnding: date("week_ending").notNull(),
  debtorsOver30Days: integer("debtors_over_30_days").notNull().default(0), // Actual debtors over 30 days
  clientsNotPayingMonthly: integer("clients_not_paying_monthly").notNull().default(0), // Actual clients not paying monthly
  valueClientsNotPayingMonthly: integer("value_clients_not_paying_monthly").notNull().default(0), // Actual value of clients not paying monthly
  averageFeePerClient: integer("average_fee_per_client").notNull().default(0), // Actual average fee per client per month
  numberOfClients: integer("number_of_clients").notNull().default(0), // Actual number of clients
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueEntry: unique().on(table.teamId, table.weekEnding),
}));

// Relations
export const teamsRelations = relations(teams, ({ many }) => ({
  weeklyTargets: many(weeklyTargets),
  weeklyResults: many(weeklyResults),
  accountsDue: many(accountsDue),
  vatTargets: many(vatTargets),
  vatResults: many(vatResults),
  vatDue: many(vatDue),
  vatTurnoverChecks: many(vatTurnoverChecks),
  healthChecksTargets: many(healthChecksTargets),
  healthChecksResults: many(healthChecksResults),
  healthChecksDue: many(healthChecksDue),
  mbsResults: many(mbsResults),
  mbsDextPrecision: many(mbsDextPrecision),
  mbsOldestItems: many(mbsOldestItems),
  clientBookkeepingResults: many(clientBookkeepingResults),
  clientDextPrecision: many(clientDextPrecision),
  clientOldestItems: many(clientOldestItems),
  confirmationStatementsTargets: many(confirmationStatementsTargets),
  confirmationStatementsResults: many(confirmationStatementsResults),
  confirmationStatementsDue: many(confirmationStatementsDue),
  confirmationStatementTurnaround: many(confirmationStatementTurnaround),
  taxData: many(taxData),
  revenueAnalyticsTargets: many(revenueAnalyticsTargets),
  revenueAnalyticsResults: many(revenueAnalyticsResults),
}));

export const weeklyTargetsRelations = relations(weeklyTargets, ({ one }) => ({
  team: one(teams, {
    fields: [weeklyTargets.teamId],
    references: [teams.id],
  }),
}));

export const weeklyResultsRelations = relations(weeklyResults, ({ one }) => ({
  team: one(teams, {
    fields: [weeklyResults.teamId],
    references: [teams.id],
  }),
}));

export const accountsDueRelations = relations(accountsDue, ({ one }) => ({
  team: one(teams, {
    fields: [accountsDue.teamId],
    references: [teams.id],
  }),
}));

export const vatTargetsRelations = relations(vatTargets, ({ one }) => ({
  team: one(teams, {
    fields: [vatTargets.teamId],
    references: [teams.id],
  }),
}));

export const vatResultsRelations = relations(vatResults, ({ one }) => ({
  team: one(teams, {
    fields: [vatResults.teamId],
    references: [teams.id],
  }),
}));

export const vatDueRelations = relations(vatDue, ({ one }) => ({
  team: one(teams, {
    fields: [vatDue.teamId],
    references: [teams.id],
  }),
}));

export const healthChecksTargetsRelations = relations(healthChecksTargets, ({ one }) => ({
  team: one(teams, {
    fields: [healthChecksTargets.teamId],
    references: [teams.id],
  }),
}));

export const healthChecksResultsRelations = relations(healthChecksResults, ({ one }) => ({
  team: one(teams, {
    fields: [healthChecksResults.teamId],
    references: [teams.id],
  }),
}));

export const healthChecksDueRelations = relations(healthChecksDue, ({ one }) => ({
  team: one(teams, {
    fields: [healthChecksDue.teamId],
    references: [teams.id],
  }),
}));

export const vatTurnoverChecksRelations = relations(vatTurnoverChecks, ({ one }) => ({
  team: one(teams, {
    fields: [vatTurnoverChecks.teamId],
    references: [teams.id],
  }),
}));

export const mbsDextPrecisionRelations = relations(mbsDextPrecision, ({ one }) => ({
  team: one(teams, {
    fields: [mbsDextPrecision.teamId],
    references: [teams.id],
  }),
}));

export const mbsResultsRelations = relations(mbsResults, ({ one }) => ({
  team: one(teams, {
    fields: [mbsResults.teamId],
    references: [teams.id],
  }),
}));

export const mbsOldestItemsRelations = relations(mbsOldestItems, ({ one }) => ({
  team: one(teams, {
    fields: [mbsOldestItems.teamId],
    references: [teams.id],
  }),
}));

export const clientBookkeepingResultsRelations = relations(clientBookkeepingResults, ({ one }) => ({
  team: one(teams, {
    fields: [clientBookkeepingResults.teamId],
    references: [teams.id],
  }),
}));

export const clientDextPrecisionRelations = relations(clientDextPrecision, ({ one }) => ({
  team: one(teams, {
    fields: [clientDextPrecision.teamId],
    references: [teams.id],
  }),
}));

export const clientOldestItemsRelations = relations(clientOldestItems, ({ one }) => ({
  team: one(teams, {
    fields: [clientOldestItems.teamId],
    references: [teams.id],
  }),
}));

export const confirmationStatementsTargetsRelations = relations(confirmationStatementsTargets, ({ one }) => ({
  team: one(teams, {
    fields: [confirmationStatementsTargets.teamId],
    references: [teams.id],
  }),
}));

export const confirmationStatementsResultsRelations = relations(confirmationStatementsResults, ({ one }) => ({
  team: one(teams, {
    fields: [confirmationStatementsResults.teamId],
    references: [teams.id],
  }),
}));

export const confirmationStatementsDueRelations = relations(confirmationStatementsDue, ({ one }) => ({
  team: one(teams, {
    fields: [confirmationStatementsDue.teamId],
    references: [teams.id],
  }),
}));

export const confirmationStatementTurnaroundRelations = relations(confirmationStatementTurnaround, ({ one }) => ({
  team: one(teams, {
    fields: [confirmationStatementTurnaround.teamId],
    references: [teams.id],
  }),
}));

export const taxDataRelations = relations(taxData, ({ one }) => ({
  team: one(teams, {
    fields: [taxData.teamId],
    references: [teams.id],
  }),
}));

export const revenueAnalyticsTargetsRelations = relations(revenueAnalyticsTargets, ({ one }) => ({
  team: one(teams, {
    fields: [revenueAnalyticsTargets.teamId],
    references: [teams.id],
  }),
}));

export const revenueAnalyticsResultsRelations = relations(revenueAnalyticsResults, ({ one }) => ({
  team: one(teams, {
    fields: [revenueAnalyticsResults.teamId],
    references: [teams.id],
  }),
}));



// Client Value Manager table
export const clientValueClients = pgTable("client_value_clients", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  clientName: text("client_name").notNull(),
  clientCode: text("client_code"),
  sector: text("sector"),
  pod: text("pod"),
  clientSince: date("client_since"),
  currentServiceLevel: text("current_service_level"),
  targetServiceLevel: text("target_service_level"),
  currentMonthlyFee: integer("current_monthly_fee").notNull().default(0),
  targetMonthlyFee: integer("target_monthly_fee").notNull().default(0),
  clientQuality: text("client_quality"),
  lastCcrDate: date("last_ccr_date"),
  nextCcrDate: date("next_ccr_date"),
  ccrStatus: text("ccr_status"),
  lastFeeChangeDate: date("last_fee_change_date"),
  lastTurnoverUpdateDate: date("last_turnover_update_date"),
  turnover: text("turnover"),
  currentReportedTurnover: integer("current_reported_turnover"),
  currentReportedTurnoverBand: text("current_reported_turnover_band"),
  turnoverLastUpdated: date("turnover_last_updated"),
  dextClientId: text("dext_client_id"),
  referredBy: text("referred_by"),
  notes: text("notes"),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clientValueClientsRelations = relations(clientValueClients, ({ one }) => ({
  team: one(teams, {
    fields: [clientValueClients.teamId],
    references: [teams.id],
  }),
}));

export const teamsClientValueRelations = relations(teams, ({ many }) => ({
  clientValueClients: many(clientValueClients),
}));

export type ClientValueClient = typeof clientValueClients.$inferSelect;
export type InsertClientValueClient = typeof clientValueClients.$inferInsert;

export const insertClientValueClientSchema = createInsertSchema(clientValueClients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema exports
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
});

export const insertWeeklyTargetSchema = createInsertSchema(weeklyTargets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWeeklyResultSchema = createInsertSchema(weeklyResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAccountsDueSchema = createInsertSchema(accountsDue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVatTargetSchema = createInsertSchema(vatTargets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVatResultSchema = createInsertSchema(vatResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVatDueSchema = createInsertSchema(vatDue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHealthChecksTargetSchema = createInsertSchema(healthChecksTargets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHealthChecksResultSchema = createInsertSchema(healthChecksResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHealthChecksDueSchema = createInsertSchema(healthChecksDue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVatTurnoverChecksSchema = createInsertSchema(vatTurnoverChecks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMbsDextPrecisionSchema = createInsertSchema(mbsDextPrecision).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMbsResultSchema = createInsertSchema(mbsResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMbsOldestItemsSchema = createInsertSchema(mbsOldestItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientBookkeepingResultSchema = createInsertSchema(clientBookkeepingResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientDextPrecisionSchema = createInsertSchema(clientDextPrecision).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientOldestItemsSchema = createInsertSchema(clientOldestItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConfirmationStatementsTargetSchema = createInsertSchema(confirmationStatementsTargets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConfirmationStatementsResultSchema = createInsertSchema(confirmationStatementsResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConfirmationStatementsDueSchema = createInsertSchema(confirmationStatementsDue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConfirmationStatementTurnaroundSchema = createInsertSchema(confirmationStatementTurnaround).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaxDataSchema = createInsertSchema(taxData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRevenueAnalyticsTargetSchema = createInsertSchema(revenueAnalyticsTargets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRevenueAnalyticsResultSchema = createInsertSchema(revenueAnalyticsResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Quarterly Goals tables
export const quarterlyGoals = pgTable("quarterly_goals", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  name: text("name").notNull(),
  endDate: date("end_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const quarterlyTargets = pgTable("quarterly_targets", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  quarterlyGoalId: integer("quarterly_goal_id").notNull().references(() => quarterlyGoals.id),
  title: text("title").notNull(),
  details: text("details"),
  progress: integer("progress").notNull().default(0),
  personResponsible: integer("person_responsible").references(() => users.id),
  notes: text("notes"),
  comments: text("comments"),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertQuarterlyGoalSchema = createInsertSchema(quarterlyGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuarterlyTargetSchema = createInsertSchema(quarterlyTargets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

export type WeeklyTarget = typeof weeklyTargets.$inferSelect;
export type InsertWeeklyTarget = z.infer<typeof insertWeeklyTargetSchema>;

export type WeeklyResult = typeof weeklyResults.$inferSelect;
export type InsertWeeklyResult = z.infer<typeof insertWeeklyResultSchema>;

export type AccountsDue = typeof accountsDue.$inferSelect;
export type InsertAccountsDue = z.infer<typeof insertAccountsDueSchema>;

export type VatTarget = typeof vatTargets.$inferSelect;
export type InsertVatTarget = z.infer<typeof insertVatTargetSchema>;

export type VatResult = typeof vatResults.$inferSelect;
export type InsertVatResult = z.infer<typeof insertVatResultSchema>;

export type VatDue = typeof vatDue.$inferSelect;
export type InsertVatDue = z.infer<typeof insertVatDueSchema>;

export type HealthChecksTarget = typeof healthChecksTargets.$inferSelect;
export type InsertHealthChecksTarget = z.infer<typeof insertHealthChecksTargetSchema>;

export type HealthChecksResult = typeof healthChecksResults.$inferSelect;
export type InsertHealthChecksResult = z.infer<typeof insertHealthChecksResultSchema>;

export type HealthChecksDue = typeof healthChecksDue.$inferSelect;
export type InsertHealthChecksDue = z.infer<typeof insertHealthChecksDueSchema>;

export type VatTurnoverChecks = typeof vatTurnoverChecks.$inferSelect;
export type InsertVatTurnoverChecks = z.infer<typeof insertVatTurnoverChecksSchema>;

export type MbsDextPrecision = typeof mbsDextPrecision.$inferSelect;
export type InsertMbsDextPrecision = z.infer<typeof insertMbsDextPrecisionSchema>;

export type MbsResult = typeof mbsResults.$inferSelect;
export type InsertMbsResult = z.infer<typeof insertMbsResultSchema>;

export type MbsOldestItems = typeof mbsOldestItems.$inferSelect;
export type InsertMbsOldestItems = z.infer<typeof insertMbsOldestItemsSchema>;

export type ClientBookkeepingResult = typeof clientBookkeepingResults.$inferSelect;
export type InsertClientBookkeepingResult = z.infer<typeof insertClientBookkeepingResultSchema>;

export type ClientDextPrecision = typeof clientDextPrecision.$inferSelect;
export type InsertClientDextPrecision = z.infer<typeof insertClientDextPrecisionSchema>;

export type ClientOldestItems = typeof clientOldestItems.$inferSelect;
export type InsertClientOldestItems = z.infer<typeof insertClientOldestItemsSchema>;

export type ConfirmationStatementsTarget = typeof confirmationStatementsTargets.$inferSelect;
export type InsertConfirmationStatementsTarget = z.infer<typeof insertConfirmationStatementsTargetSchema>;

export type ConfirmationStatementsResult = typeof confirmationStatementsResults.$inferSelect;
export type InsertConfirmationStatementsResult = z.infer<typeof insertConfirmationStatementsResultSchema>;

export type ConfirmationStatementsDue = typeof confirmationStatementsDue.$inferSelect;
export type InsertConfirmationStatementsDue = z.infer<typeof insertConfirmationStatementsDueSchema>;

export type ConfirmationStatementTurnaround = typeof confirmationStatementTurnaround.$inferSelect;
export type InsertConfirmationStatementTurnaround = z.infer<typeof insertConfirmationStatementTurnaroundSchema>;

export type TaxData = typeof taxData.$inferSelect;
export type InsertTaxData = z.infer<typeof insertTaxDataSchema>;

export type RevenueAnalyticsTarget = typeof revenueAnalyticsTargets.$inferSelect;
export type InsertRevenueAnalyticsTarget = z.infer<typeof insertRevenueAnalyticsTargetSchema>;

export type RevenueAnalyticsResult = typeof revenueAnalyticsResults.$inferSelect;
export type InsertRevenueAnalyticsResult = z.infer<typeof insertRevenueAnalyticsResultSchema>;

export type QuarterlyGoal = typeof quarterlyGoals.$inferSelect;
export type InsertQuarterlyGoal = z.infer<typeof insertQuarterlyGoalSchema>;

export type QuarterlyTarget = typeof quarterlyTargets.$inferSelect;
export type InsertQuarterlyTarget = z.infer<typeof insertQuarterlyTargetSchema>;

// Rock Reminder Dismissals - tracks when users have dismissed reminder popups
export const rockReminderDismissals = pgTable("rock_reminder_dismissals", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  userId: integer("user_id").notNull().references(() => users.id),
  reminderType: text("reminder_type").notNull(), // 'month_start', 'two_weeks', 'one_week'
  quarterlyGoalId: integer("quarterly_goal_id").references(() => quarterlyGoals.id), // null for month_start reminders
  periodDate: date("period_date").notNull(), // The month start date or quarter end date this dismissal applies to
  dismissedAt: timestamp("dismissed_at").defaultNow().notNull(),
  snoozedUntil: date("snoozed_until"), // If set, reminder will show again after this date (null = permanently dismissed)
});

export const insertRockReminderDismissalSchema = createInsertSchema(rockReminderDismissals).omit({
  id: true,
  dismissedAt: true,
});

export type RockReminderDismissal = typeof rockReminderDismissals.$inferSelect;
export type InsertRockReminderDismissal = z.infer<typeof insertRockReminderDismissalSchema>;

// Values and Principles table
export const values = pgTable("values", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(), // 'core_value' or 'principle'
  colorScheme: text("color_scheme").notNull().default('blue'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertValueSchema = createInsertSchema(values).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Value = typeof values.$inferSelect;
export type InsertValue = z.infer<typeof insertValueSchema>;

// Remove duplicate - these are defined below

// Risks and Actions - AI Analysis and Recommendations
export const riskAnalyses = pgTable("risk_analyses", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  analysisDate: date("analysis_date").notNull(),
  teamId: integer("team_id").references(() => teams.id), // null for overall analysis
  moduleType: text("module_type").notNull(), // 'overall', 'accounts', 'vat', 'health_checks', etc.
  analysisType: text("analysis_type").notNull(), // 'performance', 'trend', 'risk_assessment'
  dataSnapshot: text("data_snapshot").notNull(), // JSON snapshot of relevant data
  aiAnalysis: text("ai_analysis").notNull(), // AI-generated analysis
  riskLevel: text("risk_level").notNull(), // 'low', 'medium', 'high', 'critical'
  keyFindings: text("key_findings").array().notNull(), // Array of key insights
  trends: text("trends").array().notNull(), // Array of identified trends
  underperformingAreas: text("underperforming_areas").array().notNull(), // Areas of concern
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const actionRecommendations = pgTable("action_recommendations", {
  id: serial("id").primaryKey(),
  riskAnalysisId: integer("risk_analysis_id").notNull().references(() => riskAnalyses.id),
  priority: text("priority").notNull(), // 'low', 'medium', 'high', 'urgent'
  category: text("category").notNull(), // 'process', 'resource', 'training', 'system'
  recommendation: text("recommendation").notNull(),
  expectedImpact: text("expected_impact").notNull(),
  timeframe: text("timeframe").notNull(), // 'immediate', 'short_term', 'medium_term', 'long_term'
  estimatedEffort: text("estimated_effort").notNull(), // 'low', 'medium', 'high'
  status: text("status").notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'dismissed'
  assignedTo: text("assigned_to"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clarifyingQuestions = pgTable("clarifying_questions", {
  id: serial("id").primaryKey(),
  riskAnalysisId: integer("risk_analysis_id").notNull().references(() => riskAnalyses.id),
  question: text("question").notNull(),
  context: text("context").notNull(), // Why this question is being asked
  category: text("category").notNull(), // 'background', 'process', 'resource', 'external_factor'
  priority: text("priority").notNull(), // 'low', 'medium', 'high'
  response: text("response"),
  respondedBy: text("responded_by"),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teamResponses = pgTable("team_responses", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull().references(() => clarifyingQuestions.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  response: text("response").notNull(),
  additionalContext: text("additional_context"),
  respondedBy: text("responded_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const analysisComments = pgTable("analysis_comments", {
  id: serial("id").primaryKey(),
  riskAnalysisId: integer("risk_analysis_id").notNull().references(() => riskAnalyses.id),
  comment: text("comment").notNull(),
  commentType: text("comment_type").notNull(), // 'feedback', 'correction', 'additional_context'
  commentedBy: text("commented_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas for the new tables
export const insertRiskAnalysisSchema = createInsertSchema(riskAnalyses).omit({
  id: true,
  createdAt: true,
});

export const insertActionRecommendationSchema = createInsertSchema(actionRecommendations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClarifyingQuestionSchema = createInsertSchema(clarifyingQuestions).omit({
  id: true,
  createdAt: true,
});

export const insertTeamResponseSchema = createInsertSchema(teamResponses).omit({
  id: true,
  createdAt: true,
});

export const insertAnalysisCommentSchema = createInsertSchema(analysisComments).omit({
  id: true,
  createdAt: true,
});

// Types for the new tables
export type RiskAnalysis = typeof riskAnalyses.$inferSelect;
export type InsertRiskAnalysis = z.infer<typeof insertRiskAnalysisSchema>;

export type ActionRecommendation = typeof actionRecommendations.$inferSelect;
export type InsertActionRecommendation = z.infer<typeof insertActionRecommendationSchema>;

export type ClarifyingQuestion = typeof clarifyingQuestions.$inferSelect;
export type InsertClarifyingQuestion = z.infer<typeof insertClarifyingQuestionSchema>;

export type TeamResponse = typeof teamResponses.$inferSelect;
export type InsertTeamResponse = z.infer<typeof insertTeamResponseSchema>;

export type AnalysisComment = typeof analysisComments.$inferSelect;
export type InsertAnalysisComment = z.infer<typeof insertAnalysisCommentSchema>;

// Types and schemas for users
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;
export type InsertUser = typeof users.$inferInsert;

// User invitation schema
export const insertUserInvitationSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
  role: true,
});
export type InsertUserInvitation = z.infer<typeof insertUserInvitationSchema>;

// User-Team mapping for team-level access control
export const waitlistRegistrations = pgTable("waitlist_registrations", {
  id: serial("id").primaryKey(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  firmName: varchar("firm_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 50 }),
  practiceSize: varchar("practice_size", { length: 50 }),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  webhookSent: boolean("webhook_sent").default(false).notNull(),
  webhookSentAt: timestamp("webhook_sent_at"),
});

export const insertWaitlistRegistrationSchema = createInsertSchema(waitlistRegistrations).omit({
  id: true,
  createdAt: true,
});
export type WaitlistRegistration = typeof waitlistRegistrations.$inferSelect;
export type InsertWaitlistRegistration = z.infer<typeof insertWaitlistRegistrationSchema>;

export const userTeams = pgTable("user_teams", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisations.id),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique().on(table.userId, table.teamId),
]);

export const insertUserTeamSchema = createInsertSchema(userTeams).omit({
  id: true,
  createdAt: true,
});

// Valuation tool — platform-level, outside multi-tenancy
export const valuationSubmissions = pgTable("valuation_submissions", {
  id: serial("id").primaryKey(),
  valuationType: text("valuation_type").notNull(), // own_practice | acquisition_target
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  firmName: text("firm_name").notNull(),
  grf: decimal("grf", { precision: 14, scale: 2 }).notNull(),
  clientCount: integer("client_count").notNull(),
  ebitdaPercent: decimal("ebitda_percent", { precision: 6, scale: 2 }).notNull(),
  ownerDependency: text("owner_dependency"),
  technicalDependency: text("technical_dependency"),
  relationshipDependency: text("relationship_dependency"),
  ownerHoursPerWeek: text("owner_hours_per_week"),
  teamStructure: text("team_structure").notNull(),
  niche: text("niche").notNull(),
  nicheOther: text("niche_other"),
  ddCollectionRate: text("dd_collection_rate"),
  clientTenure: decimal("client_tenure", { precision: 6, scale: 2 }),
  churnRate: decimal("churn_rate", { precision: 6, scale: 2 }),
  technicalNormalisationAmount: decimal("technical_normalisation_amount", { precision: 12, scale: 2 }),
  relationshipRiskDiscount: decimal("relationship_risk_discount", { precision: 6, scale: 4 }),
  conservativeValuation: decimal("conservative_valuation", { precision: 14, scale: 2 }).notNull(),
  midValuation: decimal("mid_valuation", { precision: 14, scale: 2 }).notNull(),
  optimisticValuation: decimal("optimistic_valuation", { precision: 14, scale: 2 }).notNull(),
  adjustedMultiple: decimal("adjusted_multiple", { precision: 6, scale: 4 }).notNull(),
  pdfUrl: text("pdf_url"),
  pdfData: text("pdf_data"),
  consentGiven: boolean("consent_given").notNull().default(false),
  webhookSent: boolean("webhook_sent").notNull().default(false),
  webhookSentAt: timestamp("webhook_sent_at"),
  emailConfirmed: boolean("email_confirmed").notNull().default(false),
  confirmedEmail: text("confirmed_email"),
  stage2WebhookSent: boolean("stage2_webhook_sent").notNull().default(false),
  stage2WebhookSentAt: timestamp("stage2_webhook_sent_at"),
  improvementAction1: text("improvement_action_1"),
  improvementAction2: text("improvement_action_2"),
  improvementAction3: text("improvement_action_3"),
  ebitdaPrePostDrawings: text("ebitda_pre_post_drawings"),   // before_drawings | after_drawings
  clientConcentration: text("client_concentration"),          // under_10 | 10_20 | 20_30 | 30_40 | over_40
  cloudAdoptionPercent: text("cloud_adoption_percent"),       // 90_plus | 70_90 | 50_70 | under_50 | not_sure
  ownerDrawingsNormalisationAmount: decimal("owner_drawings_normalisation_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertValuationSubmissionSchema = createInsertSchema(valuationSubmissions).omit({
  id: true,
  createdAt: true,
  webhookSent: true,
  webhookSentAt: true,
  emailConfirmed: true,
  confirmedEmail: true,
  stage2WebhookSent: true,
  stage2WebhookSentAt: true,
});
export type ValuationSubmission = typeof valuationSubmissions.$inferSelect;
export type InsertValuationSubmission = z.infer<typeof insertValuationSubmissionSchema>;

export const valuationEvents = pgTable("valuation_events", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id"),
  eventType: text("event_type").notNull(), // page_viewed | form_started | form_submitted | pdf_downloaded | cta_clicked
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ValuationEvent = typeof valuationEvents.$inferSelect;

export type UserTeam = typeof userTeams.$inferSelect;
export type InsertUserTeam = z.infer<typeof insertUserTeamSchema>;

// ─── Management Reports Module ────────────────────────────────────────────────

export const reportClients = pgTable("report_clients", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  clientName: varchar("client_name").notNull(),
  companyName: varchar("company_name").notNull(),
  industry: varchar("industry").notNull().default("sme_general"), // professional_services | hospitality_retail | property | sme_general | manufacturing | other
  reportFrequency: varchar("report_frequency").notNull().default("monthly"), // monthly | quarterly | 12_weekly | custom
  reportType: varchar("report_type").notNull().default("standard"), // standard | mi_pack
  xeroTenantId: varchar("xero_tenant_id"),
  xeroAccessToken: text("xero_access_token"),
  xeroRefreshToken: text("xero_refresh_token"),
  clientLogoUrl: varchar("client_logo_url"),
  isActive: boolean("is_active").notNull().default(true),
  clientContext: text("client_context"),
  onboardingStep: integer("onboarding_step").default(1),
  businessDescription: text("business_description"),
  ownerProfile: text("owner_profile"),
  keyRelationships: jsonb("key_relationships").$type<Array<{
    type: string; name: string; description: string; importance: string;
  }>>(),
  historicalContext: text("historical_context"),
  standingInstructions: text("standing_instructions"),
  keyRisks: jsonb("key_risks").$type<Array<{
    risk: string; likelihood: string; impact: string;
  }>>(),
  keyOpportunities: jsonb("key_opportunities").$type<Array<{
    opportunity: string; timeline: string; potential_impact: string;
  }>>(),
  sectorNotes: text("sector_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReportClientSchema = createInsertSchema(reportClients).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type ReportClient = typeof reportClients.$inferSelect;
export type InsertReportClient = z.infer<typeof insertReportClientSchema>;

export const strategicPlans = pgTable("strategic_plans", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  clientId: integer("client_id").notNull().references(() => reportClients.id),
  clientName: varchar("client_name"),
  companyName: varchar("company_name"),
  coachName: varchar("coach_name"),
  planDate: date("plan_date"),
  longTermGoals: jsonb("long_term_goals").$type<Array<{ goal: string; currentPosition: string }>>().default([]),
  quickWins: jsonb("quick_wins").$type<string[]>().default([]),
  smartActions: jsonb("smart_actions").$type<Array<{
    action: string; specific: string; measurable: string;
    attainable: string; realistic: string; timeBound: string; targetDate: string;
  }>>().default([]),
  swot: jsonb("swot").$type<{
    strengths: string[]; weaknesses: string[];
    opportunities: string[]; threats: string[];
  }>().default({ strengths: [], weaknesses: [], opportunities: [], threats: [] }),
  sessionSummaryClient: jsonb("session_summary_client").$type<string[]>().default([]),
  sessionSummaryCoach: jsonb("session_summary_coach").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertStrategicPlanSchema = createInsertSchema(strategicPlans).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type StrategicPlan = typeof strategicPlans.$inferSelect;
export type InsertStrategicPlan = z.infer<typeof insertStrategicPlanSchema>;

export const managementReportPeriods = pgTable("management_report_periods", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  clientId: integer("client_id").notNull().references(() => reportClients.id),
  periodType: varchar("period_type").notNull().default("monthly"), // monthly | quarterly | 12_weekly | custom
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  periodLabel: varchar("period_label").notNull(),
  xeroConnected: boolean("xero_connected").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertManagementReportPeriodSchema = createInsertSchema(managementReportPeriods).omit({
  id: true, createdAt: true,
});
export type ManagementReportPeriod = typeof managementReportPeriods.$inferSelect;
export type InsertManagementReportPeriod = z.infer<typeof insertManagementReportPeriodSchema>;

export const managementReports = pgTable("management_reports", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  clientId: integer("client_id").notNull().references(() => reportClients.id),
  periodId: integer("period_id").notNull().references(() => managementReportPeriods.id),
  strategicPlanId: integer("strategic_plan_id").references(() => strategicPlans.id),
  status: varchar("status").notNull().default("draft"), // draft | ready | sent
  financialData: jsonb("financial_data").$type<Record<string, any>>().default({}),
  customData: jsonb("custom_data").$type<Record<string, any>>().default({}),
  aiExecutiveSummary: text("ai_executive_summary"),
  aiGoingWell: jsonb("ai_going_well").$type<string[]>().default([]),
  aiConcerns: jsonb("ai_concerns").$type<string[]>().default([]),
  aiActionSteps: jsonb("ai_action_steps").$type<Array<{
    action: string; why: string; priority: string; linksToGoal?: string;
  }>>().default([]),
  aiGoalCommentary: jsonb("ai_goal_commentary").$type<Array<{
    goal: string; currentFinancialPosition: string; gap: string; onTrack: boolean;
  }>>().default([]),
  aiDiscussionPoints: jsonb("ai_discussion_points").$type<string[]>().default([]),
  aiHealthScore: integer("ai_health_score"),
  aiHealthStatus: varchar("ai_health_status"),
  aiThreeCoreQuestions: jsonb("ai_three_core_questions").$type<{
    profitability_verdict?: string; capital_verdict?: string; borrowing_verdict?: string;
  }>(),
  aiCoreQuestionAnswers: jsonb("ai_core_question_answers").$type<Array<{
    question_number: number; question: string; verdict: string;
    key_findings: string[]; benchmark_commentary: string;
  }>>(),
  aiWatchPoints: jsonb("ai_watch_points").$type<string[]>(),
  aiNextPeriodFocus: text("ai_next_period_focus"),
  periodContext: text("period_context"),
  periodDecisionsPending: text("period_decisions_pending"),
  periodOwnerConcerns: text("period_owner_concerns"),
  periodOneOffs: text("period_one_offs"),
  accountantNotes: text("accountant_notes"),
  reportPeriodType: varchar("report_period_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertManagementReportSchema = createInsertSchema(managementReports).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type ManagementReport = typeof managementReports.$inferSelect;
export type InsertManagementReport = z.infer<typeof insertManagementReportSchema>;

// ─── Report Structures (dynamic per-client structure) ─────────────────────────
export const reportStructures = pgTable("report_structures", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  clientId: integer("client_id").notNull().references(() => reportClients.id),
  coreQuestions: jsonb("core_questions").$type<Array<{
    number: number; question: string; focus: string;
  }>>().default([]),
  keyMetrics: jsonb("key_metrics").$type<Array<{
    key: string; label: string; target: string; importance: string;
  }>>().default([]),
  sectionOrder: jsonb("section_order").$type<string[]>().default([]),
  focusAreas: jsonb("focus_areas").$type<string[]>().default([]),
  status: varchar("status").notNull().default("draft"), // draft | approved
  aiGeneratedAt: timestamp("ai_generated_at"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReportStructureSchema = createInsertSchema(reportStructures).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type ReportStructure = typeof reportStructures.$inferSelect;
export type InsertReportStructure = z.infer<typeof insertReportStructureSchema>;

// ─── Coaching Tool Module ─────────────────────────────────────────────────────

export const coachingClients = pgTable("coaching_clients", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  name: varchar("name").notNull(),
  companyName: varchar("company_name"),
  email: varchar("email"),
  phone: varchar("phone"),
  notes: text("notes"),
  linkedUserId: integer("linked_user_id").references(() => users.id, { onDelete: 'set null' }),
  portalEnabled: boolean("portal_enabled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCoachingClientSchema = createInsertSchema(coachingClients).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type CoachingClient = typeof coachingClients.$inferSelect;
export type InsertCoachingClient = z.infer<typeof insertCoachingClientSchema>;

export const coachingSessions = pgTable("coaching_sessions", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  clientId: integer("client_id").notNull().references(() => coachingClients.id),
  sessionDate: date("session_date").notNull(),
  status: varchar("status").notNull().default("open"), // open | closed
  agendaNotes: text("agenda_notes"),
  transcript: text("transcript"),
  clientSummary: text("client_summary"),
  clientSummaryShared: boolean("client_summary_shared").notNull().default(false),
  internalSummary: text("internal_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const COACHING_SESSION_STATUSES = ['open', 'closed'] as const;
export type CoachingSessionStatus = typeof COACHING_SESSION_STATUSES[number];

export const insertCoachingSessionSchema = createInsertSchema(coachingSessions).omit({
  id: true, createdAt: true, updatedAt: true,
}).extend({
  status: z.enum(COACHING_SESSION_STATUSES).default('open'),
});
export type CoachingSession = typeof coachingSessions.$inferSelect;
export type InsertCoachingSession = z.infer<typeof insertCoachingSessionSchema>;

export const coachingSessionNotes = pgTable("coaching_session_notes", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  clientId: integer("client_id").notNull().references(() => coachingClients.id),
  sessionId: integer("session_id").references(() => coachingSessions.id, { onDelete: 'set null' }),
  noteDate: date("note_date").notNull(),
  title: varchar("title").notNull(),
  body: text("body").notNull().default(""),
  sharedWithClient: boolean("shared_with_client").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCoachingSessionNoteSchema = createInsertSchema(coachingSessionNotes).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type CoachingSessionNote = typeof coachingSessionNotes.$inferSelect;
export type InsertCoachingSessionNote = z.infer<typeof insertCoachingSessionNoteSchema>;

export const coachingStrategicGoals = pgTable("coaching_strategic_goals", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  clientId: integer("client_id").notNull().references(() => coachingClients.id),
  horizon: varchar("horizon").notNull(), // 5year | 3year | 1year
  specific: text("specific").notNull().default(""),
  measurable: text("measurable").notNull().default(""),
  achievable: text("achievable").notNull().default(""),
  relevant: text("relevant").notNull().default(""),
  timeBound: text("time_bound").notNull().default(""),
  targetDate: date("target_date"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCoachingStrategicGoalSchema = createInsertSchema(coachingStrategicGoals).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type CoachingStrategicGoal = typeof coachingStrategicGoals.$inferSelect;
export type InsertCoachingStrategicGoal = z.infer<typeof insertCoachingStrategicGoalSchema>;

export const coachingQuarterlyObjectives = pgTable("coaching_quarterly_objectives", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  clientId: integer("client_id").notNull().references(() => coachingClients.id),
  quarter: integer("quarter").notNull(), // 1 | 2 | 3 | 4
  year: integer("year").notNull(),
  objective: text("objective").notNull(),
  status: varchar("status").notNull().default("not_started"),
  // not_started | making_a_start | in_progress | halfway | mostly_there | last_little_bit | done | carried
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const COACHING_OBJECTIVE_STATUSES = [
  'not_started', 'making_a_start', 'in_progress', 'halfway',
  'mostly_there', 'last_little_bit', 'done', 'carried',
] as const;
export type CoachingObjectiveStatus = typeof COACHING_OBJECTIVE_STATUSES[number];

export const insertCoachingQuarterlyObjectiveSchema = createInsertSchema(coachingQuarterlyObjectives).omit({
  id: true, createdAt: true, updatedAt: true,
}).extend({
  status: z.enum(COACHING_OBJECTIVE_STATUSES).default('not_started'),
});
export type CoachingQuarterlyObjective = typeof coachingQuarterlyObjectives.$inferSelect;
export type InsertCoachingQuarterlyObjective = z.infer<typeof insertCoachingQuarterlyObjectiveSchema>;

export const coachingActions = pgTable("coaching_actions", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  clientId: integer("client_id").notNull().references(() => coachingClients.id),
  sessionId: integer("session_id").notNull().references(() => coachingSessions.id),
  description: text("description").notNull(),
  owner: varchar("owner").notNull(), // coach | client
  deadline: date("deadline"),
  status: varchar("status").notNull().default("open"), // open | done | carried | abandoned
  carriedToSessionId: integer("carried_to_session_id").references(() => coachingSessions.id),
  linkedObjectiveId: integer("linked_objective_id").references(() => coachingQuarterlyObjectives.id, { onDelete: 'set null' }),
  linkedGoalId: integer("linked_goal_id").references(() => coachingStrategicGoals.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const COACHING_ACTION_STATUSES = ['open', 'done', 'carried', 'abandoned'] as const;
export type CoachingActionStatus = typeof COACHING_ACTION_STATUSES[number];

export const COACHING_ACTION_OWNERS = ['coach', 'client'] as const;
export type CoachingActionOwner = typeof COACHING_ACTION_OWNERS[number];

export const insertCoachingActionSchema = createInsertSchema(coachingActions).omit({
  id: true, createdAt: true, updatedAt: true,
}).extend({
  status: z.enum(COACHING_ACTION_STATUSES).default('open'),
  owner: z.enum(COACHING_ACTION_OWNERS),
});
export type CoachingAction = typeof coachingActions.$inferSelect;
export type InsertCoachingAction = z.infer<typeof insertCoachingActionSchema>;

// ─── Financial Clarity Review ──────────────────────────────────────────────

export const FCR_TRAFFIC_LIGHTS = ['green', 'amber', 'red'] as const;
export type FcrTrafficLight = typeof FCR_TRAFFIC_LIGHTS[number];

export const FCR_NEXT_STEPS = [
  'remain',
  'diy',
  'control_chaos',
  'create_clarity',
  'build_performance',
  'lead_confidence',
  'other',
] as const;
export type FcrNextStep = typeof FCR_NEXT_STEPS[number];

export const FCR_CHALLENGES = [
  'cash', 'profit', 'growth', 'pricing', 'staff',
  'leadership', 'systems', 'sales', 'capacity', 'time', 'other',
] as const;
export type FcrChallenge = typeof FCR_CHALLENGES[number];

export const financialClarityReviews = pgTable("financial_clarity_reviews", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),

  // Section 1 — Client Details
  businessName: varchar("business_name"),
  contact: varchar("contact"),
  turnover: varchar("turnover"),
  employees: varchar("employees"),
  industry: varchar("industry"),
  currentAccountant: varchar("current_accountant"),
  referralSource: varchar("referral_source"),
  reviewDate: date("review_date"),
  adviser: varchar("adviser"),

  // Section 2 — Control the Chaos
  bookkeepingQuality: varchar("bookkeeping_quality"),   // green|amber|red
  complianceConfidence: varchar("compliance_confidence"),
  vatUpToDate: varchar("vat_up_to_date"),
  accountsUpToDate: varchar("accounts_up_to_date"),
  taxSurprises: varchar("tax_surprises"),
  softwareConfidence: varchar("software_confidence"),
  ownerConfidenceInNumbers: integer("owner_confidence_in_numbers"), // 1–10
  chaosNotes: text("chaos_notes"),
  chaosStatus: varchar("chaos_status"),

  // Section 3 — Financial Clarity
  managementAccounts: varchar("management_accounts"),
  kpis: varchar("kpis"),
  cashflowVisibility: varchar("cashflow_visibility"),
  departmentProfitability: varchar("department_profitability"),
  regularReviewMeetings: varchar("regular_review_meetings"),
  financialUnderstanding: varchar("financial_understanding"),
  decisionConfidence: integer("decision_confidence"), // 1–10
  clarityNotes: text("clarity_notes"),
  clarityStatus: varchar("clarity_status"),

  // Section 4 — Business Performance
  businessGoals: varchar("business_goals"),
  quarterlyReviews: varchar("quarterly_reviews"),
  pricingConfidence: varchar("pricing_confidence"),
  profitFocus: varchar("profit_focus"),
  taxPlanning: varchar("tax_planning"),
  accountability: varchar("accountability"),
  performanceStatus: varchar("performance_status"),
  performanceNotes: text("performance_notes"),

  // Section 5 — Lead with Confidence
  budget: varchar("budget"),
  cashflowForecast: varchar("cashflow_forecast"),
  scenarioPlanning: varchar("scenario_planning"),
  performanceDashboard: varchar("performance_dashboard"),
  boardLevelSupport: varchar("board_level_support"),
  exitPlanning: varchar("exit_planning"),
  leadershipStatus: varchar("leadership_status"),
  leadershipNotes: text("leadership_notes"),

  // Section 6 — Biggest Challenges (stored as JSON array of FcrChallenge strings)
  biggestChallenges: text("biggest_challenges"),

  // Section 7 — Top Three Opportunities
  opportunity1: text("opportunity1"),
  opportunity2: text("opportunity2"),
  opportunity3: text("opportunity3"),

  // Section 8 — Recommended Next Step
  recommendedNextStep: varchar("recommended_next_step"),

  // Section 9 — AI Report
  aiReport: text("ai_report"),

  // Section 10 — Socket Handover
  socketHandover: text("socket_handover"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFinancialClarityReviewSchema = createInsertSchema(financialClarityReviews).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type FinancialClarityReview = typeof financialClarityReviews.$inferSelect;
export type InsertFinancialClarityReview = z.infer<typeof insertFinancialClarityReviewSchema>;

// ── Communication scorecards: Email Analytics (metadata only) ──────────────
// These tables deliberately contain no body, body preview, attachment, or extended
// property columns.  Email Analytics is a response-service scorecard, not an inbox.
export const emailAnalyticsSettings = pgTable("email_analytics_settings", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  enabled: boolean("enabled").notNull().default(false),
  automaticRefreshEnabled: boolean("automatic_refresh_enabled").notNull().default(true),
  autoTriageMode: varchar("auto_triage_mode").notNull().default("disabled"), // disabled | shadow | automatic
  autoTriageConfidenceThreshold: decimal("auto_triage_confidence_threshold", { precision: 4, scale: 3 }).notNull().default("0.980"),
  autoTriageValidationReviewedAt: timestamp("auto_triage_validation_reviewed_at"),
  autoTriageValidationReviewedByUserId: integer("auto_triage_validation_reviewed_by_user_id").references(() => users.id),
  autoTriageActivationApprovedAt: timestamp("auto_triage_activation_approved_at"),
  autoTriageActivationApprovedByUserId: integer("auto_triage_activation_approved_by_user_id").references(() => users.id),
  autoTriageLastRunAt: timestamp("auto_triage_last_run_at"),
  autoTriageLastErrorCode: varchar("auto_triage_last_error_code"),
  contactTypes: text("contact_types").array().notNull().default(sql`ARRAY['Client','Client - Individual Tax']::text[]`),
  workdayStartMinutes: integer("workday_start_minutes").notNull().default(570),
  workdayEndMinutes: integer("workday_end_minutes").notNull().default(1050),
  fridayEndMinutes: integer("friday_end_minutes").notNull().default(870),
  syncIntervalMinutes: integer("sync_interval_minutes").notNull().default(30),
  lastMailboxSyncAt: timestamp("last_mailbox_sync_at"),
  lastKarbonSyncAt: timestamp("last_karbon_sync_at"),
  responseEventMeasurementStartAt: timestamp("response_event_measurement_start_at").notNull().defaultNow(),
  responseEventLastBuiltAt: timestamp("response_event_last_built_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({ organisationUnique: unique("email_analytics_settings_organisation_key").on(table.organisationId) }));

export const emailAnalyticsMailboxes = pgTable("email_analytics_mailboxes", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  address: varchar("address").notNull(),
  displayName: varchar("display_name"),
  enabled: boolean("enabled").notNull().default(true),
  graphDeltaLink: text("graph_delta_link"),
  lastSyncedAt: timestamp("last_synced_at"),
  lastSyncError: text("last_sync_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({ mailboxUnique: unique("email_analytics_mailbox_organisation_address_key").on(table.organisationId, table.address) }));

export const emailAnalyticsContacts = pgTable("email_analytics_contacts", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  karbonContactId: varchar("karbon_contact_id").notNull(),
  name: varchar("name").notNull(),
  organisationName: varchar("organisation_name"),
  email: varchar("email").notNull(),
  contactType: varchar("contact_type").notNull(),
  clientManager: varchar("client_manager"),
  active: boolean("active").notNull().default(true),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
}, (table) => ({
  karbonUnique: unique("email_analytics_contact_organisation_karbon_key").on(table.organisationId, table.karbonContactId),
  emailIndex: index("email_analytics_contact_email_index").on(table.organisationId, table.email),
}));

export const emailAnalyticsConversations = pgTable("email_analytics_conversations", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  subject: text("subject"),
  latestClientMessageAt: timestamp("latest_client_message_at"),
  latestMbsResponseAt: timestamp("latest_mbs_response_at"),
  clientContactId: integer("client_contact_id").references(() => emailAnalyticsContacts.id),
  disposition: varchar("disposition"), // no_response_required | handled_elsewhere | resolved_phone_meeting | dismissed
  dispositionAt: timestamp("disposition_at"),
  dispositionByUserId: integer("disposition_by_user_id").references(() => users.id),
  isFlagged: boolean("is_flagged").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Microsoft conversation ids are only meaningful inside a mailbox.  This durable
// mapping is joined to other groups via a shared internetMessageId during sync.
export const emailAnalyticsConversationGroups = pgTable("email_analytics_conversation_groups", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  mailboxId: integer("mailbox_id").notNull().references(() => emailAnalyticsMailboxes.id),
  graphConversationId: varchar("graph_conversation_id").notNull(),
  canonicalConversationId: integer("canonical_conversation_id").notNull().references(() => emailAnalyticsConversations.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({ localGroupUnique: unique("email_analytics_group_mailbox_conversation_key").on(table.mailboxId, table.graphConversationId) }));

export const emailAnalyticsMessages = pgTable("email_analytics_messages", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  mailboxId: integer("mailbox_id").notNull().references(() => emailAnalyticsMailboxes.id),
  canonicalConversationId: integer("canonical_conversation_id").notNull().references(() => emailAnalyticsConversations.id),
  graphMessageId: varchar("graph_message_id").notNull(),
  graphConversationId: varchar("graph_conversation_id"),
  internetMessageId: varchar("internet_message_id"),
  direction: varchar("direction").notNull(), // inbound_client | outbound_mbs | external_unmatched
  senderEmail: varchar("sender_email"),
  senderName: varchar("sender_name"),
  subject: text("subject"),
  webLink: text("web_link"),
  receivedAt: timestamp("received_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  graphMessageUnique: unique("email_analytics_message_mailbox_graph_key").on(table.mailboxId, table.graphMessageId),
  internetMessageIndex: index("email_analytics_message_internet_id_index").on(table.organisationId, table.internetMessageId),
  canonicalIndex: index("email_analytics_message_canonical_index").on(table.canonicalConversationId, table.receivedAt),
}));

export const emailAnalyticsResponseEvents = pgTable("email_analytics_response_events", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  canonicalConversationId: integer("canonical_conversation_id").notNull().references(() => emailAnalyticsConversations.id),
  clientContactId: integer("client_contact_id").references(() => emailAnalyticsContacts.id),
  triggeringClientMessageId: integer("triggering_client_message_id").notNull().references(() => emailAnalyticsMessages.id),
  latestClientMessageId: integer("latest_client_message_id").notNull().references(() => emailAnalyticsMessages.id),
  clientMessageCount: integer("client_message_count").notNull().default(1),
  receivedAt: timestamp("received_at").notNull(),
  latestClientMessageAt: timestamp("latest_client_message_at").notNull(),
  deadlineAt: timestamp("deadline_at").notNull(),
  responseMessageId: integer("response_message_id").references(() => emailAnalyticsMessages.id),
  responseAt: timestamp("response_at"),
  outcome: varchar("outcome").notNull().default("pending"),
  handlingSource: varchar("handling_source").notNull().default("automatic"),
  manualClassification: varchar("manual_classification"),
  handledAt: timestamp("handled_at"),
  handledByUserId: integer("handled_by_user_id").references(() => users.id),
  slaVersion: integer("sla_version").notNull().default(1),
  backfillConfidence: varchar("backfill_confidence").notNull().default("observed_after_measurement_start"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  triggerUnique: unique("email_analytics_response_event_trigger_key").on(table.organisationId, table.triggeringClientMessageId),
  receivedIndex: index("email_analytics_response_event_received_index").on(table.organisationId, table.receivedAt),
  outcomeIndex: index("email_analytics_response_event_outcome_index").on(table.organisationId, table.outcome),
  conversationIndex: index("email_analytics_response_event_conversation_index").on(table.canonicalConversationId, table.receivedAt),
}));

// Content-free record of a triage decision.  The email itself is intentionally
// never copied to this table; only the message reference, label, confidence and
// fixed reason code survive after a transient classification attempt.
export const emailAnalyticsTriagePredictions = pgTable("email_analytics_triage_predictions", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  canonicalConversationId: integer("canonical_conversation_id").notNull().references(() => emailAnalyticsConversations.id),
  clientMessageId: integer("client_message_id").notNull().references(() => emailAnalyticsMessages.id),
  label: varchar("label").notNull(), // no_response_required | acknowledgement_recommended | response_required | uncertain
  confidence: decimal("confidence", { precision: 4, scale: 3 }).notNull(),
  reasonCode: varchar("reason_code").notNull(),
  classifierSource: varchar("classifier_source").notNull(), // rule | bedrock
  classifierVersion: varchar("classifier_version").notNull(),
  modelId: varchar("model_id"),
  status: varchar("status").notNull().default("shadow"), // shadow | applied | reopened | blocked | superseded
  classifiedAt: timestamp("classified_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  messageUnique: unique("email_analytics_triage_prediction_message_key").on(table.organisationId, table.clientMessageId),
  statusIndex: index("email_analytics_triage_prediction_status_index").on(table.organisationId, table.status),
  conversationIndex: index("email_analytics_triage_prediction_conversation_index").on(table.canonicalConversationId, table.classifiedAt),
}));

export const emailAnalyticsResponseEventAudit = pgTable("email_analytics_response_event_audit", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  responseEventId: integer("response_event_id").notNull().references(() => emailAnalyticsResponseEvents.id),
  previousOutcome: varchar("previous_outcome"),
  outcome: varchar("outcome").notNull(),
  handledAt: timestamp("handled_at"),
  performedByUserId: integer("performed_by_user_id").references(() => users.id),
  actorKind: varchar("actor_kind").notNull().default("user"), // user | automatic_triage
  triagePredictionId: integer("triage_prediction_id").references(() => emailAnalyticsTriagePredictions.id),
  performedAt: timestamp("performed_at").notNull().defaultNow(),
}, (table) => ({
  actorIntegrity: check("email_analytics_response_event_audit_actor_integrity", sql`(
    (${table.actorKind} = 'user' AND ${table.performedByUserId} IS NOT NULL AND ${table.triagePredictionId} IS NULL)
    OR (${table.actorKind} = 'automatic_triage' AND ${table.performedByUserId} IS NULL AND ${table.triagePredictionId} IS NOT NULL)
  )`),
}));

export const emailAnalyticsResponseEventExceptions = pgTable("email_analytics_response_event_exceptions", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  responseEventId: integer("response_event_id").notNull().references(() => emailAnalyticsResponseEvents.id),
  subsequentResponseMessageId: integer("subsequent_response_message_id").notNull().references(() => emailAnalyticsMessages.id),
  subsequentResponseAt: timestamp("subsequent_response_at").notNull(),
  responseWithinDeadline: boolean("response_within_deadline").notNull(),
  status: varchar("status").notNull().default("open"), // open | confirmed | corrected
  resolvedByUserId: integer("resolved_by_user_id").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  eventUnique: unique("email_analytics_response_event_exception_event_key").on(table.responseEventId),
  statusIndex: index("email_analytics_response_event_exception_status_index").on(table.organisationId, table.status),
}));

export const emailAnalyticsResponseEventExceptionAudit = pgTable("email_analytics_response_event_exception_audit", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  exceptionId: integer("exception_id").notNull().references(() => emailAnalyticsResponseEventExceptions.id),
  action: varchar("action").notNull(), // confirm_original | correct
  previousOutcome: varchar("previous_outcome").notNull(),
  outcome: varchar("outcome").notNull(),
  performedByUserId: integer("performed_by_user_id").notNull().references(() => users.id),
  performedAt: timestamp("performed_at").notNull().defaultNow(),
});

// Content-free record of a triage decision.  The email itself is intentionally
// never copied to this table; only the message reference, label, confidence and
// fixed reason code survive after a transient classification attempt.
export const emailAnalyticsDispositionAudit = pgTable("email_analytics_disposition_audit", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  canonicalConversationId: integer("canonical_conversation_id").notNull().references(() => emailAnalyticsConversations.id),
  previousDisposition: varchar("previous_disposition"),
  disposition: varchar("disposition"), // null is represented by action reopen
  action: varchar("action").notNull(), // set | reopen
  performedByUserId: integer("performed_by_user_id").references(() => users.id),
  actorKind: varchar("actor_kind").notNull().default("user"), // user | automatic_triage
  triagePredictionId: integer("triage_prediction_id").references(() => emailAnalyticsTriagePredictions.id),
  performedAt: timestamp("performed_at").notNull().defaultNow(),
}, (table) => ({
  actorIntegrity: check("email_analytics_disposition_audit_actor_integrity", sql`(
    (${table.actorKind} = 'user' AND ${table.performedByUserId} IS NOT NULL AND ${table.triagePredictionId} IS NULL)
    OR (${table.actorKind} = 'automatic_triage' AND ${table.performedByUserId} IS NULL AND ${table.triagePredictionId} IS NOT NULL)
  )`),
}));

export const emailAnalyticsSyncRuns = pgTable("email_analytics_sync_runs", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  kind: varchar("kind").notNull(), // mailbox | karbon
  status: varchar("status").notNull(), // running | succeeded | failed
  attempts: integer("attempts").notNull().default(0),
  error: text("error"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertEmailAnalyticsMailboxSchema = createInsertSchema(emailAnalyticsMailboxes).omit({ id: true, createdAt: true, updatedAt: true, lastSyncedAt: true, lastSyncError: true, graphDeltaLink: true });
export type EmailAnalyticsMailbox = typeof emailAnalyticsMailboxes.$inferSelect;
export type EmailAnalyticsConversation = typeof emailAnalyticsConversations.$inferSelect;
export type EmailAnalyticsMessage = typeof emailAnalyticsMessages.$inferSelect;
export type EmailAnalyticsResponseEvent = typeof emailAnalyticsResponseEvents.$inferSelect;
