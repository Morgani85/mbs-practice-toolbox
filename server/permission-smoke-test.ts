import { hashPassword } from "./auth";
import { storage } from "./storage";
import { db } from "./db";
import { accountsDue, confirmationStatementsDue, riskAnalyses, actionRecommendations, clarifyingQuestions, teamResponses, analysisComments, userTeams } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

const TEST_PASSWORD = "TestPassword123!";

interface TestUser {
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "manager" | "user" | "viewer";
}

const TEST_USERS: TestUser[] = [
  { email: "test-admin@test.local", firstName: "Test", lastName: "Admin", role: "admin" },
  { email: "test-manager@test.local", firstName: "Test", lastName: "Manager", role: "manager" },
  { email: "test-user@test.local", firstName: "Test", lastName: "User", role: "user" },
  { email: "test-viewer@test.local", firstName: "Test", lastName: "Viewer", role: "viewer" },
];

interface TestCase {
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  endpoint: string;
  body?: any;
  expectedByRole: {
    unauthenticated: number | "allowed";
    admin: number | "allowed";
    manager: number | "allowed";
    user: number | "allowed";
    viewer: number | "allowed";
  };
}

interface TeamAccessTestCase {
  name: string;
  method: "GET" | "POST";
  endpoint: string;
  body?: any;
  role: string;
  expected: number;
}

let teamAId: number;
let teamBId: number;

function buildPermissionTests(): TestCase[] {
  return [
    {
      name: "GET /api/teams (all authenticated roles allowed)",
      method: "GET",
      endpoint: "/api/teams",
      expectedByRole: {
        unauthenticated: 401,
        admin: 200,
        manager: 200,
        user: 200,
        viewer: 200,
      },
    },
    {
      name: "POST /api/teams (admin/manager only)",
      method: "POST",
      endpoint: "/api/teams",
      body: null,
      expectedByRole: {
        unauthenticated: 401,
        admin: "allowed",
        manager: "allowed",
        user: 403,
        viewer: 403,
      },
    },
    {
      name: "POST /api/confirmation-statements-due (admin/manager/user only, TeamA)",
      method: "POST",
      endpoint: "/api/confirmation-statements-due",
      body: null,
      expectedByRole: {
        unauthenticated: 401,
        admin: "allowed",
        manager: "allowed",
        user: "allowed",
        viewer: 403,
      },
    },
    {
      name: `GET /api/confirmation-statements-due?teamId=TeamA (all authenticated)`,
      method: "GET",
      endpoint: "",
      expectedByRole: {
        unauthenticated: 401,
        admin: 200,
        manager: 200,
        user: 200,
        viewer: 200,
      },
    },
    {
      name: "POST /api/users/invite (admin only)",
      method: "POST",
      endpoint: "/api/users/invite",
      body: null,
      expectedByRole: {
        unauthenticated: 401,
        admin: "allowed",
        manager: 403,
        user: 403,
        viewer: 403,
      },
    },
    {
      name: "POST /api/risks-actions/generate-analysis (admin/manager/user only)",
      method: "POST",
      endpoint: "/api/risks-actions/generate-analysis",
      body: null,
      expectedByRole: {
        unauthenticated: 401,
        admin: "allowed",
        manager: "allowed",
        user: "allowed",
        viewer: 403,
      },
    },
    {
      name: "GET /api/overview-stats (all authenticated)",
      method: "GET",
      endpoint: "/api/overview-stats",
      expectedByRole: {
        unauthenticated: 401,
        admin: 200,
        manager: 200,
        user: 200,
        viewer: 200,
      },
    },
    {
      name: "PUT /api/teams/:id (admin/manager only)",
      method: "PUT",
      endpoint: "",
      body: { name: `_SmokeTest_Updated_${Date.now()}` },
      expectedByRole: {
        unauthenticated: 401,
        admin: "allowed",
        manager: "allowed",
        user: 403,
        viewer: 403,
      },
    },
    {
      name: "DELETE /api/teams/:id (admin/manager only)",
      method: "DELETE",
      endpoint: "/api/teams/999999",
      expectedByRole: {
        unauthenticated: 401,
        admin: "allowed",
        manager: "allowed",
        user: 403,
        viewer: 403,
      },
    },
    {
      name: "POST /api/accounts-due (admin/manager/user only, TeamA)",
      method: "POST",
      endpoint: "/api/accounts-due",
      body: null,
      expectedByRole: {
        unauthenticated: 401,
        admin: "allowed",
        manager: "allowed",
        user: "allowed",
        viewer: 403,
      },
    },
    {
      name: "POST /api/vat/results (admin/manager/user only, TeamA)",
      method: "POST",
      endpoint: "/api/vat/results",
      body: null,
      expectedByRole: {
        unauthenticated: 401,
        admin: "allowed",
        manager: "allowed",
        user: "allowed",
        viewer: 403,
      },
    },
    {
      name: "POST /api/client-bookkeeping/results (admin/manager/user only, TeamA)",
      method: "POST",
      endpoint: "/api/client-bookkeeping/results",
      body: null,
      expectedByRole: {
        unauthenticated: 401,
        admin: "allowed",
        manager: "allowed",
        user: "allowed",
        viewer: 403,
      },
    },
    {
      name: "GET /api/users (admin only)",
      method: "GET",
      endpoint: "/api/users",
      expectedByRole: {
        unauthenticated: 401,
        admin: 200,
        manager: 403,
        user: 403,
        viewer: 403,
      },
    },
    {
      name: "PUT /api/users/:id (admin only)",
      method: "PUT",
      endpoint: "/api/users/1",
      body: { firstName: "Updated", lastName: "Name" },
      expectedByRole: {
        unauthenticated: 401,
        admin: "allowed",
        manager: 403,
        user: 403,
        viewer: 403,
      },
    },
  ];
}

async function bootstrapTestUsers(): Promise<Record<string, number>> {
  console.log("\n📦 Bootstrapping test users...");
  const userIds: Record<string, number> = {};
  
  for (const testUser of TEST_USERS) {
    let existing = await storage.getUserByEmail(testUser.email);
    if (existing) {
      console.log(`  ✓ ${testUser.role}: ${testUser.email} (already exists, id=${existing.id})`);
      userIds[testUser.role] = existing.id;
      continue;
    }
    
    const hashedPassword = await hashPassword(TEST_PASSWORD);
    const user = await storage.createUser({
      email: testUser.email,
      firstName: testUser.firstName,
      lastName: testUser.lastName,
      password: hashedPassword,
      role: testUser.role,
      isActive: true,
    });
    userIds[testUser.role] = user.id;
    console.log(`  + ${testUser.role}: ${testUser.email} (created, id=${user.id})`);
  }
  
  return userIds;
}

async function bootstrapTeams(): Promise<void> {
  console.log("\n📦 Bootstrapping test teams...");
  
  const teamA = await storage.createTeam({ name: `_SmokeTest_TeamA_${Date.now()}` });
  teamAId = teamA.id;
  console.log(`  + TeamA: id=${teamAId}, name=${teamA.name}`);
  
  const teamB = await storage.createTeam({ name: `_SmokeTest_TeamB_${Date.now()}` });
  teamBId = teamB.id;
  console.log(`  + TeamB: id=${teamBId}, name=${teamB.name}`);
}

async function setupTeamMappings(userIds: Record<string, number>): Promise<void> {
  console.log("\n🔗 Setting up team mappings...");
  console.log(`  Mapping user (id=${userIds.user}) to TeamA (id=${teamAId}) ONLY`);
  await storage.addUserToTeam({ userId: userIds.user, teamId: teamAId });
  
  console.log(`  Mapping viewer (id=${userIds.viewer}) to TeamA (id=${teamAId}) ONLY`);
  await storage.addUserToTeam({ userId: userIds.viewer, teamId: teamAId });
  
  console.log("  Admin and manager bypass team checks (no mapping needed)");
}

async function login(email: string, password: string): Promise<string | null> {
  const baseUrl = process.env.TEST_BASE_URL || "http://localhost:5000";
  
  try {
    const response = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      redirect: "manual",
    });
    
    const cookies = response.headers.get("set-cookie");
    if (response.ok && cookies) {
      const sessionCookie = cookies.split(";")[0];
      return sessionCookie;
    }
    return null;
  } catch (error) {
    console.error(`Login failed for ${email}:`, error);
    return null;
  }
}

async function makeRequest(
  method: string,
  endpoint: string,
  cookie: string | null,
  body?: any
): Promise<number> {
  const baseUrl = process.env.TEST_BASE_URL || "http://localhost:5000";
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (cookie) {
    headers["Cookie"] = cookie;
  }
  
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return response.status;
  } catch (error) {
    console.error(`Request failed: ${method} ${endpoint}`, error);
    return 500;
  }
}

interface TestResult {
  testName: string;
  role: string;
  expected: number | "allowed";
  actual: number;
  passed: boolean;
}

function checkPassed(expected: number | "allowed", actual: number): boolean {
  if (expected === "allowed") {
    return actual !== 401 && actual !== 403;
  }
  return actual === expected;
}

const createdTestEmails: string[] = [];

async function runTests(): Promise<void> {
  console.log("\n🔐 Permission & Team Access Smoke Test Runner");
  console.log("================================================\n");
  
  const userIds = await bootstrapTestUsers();
  await bootstrapTeams();
  await setupTeamMappings(userIds);
  
  console.log("\n🔑 Logging in test users...");
  const sessions: Record<string, string | null> = {
    unauthenticated: null,
  };
  
  for (const testUser of TEST_USERS) {
    const cookie = await login(testUser.email, TEST_PASSWORD);
    sessions[testUser.role] = cookie;
    if (cookie) {
      console.log(`  ✓ ${testUser.role}: logged in`);
    } else {
      console.log(`  ✗ ${testUser.role}: login failed`);
    }
  }
  
  const results: TestResult[] = [];
  const roles = ["unauthenticated", "admin", "manager", "user", "viewer"] as const;
  
  // ===============================
  // PART 1: Permission Tests
  // ===============================
  console.log("\n🧪 PART 1: Permission tests...\n");
  
  const TEST_CASES = buildPermissionTests();
  
  for (const testCase of TEST_CASES) {
    console.log(`📋 ${testCase.name}`);
    
    for (const role of roles) {
      const cookie = sessions[role];
      const expected = testCase.expectedByRole[role];
      
      let body = testCase.body;
      let endpoint = testCase.endpoint;
      
      if (testCase.endpoint === "/api/users/invite" && body === null) {
        const inviteEmail = `invite-test-${Date.now()}-${role}@test.local`;
        body = { email: inviteEmail, firstName: "Invite", lastName: "Test", role: "viewer" };
        createdTestEmails.push(inviteEmail);
      }
      if (testCase.endpoint === "/api/teams" && testCase.method === "POST" && body === null) {
        const teamName = `_SmokeTest_${Date.now()}_${role}`;
        body = { name: teamName };
      }
      if (testCase.name.includes("confirmation-statements-due") && testCase.method === "POST" && body === null) {
        body = { teamId: teamAId, weekEnding: "2025-01-05", statementsDue: 10 };
      }
      if (testCase.name.includes("confirmation-statements-due") && testCase.method === "GET" && endpoint === "") {
        endpoint = `/api/confirmation-statements-due?teamId=${teamAId}`;
      }
      if (testCase.name.includes("PUT /api/teams/:id") && endpoint === "") {
        endpoint = `/api/teams/${teamAId}`;
      }
      if (testCase.name.includes("risks-actions/generate-analysis") && body === null) {
        body = { teamId: teamAId };
      }
      if (testCase.name.includes("accounts-due") && testCase.method === "POST" && body === null) {
        body = { teamId: teamAId, weekEnding: "2025-01-05", due: 10, done: 5, overdue: 2 };
      }
      if (testCase.name.includes("vat/results") && testCase.method === "POST" && body === null) {
        body = { teamId: teamAId, weekEnding: "2025-01-05", submitted: 10, notSubmitted: 5 };
      }
      if (testCase.name.includes("client-bookkeeping/results") && testCase.method === "POST" && body === null) {
        body = { teamId: teamAId, weekEnding: "2025-01-05", totalClients: 50, upToDate: 40, twoMonthsBehind: 5, threeMonthsBehind: 3, fourPlusMonthsBehind: 2 };
      }
      
      const actual = await makeRequest(testCase.method, endpoint, cookie, body);
      
      const passed = checkPassed(expected, actual);
      results.push({
        testName: testCase.name,
        role,
        expected,
        actual,
        passed,
      });
      
      const icon = passed ? "✅" : "❌";
      const status = passed ? "PASS" : "FAIL";
      const expectedStr = expected === "allowed" ? "allowed (not 401/403)" : String(expected);
      console.log(`   ${icon} ${role}: expected ${expectedStr}, got ${actual} [${status}]`);
    }
    console.log("");
  }
  
  // ===============================
  // PART 2: Team Access Tests
  // ===============================
  console.log("\n🧪 PART 2: Team access denial tests...\n");
  console.log(`  TeamA id=${teamAId} (user & viewer mapped here)`);
  console.log(`  TeamB id=${teamBId} (nobody mapped here)\n`);
  
  const teamAccessTests: TeamAccessTestCase[] = [
    {
      name: `READ TeamB denied: GET /api/confirmation-statements-due?teamId=${teamBId}`,
      method: "GET",
      endpoint: `/api/confirmation-statements-due?teamId=${teamBId}`,
      role: "user",
      expected: 403,
    },
    {
      name: `WRITE TeamB denied: POST /api/confirmation-statements-due (teamId=${teamBId})`,
      method: "POST",
      endpoint: "/api/confirmation-statements-due",
      body: { teamId: teamBId, weekEnding: "2025-01-05", statementsDue: 10 },
      role: "user",
      expected: 403,
    },
    {
      name: `READ TeamA allowed: GET /api/confirmation-statements-due?teamId=${teamAId}`,
      method: "GET",
      endpoint: `/api/confirmation-statements-due?teamId=${teamAId}`,
      role: "user",
      expected: 200,
    },
    {
      name: `WRITE TeamA allowed: POST /api/accounts-due (teamId=${teamAId})`,
      method: "POST",
      endpoint: "/api/accounts-due",
      body: { teamId: teamAId, weekEnding: "2025-06-15", accountsDue: 5, accountsDueInProgress: 2 },
      role: "user",
      expected: 201,
    },
    {
      name: `READ TeamB denied (viewer): GET /api/accounts-due?teamId=${teamBId}`,
      method: "GET",
      endpoint: `/api/accounts-due?teamId=${teamBId}`,
      role: "viewer",
      expected: 403,
    },
    {
      name: `READ TeamA allowed (viewer): GET /api/accounts-due?teamId=${teamAId}`,
      method: "GET",
      endpoint: `/api/accounts-due?teamId=${teamAId}`,
      role: "viewer",
      expected: 200,
    },
    {
      name: `Admin bypass: GET /api/confirmation-statements-due?teamId=${teamBId}`,
      method: "GET",
      endpoint: `/api/confirmation-statements-due?teamId=${teamBId}`,
      role: "admin",
      expected: 200,
    },
    {
      name: `Manager bypass: GET /api/confirmation-statements-due?teamId=${teamBId}`,
      method: "GET",
      endpoint: `/api/confirmation-statements-due?teamId=${teamBId}`,
      role: "manager",
      expected: 200,
    },
    {
      name: `Admin bypass WRITE: POST /api/accounts-due (teamId=${teamBId})`,
      method: "POST",
      endpoint: "/api/accounts-due",
      body: { teamId: teamBId, weekEnding: "2025-06-15", accountsDue: 3, accountsDueInProgress: 1 },
      role: "admin",
      expected: 201,
    },
    {
      name: `Manager bypass WRITE: POST /api/confirmation-statements-due (teamId=${teamBId})`,
      method: "POST",
      endpoint: "/api/confirmation-statements-due",
      body: { teamId: teamBId, weekEnding: "2025-06-15", statementsDue: 5 },
      role: "manager",
      expected: 201,
    },
  ];
  
  for (const tc of teamAccessTests) {
    const cookie = sessions[tc.role];
    const actual = await makeRequest(tc.method, tc.endpoint, cookie, tc.body);
    const passed = actual === tc.expected;
    
    results.push({
      testName: tc.name,
      role: tc.role,
      expected: tc.expected,
      actual,
      passed,
    });
    
    const icon = passed ? "✅" : "❌";
    const status = passed ? "PASS" : "FAIL";
    console.log(`📋 ${tc.name}`);
    console.log(`   ${icon} ${tc.role}: expected ${tc.expected}, got ${actual} [${status}]\n`);
  }
  
  // ===============================
  // SUMMARY
  // ===============================
  console.log("\n" + "=".repeat(60));
  console.log("📊 SUMMARY");
  console.log("=".repeat(60));
  
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  
  const permTests = results.filter(r => !r.testName.startsWith("READ ") && !r.testName.startsWith("WRITE ") && !r.testName.startsWith("Admin bypass") && !r.testName.startsWith("Manager bypass"));
  const teamTests = results.filter(r => r.testName.startsWith("READ ") || r.testName.startsWith("WRITE ") || r.testName.startsWith("Admin bypass") || r.testName.startsWith("Manager bypass"));
  
  console.log(`\n  Total tests: ${total}`);
  console.log(`    Permission tests: ${permTests.length}`);
  console.log(`    Team access tests: ${teamTests.length}`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log("\n❌ FAILED TESTS:");
    for (const result of results.filter((r) => !r.passed)) {
      const expectedStr = result.expected === "allowed" ? "allowed (not 401/403)" : String(result.expected);
      console.log(`   - ${result.testName} [${result.role}]: expected ${expectedStr}, got ${result.actual}`);
    }
  }
  
  const successRate = ((passed / total) * 100).toFixed(1);
  console.log(`\n  Success rate: ${successRate}%`);
  
  await cleanupTestData();
  
  if (failed === 0) {
    console.log("\n🎉 All permission & team access tests passed!\n");
    process.exit(0);
  } else {
    console.log("\n⚠️  Some tests failed. Review the results above.\n");
    process.exit(1);
  }
}

async function cleanupTestData(): Promise<void> {
  console.log("\n🧹 Cleaning up test data...");
  
  const allTeams = await storage.getAllTeams();
  const testTeamIds = allTeams
    .filter(t => t.name.startsWith("_SmokeTest_") || t.name.startsWith("Test Team"))
    .map(t => t.id);
  
  for (const tid of testTeamIds) {
    try {
      await db.delete(accountsDue).where(eq(accountsDue.teamId, tid));
      await db.delete(confirmationStatementsDue).where(eq(confirmationStatementsDue.teamId, tid));
      await db.delete(userTeams).where(eq(userTeams.teamId, tid));
      
      const analyses = await db.select({ id: riskAnalyses.id }).from(riskAnalyses).where(eq(riskAnalyses.teamId, tid));
      const analysisIds = analyses.map(a => a.id);
      if (analysisIds.length > 0) {
        await db.delete(analysisComments).where(inArray(analysisComments.riskAnalysisId, analysisIds));
        const questions = await db.select({ id: clarifyingQuestions.id }).from(clarifyingQuestions).where(inArray(clarifyingQuestions.riskAnalysisId, analysisIds));
        const qIds = questions.map(q => q.id);
        if (qIds.length > 0) {
          await db.delete(teamResponses).where(inArray(teamResponses.questionId, qIds));
        }
        await db.delete(clarifyingQuestions).where(inArray(clarifyingQuestions.riskAnalysisId, analysisIds));
        await db.delete(actionRecommendations).where(inArray(actionRecommendations.riskAnalysisId, analysisIds));
        await db.delete(riskAnalyses).where(eq(riskAnalyses.teamId, tid));
      }
    } catch (e: any) {
      console.log(`  - Warning cleaning team ${tid}: ${e.message}`);
    }
  }
  
  for (const team of allTeams) {
    if (testTeamIds.includes(team.id)) {
      try {
        await storage.deleteTeam(team.id);
        console.log(`  - Deleted test team: ${team.name}`);
      } catch (e: any) {
        console.log(`  - Warning: could not delete team ${team.name}: ${e.message}`);
      }
    }
  }
  
  for (const testUser of TEST_USERS) {
    const user = await storage.getUserByEmail(testUser.email);
    if (user) {
      await storage.deleteUser(user.id);
      console.log(`  - Deleted ${testUser.email}`);
    }
  }
  
  for (const email of createdTestEmails) {
    const user = await storage.getUserByEmail(email);
    if (user) {
      await storage.deleteUser(user.id);
      console.log(`  - Deleted ${email}`);
    }
  }
  
  const allUsers = await storage.getAllUsers();
  for (const user of allUsers) {
    if (user.email?.startsWith("invite-test-") && user.email?.endsWith("@test.local")) {
      await storage.deleteUser(user.id);
      console.log(`  - Deleted stale invite: ${user.email}`);
    }
  }
}

const args = process.argv.slice(2);
if (args.includes("--cleanup")) {
  cleanupTestData()
    .then(() => {
      console.log("✓ Cleanup complete\n");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Cleanup failed:", err);
      process.exit(1);
    });
} else {
  runTests().catch((err) => {
    console.error("Test runner failed:", err);
    process.exit(1);
  });
}
