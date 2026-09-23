import { db } from "./db";
import { teams, weeklyTargets, weeklyResults, accountsDue } from "@shared/schema";

async function initializeDatabase() {
  try {
    console.log("Creating sample teams...");
    
    // Create sample teams
    const team1 = await db.insert(teams).values({
      name: "Team Alpha",
      description: "Main accounting team"
    }).returning();
    
    const team2 = await db.insert(teams).values({
      name: "Team Beta", 
      description: "Secondary accounting team"
    }).returning();

    console.log("Teams created:", team1, team2);

    // Create sample weekly targets
    const currentDate = new Date();
    const weekEnding = new Date(currentDate);
    weekEnding.setDate(currentDate.getDate() - currentDate.getDay() + 6); // Saturday

    await db.insert(weeklyTargets).values([
      {
        teamId: team1[0].id,
        weekEnding: weekEnding.toISOString().split('T')[0],
        rollingFourWeekTarget: 100
      },
      {
        teamId: team2[0].id,
        weekEnding: weekEnding.toISOString().split('T')[0],
        rollingFourWeekTarget: 80
      }
    ]);

    // Create sample weekly results
    await db.insert(weeklyResults).values([
      {
        teamId: team1[0].id,
        weekEnding: weekEnding.toISOString().split('T')[0],
        actualCompleted: 85
      },
      {
        teamId: team2[0].id,
        weekEnding: weekEnding.toISOString().split('T')[0],
        actualCompleted: 75
      }
    ]);

    // Create sample accounts due
    await db.insert(accountsDue).values([
      {
        teamId: team1[0].id,
        weekEnding: weekEnding.toISOString().split('T')[0],
        accountsDue: 15
      },
      {
        teamId: team2[0].id,
        weekEnding: weekEnding.toISOString().split('T')[0],
        accountsDue: 12
      }
    ]);

    console.log("Database initialized successfully!");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

initializeDatabase();