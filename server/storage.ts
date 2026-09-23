import { randomBytes } from "crypto";
import { 
  organisations,
  users,
  teams, weeklyTargets, weeklyResults, accountsDue,
  vatTargets, vatResults, vatDue, vatTurnoverChecks,
  healthChecksTargets, healthChecksResults, healthChecksDue,
  mbsResults, mbsDextPrecision, mbsOldestItems, clientBookkeepingResults, clientDextPrecision, clientOldestItems,
  confirmationStatementsTargets, confirmationStatementsResults, confirmationStatementsDue, confirmationStatementTurnaround,
  taxData,
  revenueAnalyticsTargets, revenueAnalyticsResults,
  riskAnalyses, actionRecommendations, clarifyingQuestions, teamResponses, analysisComments,
  quarterlyGoals, quarterlyTargets, values, rockReminderDismissals,
  clientValueClients,
  reportClients, strategicPlans, managementReportPeriods, managementReports, reportStructures,
  coachingClients, coachingSessions, coachingSessionNotes, coachingStrategicGoals, coachingQuarterlyObjectives, coachingActions,
  financialClarityReviews,
  type ReportClient, type InsertReportClient,
  type StrategicPlan, type InsertStrategicPlan,
  type ManagementReportPeriod, type InsertManagementReportPeriod,
  type ManagementReport, type InsertManagementReport,
  type ReportStructure, type InsertReportStructure,
  type CoachingClient, type InsertCoachingClient,
  type CoachingSession, type InsertCoachingSession,
  type CoachingSessionNote, type InsertCoachingSessionNote,
  type CoachingStrategicGoal, type InsertCoachingStrategicGoal,
  type CoachingQuarterlyObjective, type InsertCoachingQuarterlyObjective,
  type CoachingAction, type InsertCoachingAction,
  type FinancialClarityReview, type InsertFinancialClarityReview,
  type Organisation, type InsertOrganisation,
  type User, type UpsertUser,
  type Team, type WeeklyTarget, type WeeklyResult, type AccountsDue,
  type VatTarget, type VatResult, type VatDue, type VatTurnoverChecks,
  type HealthChecksTarget, type HealthChecksResult, type HealthChecksDue,
  type MbsResult, type MbsDextPrecision, type MbsOldestItems,
  type ClientBookkeepingResult, type ClientDextPrecision, type ClientOldestItems,
  type ConfirmationStatementsTarget, type ConfirmationStatementsResult, type ConfirmationStatementsDue, type ConfirmationStatementTurnaround,
  type TaxData,
  type RevenueAnalyticsTarget, type RevenueAnalyticsResult,
  type RiskAnalysis, type ActionRecommendation, type ClarifyingQuestion, type TeamResponse, type AnalysisComment,
  type QuarterlyGoal, type QuarterlyTarget, type Value, type RockReminderDismissal,
  type ClientValueClient, type InsertClientValueClient,
  type InsertTeam, type InsertWeeklyTarget, type InsertWeeklyResult, type InsertAccountsDue,
  type InsertVatTarget, type InsertVatResult, type InsertVatDue, type InsertVatTurnoverChecks,
  type InsertHealthChecksTarget, type InsertHealthChecksResult, type InsertHealthChecksDue,
  type InsertMbsResult, type InsertMbsDextPrecision, type InsertMbsOldestItems,
  type InsertClientBookkeepingResult, type InsertClientDextPrecision, type InsertClientOldestItems,
  type InsertConfirmationStatementsTarget, type InsertConfirmationStatementsResult, type InsertConfirmationStatementsDue, type InsertConfirmationStatementTurnaround,
  type InsertTaxData,
  type InsertRevenueAnalyticsTarget, type InsertRevenueAnalyticsResult,
  type InsertRiskAnalysis, type InsertActionRecommendation, type InsertClarifyingQuestion, type InsertTeamResponse, type InsertAnalysisComment,
  type InsertQuarterlyGoal, type InsertQuarterlyTarget, type InsertValue, type InsertRockReminderDismissal,
  type InsertUser,
  userTeams, type UserTeam, type InsertUserTeam,
  waitlistRegistrations, type WaitlistRegistration, type InsertWaitlistRegistration,
  valuationSubmissions, type ValuationSubmission,
  valuationEvents,
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, desc, and, lte, isNull, sql } from "drizzle-orm";
import { getCurrentTaxYear } from "./tax-year-utils";
import { getCacheKey, getFromCache, setInCache, invalidateCache } from "./cache";

export interface IStorage {
  // Organisation operations
  createOrganisation(org: InsertOrganisation): Promise<Organisation>;
  getOrganisation(id: number): Promise<Organisation | undefined>;
  getOrganisationBySlug(slug: string): Promise<Organisation | undefined>;
  getAllOrganisations(): Promise<Organisation[]>;
  updateOrganisation(id: number, data: Partial<InsertOrganisation>): Promise<Organisation | undefined>;
  deleteOrganisation(id: number): Promise<void>;
  getOrganisationsWithStats(): Promise<Array<Organisation & { userCount: number; clientCount: number }>>;
  createOrganisationWithAdmin(orgData: { name: string; slug: string }, adminData: { email: string; password: string; firstName: string; lastName: string }): Promise<{ org: Organisation; user: User }>;
  completeOnboarding(orgId: number): Promise<void>;

  // User operations (for local auth)
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByInvitationToken(token: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  setPasswordResetToken(email: string, token: string, expires: Date): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<User | undefined>;
  completeInvitation(token: string, password: string): Promise<User | undefined>;
  createUser(userData: InsertUser): Promise<User>;
  createUserInvitation(userData: Partial<InsertUser>): Promise<User>;
  reissueUserInvitation(id: number, userData: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(orgId?: number): Promise<User[]>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;
  
  // Teams
  getAllTeams(orgId?: number): Promise<Team[]>;
  getTeam(id: number): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: number, team: Partial<InsertTeam>): Promise<Team | undefined>;
  deleteTeam(id: number): Promise<void>;
  
  // User-Team mappings
  getUserTeams(userId: number): Promise<UserTeam[]>;
  getTeamUsers(teamId: number): Promise<UserTeam[]>;
  addUserToTeam(mapping: InsertUserTeam): Promise<UserTeam>;
  removeUserFromTeam(userId: number, teamId: number): Promise<void>;
  isUserInTeam(userId: number, teamId: number): Promise<boolean>;
  
  // Weekly Targets
  getWeeklyTarget(teamId: number, weekEnding: string): Promise<WeeklyTarget | undefined>;
  getAllWeeklyTargets(teamId?: number, orgId?: number): Promise<WeeklyTarget[]>;
  createWeeklyTarget(target: InsertWeeklyTarget): Promise<WeeklyTarget>;
  updateWeeklyTarget(teamId: number, weekEnding: string, target: Partial<InsertWeeklyTarget>): Promise<WeeklyTarget | undefined>;
  
  // Weekly Results
  getWeeklyResult(teamId: number, weekEnding: string): Promise<WeeklyResult | undefined>;
  getAllWeeklyResults(teamId?: number, orgId?: number): Promise<WeeklyResult[]>;
  createWeeklyResult(result: InsertWeeklyResult): Promise<WeeklyResult>;
  updateWeeklyResult(teamId: number, weekEnding: string, result: Partial<InsertWeeklyResult>): Promise<WeeklyResult | undefined>;
  deleteWeeklyResult(id: number): Promise<void>;
  
  // Accounts Due
  getAccountsDue(teamId: number, weekEnding: string): Promise<AccountsDue | undefined>;
  getAllAccountsDue(teamId?: number, orgId?: number): Promise<AccountsDue[]>;
  createAccountsDue(accountsDue: InsertAccountsDue): Promise<AccountsDue>;
  updateAccountsDue(teamId: number, weekEnding: string, accountsDue: Partial<InsertAccountsDue>): Promise<AccountsDue | undefined>;
  
  // Health Checks Targets
  getHealthChecksTarget(teamId: number, weekEnding: string): Promise<HealthChecksTarget | undefined>;
  getAllHealthChecksTargets(teamId?: number, orgId?: number): Promise<HealthChecksTarget[]>;
  createHealthChecksTarget(target: InsertHealthChecksTarget): Promise<HealthChecksTarget>;
  updateHealthChecksTarget(teamId: number, weekEnding: string, target: Partial<InsertHealthChecksTarget>): Promise<HealthChecksTarget | undefined>;
  
  // Health Checks Results
  getHealthChecksResult(teamId: number, weekEnding: string): Promise<HealthChecksResult | undefined>;
  getAllHealthChecksResults(teamId?: number, orgId?: number): Promise<HealthChecksResult[]>;
  createHealthChecksResult(result: InsertHealthChecksResult): Promise<HealthChecksResult>;
  updateHealthChecksResult(teamId: number, weekEnding: string, result: Partial<InsertHealthChecksResult>): Promise<HealthChecksResult | undefined>;
  
  // Health Checks Due
  getHealthChecksDue(teamId: number, weekEnding: string): Promise<HealthChecksDue | undefined>;
  getAllHealthChecksDue(teamId?: number, orgId?: number): Promise<HealthChecksDue[]>;
  createHealthChecksDue(healthChecksDue: InsertHealthChecksDue): Promise<HealthChecksDue>;
  updateHealthChecksDue(teamId: number, weekEnding: string, healthChecksDue: Partial<InsertHealthChecksDue>): Promise<HealthChecksDue | undefined>;
  
  // VAT Due
  getVatDue(teamId: number, weekEnding: string, quarterEnding: string): Promise<VatDue | undefined>;
  getAllVatDue(teamId?: number, orgId?: number): Promise<VatDue[]>;
  createVatDue(vatDue: InsertVatDue): Promise<VatDue>;
  updateVatDue(teamId: number, weekEnding: string, quarterEnding: string, vatDue: Partial<InsertVatDue>): Promise<VatDue | undefined>;
  deleteVatDue(id: number): Promise<void>;
  
  // VAT Turnover Checks
  getVatTurnoverChecks(teamId: number, weekEnding: string): Promise<VatTurnoverChecks | undefined>;
  getAllVatTurnoverChecks(teamId?: number, orgId?: number): Promise<VatTurnoverChecks[]>;
  createVatTurnoverChecks(vatTurnoverChecks: InsertVatTurnoverChecks): Promise<VatTurnoverChecks>;
  updateVatTurnoverChecks(teamId: number, weekEnding: string, vatTurnoverChecks: Partial<InsertVatTurnoverChecks>): Promise<VatTurnoverChecks | undefined>;
  updateVatTurnoverChecksById(id: number, vatTurnoverChecks: Partial<InsertVatTurnoverChecks>): Promise<VatTurnoverChecks | undefined>;
  deleteVatTurnoverChecks(id: number): Promise<void>;
  
  // MBS Results  
  getMbsResult(teamId: number, weekEnding: string): Promise<MbsResult | undefined>;
  getAllMbsResults(teamId?: number, orgId?: number): Promise<MbsResult[]>;
  createMbsResult(result: InsertMbsResult): Promise<MbsResult>;
  deleteMbsResult(id: number): Promise<void>;
  
  // MBS Dext Precision
  getMbsDextPrecision(teamId: number, weekEnding: string): Promise<MbsDextPrecision | undefined>;
  getAllMbsDextPrecision(teamId?: number, orgId?: number): Promise<MbsDextPrecision[]>;
  createMbsDextPrecision(mbsDextPrecision: InsertMbsDextPrecision): Promise<MbsDextPrecision>;
  updateMbsDextPrecision(teamId: number, weekEnding: string, mbsDextPrecision: Partial<InsertMbsDextPrecision>): Promise<MbsDextPrecision | undefined>;
  deleteMbsDextPrecision(id: number): Promise<void>;
  
  // MBS Oldest Items
  getMbsOldestItems(teamId: number, weekEnding: string): Promise<MbsOldestItems | undefined>;
  getAllMbsOldestItems(teamId?: number, orgId?: number): Promise<MbsOldestItems[]>;
  createMbsOldestItems(mbsOldestItems: InsertMbsOldestItems): Promise<MbsOldestItems>;
  updateMbsOldestItems(teamId: number, weekEnding: string, mbsOldestItems: Partial<InsertMbsOldestItems>): Promise<MbsOldestItems | undefined>;
  deleteMbsOldestItems(id: number): Promise<void>;
  
  // Client Bookkeeping Results
  getClientBookkeepingResult(teamId: number, weekEnding: string): Promise<ClientBookkeepingResult | undefined>;
  getAllClientBookkeepingResults(teamId?: number, orgId?: number): Promise<ClientBookkeepingResult[]>;
  createClientBookkeepingResult(result: InsertClientBookkeepingResult): Promise<ClientBookkeepingResult>;
  deleteClientBookkeepingResult(id: number): Promise<void>;
  
  // Client Dext Precision
  getClientDextPrecision(teamId: number, weekEnding: string): Promise<ClientDextPrecision | undefined>;
  getAllClientDextPrecision(teamId?: number, orgId?: number): Promise<ClientDextPrecision[]>;
  createClientDextPrecision(clientDextPrecision: InsertClientDextPrecision): Promise<ClientDextPrecision>;
  updateClientDextPrecision(teamId: number, weekEnding: string, clientDextPrecision: Partial<InsertClientDextPrecision>): Promise<ClientDextPrecision | undefined>;
  deleteClientDextPrecision(id: number): Promise<void>;
  
  // Client Oldest Items
  getClientOldestItems(teamId: number, weekEnding: string): Promise<ClientOldestItems | undefined>;
  getAllClientOldestItems(teamId?: number, orgId?: number): Promise<ClientOldestItems[]>;
  createClientOldestItems(clientOldestItems: InsertClientOldestItems): Promise<ClientOldestItems>;
  updateClientOldestItems(teamId: number, weekEnding: string, clientOldestItems: Partial<InsertClientOldestItems>): Promise<ClientOldestItems | undefined>;
  deleteClientOldestItems(id: number): Promise<void>;

  // Confirmation Statements Targets
  getConfirmationStatementsTarget(teamId: number, weekEnding: string): Promise<ConfirmationStatementsTarget | undefined>;
  getAllConfirmationStatementsTargets(teamId?: number, orgId?: number): Promise<ConfirmationStatementsTarget[]>;
  createConfirmationStatementsTarget(target: InsertConfirmationStatementsTarget): Promise<ConfirmationStatementsTarget>;
  updateConfirmationStatementsTarget(teamId: number, weekEnding: string, target: Partial<InsertConfirmationStatementsTarget>): Promise<ConfirmationStatementsTarget | undefined>;

  // Confirmation Statements Results
  getConfirmationStatementsResult(teamId: number, weekEnding: string): Promise<ConfirmationStatementsResult | undefined>;
  getAllConfirmationStatementsResults(teamId?: number, orgId?: number): Promise<ConfirmationStatementsResult[]>;
  createConfirmationStatementsResult(result: InsertConfirmationStatementsResult): Promise<ConfirmationStatementsResult>;
  updateConfirmationStatementsResult(teamId: number, weekEnding: string, result: Partial<InsertConfirmationStatementsResult>): Promise<ConfirmationStatementsResult | undefined>;

  // Confirmation Statements Due
  getConfirmationStatementsDue(teamId: number, weekEnding: string): Promise<ConfirmationStatementsDue | undefined>;
  getAllConfirmationStatementsDue(teamId?: number, orgId?: number): Promise<ConfirmationStatementsDue[]>;
  createConfirmationStatementsDue(confirmationStatementsDue: InsertConfirmationStatementsDue): Promise<ConfirmationStatementsDue>;
  updateConfirmationStatementsDue(teamId: number, weekEnding: string, confirmationStatementsDue: Partial<InsertConfirmationStatementsDue>): Promise<ConfirmationStatementsDue | undefined>;

  // Confirmation Statement Turnaround
  getConfirmationStatementTurnaround(teamId: number, weekEnding: string): Promise<ConfirmationStatementTurnaround | undefined>;
  getAllConfirmationStatementTurnaround(teamId?: number, orgId?: number): Promise<any[]>;
  createConfirmationStatementTurnaround(turnaround: InsertConfirmationStatementTurnaround): Promise<ConfirmationStatementTurnaround>;
  updateConfirmationStatementTurnaround(teamId: number, weekEnding: string, turnaround: Partial<InsertConfirmationStatementTurnaround>): Promise<ConfirmationStatementTurnaround | undefined>;
  deleteConfirmationStatementTurnaround(teamId: number, weekEnding: string): Promise<void>;
  
  // Tax Data
  getTaxData(teamId: number, weekEnding: string): Promise<TaxData | undefined>;
  getAllTaxData(teamId?: number, orgId?: number): Promise<TaxData[]>;
  createTaxData(taxData: InsertTaxData): Promise<TaxData>;
  updateTaxData(teamId: number, weekEnding: string, taxData: Partial<InsertTaxData>): Promise<TaxData | undefined>;
  deleteTaxData(teamId: number, weekEnding: string): Promise<void>;
  
  // Revenue Analytics Targets
  getRevenueAnalyticsTarget(teamId: number, weekEnding: string): Promise<RevenueAnalyticsTarget | undefined>;
  getAllRevenueAnalyticsTargets(teamId?: number, orgId?: number): Promise<RevenueAnalyticsTarget[]>;
  createRevenueAnalyticsTarget(target: InsertRevenueAnalyticsTarget): Promise<RevenueAnalyticsTarget>;
  updateRevenueAnalyticsTarget(teamId: number, weekEnding: string, target: Partial<InsertRevenueAnalyticsTarget>): Promise<RevenueAnalyticsTarget | undefined>;
  deleteRevenueAnalyticsTarget(teamId: number, weekEnding: string): Promise<void>;
  
  // Revenue Analytics Results
  getRevenueAnalyticsResult(teamId: number, weekEnding: string): Promise<RevenueAnalyticsResult | undefined>;
  getAllRevenueAnalyticsResults(teamId?: number, orgId?: number): Promise<RevenueAnalyticsResult[]>;
  createRevenueAnalyticsResult(result: InsertRevenueAnalyticsResult): Promise<RevenueAnalyticsResult>;
  updateRevenueAnalyticsResult(teamId: number, weekEnding: string, result: Partial<InsertRevenueAnalyticsResult>): Promise<RevenueAnalyticsResult | undefined>;
  deleteRevenueAnalyticsResult(teamId: number, weekEnding: string): Promise<void>;
  
  // Revenue Analytics Performance Data
  getRevenueAnalyticsPerformanceData(teamId?: number, orgId?: number): Promise<Array<{
    teamId: number;
    teamName: string;
    weekEnding: string;
    targets: RevenueAnalyticsTarget | null;
    results: RevenueAnalyticsResult | null;
    calculatedMRR: number | null;
  }>>;
  
  // Tax calculations
  getTaxYearCumulativeTotal(teamId: number, weekEnding: string, taxYearStart: string): Promise<number>;
  getTaxYearProgressData(teamId?: number, orgId?: number): Promise<Array<{
    teamId: number;
    teamName: string;
    weekEnding: string;
    completedThisWeek: number;
    cumulativeCompleted: number;
    totalTarget: number;
    percentageComplete: number;
    taxYearStart: string;
  }>>;
  
  // Combined data for dashboard with 4-week rolling calculations
  getTeamPerformanceData(teamId?: number, orgId?: number): Promise<Array<{
    teamId: number;
    teamName: string;
    weekEnding: string;
    rollingFourWeekTarget: number | null;
    rollingFourWeekActual: number | null;
    weeklyActual: number | null;
    accountsDue: number | null;
  }>>;
  
  // Health Checks dashboard data
  getHealthChecksPerformanceData(teamId?: number, orgId?: number): Promise<Array<{
    teamId: number;
    teamName: string;
    weekEnding: string;
    rollingFourWeekTarget: number | null;
    rollingFourWeekActual: number | null;
    weeklyActual: number | null;
    healthChecksDue: number | null;
  }>>;

  // Risk Analyses
  getAllRiskAnalyses(orgId?: number, teamId?: number): Promise<RiskAnalysis[]>;
  getRiskAnalysis(id: number): Promise<RiskAnalysis | undefined>;
  createRiskAnalysis(analysis: InsertRiskAnalysis): Promise<RiskAnalysis>;
  getLatestRiskAnalysis(moduleType: string, teamId?: number): Promise<RiskAnalysis | undefined>;

  // Action Recommendations
  getAllActionRecommendations(riskAnalysisId?: number, orgId?: number): Promise<ActionRecommendation[]>;
  getActionRecommendation(id: number): Promise<ActionRecommendation | undefined>;
  createActionRecommendation(recommendation: InsertActionRecommendation): Promise<ActionRecommendation>;
  updateActionRecommendation(id: number, recommendation: Partial<InsertActionRecommendation>): Promise<ActionRecommendation | undefined>;

  // Clarifying Questions
  getAllClarifyingQuestions(riskAnalysisId?: number, orgId?: number): Promise<ClarifyingQuestion[]>;
  getClarifyingQuestion(id: number): Promise<ClarifyingQuestion | undefined>;
  createClarifyingQuestion(question: InsertClarifyingQuestion): Promise<ClarifyingQuestion>;
  updateClarifyingQuestion(id: number, question: Partial<InsertClarifyingQuestion>): Promise<ClarifyingQuestion | undefined>;

  // Team Responses
  getAllTeamResponses(questionId?: number): Promise<TeamResponse[]>;
  getTeamResponse(id: number): Promise<TeamResponse | undefined>;
  createTeamResponse(response: InsertTeamResponse): Promise<TeamResponse>;

  // Analysis Comments
  getAllAnalysisComments(riskAnalysisId: number): Promise<AnalysisComment[]>;
  getAnalysisComment(id: number): Promise<AnalysisComment | undefined>;
  createAnalysisComment(comment: InsertAnalysisComment): Promise<AnalysisComment>;
  updateAnalysisComment(id: number, comment: Partial<InsertAnalysisComment>): Promise<AnalysisComment | undefined>;
  deleteAnalysisComment(id: number): Promise<void>;

  // Quarterly Goals
  getAllQuarterlyGoals(orgId?: number): Promise<QuarterlyGoal[]>;
  getQuarterlyGoal(id: number): Promise<QuarterlyGoal | undefined>;
  createQuarterlyGoal(goal: InsertQuarterlyGoal): Promise<QuarterlyGoal>;
  updateQuarterlyGoal(id: number, goal: Partial<InsertQuarterlyGoal>): Promise<QuarterlyGoal | undefined>;
  deleteQuarterlyGoal(id: number): Promise<void>;

  // Quarterly Targets
  getAllQuarterlyTargets(quarterlyGoalId?: number, orgId?: number): Promise<QuarterlyTarget[]>;
  getQuarterlyTarget(id: number): Promise<QuarterlyTarget | undefined>;
  createQuarterlyTarget(target: InsertQuarterlyTarget): Promise<QuarterlyTarget>;
  updateQuarterlyTarget(id: number, target: Partial<InsertQuarterlyTarget>): Promise<QuarterlyTarget | undefined>;
  deleteQuarterlyTarget(id: number): Promise<void>;

  // Rock Reminder Dismissals
  getRockReminderDismissals(userId: number): Promise<RockReminderDismissal[]>;
  createRockReminderDismissal(dismissal: InsertRockReminderDismissal): Promise<RockReminderDismissal>;

  // Values
  getAllValues(orgId?: number): Promise<Value[]>;
  getValue(id: number): Promise<Value | undefined>;
  createValue(value: InsertValue): Promise<Value>;
  updateValue(id: number, value: Partial<InsertValue>): Promise<Value | undefined>;
  deleteValue(id: number): Promise<void>;

  // Client Value Manager
  getAllClientValueClients(teamId?: number, orgId?: number, archivedOnly?: boolean): Promise<ClientValueClient[]>;
  getClientValueClient(id: number): Promise<ClientValueClient | undefined>;
  createClientValueClient(client: InsertClientValueClient): Promise<ClientValueClient>;
  updateClientValueClient(id: number, client: Partial<InsertClientValueClient>): Promise<ClientValueClient | undefined>;
  deleteClientValueClient(id: number): Promise<void>;

  // Waitlist operations
  createWaitlistRegistration(data: InsertWaitlistRegistration): Promise<WaitlistRegistration>;
  getWaitlistRegistrationByEmail(email: string): Promise<WaitlistRegistration | undefined>;
  getAllWaitlistRegistrations(): Promise<WaitlistRegistration[]>;
  deleteWaitlistRegistration(id: number): Promise<void>;

  // Valuation operations
  createValuationSubmission(data: Omit<ValuationSubmission, 'id' | 'createdAt' | 'webhookSent' | 'webhookSentAt'>): Promise<ValuationSubmission>;
  getValuationSubmission(id: number): Promise<ValuationSubmission | undefined>;
  updateValuationSubmission(id: number, data: Partial<ValuationSubmission>): Promise<ValuationSubmission | undefined>;
  getAllValuationSubmissions(): Promise<ValuationSubmission[]>;
  logValuationEvent(submissionId: number | null, eventType: string): Promise<void>;
  deleteValuationSubmission(id: number): Promise<void>;
  getConfirmedValuationBenchmarks(): Promise<{ count: number; avgMid: number; avgGrf: number; avgEbitda: number; topAction: string | null }>;

  // Management Reports - Report Clients
  getAllReportClients(orgId: number): Promise<ReportClient[]>;
  getReportClient(id: number): Promise<ReportClient | undefined>;
  createReportClient(client: InsertReportClient): Promise<ReportClient>;
  updateReportClient(id: number, client: Partial<InsertReportClient>): Promise<ReportClient | undefined>;
  deleteReportClient(id: number): Promise<void>;

  // Management Reports - Strategic Plans
  getStrategicPlanForClient(clientId: number): Promise<StrategicPlan | undefined>;
  getStrategicPlan(id: number): Promise<StrategicPlan | undefined>;
  upsertStrategicPlan(data: InsertStrategicPlan): Promise<StrategicPlan>;

  // Management Reports - Periods
  createManagementReportPeriod(period: InsertManagementReportPeriod): Promise<ManagementReportPeriod>;

  // Management Reports - Reports
  getAllReportsForClient(clientId: number, orgId: number): Promise<Array<ManagementReport & { period: ManagementReportPeriod }>>;
  getManagementReport(id: number): Promise<(ManagementReport & { period: ManagementReportPeriod; client: ReportClient }) | undefined>;
  createManagementReport(report: InsertManagementReport): Promise<ManagementReport>;
  updateManagementReport(id: number, data: Partial<InsertManagementReport>): Promise<ManagementReport | undefined>;

  // Management Reports - Structures
  getReportStructureForClient(clientId: number): Promise<ReportStructure | undefined>;
  upsertReportStructure(data: Partial<InsertReportStructure> & { clientId: number; organisationId: number }): Promise<ReportStructure>;
  approveReportStructure(id: number): Promise<ReportStructure | undefined>;

  // Coaching Clients
  getAllCoachingClients(orgId: number): Promise<CoachingClient[]>;
  getCoachingLastSessionDates(orgId: number): Promise<Record<number, string>>;
  getCoachingClient(id: number): Promise<CoachingClient | undefined>;
  getCoachingClientByLinkedUser(userId: number): Promise<CoachingClient | undefined>;
  createCoachingClient(data: InsertCoachingClient): Promise<CoachingClient>;
  updateCoachingClient(id: number, data: Partial<InsertCoachingClient>): Promise<CoachingClient | undefined>;
  deleteCoachingClient(id: number): Promise<void>;

  // Coaching Session Notes
  getAllCoachingSessionNotes(clientId: number, sharedOnly?: boolean): Promise<CoachingSessionNote[]>;
  getCoachingSessionNote(id: number): Promise<CoachingSessionNote | undefined>;
  createCoachingSessionNote(data: InsertCoachingSessionNote): Promise<CoachingSessionNote>;
  updateCoachingSessionNote(id: number, data: Partial<InsertCoachingSessionNote>): Promise<CoachingSessionNote | undefined>;
  deleteCoachingSessionNote(id: number): Promise<void>;

  // Coaching Strategic Goals
  getAllCoachingStrategicGoals(clientId: number): Promise<CoachingStrategicGoal[]>;
  getCoachingStrategicGoal(id: number): Promise<CoachingStrategicGoal | undefined>;
  createCoachingStrategicGoal(data: InsertCoachingStrategicGoal): Promise<CoachingStrategicGoal>;
  updateCoachingStrategicGoal(id: number, data: Partial<InsertCoachingStrategicGoal>): Promise<CoachingStrategicGoal | undefined>;
  deleteCoachingStrategicGoal(id: number): Promise<void>;

  // Coaching Quarterly Objectives
  getAllCoachingQuarterlyObjectives(clientId: number, quarter?: number, year?: number): Promise<CoachingQuarterlyObjective[]>;
  getCoachingQuarterlyObjective(id: number): Promise<CoachingQuarterlyObjective | undefined>;
  createCoachingQuarterlyObjective(data: InsertCoachingQuarterlyObjective): Promise<CoachingQuarterlyObjective>;
  updateCoachingQuarterlyObjective(id: number, data: Partial<InsertCoachingQuarterlyObjective>): Promise<CoachingQuarterlyObjective | undefined>;
  deleteCoachingQuarterlyObjective(id: number): Promise<void>;
  carryForwardCoachingObjective(id: number): Promise<CoachingQuarterlyObjective>;

  // Coaching Sessions
  getAllCoachingSessions(clientId: number, sharedOnly?: boolean): Promise<CoachingSession[]>;
  getCoachingSession(id: number): Promise<CoachingSession | undefined>;
  getOrCreateOpenSession(orgId: number, clientId: number, sessionDate: string): Promise<CoachingSession>;
  createCoachingSession(data: InsertCoachingSession): Promise<CoachingSession>;
  updateCoachingSession(id: number, data: Partial<InsertCoachingSession>): Promise<CoachingSession | undefined>;

  // Coaching Actions
  getAllCoachingActions(clientId: number, ownerFilter?: string): Promise<CoachingAction[]>;
  getCoachingAction(id: number): Promise<CoachingAction | undefined>;
  createCoachingAction(data: InsertCoachingAction): Promise<CoachingAction>;
  updateCoachingAction(id: number, data: Partial<InsertCoachingAction>): Promise<CoachingAction | undefined>;
  carryForwardCoachingAction(actionId: number, toSessionId: number): Promise<CoachingAction>;
  deleteCoachingAction(id: number): Promise<void>;

  // Financial Clarity Review
  getAllFinancialClarityReviews(orgId: number): Promise<FinancialClarityReview[]>;
  getFinancialClarityReview(id: number): Promise<FinancialClarityReview | undefined>;
  createFinancialClarityReview(data: InsertFinancialClarityReview): Promise<FinancialClarityReview>;
  updateFinancialClarityReview(id: number, data: Partial<InsertFinancialClarityReview>): Promise<FinancialClarityReview | undefined>;
  deleteFinancialClarityReview(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Organisation operations
  async createOrganisation(org: InsertOrganisation): Promise<Organisation> {
    const [newOrg] = await db.insert(organisations).values({
      ...org,
      updatedAt: new Date(),
    }).returning();
    return newOrg;
  }

  async getOrganisation(id: number): Promise<Organisation | undefined> {
    const [org] = await db.select().from(organisations).where(eq(organisations.id, id));
    return org || undefined;
  }

  async getOrganisationBySlug(slug: string): Promise<Organisation | undefined> {
    const [org] = await db.select().from(organisations).where(eq(organisations.slug, slug));
    return org || undefined;
  }

  async getAllOrganisations(): Promise<Organisation[]> {
    return await db.select().from(organisations).orderBy(organisations.name);
  }

  async updateOrganisation(id: number, data: Partial<InsertOrganisation>): Promise<Organisation | undefined> {
    const [updated] = await db.update(organisations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organisations.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteOrganisation(id: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Discover which tables actually exist — never fail on a missing table
      const tablesRes = await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
      );
      const has = new Set(tablesRes.rows.map((r) => r.table_name));

      const delByOrg = async (table: string) => {
        if (has.has(table)) {
          await client.query(`DELETE FROM ${table} WHERE organisation_id = $1`, [id]);
        }
      };

      // Step 1: team_responses links via question_id → clarifying_questions AND team_id → teams
      // Must be deleted before clarifying_questions and before teams
      if (has.has('team_responses')) {
        await client.query(
          `DELETE FROM team_responses WHERE team_id IN (SELECT id FROM teams WHERE organisation_id = $1)`,
          [id]
        );
      }

      // Step 2: All tables with a direct organisation_id (and a secondary team_id FK)
      const directOrgTables = [
        'weekly_targets', 'weekly_results', 'accounts_due',
        'vat_targets', 'vat_results', 'vat_due', 'vat_turnover_checks',
        'health_checks_targets', 'health_checks_results', 'health_checks_due',
        'mbs_dext_precision', 'mbs_oldest_items', 'mbs_results',
        'client_dext_precision', 'client_oldest_items', 'client_bookkeeping_results',
        'confirmation_statements_targets', 'confirmation_statements_results',
        'confirmation_statements_due', 'confirmation_statement_turnaround',
        'tax_data',
        'revenue_analytics_targets', 'revenue_analytics_results',
        'client_value_clients',
        'values',
      ];
      for (const table of directOrgTables) {
        await delByOrg(table);
      }

      // Step 3: Risk analysis chain
      // clarifying_questions, analysis_comments, action_recommendations → risk_analyses
      if (has.has('clarifying_questions') && has.has('risk_analyses')) {
        await client.query(
          `DELETE FROM clarifying_questions WHERE risk_analysis_id IN (SELECT id FROM risk_analyses WHERE organisation_id = $1)`,
          [id]
        );
      }
      if (has.has('analysis_comments') && has.has('risk_analyses')) {
        await client.query(
          `DELETE FROM analysis_comments WHERE risk_analysis_id IN (SELECT id FROM risk_analyses WHERE organisation_id = $1)`,
          [id]
        );
      }
      if (has.has('action_recommendations') && has.has('risk_analyses')) {
        await client.query(
          `DELETE FROM action_recommendations WHERE risk_analysis_id IN (SELECT id FROM risk_analyses WHERE organisation_id = $1)`,
          [id]
        );
      }
      await delByOrg('risk_analyses');

      // Step 4: rock_reminder_dismissals has FK to both users AND quarterly_goals — delete before both
      if (has.has('rock_reminder_dismissals')) {
        await client.query(
          `DELETE FROM rock_reminder_dismissals
           WHERE user_id IN (SELECT id FROM users WHERE organisation_id = $1)
              OR quarterly_goal_id IN (SELECT id FROM quarterly_goals WHERE organisation_id = $1)`,
          [id]
        );
      }

      // Step 5: quarterly_targets has organisation_id directly AND FK to quarterly_goals AND to users
      // Delete before quarterly_goals and before users
      await delByOrg('quarterly_targets');
      await delByOrg('quarterly_goals');

      // Step 6: user_teams has FK to both users and teams — delete before both
      if (has.has('user_teams')) {
        await client.query(
          `DELETE FROM user_teams WHERE user_id IN (SELECT id FROM users WHERE organisation_id = $1)`,
          [id]
        );
      }

      // Step 7: users, teams, then the org itself
      await client.query(`DELETE FROM users WHERE organisation_id = $1`, [id]);
      await client.query(`DELETE FROM teams WHERE organisation_id = $1`, [id]);
      await client.query(`DELETE FROM organisations WHERE id = $1`, [id]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getOrganisationsWithStats(): Promise<Array<Organisation & { userCount: number; clientCount: number }>> {
    const allOrgs = await db.select().from(organisations).orderBy(organisations.createdAt);
    const results = await Promise.all(allOrgs.map(async (org) => {
      const orgUsers = await db.select().from(users).where(eq(users.organisationId, org.id));
      const orgClients = await db.select().from(clientValueClients).where(eq(clientValueClients.organisationId, org.id));
      return { ...org, userCount: orgUsers.length, clientCount: orgClients.length };
    }));
    return results;
  }

  async createOrganisationWithAdmin(
    orgData: { name: string; slug: string },
    adminData: { email: string; password: string; firstName: string; lastName: string }
  ): Promise<{ org: Organisation; user: User }> {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14-day free trial

    const [org] = await db.insert(organisations).values({
      name: orgData.name,
      slug: orgData.slug,
      subscriptionStatus: 'trialling',
      isSuspended: false,
      isOnboardingComplete: false,
      trialEndsAt,
      updatedAt: new Date(),
    }).returning();

    const [newUser] = await db.insert(users).values({
      organisationId: org.id,
      email: adminData.email,
      password: adminData.password,
      firstName: adminData.firstName,
      lastName: adminData.lastName,
      role: 'admin',
      isActive: true,
      updatedAt: new Date(),
    }).returning();

    return { org, user: newUser };
  }

  async completeOnboarding(orgId: number): Promise<void> {
    await db.update(organisations)
      .set({ isOnboardingComplete: true, updatedAt: new Date() })
      .where(eq(organisations.id, orgId));
  }

  // User operations for local authentication
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByInvitationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.invitationToken, token));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async createUserInvitation(userData: Partial<InsertUser>): Promise<User> {
    // Generate invitation token
    const invitationToken = randomBytes(32).toString('hex');
    const invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [user] = await db
      .insert(users)
      .values({
        organisationId: userData.organisationId,
        email: userData.email!,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role || 'user',
        invitationToken,
        invitationExpires,
        isActive: false, // Inactive until password is set
      })
      .returning();
    return user;
  }

  async reissueUserInvitation(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const invitationToken = randomBytes(32).toString('hex');
    const invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [user] = await db
      .update(users)
      .set({
        organisationId: userData.organisationId,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role || 'user',
        invitationToken,
        invitationExpires,
        isActive: false,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), isNull(users.organisationId)))
      .returning();

    return user;
  }

  async getAllUsers(orgId?: number): Promise<User[]> {
    if (orgId) {
      return await db.select().from(users).where(eq(users.organisationId, orgId));
    }
    return await db.select().from(users);
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: number): Promise<void> {
    // Clear FK references before deleting the user (historic data referencing the
    // user via plain, non-FK columns like `submitted_by` is intentionally left
    // untouched so past entries remain intact after the user is removed).
    await db.delete(userTeams).where(eq(userTeams.userId, id));
    await db.execute(sql`DELETE FROM rock_reminder_dismissals WHERE user_id = ${id}`);
    await db.execute(sql`UPDATE quarterly_targets SET person_responsible = NULL WHERE person_responsible = ${id}`);
    await db.execute(sql`UPDATE coaching_clients SET linked_user_id = NULL, portal_enabled = false WHERE linked_user_id = ${id}`);
    await db.delete(users).where(eq(users.id, id));
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.resetToken, token));
    return user || undefined;
  }

  async setPasswordResetToken(email: string, token: string, expires: Date): Promise<void> {
    await db.update(users)
      .set({ 
        resetToken: token, 
        resetExpires: expires,
        updatedAt: new Date()
      })
      .where(eq(users.email, email));
  }

  async resetPassword(token: string, newPassword: string): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ 
        password: newPassword,
        resetToken: null,
        resetExpires: null,
        passwordSetAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.resetToken, token))
      .returning();
    return user || undefined;
  }

  async completeInvitation(token: string, password: string): Promise<User | undefined> {
    // First check if the invitation token is valid and not expired
    const invitedUser = await this.getUserByInvitationToken(token);
    if (!invitedUser || !invitedUser.invitationExpires) {
      return undefined;
    }

    // Check if invitation has expired
    if (new Date() > invitedUser.invitationExpires) {
      return undefined;
    }

    // Complete the invitation by setting password and activating account
    const { hashPassword } = await import("./auth");
    const hashedPassword = await hashPassword(password);
    
    const [user] = await db.update(users)
      .set({ 
        password: hashedPassword,
        invitationToken: null,
        invitationExpires: null,
        isActive: true,
        passwordSetAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.invitationToken, token))
      .returning();
    return user || undefined;
  }

  // Teams
  async getAllTeams(orgId?: number): Promise<Team[]> {
    if (orgId) {
      return await db.select().from(teams)
        .where(eq(teams.organisationId, orgId))
        .orderBy(teams.name);
    }
    return await db.select().from(teams).orderBy(teams.name);
  }

  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team || undefined;
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [newTeam] = await db.insert(teams).values(team).returning();
    return newTeam;
  }

  async updateTeam(id: number, team: Partial<InsertTeam>): Promise<Team | undefined> {
    const [updatedTeam] = await db
      .update(teams)
      .set(team)
      .where(eq(teams.id, id))
      .returning();
    return updatedTeam || undefined;
  }

  async deleteTeam(id: number): Promise<void> {
    await db.delete(teams).where(eq(teams.id, id));
  }

  // User-Team mappings
  async getUserTeams(userId: number): Promise<UserTeam[]> {
    return await db.select().from(userTeams).where(eq(userTeams.userId, userId));
  }

  async getTeamUsers(teamId: number): Promise<UserTeam[]> {
    return await db.select().from(userTeams).where(eq(userTeams.teamId, teamId));
  }

  async addUserToTeam(mapping: InsertUserTeam): Promise<UserTeam> {
    const [result] = await db.insert(userTeams).values(mapping).returning();
    return result;
  }

  async removeUserFromTeam(userId: number, teamId: number): Promise<void> {
    await db.delete(userTeams).where(
      and(eq(userTeams.userId, userId), eq(userTeams.teamId, teamId))
    );
  }

  async isUserInTeam(userId: number, teamId: number): Promise<boolean> {
    const [result] = await db.select().from(userTeams).where(
      and(eq(userTeams.userId, userId), eq(userTeams.teamId, teamId))
    );
    return !!result;
  }

  // Weekly Targets
  async getWeeklyTarget(teamId: number, weekEnding: string): Promise<WeeklyTarget | undefined> {
    const [target] = await db.select().from(weeklyTargets)
      .where(and(eq(weeklyTargets.teamId, teamId), eq(weeklyTargets.weekEnding, weekEnding)));
    return target || undefined;
  }

  async getAllWeeklyTargets(teamId?: number, orgId?: number): Promise<WeeklyTarget[]> {
    if (teamId) {
      return await db.select().from(weeklyTargets)
        .where(eq(weeklyTargets.teamId, teamId))
        .orderBy(desc(weeklyTargets.weekEnding));
    }
    if (orgId) {
      return await db.select().from(weeklyTargets)
        .where(eq(weeklyTargets.organisationId, orgId))
        .orderBy(desc(weeklyTargets.weekEnding));
    }
    return await db.select().from(weeklyTargets)
      .orderBy(desc(weeklyTargets.weekEnding));
  }

  async createWeeklyTarget(target: InsertWeeklyTarget): Promise<WeeklyTarget> {
    const [newTarget] = await db
      .insert(weeklyTargets)
      .values({
        ...target,
        updatedAt: new Date(),
      })
      .returning();
    
    // Invalidate relevant caches
    invalidateCache("performance_data");
    invalidateCache("dashboard");
    invalidateCache("weekly_targets");
    
    return newTarget;
  }

  async updateWeeklyTarget(teamId: number, weekEnding: string, target: Partial<InsertWeeklyTarget>): Promise<WeeklyTarget | undefined> {
    const [updatedTarget] = await db
      .update(weeklyTargets)
      .set({
        ...target,
        updatedAt: new Date(),
      })
      .where(and(eq(weeklyTargets.teamId, teamId), eq(weeklyTargets.weekEnding, weekEnding)))
      .returning();
    
    // Invalidate relevant caches
    invalidateCache("performance_data");
    invalidateCache("dashboard");
    invalidateCache("weekly_targets");
    
    return updatedTarget || undefined;
  }

  // Weekly Results
  async getWeeklyResult(teamId: number, weekEnding: string): Promise<WeeklyResult | undefined> {
    const [result] = await db.select().from(weeklyResults)
      .where(and(eq(weeklyResults.teamId, teamId), eq(weeklyResults.weekEnding, weekEnding)));
    return result || undefined;
  }

  async getAllWeeklyResults(teamId?: number, orgId?: number): Promise<WeeklyResult[]> {
    if (teamId) {
      return await db.select().from(weeklyResults)
        .where(eq(weeklyResults.teamId, teamId))
        .orderBy(desc(weeklyResults.weekEnding));
    }
    if (orgId) {
      return await db.select().from(weeklyResults)
        .where(eq(weeklyResults.organisationId, orgId))
        .orderBy(desc(weeklyResults.weekEnding));
    }
    return await db.select().from(weeklyResults)
      .orderBy(desc(weeklyResults.weekEnding));
  }

  async createWeeklyResult(result: InsertWeeklyResult): Promise<WeeklyResult> {
    const [newResult] = await db
      .insert(weeklyResults)
      .values({
        ...result,
        updatedAt: new Date(),
      })
      .returning();
    
    // Invalidate relevant caches
    invalidateCache("performance_data");
    invalidateCache("dashboard");
    invalidateCache("weekly_results");
    
    return newResult;
  }

  async updateWeeklyResult(teamId: number, weekEnding: string, result: Partial<InsertWeeklyResult>): Promise<WeeklyResult | undefined> {
    const [updatedResult] = await db
      .update(weeklyResults)
      .set({
        ...result,
        updatedAt: new Date(),
      })
      .where(and(eq(weeklyResults.teamId, teamId), eq(weeklyResults.weekEnding, weekEnding)))
      .returning();
    
    // Invalidate relevant caches
    invalidateCache("performance_data");
    invalidateCache("dashboard");
    invalidateCache("weekly_results");
    
    return updatedResult || undefined;
  }

  async deleteWeeklyResult(id: number): Promise<void> {
    await db
      .delete(weeklyResults)
      .where(eq(weeklyResults.id, id));
  }

  // MBS Results
  async getMbsResult(teamId: number, weekEnding: string): Promise<MbsResult | undefined> {
    const [result] = await db.select().from(mbsResults)
      .where(and(eq(mbsResults.teamId, teamId), eq(mbsResults.weekEnding, weekEnding)));
    return result || undefined;
  }

  async getAllMbsResults(teamId?: number, orgId?: number): Promise<MbsResult[]> {
    if (teamId) {
      return await db.select().from(mbsResults)
        .where(eq(mbsResults.teamId, teamId))
        .orderBy(desc(mbsResults.weekEnding));
    }
    if (orgId) {
      return await db.select().from(mbsResults)
        .where(eq(mbsResults.organisationId, orgId))
        .orderBy(desc(mbsResults.weekEnding));
    }
    return await db.select().from(mbsResults)
      .orderBy(desc(mbsResults.weekEnding));
  }

  async createMbsResult(result: InsertMbsResult): Promise<MbsResult> {
    const existing = await this.getMbsResult(result.teamId, result.weekEnding);
    
    if (existing) {
      const [updated] = await db
        .update(mbsResults)
        .set({ ...result, updatedAt: new Date() })
        .where(and(eq(mbsResults.teamId, result.teamId), eq(mbsResults.weekEnding, result.weekEnding)))
        .returning();
      return updated;
    }

    const [newResult] = await db
      .insert(mbsResults)
      .values({ ...result, updatedAt: new Date() })
      .returning();
    return newResult;
  }

  async deleteMbsResult(id: number): Promise<void> {
    await db.delete(mbsResults).where(eq(mbsResults.id, id));
  }

  // Client Bookkeeping Results
  async getClientBookkeepingResult(teamId: number, weekEnding: string): Promise<ClientBookkeepingResult | undefined> {
    const [result] = await db.select().from(clientBookkeepingResults)
      .where(and(eq(clientBookkeepingResults.teamId, teamId), eq(clientBookkeepingResults.weekEnding, weekEnding)));
    return result || undefined;
  }

  async getAllClientBookkeepingResults(teamId?: number, orgId?: number): Promise<ClientBookkeepingResult[]> {
    if (teamId) {
      return await db.select().from(clientBookkeepingResults)
        .where(eq(clientBookkeepingResults.teamId, teamId))
        .orderBy(desc(clientBookkeepingResults.weekEnding));
    }
    if (orgId) {
      return await db.select().from(clientBookkeepingResults)
        .where(eq(clientBookkeepingResults.organisationId, orgId))
        .orderBy(desc(clientBookkeepingResults.weekEnding));
    }
    return await db.select().from(clientBookkeepingResults)
      .orderBy(desc(clientBookkeepingResults.weekEnding));
  }

  async createClientBookkeepingResult(result: InsertClientBookkeepingResult): Promise<ClientBookkeepingResult> {
    const existing = await this.getClientBookkeepingResult(result.teamId, result.weekEnding);
    
    if (existing) {
      const [updated] = await db
        .update(clientBookkeepingResults)
        .set({ ...result, updatedAt: new Date() })
        .where(and(eq(clientBookkeepingResults.teamId, result.teamId), eq(clientBookkeepingResults.weekEnding, result.weekEnding)))
        .returning();
      return updated;
    }

    const [newResult] = await db
      .insert(clientBookkeepingResults)
      .values({ ...result, updatedAt: new Date() })
      .returning();
    return newResult;
  }

  async deleteClientBookkeepingResult(id: number): Promise<void> {
    await db.delete(clientBookkeepingResults).where(eq(clientBookkeepingResults.id, id));
  }

  // Accounts Due
  async getAccountsDue(teamId: number, weekEnding: string): Promise<AccountsDue | undefined> {
    const [accountsDueData] = await db.select().from(accountsDue)
      .where(and(eq(accountsDue.teamId, teamId), eq(accountsDue.weekEnding, weekEnding)));
    return accountsDueData || undefined;
  }

  async getAllAccountsDue(teamId?: number, orgId?: number): Promise<AccountsDue[]> {
    if (teamId) {
      return await db.select().from(accountsDue)
        .where(eq(accountsDue.teamId, teamId))
        .orderBy(desc(accountsDue.weekEnding));
    }
    if (orgId) {
      return await db.select().from(accountsDue)
        .where(eq(accountsDue.organisationId, orgId))
        .orderBy(desc(accountsDue.weekEnding));
    }
    return await db.select().from(accountsDue).orderBy(desc(accountsDue.weekEnding));
  }

  async createAccountsDue(accountsDueData: InsertAccountsDue): Promise<AccountsDue> {
    const [newAccountsDue] = await db
      .insert(accountsDue)
      .values({
        ...accountsDueData,
        updatedAt: new Date(),
      })
      .returning();
    return newAccountsDue;
  }

  async updateAccountsDue(teamId: number, weekEnding: string, accountsDueData: Partial<InsertAccountsDue>): Promise<AccountsDue | undefined> {
    const [updatedAccountsDue] = await db
      .update(accountsDue)
      .set({
        ...accountsDueData,
        updatedAt: new Date(),
      })
      .where(and(eq(accountsDue.teamId, teamId), eq(accountsDue.weekEnding, weekEnding)))
      .returning();
    return updatedAccountsDue || undefined;
  }

  // Combined data for dashboard with 4-week rolling calculations - Optimized
  async getTeamPerformanceData(teamId?: number, orgId?: number): Promise<Array<{
    teamId: number;
    teamName: string;
    weekEnding: string;
    rollingFourWeekTarget: number | null;
    rollingFourWeekActual: number | null;
    weeklyActual: number | null;
    accountsDue: number | null;
    accountsDueInProgress: number | null;
  }>> {
    // Create cache key for performance data
    const cacheKey = getCacheKey("performance_data", teamId ?? orgId);
    let cachedData = getFromCache(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }

    // Single optimized query to get all data with joins - much faster than multiple queries
    const whereClause = teamId 
      ? eq(teams.id, teamId) 
      : orgId 
        ? eq(teams.organisationId, orgId) 
        : undefined;

    const allData = await db
      .select({
        teamId: teams.id,
        teamName: teams.name,
        targetWeekEnding: weeklyTargets.weekEnding,
        rollingFourWeekTarget: weeklyTargets.rollingFourWeekTarget,
        resultWeekEnding: weeklyResults.weekEnding,
        actualCompleted: weeklyResults.actualCompleted,
        accountsWeekEnding: accountsDue.weekEnding,
        accountsDueCount: accountsDue.accountsDue,
        accountsDueInProgressCount: accountsDue.accountsDueInProgress,
      })
      .from(teams)
      .leftJoin(weeklyTargets, eq(teams.id, weeklyTargets.teamId))
      .leftJoin(weeklyResults, eq(teams.id, weeklyResults.teamId))
      .leftJoin(accountsDue, eq(teams.id, accountsDue.teamId))
      .where(whereClause)
      .orderBy(desc(weeklyTargets.weekEnding), desc(weeklyResults.weekEnding), desc(accountsDue.weekEnding));

    // Process the joined data more efficiently
    const weeklyResultsMap = new Map<string, number>();
    const accountsDueMap = new Map<string, number>();
    const teamsMap = new Map<number, string>();
    
    // Build lookup maps for faster access
    const accountsDueInProgressMap = new Map<string, number>();
    allData.forEach(row => {
      teamsMap.set(row.teamId, row.teamName);
      
      if (row.resultWeekEnding && row.actualCompleted !== null) {
        weeklyResultsMap.set(`${row.teamId}-${row.resultWeekEnding}`, row.actualCompleted);
        console.log(`Weekly results map: ${row.teamId}-${row.resultWeekEnding} = ${row.actualCompleted}`);
      }
      
      if (row.accountsWeekEnding && row.accountsDueCount !== null) {
        accountsDueMap.set(`${row.teamId}-${row.accountsWeekEnding}`, row.accountsDueCount);
      }
      
      if (row.accountsWeekEnding && row.accountsDueInProgressCount !== null) {
        accountsDueInProgressMap.set(`${row.teamId}-${row.accountsWeekEnding}`, row.accountsDueInProgressCount);
      }
    });

    // Get unique weeks and teams for processing
    const allWeeks = new Set<string>();
    const teamTargets = new Map<number, Array<{weekEnding: string, target: number}>>();
    
    allData.forEach(row => {
      if (row.targetWeekEnding) {
        allWeeks.add(row.targetWeekEnding);
        if (!teamTargets.has(row.teamId)) {
          teamTargets.set(row.teamId, []);
        }
        teamTargets.get(row.teamId)!.push({
          weekEnding: row.targetWeekEnding,
          target: row.rollingFourWeekTarget || 0
        });
      }
      if (row.resultWeekEnding) allWeeks.add(row.resultWeekEnding);
      if (row.accountsWeekEnding) allWeeks.add(row.accountsWeekEnding);
    });

    // Optimized rolling calculation with memoization
    const rollingCalculationCache = new Map<string, number>();
    
    const calculateRollingFourWeekOptimized = (teamId: number, weekEnding: string): number => {
      const cacheKey = `${teamId}-${weekEnding}`;
      if (rollingCalculationCache.has(cacheKey)) {
        console.log(`Using cached rolling total for team ${teamId}, week ${weekEnding}: ${rollingCalculationCache.get(cacheKey)!}`);
        return rollingCalculationCache.get(cacheKey)!;
      }
      
      console.log(`Calculating rolling 4-week total for team ${teamId}, week ${weekEnding}`);
      const weekEndingDate = new Date(weekEnding);
      const fourWeeksAgo = new Date(weekEndingDate);
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      
      console.log(`Looking for results between ${fourWeeksAgo.toISOString().split('T')[0]} and ${weekEnding}`);
      
      let total = 0;
      for (const [key, value] of weeklyResultsMap.entries()) {
        if (key.startsWith(`${teamId}-`)) {
          const resultWeekEnding = key.split('-').slice(1).join('-'); // Handle YYYY-MM-DD format properly
          const resultDate = new Date(resultWeekEnding);
          
          console.log(`Checking result: ${key} = ${value}, date: ${resultWeekEnding}, parsed: ${resultDate.toISOString()}`);
          console.log(`Week ending: ${weekEndingDate.toISOString()}, Four weeks ago: ${fourWeeksAgo.toISOString()}`);
          console.log(`Date comparison: ${resultDate.toISOString()} <= ${weekEndingDate.toISOString()} && ${resultDate.toISOString()} > ${fourWeeksAgo.toISOString()}`);
          
          // Include results from 4 weeks ago up to and including the current week
          if (resultDate <= weekEndingDate && resultDate > fourWeeksAgo) {
            total += value;
            console.log(`✓ Adding ${value} from ${resultWeekEnding} to rolling total for team ${teamId}, week ${weekEnding}`);
          } else {
            console.log(`✗ Skipping ${value} from ${resultWeekEnding} - outside date range`);
          }
        }
      }
      
      console.log(`Final rolling total for team ${teamId}, week ${weekEnding}: ${total}`);
      rollingCalculationCache.set(cacheKey, total);
      return total;
    };

    // Helper function to carry forward target for a team and week
    const getCarriedForwardTargetOptimized = (teamId: number, weekEnding: string): number | null => {
      const targets = teamTargets.get(teamId);
      if (!targets) return null;
      
      // Sort targets by date descending and find most recent before this week
      const sortedTargets = targets.sort((a, b) => 
        new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime()
      );
      
      const weekDate = new Date(weekEnding);
      const mostRecentTarget = sortedTargets.find(t => 
        new Date(t.weekEnding).getTime() <= weekDate.getTime()
      );
      
      return mostRecentTarget ? mostRecentTarget.target : null;
    };

    // Build performance data efficiently
    const performanceData: Array<{
      teamId: number;
      teamName: string;
      weekEnding: string;
      rollingFourWeekTarget: number | null;
      rollingFourWeekActual: number | null;
      weeklyActual: number | null;
      accountsDue: number | null;
      accountsDueInProgress: number | null;
    }> = [];

    const processedWeeks = new Set<string>();
    
    Array.from(allWeeks).forEach(weekEnding => {
      Array.from(teamsMap.keys()).forEach(teamId => {
        const key = `${teamId}-${weekEnding}`;
        if (processedWeeks.has(key)) return;
        
        // Check if there's any data for this team-week combination
        const hasTarget = teamTargets.has(teamId) && teamTargets.get(teamId)!.some(t => t.weekEnding === weekEnding);
        const hasResult = weeklyResultsMap.has(key);
        const hasAccountsDue = accountsDueMap.has(key);
        
        if (hasTarget || hasResult || hasAccountsDue) {
          performanceData.push({
            teamId,
            teamName: teamsMap.get(teamId) || `Team ${teamId}`,
            weekEnding,
            rollingFourWeekTarget: hasTarget ? 
              teamTargets.get(teamId)!.find(t => t.weekEnding === weekEnding)?.target || null :
              getCarriedForwardTargetOptimized(teamId, weekEnding),
            rollingFourWeekActual: calculateRollingFourWeekOptimized(teamId, weekEnding),
            weeklyActual: weeklyResultsMap.get(key) || null,
            accountsDue: accountsDueMap.get(key) || 0,
            accountsDueInProgress: accountsDueInProgressMap.get(key) || 0,
          });
          
          processedWeeks.add(key);
        }
      });
    });

    const result = performanceData.sort((a, b) => 
      new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime()
    );
    
    // Cache the result for 3 minutes
    setInCache(cacheKey, result);
    
    return result;
  }

  // Health Checks Targets
  async getHealthChecksTarget(teamId: number, weekEnding: string): Promise<HealthChecksTarget | undefined> {
    const [target] = await db
      .select()
      .from(healthChecksTargets)
      .where(and(eq(healthChecksTargets.teamId, teamId), eq(healthChecksTargets.weekEnding, weekEnding)));
    return target || undefined;
  }

  async getAllHealthChecksTargets(teamId?: number, orgId?: number): Promise<HealthChecksTarget[]> {
    if (teamId) {
      return await db
        .select()
        .from(healthChecksTargets)
        .where(eq(healthChecksTargets.teamId, teamId))
        .orderBy(desc(healthChecksTargets.weekEnding));
    }
    if (orgId) {
      return await db
        .select()
        .from(healthChecksTargets)
        .where(eq(healthChecksTargets.organisationId, orgId))
        .orderBy(desc(healthChecksTargets.weekEnding));
    }
    return await db
      .select()
      .from(healthChecksTargets)
      .orderBy(desc(healthChecksTargets.weekEnding));
  }

  async createHealthChecksTarget(target: InsertHealthChecksTarget): Promise<HealthChecksTarget> {
    const [newTarget] = await db
      .insert(healthChecksTargets)
      .values(target)
      .returning();
    return newTarget;
  }

  async updateHealthChecksTarget(teamId: number, weekEnding: string, target: Partial<InsertHealthChecksTarget>): Promise<HealthChecksTarget | undefined> {
    const [updatedTarget] = await db
      .update(healthChecksTargets)
      .set({ ...target, updatedAt: new Date() })
      .where(and(eq(healthChecksTargets.teamId, teamId), eq(healthChecksTargets.weekEnding, weekEnding)))
      .returning();
    return updatedTarget || undefined;
  }

  // Health Checks Results
  async getHealthChecksResult(teamId: number, weekEnding: string): Promise<HealthChecksResult | undefined> {
    const [result] = await db
      .select()
      .from(healthChecksResults)
      .where(and(eq(healthChecksResults.teamId, teamId), eq(healthChecksResults.weekEnding, weekEnding)));
    return result || undefined;
  }

  async getAllHealthChecksResults(teamId?: number, orgId?: number): Promise<HealthChecksResult[]> {
    if (teamId) {
      return await db
        .select()
        .from(healthChecksResults)
        .where(eq(healthChecksResults.teamId, teamId))
        .orderBy(desc(healthChecksResults.weekEnding));
    }
    if (orgId) {
      return await db
        .select()
        .from(healthChecksResults)
        .where(eq(healthChecksResults.organisationId, orgId))
        .orderBy(desc(healthChecksResults.weekEnding));
    }
    return await db
      .select()
      .from(healthChecksResults)
      .orderBy(desc(healthChecksResults.weekEnding));
  }

  async createHealthChecksResult(result: InsertHealthChecksResult): Promise<HealthChecksResult> {
    const [newResult] = await db
      .insert(healthChecksResults)
      .values(result)
      .returning();
    return newResult;
  }

  async updateHealthChecksResult(teamId: number, weekEnding: string, result: Partial<InsertHealthChecksResult>): Promise<HealthChecksResult | undefined> {
    const [updatedResult] = await db
      .update(healthChecksResults)
      .set({ ...result, updatedAt: new Date() })
      .where(and(eq(healthChecksResults.teamId, teamId), eq(healthChecksResults.weekEnding, weekEnding)))
      .returning();
    return updatedResult || undefined;
  }

  // Health Checks Due
  async getHealthChecksDue(teamId: number, weekEnding: string): Promise<HealthChecksDue | undefined> {
    const [healthChecksDueData] = await db
      .select()
      .from(healthChecksDue)
      .where(and(eq(healthChecksDue.teamId, teamId), eq(healthChecksDue.weekEnding, weekEnding)));
    return healthChecksDueData || undefined;
  }

  async getAllHealthChecksDue(teamId?: number, orgId?: number): Promise<HealthChecksDue[]> {
    const selectShape = {
      id: healthChecksDue.id,
      teamId: healthChecksDue.teamId,
      weekEnding: healthChecksDue.weekEnding,
      healthChecksDue: healthChecksDue.healthChecksDue,
      notes: healthChecksDue.notes,
      createdAt: healthChecksDue.createdAt,
      updatedAt: healthChecksDue.updatedAt,
      team: {
        id: teams.id,
        name: teams.name,
      }
    };
    if (teamId) {
      return await db
        .select(selectShape)
        .from(healthChecksDue)
        .leftJoin(teams, eq(healthChecksDue.teamId, teams.id))
        .where(eq(healthChecksDue.teamId, teamId))
        .orderBy(desc(healthChecksDue.weekEnding));
    }
    if (orgId) {
      return await db
        .select(selectShape)
        .from(healthChecksDue)
        .leftJoin(teams, eq(healthChecksDue.teamId, teams.id))
        .where(eq(healthChecksDue.organisationId, orgId))
        .orderBy(desc(healthChecksDue.weekEnding));
    }
    return await db
      .select(selectShape)
      .from(healthChecksDue)
      .leftJoin(teams, eq(healthChecksDue.teamId, teams.id))
      .orderBy(desc(healthChecksDue.weekEnding));
  }

  async createHealthChecksDue(healthChecksDueData: InsertHealthChecksDue): Promise<HealthChecksDue> {
    const [newHealthChecksDue] = await db
      .insert(healthChecksDue)
      .values(healthChecksDueData)
      .returning();
    return newHealthChecksDue;
  }

  async updateHealthChecksDue(teamId: number, weekEnding: string, healthChecksDueData: Partial<InsertHealthChecksDue>): Promise<HealthChecksDue | undefined> {
    const [updatedHealthChecksDue] = await db
      .update(healthChecksDue)
      .set({ ...healthChecksDueData, updatedAt: new Date() })
      .where(and(eq(healthChecksDue.teamId, teamId), eq(healthChecksDue.weekEnding, weekEnding)))
      .returning();
    return updatedHealthChecksDue || undefined;
  }

  // Health Checks Performance Data
  async getHealthChecksPerformanceData(teamId?: number, orgId?: number): Promise<Array<{
    teamId: number;
    teamName: string;
    weekEnding: string;
    rollingFourWeekTarget: number | null;
    rollingFourWeekActual: number | null;
    weeklyActual: number | null;
    healthChecksDue: number | null;
  }>> {
    const teamsData = await this.getAllTeams(orgId);
    const targetsData = await this.getAllHealthChecksTargets(undefined, orgId);
    const resultsData = await this.getAllHealthChecksResults(undefined, orgId);
    const healthChecksDueData = await this.getAllHealthChecksDue(undefined, orgId);
    
    // Get all unique weeks from targets and results
    const allWeeks = new Set([
      ...targetsData.map(t => t.weekEnding),
      ...resultsData.map(r => r.weekEnding),
      ...healthChecksDueData.map(d => d.weekEnding)
    ]);
    
    const performanceData: Array<{
      teamId: number;
      teamName: string;
      weekEnding: string;
      rollingFourWeekTarget: number | null;
      rollingFourWeekActual: number | null;
      weeklyActual: number | null;
      healthChecksDue: number | null;
    }> = [];

    // Filter teams if teamId is specified
    const filteredTeams = teamId ? teamsData.filter(t => t.id === teamId) : teamsData;

    filteredTeams.forEach(team => {
      Array.from(allWeeks).forEach(weekEnding => {
        // Get 4-week rolling targets and actuals
        const fourWeeksAgo = new Date(weekEnding);
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
        
        const recentTargets = targetsData.filter(t => 
          t.teamId === team.id && 
          new Date(t.weekEnding) >= fourWeeksAgo && 
          new Date(t.weekEnding) <= new Date(weekEnding)
        );
        
        const recentResults = resultsData.filter(r => 
          r.teamId === team.id && 
          new Date(r.weekEnding) >= fourWeeksAgo && 
          new Date(r.weekEnding) <= new Date(weekEnding)
        );
        
        const rollingFourWeekTarget = recentTargets.reduce((sum, t) => sum + t.targetCompleted, 0);
        const rollingFourWeekActual = recentResults.reduce((sum, r) => sum + r.actualCompleted, 0);
        
        // Get weekly actual for this specific week
        const weeklyResult = resultsData.find(r => 
          r.teamId === team.id && r.weekEnding === weekEnding
        );
        
        // Get health checks due for this week
        const healthChecksDueDataForWeek = healthChecksDueData.find(d => 
          d.teamId === team.id && d.weekEnding === weekEnding
        );

        performanceData.push({
          teamId: team.id,
          teamName: team.name,
          weekEnding,
          rollingFourWeekTarget: recentTargets.length > 0 ? rollingFourWeekTarget : null,
          rollingFourWeekActual: recentResults.length > 0 ? rollingFourWeekActual : null,
          weeklyActual: weeklyResult?.actualCompleted || null,
          healthChecksDue: healthChecksDueDataForWeek?.healthChecksDue || null,
        });
      });
    });

    return performanceData.sort((a, b) => 
      new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime()
    );
  }

  // VAT Due methods
  async getVatDue(teamId: number, weekEnding: string, quarterEnding: string): Promise<VatDue | undefined> {
    const [vatDueData] = await db
      .select()
      .from(vatDue)
      .where(and(eq(vatDue.teamId, teamId), eq(vatDue.weekEnding, weekEnding), eq(vatDue.quarterEnding, quarterEnding)));
    return vatDueData || undefined;
  }

  async getAllVatDue(teamId?: number, orgId?: number): Promise<VatDue[]> {
    const selectShape = {
      id: vatDue.id,
      teamId: vatDue.teamId,
      weekEnding: vatDue.weekEnding,
      quarterEnding: vatDue.quarterEnding,
      vatDue: vatDue.vatDue,
      notes: vatDue.notes,
      createdAt: vatDue.createdAt,
      updatedAt: vatDue.updatedAt,
      team: {
        id: teams.id,
        name: teams.name,
      }
    };
    if (teamId) {
      return await db
        .select(selectShape)
        .from(vatDue)
        .leftJoin(teams, eq(vatDue.teamId, teams.id))
        .where(eq(vatDue.teamId, teamId))
        .orderBy(desc(vatDue.weekEnding));
    }
    if (orgId) {
      return await db
        .select(selectShape)
        .from(vatDue)
        .leftJoin(teams, eq(vatDue.teamId, teams.id))
        .where(eq(vatDue.organisationId, orgId))
        .orderBy(desc(vatDue.weekEnding));
    }
    return await db
      .select(selectShape)
      .from(vatDue)
      .leftJoin(teams, eq(vatDue.teamId, teams.id))
      .orderBy(desc(vatDue.weekEnding));
  }

  async createVatDue(vatDueData: InsertVatDue): Promise<VatDue> {
    const [newVatDue] = await db
      .insert(vatDue)
      .values(vatDueData)
      .returning();
    return newVatDue;
  }

  async updateVatDue(teamId: number, weekEnding: string, quarterEnding: string, vatDueData: Partial<InsertVatDue>): Promise<VatDue | undefined> {
    const [updatedVatDue] = await db
      .update(vatDue)
      .set({ ...vatDueData, updatedAt: new Date() })
      .where(and(eq(vatDue.teamId, teamId), eq(vatDue.weekEnding, weekEnding), eq(vatDue.quarterEnding, quarterEnding)))
      .returning();
    return updatedVatDue || undefined;
  }

  async deleteVatDue(id: number): Promise<void> {
    await db
      .delete(vatDue)
      .where(eq(vatDue.id, id));
  }

  async getVatTurnoverChecks(teamId: number, weekEnding: string): Promise<VatTurnoverChecks | undefined> {
    const [vatTurnoverChecksData] = await db
      .select()
      .from(vatTurnoverChecks)
      .where(and(eq(vatTurnoverChecks.teamId, teamId), eq(vatTurnoverChecks.weekEnding, weekEnding)));
    return vatTurnoverChecksData || undefined;
  }

  async getAllVatTurnoverChecks(teamId?: number, orgId?: number): Promise<VatTurnoverChecks[]> {
    if (teamId) {
      return await db
        .select()
        .from(vatTurnoverChecks)
        .where(eq(vatTurnoverChecks.teamId, teamId))
        .orderBy(desc(vatTurnoverChecks.weekEnding));
    }
    if (orgId) {
      return await db
        .select()
        .from(vatTurnoverChecks)
        .where(eq(vatTurnoverChecks.organisationId, orgId))
        .orderBy(desc(vatTurnoverChecks.weekEnding));
    }
    return await db
      .select()
      .from(vatTurnoverChecks)
      .orderBy(desc(vatTurnoverChecks.weekEnding));
  }

  async createVatTurnoverChecks(vatTurnoverChecksData: InsertVatTurnoverChecks): Promise<VatTurnoverChecks> {
    const existing = await this.getVatTurnoverChecks(vatTurnoverChecksData.teamId, vatTurnoverChecksData.weekEnding);
    
    if (existing) {
      const [updated] = await db
        .update(vatTurnoverChecks)
        .set({ ...vatTurnoverChecksData, updatedAt: new Date() })
        .where(and(eq(vatTurnoverChecks.teamId, vatTurnoverChecksData.teamId), eq(vatTurnoverChecks.weekEnding, vatTurnoverChecksData.weekEnding)))
        .returning();
      return updated;
    }

    const [newVatTurnoverChecks] = await db
      .insert(vatTurnoverChecks)
      .values(vatTurnoverChecksData)
      .returning();
    return newVatTurnoverChecks;
  }

  async updateVatTurnoverChecks(teamId: number, weekEnding: string, vatTurnoverChecksData: Partial<InsertVatTurnoverChecks>): Promise<VatTurnoverChecks | undefined> {
    const [updatedVatTurnoverChecks] = await db
      .update(vatTurnoverChecks)
      .set({ ...vatTurnoverChecksData, updatedAt: new Date() })
      .where(and(eq(vatTurnoverChecks.teamId, teamId), eq(vatTurnoverChecks.weekEnding, weekEnding)))
      .returning();
    return updatedVatTurnoverChecks || undefined;
  }

  async updateVatTurnoverChecksById(id: number, vatTurnoverChecksData: Partial<InsertVatTurnoverChecks>): Promise<VatTurnoverChecks | undefined> {
    const [updatedVatTurnoverChecks] = await db
      .update(vatTurnoverChecks)
      .set({ ...vatTurnoverChecksData, updatedAt: new Date() })
      .where(eq(vatTurnoverChecks.id, id))
      .returning();
    return updatedVatTurnoverChecks || undefined;
  }

  async deleteVatTurnoverChecks(id: number): Promise<void> {
    await db
      .delete(vatTurnoverChecks)
      .where(eq(vatTurnoverChecks.id, id));
  }

  // MBS Dext Precision methods
  async getMbsDextPrecision(teamId: number, weekEnding: string): Promise<MbsDextPrecision | undefined> {
    const [dextPrecisionData] = await db
      .select()
      .from(mbsDextPrecision)
      .where(and(eq(mbsDextPrecision.teamId, teamId), eq(mbsDextPrecision.weekEnding, weekEnding)));
    return dextPrecisionData || undefined;
  }

  async getAllMbsDextPrecision(teamId?: number, orgId?: number): Promise<MbsDextPrecision[]> {
    if (teamId) {
      return await db
        .select()
        .from(mbsDextPrecision)
        .where(eq(mbsDextPrecision.teamId, teamId))
        .orderBy(desc(mbsDextPrecision.weekEnding));
    }
    if (orgId) {
      return await db
        .select()
        .from(mbsDextPrecision)
        .where(eq(mbsDextPrecision.organisationId, orgId))
        .orderBy(desc(mbsDextPrecision.weekEnding));
    }
    return await db
      .select()
      .from(mbsDextPrecision)
      .orderBy(desc(mbsDextPrecision.weekEnding));
  }

  async createMbsDextPrecision(dextPrecisionData: InsertMbsDextPrecision): Promise<MbsDextPrecision> {
    const [newDextPrecision] = await db
      .insert(mbsDextPrecision)
      .values(dextPrecisionData)
      .returning();
    return newDextPrecision;
  }

  async updateMbsDextPrecision(teamId: number, weekEnding: string, dextPrecisionData: Partial<InsertMbsDextPrecision>): Promise<MbsDextPrecision | undefined> {
    const [updatedDextPrecision] = await db
      .update(mbsDextPrecision)
      .set({ ...dextPrecisionData, updatedAt: new Date() })
      .where(and(eq(mbsDextPrecision.teamId, teamId), eq(mbsDextPrecision.weekEnding, weekEnding)))
      .returning();
    return updatedDextPrecision || undefined;
  }

  async deleteMbsDextPrecision(id: number): Promise<void> {
    await db
      .delete(mbsDextPrecision)
      .where(eq(mbsDextPrecision.id, id));
  }

  // MBS Oldest Items methods
  async getMbsOldestItems(teamId: number, weekEnding: string): Promise<MbsOldestItems | undefined> {
    const [oldestItemsData] = await db
      .select()
      .from(mbsOldestItems)
      .where(and(eq(mbsOldestItems.teamId, teamId), eq(mbsOldestItems.weekEnding, weekEnding)));
    return oldestItemsData || undefined;
  }

  async getAllMbsOldestItems(teamId?: number, orgId?: number): Promise<MbsOldestItems[]> {
    if (teamId) {
      return await db
        .select()
        .from(mbsOldestItems)
        .where(eq(mbsOldestItems.teamId, teamId))
        .orderBy(desc(mbsOldestItems.weekEnding));
    }
    if (orgId) {
      return await db
        .select()
        .from(mbsOldestItems)
        .where(eq(mbsOldestItems.organisationId, orgId))
        .orderBy(desc(mbsOldestItems.weekEnding));
    }
    return await db
      .select()
      .from(mbsOldestItems)
      .orderBy(desc(mbsOldestItems.weekEnding));
  }

  async createMbsOldestItems(oldestItemsData: InsertMbsOldestItems): Promise<MbsOldestItems> {
    const [newOldestItems] = await db
      .insert(mbsOldestItems)
      .values(oldestItemsData)
      .returning();
    return newOldestItems;
  }

  async updateMbsOldestItems(teamId: number, weekEnding: string, oldestItemsData: Partial<InsertMbsOldestItems>): Promise<MbsOldestItems | undefined> {
    const [updatedOldestItems] = await db
      .update(mbsOldestItems)
      .set({ ...oldestItemsData, updatedAt: new Date() })
      .where(and(eq(mbsOldestItems.teamId, teamId), eq(mbsOldestItems.weekEnding, weekEnding)))
      .returning();
    return updatedOldestItems || undefined;
  }

  async deleteMbsOldestItems(id: number): Promise<void> {
    await db
      .delete(mbsOldestItems)
      .where(eq(mbsOldestItems.id, id));
  }

  // Client Dext Precision methods
  async getClientDextPrecision(teamId: number, weekEnding: string): Promise<ClientDextPrecision | undefined> {
    const [dextPrecisionData] = await db
      .select()
      .from(clientDextPrecision)
      .where(and(eq(clientDextPrecision.teamId, teamId), eq(clientDextPrecision.weekEnding, weekEnding)));
    return dextPrecisionData || undefined;
  }

  async getAllClientDextPrecision(teamId?: number, orgId?: number): Promise<ClientDextPrecision[]> {
    if (teamId) {
      return await db
        .select()
        .from(clientDextPrecision)
        .where(eq(clientDextPrecision.teamId, teamId))
        .orderBy(desc(clientDextPrecision.weekEnding));
    }
    if (orgId) {
      return await db
        .select()
        .from(clientDextPrecision)
        .where(eq(clientDextPrecision.organisationId, orgId))
        .orderBy(desc(clientDextPrecision.weekEnding));
    }
    return await db
      .select()
      .from(clientDextPrecision)
      .orderBy(desc(clientDextPrecision.weekEnding));
  }

  async createClientDextPrecision(dextPrecisionData: InsertClientDextPrecision): Promise<ClientDextPrecision> {
    const [newDextPrecision] = await db
      .insert(clientDextPrecision)
      .values(dextPrecisionData)
      .returning();
    return newDextPrecision;
  }

  async updateClientDextPrecision(teamId: number, weekEnding: string, dextPrecisionData: Partial<InsertClientDextPrecision>): Promise<ClientDextPrecision | undefined> {
    const [updatedDextPrecision] = await db
      .update(clientDextPrecision)
      .set({ ...dextPrecisionData, updatedAt: new Date() })
      .where(and(eq(clientDextPrecision.teamId, teamId), eq(clientDextPrecision.weekEnding, weekEnding)))
      .returning();
    return updatedDextPrecision || undefined;
  }

  async deleteClientDextPrecision(id: number): Promise<void> {
    await db
      .delete(clientDextPrecision)
      .where(eq(clientDextPrecision.id, id));
  }

  // Client Oldest Items methods
  async getClientOldestItems(teamId: number, weekEnding: string): Promise<ClientOldestItems | undefined> {
    const [oldestItemsData] = await db
      .select()
      .from(clientOldestItems)
      .where(and(eq(clientOldestItems.teamId, teamId), eq(clientOldestItems.weekEnding, weekEnding)));
    return oldestItemsData || undefined;
  }

  async getAllClientOldestItems(teamId?: number, orgId?: number): Promise<ClientOldestItems[]> {
    if (teamId) {
      return await db
        .select()
        .from(clientOldestItems)
        .where(eq(clientOldestItems.teamId, teamId))
        .orderBy(desc(clientOldestItems.weekEnding));
    }
    if (orgId) {
      return await db
        .select()
        .from(clientOldestItems)
        .where(eq(clientOldestItems.organisationId, orgId))
        .orderBy(desc(clientOldestItems.weekEnding));
    }
    return await db
      .select()
      .from(clientOldestItems)
      .orderBy(desc(clientOldestItems.weekEnding));
  }

  async createClientOldestItems(oldestItemsData: InsertClientOldestItems): Promise<ClientOldestItems> {
    const [newOldestItems] = await db
      .insert(clientOldestItems)
      .values(oldestItemsData)
      .returning();
    return newOldestItems;
  }

  async updateClientOldestItems(teamId: number, weekEnding: string, oldestItemsData: Partial<InsertClientOldestItems>): Promise<ClientOldestItems | undefined> {
    const [updatedOldestItems] = await db
      .update(clientOldestItems)
      .set({ ...oldestItemsData, updatedAt: new Date() })
      .where(and(eq(clientOldestItems.teamId, teamId), eq(clientOldestItems.weekEnding, weekEnding)))
      .returning();
    return updatedOldestItems || undefined;
  }

  async deleteClientOldestItems(id: number): Promise<void> {
    await db
      .delete(clientOldestItems)
      .where(eq(clientOldestItems.id, id));
  }

  // Confirmation Statements Targets
  async getConfirmationStatementsTarget(teamId: number, weekEnding: string): Promise<ConfirmationStatementsTarget | undefined> {
    const [target] = await db
      .select()
      .from(confirmationStatementsTargets)
      .where(and(eq(confirmationStatementsTargets.teamId, teamId), eq(confirmationStatementsTargets.weekEnding, weekEnding)));
    return target || undefined;
  }

  async getAllConfirmationStatementsTargets(teamId?: number, orgId?: number): Promise<ConfirmationStatementsTarget[]> {
    if (teamId) {
      return await db
        .select()
        .from(confirmationStatementsTargets)
        .where(eq(confirmationStatementsTargets.teamId, teamId))
        .orderBy(desc(confirmationStatementsTargets.weekEnding));
    }
    if (orgId) {
      return await db
        .select()
        .from(confirmationStatementsTargets)
        .where(eq(confirmationStatementsTargets.organisationId, orgId))
        .orderBy(desc(confirmationStatementsTargets.weekEnding));
    }
    return await db
      .select()
      .from(confirmationStatementsTargets)
      .orderBy(desc(confirmationStatementsTargets.weekEnding));
  }

  async createConfirmationStatementsTarget(target: InsertConfirmationStatementsTarget): Promise<ConfirmationStatementsTarget> {
    const [newTarget] = await db
      .insert(confirmationStatementsTargets)
      .values(target)
      .returning();
    return newTarget;
  }

  async updateConfirmationStatementsTarget(teamId: number, weekEnding: string, target: Partial<InsertConfirmationStatementsTarget>): Promise<ConfirmationStatementsTarget | undefined> {
    const [updatedTarget] = await db
      .update(confirmationStatementsTargets)
      .set({ ...target, updatedAt: new Date() })
      .where(and(eq(confirmationStatementsTargets.teamId, teamId), eq(confirmationStatementsTargets.weekEnding, weekEnding)))
      .returning();
    return updatedTarget || undefined;
  }

  // Confirmation Statements Results
  async getConfirmationStatementsResult(teamId: number, weekEnding: string): Promise<ConfirmationStatementsResult | undefined> {
    const [result] = await db
      .select()
      .from(confirmationStatementsResults)
      .where(and(eq(confirmationStatementsResults.teamId, teamId), eq(confirmationStatementsResults.weekEnding, weekEnding)));
    return result || undefined;
  }

  async getAllConfirmationStatementsResults(teamId?: number, orgId?: number): Promise<ConfirmationStatementsResult[]> {
    if (teamId) {
      return await db
        .select()
        .from(confirmationStatementsResults)
        .where(eq(confirmationStatementsResults.teamId, teamId))
        .orderBy(desc(confirmationStatementsResults.weekEnding));
    }
    if (orgId) {
      return await db
        .select()
        .from(confirmationStatementsResults)
        .where(eq(confirmationStatementsResults.organisationId, orgId))
        .orderBy(desc(confirmationStatementsResults.weekEnding));
    }
    return await db
      .select()
      .from(confirmationStatementsResults)
      .orderBy(desc(confirmationStatementsResults.weekEnding));
  }

  async createConfirmationStatementsResult(result: InsertConfirmationStatementsResult): Promise<ConfirmationStatementsResult> {
    const [newResult] = await db
      .insert(confirmationStatementsResults)
      .values(result)
      .returning();
    return newResult;
  }

  async updateConfirmationStatementsResult(teamId: number, weekEnding: string, result: Partial<InsertConfirmationStatementsResult>): Promise<ConfirmationStatementsResult | undefined> {
    const [updatedResult] = await db
      .update(confirmationStatementsResults)
      .set({ ...result, updatedAt: new Date() })
      .where(and(eq(confirmationStatementsResults.teamId, teamId), eq(confirmationStatementsResults.weekEnding, weekEnding)))
      .returning();
    return updatedResult || undefined;
  }

  // Confirmation Statements Due
  async getConfirmationStatementsDue(teamId: number, weekEnding: string): Promise<ConfirmationStatementsDue | undefined> {
    const [due] = await db
      .select()
      .from(confirmationStatementsDue)
      .where(and(eq(confirmationStatementsDue.teamId, teamId), eq(confirmationStatementsDue.weekEnding, weekEnding)));
    return due || undefined;
  }

  async getAllConfirmationStatementsDue(teamId?: number, orgId?: number): Promise<ConfirmationStatementsDue[]> {
    if (teamId) {
      return await db
        .select()
        .from(confirmationStatementsDue)
        .where(eq(confirmationStatementsDue.teamId, teamId))
        .orderBy(desc(confirmationStatementsDue.weekEnding));
    }
    if (orgId) {
      return await db
        .select()
        .from(confirmationStatementsDue)
        .where(eq(confirmationStatementsDue.organisationId, orgId))
        .orderBy(desc(confirmationStatementsDue.weekEnding));
    }
    return await db
      .select()
      .from(confirmationStatementsDue)
      .orderBy(desc(confirmationStatementsDue.weekEnding));
  }

  async createConfirmationStatementsDue(confirmationStatementsDueData: InsertConfirmationStatementsDue): Promise<ConfirmationStatementsDue> {
    const [newDue] = await db
      .insert(confirmationStatementsDue)
      .values(confirmationStatementsDueData)
      .returning();
    return newDue;
  }

  async updateConfirmationStatementsDue(teamId: number, weekEnding: string, confirmationStatementsDueData: Partial<InsertConfirmationStatementsDue>): Promise<ConfirmationStatementsDue | undefined> {
    const [updatedDue] = await db
      .update(confirmationStatementsDue)
      .set({ ...confirmationStatementsDueData, updatedAt: new Date() })
      .where(and(eq(confirmationStatementsDue.teamId, teamId), eq(confirmationStatementsDue.weekEnding, weekEnding)))
      .returning();
    return updatedDue || undefined;
  }

  // Confirmation Statement Turnaround
  async getConfirmationStatementTurnaround(teamId: number, weekEnding: string): Promise<ConfirmationStatementTurnaround | undefined> {
    const [turnaround] = await db
      .select()
      .from(confirmationStatementTurnaround)
      .where(and(eq(confirmationStatementTurnaround.teamId, teamId), eq(confirmationStatementTurnaround.weekEnding, weekEnding)));
    return turnaround || undefined;
  }

  async getAllConfirmationStatementTurnaround(teamId?: number, orgId?: number): Promise<any[]> {
    const selectShape = {
      id: confirmationStatementTurnaround.id,
      teamId: confirmationStatementTurnaround.teamId,
      weekEnding: confirmationStatementTurnaround.weekEnding,
      turnaroundTimeDays: confirmationStatementTurnaround.turnaroundTimeDays,
      notes: confirmationStatementTurnaround.notes,
      createdAt: confirmationStatementTurnaround.createdAt,
      updatedAt: confirmationStatementTurnaround.updatedAt,
      team: {
        id: teams.id,
        name: teams.name,
      }
    };
    if (teamId) {
      return await db
        .select(selectShape)
        .from(confirmationStatementTurnaround)
        .leftJoin(teams, eq(confirmationStatementTurnaround.teamId, teams.id))
        .where(eq(confirmationStatementTurnaround.teamId, teamId))
        .orderBy(desc(confirmationStatementTurnaround.weekEnding));
    }
    if (orgId) {
      return await db
        .select(selectShape)
        .from(confirmationStatementTurnaround)
        .leftJoin(teams, eq(confirmationStatementTurnaround.teamId, teams.id))
        .where(eq(confirmationStatementTurnaround.organisationId, orgId))
        .orderBy(desc(confirmationStatementTurnaround.weekEnding));
    }
    return await db
      .select(selectShape)
      .from(confirmationStatementTurnaround)
      .leftJoin(teams, eq(confirmationStatementTurnaround.teamId, teams.id))
      .orderBy(desc(confirmationStatementTurnaround.weekEnding));
  }

  async createConfirmationStatementTurnaround(turnaroundData: InsertConfirmationStatementTurnaround): Promise<ConfirmationStatementTurnaround> {
    const [newTurnaround] = await db
      .insert(confirmationStatementTurnaround)
      .values(turnaroundData)
      .returning();
    return newTurnaround;
  }

  async updateConfirmationStatementTurnaround(teamId: number, weekEnding: string, turnaroundData: Partial<InsertConfirmationStatementTurnaround>): Promise<ConfirmationStatementTurnaround | undefined> {
    const [updatedTurnaround] = await db
      .update(confirmationStatementTurnaround)
      .set({ ...turnaroundData, updatedAt: new Date() })
      .where(and(eq(confirmationStatementTurnaround.teamId, teamId), eq(confirmationStatementTurnaround.weekEnding, weekEnding)))
      .returning();
    return updatedTurnaround || undefined;
  }

  async deleteConfirmationStatementTurnaround(teamId: number, weekEnding: string): Promise<void> {
    await db
      .delete(confirmationStatementTurnaround)
      .where(and(eq(confirmationStatementTurnaround.teamId, teamId), eq(confirmationStatementTurnaround.weekEnding, weekEnding)));
  }

  // Tax Data
  async getTaxData(teamId: number, weekEnding: string): Promise<TaxData | undefined> {
    const [taxDataResult] = await db
      .select()
      .from(taxData)
      .where(and(eq(taxData.teamId, teamId), eq(taxData.weekEnding, weekEnding)));
    return taxDataResult || undefined;
  }

  async getAllTaxData(teamId?: number, orgId?: number): Promise<TaxData[]> {
    if (teamId) {
      return await db
        .select()
        .from(taxData)
        .where(eq(taxData.teamId, teamId))
        .orderBy(desc(taxData.weekEnding));
    }
    if (orgId) {
      return await db
        .select()
        .from(taxData)
        .where(eq(taxData.organisationId, orgId))
        .orderBy(desc(taxData.weekEnding));
    }
    return await db
      .select()
      .from(taxData)
      .orderBy(desc(taxData.weekEnding));
  }

  async createTaxData(taxDataInput: InsertTaxData): Promise<TaxData> {
    const [newTaxData] = await db
      .insert(taxData)
      .values(taxDataInput)
      .returning();
    return newTaxData;
  }

  async updateTaxData(teamId: number, weekEnding: string, taxDataInput: Partial<InsertTaxData>): Promise<TaxData | undefined> {
    const [updatedTaxData] = await db
      .update(taxData)
      .set({ ...taxDataInput, updatedAt: new Date() })
      .where(and(eq(taxData.teamId, teamId), eq(taxData.weekEnding, weekEnding)))
      .returning();
    return updatedTaxData || undefined;
  }

  async deleteTaxData(teamId: number, weekEnding: string): Promise<void> {
    await db
      .delete(taxData)
      .where(and(eq(taxData.teamId, teamId), eq(taxData.weekEnding, weekEnding)));
  }

  // Revenue Analytics Targets
  async getRevenueAnalyticsTarget(teamId: number, weekEnding: string): Promise<RevenueAnalyticsTarget | undefined> {
    const [target] = await db
      .select()
      .from(revenueAnalyticsTargets)
      .where(and(eq(revenueAnalyticsTargets.teamId, teamId), eq(revenueAnalyticsTargets.weekEnding, weekEnding)));
    return target || undefined;
  }

  async getAllRevenueAnalyticsTargets(teamId?: number, orgId?: number): Promise<RevenueAnalyticsTarget[]> {
    if (teamId) {
      return await db
        .select()
        .from(revenueAnalyticsTargets)
        .where(eq(revenueAnalyticsTargets.teamId, teamId))
        .orderBy(desc(revenueAnalyticsTargets.weekEnding));
    }
    if (orgId) {
      return await db
        .select()
        .from(revenueAnalyticsTargets)
        .where(eq(revenueAnalyticsTargets.organisationId, orgId))
        .orderBy(desc(revenueAnalyticsTargets.weekEnding));
    }
    return await db
      .select()
      .from(revenueAnalyticsTargets)
      .orderBy(desc(revenueAnalyticsTargets.weekEnding));
  }

  async createRevenueAnalyticsTarget(target: InsertRevenueAnalyticsTarget): Promise<RevenueAnalyticsTarget> {
    const existing = await this.getRevenueAnalyticsTarget(target.teamId, target.weekEnding);
    
    if (existing) {
      const [updated] = await db
        .update(revenueAnalyticsTargets)
        .set({ ...target, updatedAt: new Date() })
        .where(and(eq(revenueAnalyticsTargets.teamId, target.teamId), eq(revenueAnalyticsTargets.weekEnding, target.weekEnding)))
        .returning();
      return updated;
    }

    const [newTarget] = await db
      .insert(revenueAnalyticsTargets)
      .values(target)
      .returning();
    return newTarget;
  }

  async updateRevenueAnalyticsTarget(teamId: number, weekEnding: string, target: Partial<InsertRevenueAnalyticsTarget>): Promise<RevenueAnalyticsTarget | undefined> {
    const [updated] = await db
      .update(revenueAnalyticsTargets)
      .set({ ...target, updatedAt: new Date() })
      .where(and(eq(revenueAnalyticsTargets.teamId, teamId), eq(revenueAnalyticsTargets.weekEnding, weekEnding)))
      .returning();
    return updated || undefined;
  }

  async deleteRevenueAnalyticsTarget(teamId: number, weekEnding: string): Promise<void> {
    await db
      .delete(revenueAnalyticsTargets)
      .where(and(eq(revenueAnalyticsTargets.teamId, teamId), eq(revenueAnalyticsTargets.weekEnding, weekEnding)));
  }

  // Revenue Analytics Results
  async getRevenueAnalyticsResult(teamId: number, weekEnding: string): Promise<RevenueAnalyticsResult | undefined> {
    const [result] = await db
      .select()
      .from(revenueAnalyticsResults)
      .where(and(eq(revenueAnalyticsResults.teamId, teamId), eq(revenueAnalyticsResults.weekEnding, weekEnding)));
    return result || undefined;
  }

  async getAllRevenueAnalyticsResults(teamId?: number, orgId?: number): Promise<RevenueAnalyticsResult[]> {
    if (teamId) {
      return await db
        .select()
        .from(revenueAnalyticsResults)
        .where(eq(revenueAnalyticsResults.teamId, teamId))
        .orderBy(desc(revenueAnalyticsResults.weekEnding));
    }
    if (orgId) {
      return await db
        .select()
        .from(revenueAnalyticsResults)
        .where(eq(revenueAnalyticsResults.organisationId, orgId))
        .orderBy(desc(revenueAnalyticsResults.weekEnding));
    }
    return await db
      .select()
      .from(revenueAnalyticsResults)
      .orderBy(desc(revenueAnalyticsResults.weekEnding));
  }

  async createRevenueAnalyticsResult(result: InsertRevenueAnalyticsResult): Promise<RevenueAnalyticsResult> {
    const existing = await this.getRevenueAnalyticsResult(result.teamId, result.weekEnding);
    
    if (existing) {
      const [updated] = await db
        .update(revenueAnalyticsResults)
        .set({ ...result, updatedAt: new Date() })
        .where(and(eq(revenueAnalyticsResults.teamId, result.teamId), eq(revenueAnalyticsResults.weekEnding, result.weekEnding)))
        .returning();
      return updated;
    }

    const [newResult] = await db
      .insert(revenueAnalyticsResults)
      .values(result)
      .returning();
    return newResult;
  }

  async updateRevenueAnalyticsResult(teamId: number, weekEnding: string, result: Partial<InsertRevenueAnalyticsResult>): Promise<RevenueAnalyticsResult | undefined> {
    const [updated] = await db
      .update(revenueAnalyticsResults)
      .set({ ...result, updatedAt: new Date() })
      .where(and(eq(revenueAnalyticsResults.teamId, teamId), eq(revenueAnalyticsResults.weekEnding, weekEnding)))
      .returning();
    return updated || undefined;
  }

  async deleteRevenueAnalyticsResult(teamId: number, weekEnding: string): Promise<void> {
    await db
      .delete(revenueAnalyticsResults)
      .where(and(eq(revenueAnalyticsResults.teamId, teamId), eq(revenueAnalyticsResults.weekEnding, weekEnding)));
  }

  // Revenue Analytics Performance Data
  async getRevenueAnalyticsPerformanceData(teamId?: number, orgId?: number): Promise<Array<{
    teamId: number;
    teamName: string;
    weekEnding: string;
    targets: RevenueAnalyticsTarget | null;
    results: RevenueAnalyticsResult | null;
    calculatedMRR: number | null;
  }>> {
    const teamsData = await this.getAllTeams(orgId);
    const targetsData = await this.getAllRevenueAnalyticsTargets(teamId, orgId);
    const resultsData = await this.getAllRevenueAnalyticsResults(teamId, orgId);
    
    // Get all unique weeks from targets and results
    const allWeeks = new Set([
      ...targetsData.map(t => t.weekEnding),
      ...resultsData.map(r => r.weekEnding)
    ]);
    
    const performanceData: Array<{
      teamId: number;
      teamName: string;
      weekEnding: string;
      targets: RevenueAnalyticsTarget | null;
      results: RevenueAnalyticsResult | null;
      calculatedMRR: number | null;
    }> = [];

    // Filter teams if teamId is specified
    const filteredTeams = teamId ? teamsData.filter(t => t.id === teamId) : teamsData;

    filteredTeams.forEach(team => {
      Array.from(allWeeks).forEach(weekEnding => {
        const target = targetsData.find(t => t.teamId === team.id && t.weekEnding === weekEnding) || null;
        const result = resultsData.find(r => r.teamId === team.id && r.weekEnding === weekEnding) || null;
        
        // Calculate MRR (Monthly Recurring Revenue) = Average Fee Per Client × Number of Clients
        const calculatedMRR = result && result.averageFeePerClient && result.numberOfClients 
          ? result.averageFeePerClient * result.numberOfClients
          : null;

        performanceData.push({
          teamId: team.id,
          teamName: team.name,
          weekEnding,
          targets: target,
          results: result,
          calculatedMRR,
        });
      });
    });

    return performanceData.sort((a, b) => 
      new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime()
    );
  }

  // Tax year calculations
  async getTaxYearCumulativeTotal(teamId: number, weekEnding: string, taxYearStart: string): Promise<number> {
    const result = await db
      .select({
        total: taxData.personalTaxCompletedThisWeek
      })
      .from(taxData)
      .where(
        and(
          eq(taxData.teamId, teamId),
          eq(taxData.taxYearStart, taxYearStart),
          // Include all weeks up to and including the specified week
          lte(taxData.weekEnding, weekEnding)
        )
      );

    return result.reduce((sum, row) => sum + (row.total || 0), 0);
  }

  async getTaxYearProgressData(teamId?: number, orgId?: number): Promise<Array<{
    teamId: number;
    teamName: string;
    weekEnding: string;
    completedThisWeek: number;
    cumulativeCompleted: number;
    totalTarget: number;
    percentageComplete: number;
    taxYearStart: string;
  }>> {
    // Get all teams and tax data with joins
    const conditions = [];
    if (teamId) conditions.push(eq(taxData.teamId, teamId));
    else if (orgId) conditions.push(eq(taxData.organisationId, orgId));

    const query = db
      .select({
        taxDataId: taxData.id,
        teamId: taxData.teamId,
        teamName: teams.name,
        weekEnding: taxData.weekEnding,
        completedThisWeek: taxData.personalTaxCompletedThisWeek,
        totalTarget: taxData.personalTaxTotalToComplete,
        taxYearStart: taxData.taxYearStart,
      })
      .from(taxData)
      .leftJoin(teams, eq(taxData.teamId, teams.id));

    if (conditions.length > 0) {
      query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
    }

    const taxResults = await query.orderBy(desc(taxData.weekEnding));

    // Calculate cumulative totals for each entry
    const progressData: Array<{
      teamId: number;
      teamName: string;
      weekEnding: string;
      completedThisWeek: number;
      cumulativeCompleted: number;
      totalTarget: number;
      percentageComplete: number;
      taxYearStart: string;
    }> = [];

    for (const row of taxResults) {
      // Calculate cumulative total for this team/tax year up to this week
      const cumulativeCompleted = await this.getTaxYearCumulativeTotal(
        row.teamId, 
        row.weekEnding, 
        row.taxYearStart
      );

      const percentageComplete = row.totalTarget > 0 
        ? Math.round((cumulativeCompleted / row.totalTarget) * 100)
        : 0;

      progressData.push({
        teamId: row.teamId,
        teamName: row.teamName || `Team ${row.teamId}`,
        weekEnding: row.weekEnding,
        completedThisWeek: row.completedThisWeek || 0,
        cumulativeCompleted,
        totalTarget: row.totalTarget || 0,
        percentageComplete,
        taxYearStart: row.taxYearStart,
      });
    }

    return progressData;
  }

  // Risk Analyses
  async getAllRiskAnalyses(orgId?: number, teamId?: number): Promise<RiskAnalysis[]> {
    const conditions = [];
    if (orgId) conditions.push(eq(riskAnalyses.organisationId, orgId));
    if (teamId) conditions.push(eq(riskAnalyses.teamId, teamId));

    if (conditions.length > 0) {
      return await db
        .select()
        .from(riskAnalyses)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(riskAnalyses.analysisDate));
    }
    return await db
      .select()
      .from(riskAnalyses)
      .orderBy(desc(riskAnalyses.analysisDate));
  }

  async getRiskAnalysis(id: number): Promise<RiskAnalysis | undefined> {
    const [analysis] = await db
      .select()
      .from(riskAnalyses)
      .where(eq(riskAnalyses.id, id));
    return analysis || undefined;
  }

  async createRiskAnalysis(analysis: InsertRiskAnalysis): Promise<RiskAnalysis> {
    const [newAnalysis] = await db
      .insert(riskAnalyses)
      .values(analysis)
      .returning();
    return newAnalysis;
  }

  async getLatestRiskAnalysis(moduleType: string, teamId?: number): Promise<RiskAnalysis | undefined> {
    if (teamId !== undefined) {
      const [analysis] = await db
        .select()
        .from(riskAnalyses)
        .where(and(eq(riskAnalyses.moduleType, moduleType), eq(riskAnalyses.teamId, teamId)))
        .orderBy(desc(riskAnalyses.createdAt))
        .limit(1);
      return analysis || undefined;
    }
    
    const [analysis] = await db
      .select()
      .from(riskAnalyses)
      .where(eq(riskAnalyses.moduleType, moduleType))
      .orderBy(desc(riskAnalyses.createdAt))
      .limit(1);
    
    return analysis || undefined;
  }

  // Action Recommendations
  async getAllActionRecommendations(riskAnalysisId?: number, orgId?: number): Promise<ActionRecommendation[]> {
    if (riskAnalysisId) {
      return await db
        .select()
        .from(actionRecommendations)
        .where(eq(actionRecommendations.riskAnalysisId, riskAnalysisId))
        .orderBy(desc(actionRecommendations.createdAt));
    }
    if (orgId) {
      return await db
        .select({
          id: actionRecommendations.id,
          riskAnalysisId: actionRecommendations.riskAnalysisId,
          priority: actionRecommendations.priority,
          category: actionRecommendations.category,
          recommendation: actionRecommendations.recommendation,
          expectedImpact: actionRecommendations.expectedImpact,
          timeframe: actionRecommendations.timeframe,
          estimatedEffort: actionRecommendations.estimatedEffort,
          status: actionRecommendations.status,
          assignedTo: actionRecommendations.assignedTo,
          completedAt: actionRecommendations.completedAt,
          createdAt: actionRecommendations.createdAt,
          updatedAt: actionRecommendations.updatedAt,
        })
        .from(actionRecommendations)
        .innerJoin(riskAnalyses, eq(actionRecommendations.riskAnalysisId, riskAnalyses.id))
        .where(eq(riskAnalyses.organisationId, orgId))
        .orderBy(desc(actionRecommendations.createdAt));
    }
    return await db
      .select()
      .from(actionRecommendations)
      .orderBy(desc(actionRecommendations.createdAt));
  }

  async getActionRecommendation(id: number): Promise<ActionRecommendation | undefined> {
    const [recommendation] = await db
      .select()
      .from(actionRecommendations)
      .where(eq(actionRecommendations.id, id));
    return recommendation || undefined;
  }

  async createActionRecommendation(recommendation: InsertActionRecommendation): Promise<ActionRecommendation> {
    const [newRecommendation] = await db
      .insert(actionRecommendations)
      .values(recommendation)
      .returning();
    return newRecommendation;
  }

  async updateActionRecommendation(id: number, recommendation: Partial<InsertActionRecommendation>): Promise<ActionRecommendation | undefined> {
    const [updatedRecommendation] = await db
      .update(actionRecommendations)
      .set({ ...recommendation, updatedAt: new Date() })
      .where(eq(actionRecommendations.id, id))
      .returning();
    return updatedRecommendation || undefined;
  }

  // Clarifying Questions
  async getAllClarifyingQuestions(riskAnalysisId?: number, orgId?: number): Promise<ClarifyingQuestion[]> {
    if (riskAnalysisId) {
      return await db
        .select()
        .from(clarifyingQuestions)
        .where(eq(clarifyingQuestions.riskAnalysisId, riskAnalysisId))
        .orderBy(desc(clarifyingQuestions.createdAt));
    }
    if (orgId) {
      return await db
        .select({
          id: clarifyingQuestions.id,
          riskAnalysisId: clarifyingQuestions.riskAnalysisId,
          question: clarifyingQuestions.question,
          context: clarifyingQuestions.context,
          priority: clarifyingQuestions.priority,
          status: clarifyingQuestions.status,
          createdAt: clarifyingQuestions.createdAt,
          updatedAt: clarifyingQuestions.updatedAt,
        })
        .from(clarifyingQuestions)
        .innerJoin(riskAnalyses, eq(clarifyingQuestions.riskAnalysisId, riskAnalyses.id))
        .where(eq(riskAnalyses.organisationId, orgId))
        .orderBy(desc(clarifyingQuestions.createdAt));
    }
    return await db
      .select()
      .from(clarifyingQuestions)
      .orderBy(desc(clarifyingQuestions.createdAt));
  }

  async getClarifyingQuestion(id: number): Promise<ClarifyingQuestion | undefined> {
    const [question] = await db
      .select()
      .from(clarifyingQuestions)
      .where(eq(clarifyingQuestions.id, id));
    return question || undefined;
  }

  async createClarifyingQuestion(question: InsertClarifyingQuestion): Promise<ClarifyingQuestion> {
    const [newQuestion] = await db
      .insert(clarifyingQuestions)
      .values(question)
      .returning();
    return newQuestion;
  }

  async updateClarifyingQuestion(id: number, question: Partial<InsertClarifyingQuestion>): Promise<ClarifyingQuestion | undefined> {
    const [updatedQuestion] = await db
      .update(clarifyingQuestions)
      .set(question)
      .where(eq(clarifyingQuestions.id, id))
      .returning();
    return updatedQuestion || undefined;
  }

  // Team Responses
  async getAllTeamResponses(questionId?: number): Promise<TeamResponse[]> {
    if (questionId) {
      return await db
        .select()
        .from(teamResponses)
        .where(eq(teamResponses.questionId, questionId))
        .orderBy(desc(teamResponses.createdAt));
    }
    return await db
      .select()
      .from(teamResponses)
      .orderBy(desc(teamResponses.createdAt));
  }

  async getTeamResponse(id: number): Promise<TeamResponse | undefined> {
    const [response] = await db
      .select()
      .from(teamResponses)
      .where(eq(teamResponses.id, id));
    return response || undefined;
  }

  async createTeamResponse(response: InsertTeamResponse): Promise<TeamResponse> {
    const [newResponse] = await db
      .insert(teamResponses)
      .values(response)
      .returning();
    return newResponse;
  }

  // Analysis Comments
  async getAllAnalysisComments(riskAnalysisId: number): Promise<AnalysisComment[]> {
    return await db
      .select()
      .from(analysisComments)
      .where(eq(analysisComments.riskAnalysisId, riskAnalysisId))
      .orderBy(desc(analysisComments.createdAt));
  }

  async getAnalysisComment(id: number): Promise<AnalysisComment | undefined> {
    const [comment] = await db
      .select()
      .from(analysisComments)
      .where(eq(analysisComments.id, id));
    return comment || undefined;
  }

  async createAnalysisComment(comment: InsertAnalysisComment): Promise<AnalysisComment> {
    const [newComment] = await db
      .insert(analysisComments)
      .values(comment)
      .returning();
    return newComment;
  }

  async updateAnalysisComment(id: number, comment: Partial<InsertAnalysisComment>): Promise<AnalysisComment | undefined> {
    const [updatedComment] = await db
      .update(analysisComments)
      .set(comment)
      .where(eq(analysisComments.id, id))
      .returning();
    return updatedComment || undefined;
  }

  async deleteAnalysisComment(id: number): Promise<void> {
    await db
      .delete(analysisComments)
      .where(eq(analysisComments.id, id));
  }

  // Quarterly Goals
  async getAllQuarterlyGoals(orgId?: number): Promise<QuarterlyGoal[]> {
    if (orgId) {
      return await db
        .select()
        .from(quarterlyGoals)
        .where(eq(quarterlyGoals.organisationId, orgId))
        .orderBy(desc(quarterlyGoals.endDate));
    }
    return await db
      .select()
      .from(quarterlyGoals)
      .orderBy(desc(quarterlyGoals.endDate));
  }

  async getQuarterlyGoal(id: number): Promise<QuarterlyGoal | undefined> {
    const [goal] = await db
      .select()
      .from(quarterlyGoals)
      .where(eq(quarterlyGoals.id, id));
    return goal || undefined;
  }

  async createQuarterlyGoal(goal: InsertQuarterlyGoal): Promise<QuarterlyGoal> {
    const [newGoal] = await db
      .insert(quarterlyGoals)
      .values(goal)
      .returning();
    return newGoal;
  }

  async updateQuarterlyGoal(id: number, goal: Partial<InsertQuarterlyGoal>): Promise<QuarterlyGoal | undefined> {
    const [updatedGoal] = await db
      .update(quarterlyGoals)
      .set({ ...goal, updatedAt: new Date() })
      .where(eq(quarterlyGoals.id, id))
      .returning();
    return updatedGoal || undefined;
  }

  async deleteQuarterlyGoal(id: number): Promise<void> {
    // Delete all related targets first
    await db
      .delete(quarterlyTargets)
      .where(eq(quarterlyTargets.quarterlyGoalId, id));
    
    // Then delete the goal
    await db
      .delete(quarterlyGoals)
      .where(eq(quarterlyGoals.id, id));
  }

  // Quarterly Targets
  async getAllQuarterlyTargets(quarterlyGoalId?: number, orgId?: number): Promise<QuarterlyTarget[]> {
    const conditions = [];
    if (quarterlyGoalId !== undefined) {
      conditions.push(eq(quarterlyTargets.quarterlyGoalId, quarterlyGoalId));
    }
    if (orgId !== undefined) {
      conditions.push(eq(quarterlyTargets.organisationId, orgId));
    }
    return await db.select().from(quarterlyTargets)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(quarterlyTargets.createdAt));
  }

  async getQuarterlyTarget(id: number): Promise<QuarterlyTarget | undefined> {
    const [target] = await db
      .select()
      .from(quarterlyTargets)
      .where(eq(quarterlyTargets.id, id));
    return target || undefined;
  }

  async createQuarterlyTarget(target: InsertQuarterlyTarget): Promise<QuarterlyTarget> {
    const [newTarget] = await db
      .insert(quarterlyTargets)
      .values(target)
      .returning();
    return newTarget;
  }

  async updateQuarterlyTarget(id: number, target: Partial<InsertQuarterlyTarget>): Promise<QuarterlyTarget | undefined> {
    const [updatedTarget] = await db
      .update(quarterlyTargets)
      .set({ ...target, updatedAt: new Date(), lastUpdated: new Date() })
      .where(eq(quarterlyTargets.id, id))
      .returning();
    return updatedTarget || undefined;
  }

  async deleteQuarterlyTarget(id: number): Promise<void> {
    await db
      .delete(quarterlyTargets)
      .where(eq(quarterlyTargets.id, id));
  }

  // Rock Reminder Dismissals
  async getRockReminderDismissals(userId: number): Promise<RockReminderDismissal[]> {
    return await db
      .select()
      .from(rockReminderDismissals)
      .where(eq(rockReminderDismissals.userId, userId));
  }

  async createRockReminderDismissal(dismissal: InsertRockReminderDismissal): Promise<RockReminderDismissal> {
    const existingDismissal = await db
      .select()
      .from(rockReminderDismissals)
      .where(
        and(
          eq(rockReminderDismissals.userId, dismissal.userId),
          eq(rockReminderDismissals.reminderType, dismissal.reminderType),
          eq(rockReminderDismissals.periodDate, dismissal.periodDate),
          dismissal.quarterlyGoalId
            ? eq(rockReminderDismissals.quarterlyGoalId, dismissal.quarterlyGoalId)
            : isNull(rockReminderDismissals.quarterlyGoalId)
        )
      )
      .limit(1);

    if (existingDismissal.length > 0) {
      const [updatedDismissal] = await db
        .update(rockReminderDismissals)
        .set({ 
          snoozedUntil: dismissal.snoozedUntil,
          dismissedAt: new Date()
        })
        .where(eq(rockReminderDismissals.id, existingDismissal[0].id))
        .returning();
      return updatedDismissal;
    }

    const [newDismissal] = await db
      .insert(rockReminderDismissals)
      .values(dismissal)
      .returning();
    return newDismissal;
  }

  // Values operations
  async getAllValues(orgId?: number): Promise<Value[]> {
    if (orgId) {
      return await db.select().from(values)
        .where(eq(values.organisationId, orgId))
        .orderBy(desc(values.createdAt));
    }
    return await db.select().from(values).orderBy(desc(values.createdAt));
  }

  async getValue(id: number): Promise<Value | undefined> {
    const [value] = await db.select().from(values).where(eq(values.id, id));
    return value || undefined;
  }

  async createValue(value: InsertValue): Promise<Value> {
    const [newValue] = await db
      .insert(values)
      .values(value)
      .returning();
    return newValue;
  }

  async updateValue(id: number, value: Partial<InsertValue>): Promise<Value | undefined> {
    const [updatedValue] = await db
      .update(values)
      .set({ ...value, updatedAt: new Date() })
      .where(eq(values.id, id))
      .returning();
    return updatedValue || undefined;
  }

  async deleteValue(id: number): Promise<void> {
    await db
      .delete(values)
      .where(eq(values.id, id));
  }

  // Client Value Manager operations
  async getAllClientValueClients(teamId?: number, orgId?: number, archivedOnly = false): Promise<ClientValueClient[]> {
    const archiveFilter = archivedOnly
      ? eq(clientValueClients.isArchived, true)
      : eq(clientValueClients.isArchived, false);
    if (teamId !== undefined) {
      return await db.select().from(clientValueClients)
        .where(and(eq(clientValueClients.teamId, teamId), archiveFilter))
        .orderBy(clientValueClients.clientName);
    }
    if (orgId !== undefined) {
      return await db.select().from(clientValueClients)
        .where(and(eq(clientValueClients.organisationId, orgId), archiveFilter))
        .orderBy(clientValueClients.clientName);
    }
    return await db.select().from(clientValueClients)
      .where(archiveFilter)
      .orderBy(clientValueClients.clientName);
  }

  async getClientValueClient(id: number): Promise<ClientValueClient | undefined> {
    const [client] = await db.select().from(clientValueClients).where(eq(clientValueClients.id, id));
    return client || undefined;
  }

  async createClientValueClient(client: InsertClientValueClient): Promise<ClientValueClient> {
    const [newClient] = await db.insert(clientValueClients).values(client).returning();
    return newClient;
  }

  async updateClientValueClient(id: number, client: Partial<InsertClientValueClient>): Promise<ClientValueClient | undefined> {
    const [updated] = await db
      .update(clientValueClients)
      .set({ ...client, updatedAt: new Date() })
      .where(eq(clientValueClients.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteClientValueClient(id: number): Promise<void> {
    await db.delete(clientValueClients).where(eq(clientValueClients.id, id));
  }

  // Waitlist operations
  async createWaitlistRegistration(data: InsertWaitlistRegistration): Promise<WaitlistRegistration> {
    const [reg] = await db.insert(waitlistRegistrations).values(data).returning();
    return reg;
  }

  async getWaitlistRegistrationByEmail(email: string): Promise<WaitlistRegistration | undefined> {
    const [reg] = await db.select().from(waitlistRegistrations).where(eq(waitlistRegistrations.email, email));
    return reg || undefined;
  }

  async getAllWaitlistRegistrations(): Promise<WaitlistRegistration[]> {
    return db.select().from(waitlistRegistrations).orderBy(waitlistRegistrations.createdAt);
  }

  async deleteWaitlistRegistration(id: number): Promise<void> {
    await db.delete(waitlistRegistrations).where(eq(waitlistRegistrations.id, id));
  }

  async createValuationSubmission(data: Omit<ValuationSubmission, 'id' | 'createdAt' | 'webhookSent' | 'webhookSentAt'>): Promise<ValuationSubmission> {
    const [sub] = await db.insert(valuationSubmissions).values(data as any).returning();
    return sub;
  }

  async getValuationSubmission(id: number): Promise<ValuationSubmission | undefined> {
    const [sub] = await db.select().from(valuationSubmissions).where(eq(valuationSubmissions.id, id));
    return sub || undefined;
  }

  async updateValuationSubmission(id: number, data: Partial<ValuationSubmission>): Promise<ValuationSubmission | undefined> {
    const [sub] = await db.update(valuationSubmissions).set(data as any).where(eq(valuationSubmissions.id, id)).returning();
    return sub || undefined;
  }

  async getAllValuationSubmissions(): Promise<ValuationSubmission[]> {
    return db.select().from(valuationSubmissions).orderBy(desc(valuationSubmissions.createdAt));
  }

  async deleteValuationSubmission(id: number): Promise<void> {
    await db.delete(valuationSubmissions).where(eq(valuationSubmissions.id, id));
  }

  async getConfirmedValuationBenchmarks(): Promise<{ count: number; avgMid: number; avgGrf: number; avgEbitda: number; topAction: string | null }> {
    const rows = await db.select().from(valuationSubmissions).where(eq(valuationSubmissions.emailConfirmed, true));
    if (rows.length === 0) return { count: 0, avgMid: 0, avgGrf: 0, avgEbitda: 0, topAction: null };
    const count = rows.length;
    const avgMid = rows.reduce((s, r) => s + parseFloat(String(r.midValuation || 0)), 0) / count;
    const avgGrf = rows.reduce((s, r) => s + parseFloat(String(r.grf || 0)), 0) / count;
    const avgEbitda = rows.reduce((s, r) => s + parseFloat(String(r.ebitdaPercent || 0)), 0) / count;
    const actionCounts: Record<string, number> = {};
    for (const r of rows) {
      if (r.improvementAction1) actionCounts[r.improvementAction1] = (actionCounts[r.improvementAction1] || 0) + 1;
    }
    const topAction = Object.keys(actionCounts).length > 0
      ? Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0][0]
      : null;
    return { count, avgMid, avgGrf, avgEbitda, topAction };
  }

  async logValuationEvent(submissionId: number | null, eventType: string): Promise<void> {
    await db.insert(valuationEvents).values({ submissionId, eventType });
  }

  // ── Management Reports ──────────────────────────────────────────────────────

  async getAllReportClients(orgId: number): Promise<ReportClient[]> {
    return db.select().from(reportClients)
      .where(and(eq(reportClients.organisationId, orgId), eq(reportClients.isActive, true)))
      .orderBy(reportClients.clientName);
  }

  async getReportClient(id: number): Promise<ReportClient | undefined> {
    const [row] = await db.select().from(reportClients).where(eq(reportClients.id, id));
    return row;
  }

  async createReportClient(client: InsertReportClient): Promise<ReportClient> {
    const [row] = await db.insert(reportClients).values(client).returning();
    return row;
  }

  async updateReportClient(id: number, client: Partial<InsertReportClient>): Promise<ReportClient | undefined> {
    const [row] = await db.update(reportClients)
      .set({ ...client, updatedAt: new Date() })
      .where(eq(reportClients.id, id))
      .returning();
    return row;
  }

  async deleteReportClient(id: number): Promise<void> {
    await db.update(reportClients)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(reportClients.id, id));
  }

  async getStrategicPlanForClient(clientId: number): Promise<StrategicPlan | undefined> {
    const [row] = await db.select().from(strategicPlans)
      .where(eq(strategicPlans.clientId, clientId))
      .orderBy(desc(strategicPlans.updatedAt))
      .limit(1);
    return row;
  }

  async getStrategicPlan(id: number): Promise<StrategicPlan | undefined> {
    const [row] = await db.select().from(strategicPlans).where(eq(strategicPlans.id, id));
    return row;
  }

  async upsertStrategicPlan(data: InsertStrategicPlan): Promise<StrategicPlan> {
    const existing = await this.getStrategicPlanForClient(data.clientId);
    if (existing) {
      const [row] = await db.update(strategicPlans)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(strategicPlans.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db.insert(strategicPlans).values(data).returning();
    return row;
  }

  async createManagementReportPeriod(period: InsertManagementReportPeriod): Promise<ManagementReportPeriod> {
    const [row] = await db.insert(managementReportPeriods).values(period).returning();
    return row;
  }

  async getAllReportsForClient(clientId: number, orgId: number): Promise<Array<ManagementReport & { period: ManagementReportPeriod }>> {
    const rows = await db.select({
      report: managementReports,
      period: managementReportPeriods,
    })
      .from(managementReports)
      .innerJoin(managementReportPeriods, eq(managementReports.periodId, managementReportPeriods.id))
      .where(and(eq(managementReports.clientId, clientId), eq(managementReports.organisationId, orgId)))
      .orderBy(desc(managementReportPeriods.periodStart));
    return rows.map(r => ({ ...r.report, period: r.period }));
  }

  async getManagementReport(id: number): Promise<(ManagementReport & { period: ManagementReportPeriod; client: ReportClient }) | undefined> {
    const [row] = await db.select({
      report: managementReports,
      period: managementReportPeriods,
      client: reportClients,
    })
      .from(managementReports)
      .innerJoin(managementReportPeriods, eq(managementReports.periodId, managementReportPeriods.id))
      .innerJoin(reportClients, eq(managementReports.clientId, reportClients.id))
      .where(eq(managementReports.id, id));
    if (!row) return undefined;
    return { ...row.report, period: row.period, client: row.client };
  }

  async createManagementReport(report: InsertManagementReport): Promise<ManagementReport> {
    const [row] = await db.insert(managementReports).values(report).returning();
    return row;
  }

  async updateManagementReport(id: number, data: Partial<InsertManagementReport>): Promise<ManagementReport | undefined> {
    const [row] = await db.update(managementReports)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(managementReports.id, id))
      .returning();
    return row;
  }

  async getReportStructureForClient(clientId: number): Promise<ReportStructure | undefined> {
    const [row] = await db.select().from(reportStructures)
      .where(eq(reportStructures.clientId, clientId))
      .orderBy(desc(reportStructures.updatedAt))
      .limit(1);
    return row;
  }

  async upsertReportStructure(data: Partial<InsertReportStructure> & { clientId: number; organisationId: number }): Promise<ReportStructure> {
    const existing = await this.getReportStructureForClient(data.clientId);
    if (existing) {
      const [row] = await db.update(reportStructures)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(reportStructures.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db.insert(reportStructures).values(data as InsertReportStructure).returning();
    return row;
  }

  async approveReportStructure(id: number): Promise<ReportStructure | undefined> {
    const [row] = await db.update(reportStructures)
      .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(reportStructures.id, id))
      .returning();
    return row;
  }

  // ─── Coaching Tool ────────────────────────────────────────────────────────

  async getAllCoachingClients(orgId: number): Promise<CoachingClient[]> {
    return db.select().from(coachingClients)
      .where(eq(coachingClients.organisationId, orgId))
      .orderBy(coachingClients.name);
  }

  async getCoachingLastSessionDates(orgId: number): Promise<Record<number, string>> {
    const rows = await db
      .select({
        clientId: coachingSessionNotes.clientId,
        lastDate: sql<string>`MAX(${coachingSessionNotes.noteDate})`,
      })
      .from(coachingSessionNotes)
      .where(eq(coachingSessionNotes.organisationId, orgId))
      .groupBy(coachingSessionNotes.clientId);
    return Object.fromEntries(rows.map((r) => [r.clientId, r.lastDate]));
  }

  async getCoachingClient(id: number): Promise<CoachingClient | undefined> {
    const [row] = await db.select().from(coachingClients).where(eq(coachingClients.id, id));
    return row;
  }

  async getCoachingClientByLinkedUser(userId: number): Promise<CoachingClient | undefined> {
    const [row] = await db.select().from(coachingClients).where(eq(coachingClients.linkedUserId, userId));
    return row;
  }

  async createCoachingClient(data: InsertCoachingClient): Promise<CoachingClient> {
    const [row] = await db.insert(coachingClients).values({ ...data, updatedAt: new Date() }).returning();
    return row;
  }

  async updateCoachingClient(id: number, data: Partial<InsertCoachingClient>): Promise<CoachingClient | undefined> {
    const [row] = await db.update(coachingClients).set({ ...data, updatedAt: new Date() }).where(eq(coachingClients.id, id)).returning();
    return row;
  }

  async deleteCoachingClient(id: number): Promise<void> {
    await db.delete(coachingActions).where(eq(coachingActions.clientId, id));
    await db.delete(coachingQuarterlyObjectives).where(eq(coachingQuarterlyObjectives.clientId, id));
    await db.delete(coachingStrategicGoals).where(eq(coachingStrategicGoals.clientId, id));
    await db.delete(coachingSessionNotes).where(eq(coachingSessionNotes.clientId, id));
    // sessions cannot be individually deleted but must be removed when the client is deleted
    await db.delete(coachingSessions).where(eq(coachingSessions.clientId, id));
    await db.delete(coachingClients).where(eq(coachingClients.id, id));
  }

  async getAllCoachingSessionNotes(clientId: number, sharedOnly?: boolean): Promise<CoachingSessionNote[]> {
    const conditions = [eq(coachingSessionNotes.clientId, clientId)];
    if (sharedOnly) conditions.push(eq(coachingSessionNotes.sharedWithClient, true));
    return db.select().from(coachingSessionNotes)
      .where(and(...conditions))
      .orderBy(desc(coachingSessionNotes.noteDate));
  }

  async getCoachingSessionNote(id: number): Promise<CoachingSessionNote | undefined> {
    const [row] = await db.select().from(coachingSessionNotes).where(eq(coachingSessionNotes.id, id));
    return row;
  }

  async createCoachingSessionNote(data: InsertCoachingSessionNote): Promise<CoachingSessionNote> {
    const [row] = await db.insert(coachingSessionNotes).values({ ...data, updatedAt: new Date() }).returning();
    return row;
  }

  async updateCoachingSessionNote(id: number, data: Partial<InsertCoachingSessionNote>): Promise<CoachingSessionNote | undefined> {
    const [row] = await db.update(coachingSessionNotes).set({ ...data, updatedAt: new Date() }).where(eq(coachingSessionNotes.id, id)).returning();
    return row;
  }

  async deleteCoachingSessionNote(id: number): Promise<void> {
    await db.delete(coachingSessionNotes).where(eq(coachingSessionNotes.id, id));
  }

  async getAllCoachingStrategicGoals(clientId: number): Promise<CoachingStrategicGoal[]> {
    return db.select().from(coachingStrategicGoals)
      .where(eq(coachingStrategicGoals.clientId, clientId))
      .orderBy(coachingStrategicGoals.horizon, coachingStrategicGoals.sortOrder);
  }

  async getCoachingStrategicGoal(id: number): Promise<CoachingStrategicGoal | undefined> {
    const [row] = await db.select().from(coachingStrategicGoals).where(eq(coachingStrategicGoals.id, id));
    return row;
  }

  async createCoachingStrategicGoal(data: InsertCoachingStrategicGoal): Promise<CoachingStrategicGoal> {
    const [row] = await db.insert(coachingStrategicGoals).values({ ...data, updatedAt: new Date() }).returning();
    return row;
  }

  async updateCoachingStrategicGoal(id: number, data: Partial<InsertCoachingStrategicGoal>): Promise<CoachingStrategicGoal | undefined> {
    const [row] = await db.update(coachingStrategicGoals).set({ ...data, updatedAt: new Date() }).where(eq(coachingStrategicGoals.id, id)).returning();
    return row;
  }

  async deleteCoachingStrategicGoal(id: number): Promise<void> {
    await db.delete(coachingStrategicGoals).where(eq(coachingStrategicGoals.id, id));
  }

  async getAllCoachingQuarterlyObjectives(clientId: number, quarter?: number, year?: number): Promise<CoachingQuarterlyObjective[]> {
    const conditions = [eq(coachingQuarterlyObjectives.clientId, clientId)];
    if (quarter !== undefined) conditions.push(eq(coachingQuarterlyObjectives.quarter, quarter));
    if (year !== undefined) conditions.push(eq(coachingQuarterlyObjectives.year, year));
    return db.select().from(coachingQuarterlyObjectives)
      .where(and(...conditions))
      .orderBy(coachingQuarterlyObjectives.sortOrder);
  }

  async getCoachingQuarterlyObjective(id: number): Promise<CoachingQuarterlyObjective | undefined> {
    const [row] = await db.select().from(coachingQuarterlyObjectives).where(eq(coachingQuarterlyObjectives.id, id));
    return row;
  }

  async createCoachingQuarterlyObjective(data: InsertCoachingQuarterlyObjective): Promise<CoachingQuarterlyObjective> {
    const [row] = await db.insert(coachingQuarterlyObjectives).values({ ...data, updatedAt: new Date() }).returning();
    return row;
  }

  async updateCoachingQuarterlyObjective(id: number, data: Partial<InsertCoachingQuarterlyObjective>): Promise<CoachingQuarterlyObjective | undefined> {
    const [row] = await db.update(coachingQuarterlyObjectives).set({ ...data, updatedAt: new Date() }).where(eq(coachingQuarterlyObjectives.id, id)).returning();
    return row;
  }

  async deleteCoachingQuarterlyObjective(id: number): Promise<void> {
    await db.delete(coachingQuarterlyObjectives).where(eq(coachingQuarterlyObjectives.id, id));
  }

  async carryForwardCoachingObjective(id: number): Promise<CoachingQuarterlyObjective> {
    const [orig] = await db.select().from(coachingQuarterlyObjectives).where(eq(coachingQuarterlyObjectives.id, id));
    if (!orig) throw new Error("Objective not found");
    // mark original as carried
    await db.update(coachingQuarterlyObjectives)
      .set({ status: "carried", updatedAt: new Date() })
      .where(eq(coachingQuarterlyObjectives.id, id));
    // compute next quarter
    const nextQuarter = orig.quarter === 4 ? 1 : orig.quarter + 1;
    const nextYear = orig.quarter === 4 ? orig.year + 1 : orig.year;
    const [copy] = await db.insert(coachingQuarterlyObjectives).values({
      organisationId: orig.organisationId,
      clientId: orig.clientId,
      quarter: nextQuarter,
      year: nextYear,
      objective: orig.objective,
      status: "not_started",
      sortOrder: orig.sortOrder,
      updatedAt: new Date(),
    }).returning();
    return copy;
  }

  // ─── Coaching Sessions ────────────────────────────────────────────────────
  //
  // The `transcript` column was added after initial production deploy.
  // We probe once per process and fall back to explicit columns if absent.

  private _sessionHasTranscript: boolean | null = null;

  private async sessionHasTranscript(): Promise<boolean> {
    if (this._sessionHasTranscript !== null) return this._sessionHasTranscript;
    try {
      await db.execute(sql`SELECT transcript FROM coaching_sessions LIMIT 0`);
      this._sessionHasTranscript = true;
    } catch {
      this._sessionHasTranscript = false;
    }
    return this._sessionHasTranscript;
  }

  // Columns present in the original schema (no transcript) — used as fallback
  private get _sessionColsNoTranscript() {
    return {
      id: coachingSessions.id,
      organisationId: coachingSessions.organisationId,
      clientId: coachingSessions.clientId,
      sessionDate: coachingSessions.sessionDate,
      status: coachingSessions.status,
      agendaNotes: coachingSessions.agendaNotes,
      clientSummary: coachingSessions.clientSummary,
      clientSummaryShared: coachingSessions.clientSummaryShared,
      internalSummary: coachingSessions.internalSummary,
      createdAt: coachingSessions.createdAt,
      updatedAt: coachingSessions.updatedAt,
    };
  }

  async getAllCoachingSessions(clientId: number, sharedOnly?: boolean): Promise<CoachingSession[]> {
    const conditions = [eq(coachingSessions.clientId, clientId)];
    if (sharedOnly) conditions.push(eq(coachingSessions.clientSummaryShared, true));
    const hasTranscript = await this.sessionHasTranscript();
    if (hasTranscript) {
      return db.select().from(coachingSessions)
        .where(and(...conditions))
        .orderBy(desc(coachingSessions.sessionDate));
    }
    return db.select(this._sessionColsNoTranscript).from(coachingSessions)
      .where(and(...conditions))
      .orderBy(desc(coachingSessions.sessionDate)) as unknown as CoachingSession[];
  }

  async getCoachingSession(id: number): Promise<CoachingSession | undefined> {
    const hasTranscript = await this.sessionHasTranscript();
    if (hasTranscript) {
      const [row] = await db.select().from(coachingSessions).where(eq(coachingSessions.id, id));
      return row;
    }
    const [row] = await db.select(this._sessionColsNoTranscript).from(coachingSessions)
      .where(eq(coachingSessions.id, id));
    return row as unknown as CoachingSession | undefined;
  }

  async getOrCreateOpenSession(orgId: number, clientId: number, sessionDate: string): Promise<CoachingSession> {
    const hasTranscript = await this.sessionHasTranscript();
    const whereOpen = and(
      eq(coachingSessions.clientId, clientId),
      eq(coachingSessions.sessionDate, sessionDate),
      eq(coachingSessions.status, "open"),
    );
    if (hasTranscript) {
      const [existing] = await db.select().from(coachingSessions).where(whereOpen);
      if (existing) return existing;
      const [row] = await db.insert(coachingSessions).values({
        organisationId: orgId, clientId, sessionDate, status: "open", updatedAt: new Date(),
      }).returning();
      return row;
    }
    const [existing] = await db.select(this._sessionColsNoTranscript).from(coachingSessions).where(whereOpen);
    if (existing) return existing as unknown as CoachingSession;
    const [row] = await db.insert(coachingSessions).values({
      organisationId: orgId, clientId, sessionDate, status: "open", updatedAt: new Date(),
    }).returning(this._sessionColsNoTranscript);
    return row as unknown as CoachingSession;
  }

  async createCoachingSession(data: InsertCoachingSession): Promise<CoachingSession> {
    const hasTranscript = await this.sessionHasTranscript();
    if (hasTranscript) {
      const [row] = await db.insert(coachingSessions).values({ ...data, updatedAt: new Date() }).returning();
      return row;
    }
    const [row] = await db.insert(coachingSessions).values({ ...data, updatedAt: new Date() })
      .returning(this._sessionColsNoTranscript);
    return row as unknown as CoachingSession;
  }

  async updateCoachingSession(id: number, data: Partial<InsertCoachingSession>): Promise<CoachingSession | undefined> {
    const hasTranscript = await this.sessionHasTranscript();
    if (hasTranscript) {
      const [row] = await db.update(coachingSessions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(coachingSessions.id, id))
        .returning();
      return row;
    }
    // Strip transcript from the update payload so prod doesn't choke on unknown column
    const { transcript: _t, ...safeData } = data as any;
    const [row] = await db.update(coachingSessions)
      .set({ ...safeData, updatedAt: new Date() })
      .where(eq(coachingSessions.id, id))
      .returning(this._sessionColsNoTranscript);
    return row as unknown as CoachingSession | undefined;
  }

  // ─── Coaching Actions ─────────────────────────────────────────────────────

  async getAllCoachingActions(clientId: number, ownerFilter?: string): Promise<CoachingAction[]> {
    const conditions = [eq(coachingActions.clientId, clientId)];
    if (ownerFilter) conditions.push(eq(coachingActions.owner, ownerFilter));
    return db.select().from(coachingActions)
      .where(and(...conditions))
      .orderBy(coachingActions.deadline);
  }

  async getCoachingAction(id: number): Promise<CoachingAction | undefined> {
    const [row] = await db.select().from(coachingActions).where(eq(coachingActions.id, id));
    return row;
  }

  async createCoachingAction(data: InsertCoachingAction): Promise<CoachingAction> {
    const [row] = await db.insert(coachingActions).values({ ...data, updatedAt: new Date() }).returning();
    return row;
  }

  async updateCoachingAction(id: number, data: Partial<InsertCoachingAction>): Promise<CoachingAction | undefined> {
    const [row] = await db.update(coachingActions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(coachingActions.id, id))
      .returning();
    return row;
  }

  async carryForwardCoachingAction(actionId: number, toSessionId: number): Promise<CoachingAction> {
    const [orig] = await db.select().from(coachingActions).where(eq(coachingActions.id, actionId));
    if (!orig) throw new Error("Action not found");
    // mark original as carried, record which session it was carried to
    await db.update(coachingActions)
      .set({ status: "carried", carriedToSessionId: toSessionId, updatedAt: new Date() })
      .where(eq(coachingActions.id, actionId));
    // create fresh copy on the new session
    const [copy] = await db.insert(coachingActions).values({
      organisationId: orig.organisationId,
      clientId: orig.clientId,
      sessionId: toSessionId,
      description: orig.description,
      owner: orig.owner,
      deadline: orig.deadline,
      status: "open",
      linkedObjectiveId: orig.linkedObjectiveId,
      linkedGoalId: orig.linkedGoalId,
      updatedAt: new Date(),
    }).returning();
    return copy;
  }

  // ─── Financial Clarity Review ────────────────────────────────────────────
  async getAllFinancialClarityReviews(orgId: number): Promise<FinancialClarityReview[]> {
    return db.select().from(financialClarityReviews)
      .where(eq(financialClarityReviews.organisationId, orgId))
      .orderBy(desc(financialClarityReviews.createdAt));
  }
  async getFinancialClarityReview(id: number): Promise<FinancialClarityReview | undefined> {
    const [row] = await db.select().from(financialClarityReviews).where(eq(financialClarityReviews.id, id));
    return row;
  }
  async createFinancialClarityReview(data: InsertFinancialClarityReview): Promise<FinancialClarityReview> {
    const [row] = await db.insert(financialClarityReviews).values({ ...data, updatedAt: new Date() }).returning();
    return row;
  }
  async updateFinancialClarityReview(id: number, data: Partial<InsertFinancialClarityReview>): Promise<FinancialClarityReview | undefined> {
    const [row] = await db.update(financialClarityReviews).set({ ...data, updatedAt: new Date() }).where(eq(financialClarityReviews.id, id)).returning();
    return row;
  }
  async deleteFinancialClarityReview(id: number): Promise<void> {
    await db.delete(financialClarityReviews).where(eq(financialClarityReviews.id, id));
  }

  async deleteCoachingAction(id: number): Promise<void> {
    await db.delete(coachingActions).where(eq(coachingActions.id, id));
  }
}

export const storage = new DatabaseStorage();
