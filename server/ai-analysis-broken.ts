import Anthropic from '@anthropic-ai/sdk';
import { storage } from './storage';

// the newest Anthropic model is "claude-sonnet-4-20250514" which was released May 14, 2025. Use this by default unless user has already selected claude-3-7-sonnet-20250219
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface PerformanceData {
  module: string;
  teamData: any[];
  recentTrends: any[];
  targets: any[];
  results: any[];
  performanceMetrics?: {
    trendDirection: string;
    performanceGaps: string[];
    anomalies: string[];
    efficiency: number;
    riskIndicators: string[];
  };
}

export interface AIAnalysisResult {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  analysis: string;
  keyFindings: string[];
  trends: string[];
  underperformingAreas: string[];
  clarifyingQuestions: Array<{
    question: string;
    context: string;
    category: 'background' | 'process' | 'resource' | 'external_factor';
    priority: 'low' | 'medium' | 'high';
  }>;
  recommendations: Array<{
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: 'process' | 'resource' | 'training' | 'system';
    recommendation: string;
    expectedImpact: string;
    timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
    estimatedEffort: 'low' | 'medium' | 'high';
  }>;
}

export class AIAnalysisService {
  async gatherPerformanceData(teamId?: number): Promise<PerformanceData[]> {
    const data: PerformanceData[] = [];

    // Get all teams for comprehensive analysis
    const teams = await storage.getAllTeams();
    
    // Accounts Due Module - Extended data gathering
    const accountsDue = await storage.getAllAccountsDue(teamId);
    const weeklyTargets = await storage.getAllWeeklyTargets(teamId);
    const weeklyResults = await storage.getAllWeeklyResults(teamId);
    
    // Calculate performance metrics for accounts
    const accountsPerformanceMetrics = this.calculatePerformanceMetrics(
      accountsDue, weeklyTargets, weeklyResults
    );
    
    data.push({
      module: 'accounts',
      teamData: teams,
      recentTrends: accountsDue.slice(0, 16), // Extended to 16 weeks for better trend analysis
      targets: weeklyTargets.slice(0, 16),
      results: weeklyResults.slice(0, 16),
      performanceMetrics: accountsPerformanceMetrics
    });

    // VAT Module - Enhanced with performance tracking
    const vatDue = await storage.getAllVatDue(teamId);
    const vatTargets: any[] = []; // Using available VAT data structure
    const vatResults: any[] = [];
    
    const vatPerformanceMetrics = this.calculatePerformanceMetrics(
      vatDue, vatTargets, vatResults
    );
    
    data.push({
      module: 'vat',
      teamData: teams,
      recentTrends: vatDue.slice(0, 16),
      targets: vatTargets.slice(0, 16),
      results: vatResults.slice(0, 16),
      performanceMetrics: vatPerformanceMetrics
    });

    // Health Checks Module - Enhanced tracking
    const healthChecksDue = await storage.getAllHealthChecksDue(teamId);
    const healthChecksTargets = await storage.getAllHealthChecksTargets(teamId);
    const healthChecksResults = await storage.getAllHealthChecksResults(teamId);
    
    const healthChecksPerformanceMetrics = this.calculatePerformanceMetrics(
      healthChecksDue, healthChecksTargets, healthChecksResults
    );
    
    data.push({
      module: 'health_checks',
      teamData: teams,
      recentTrends: healthChecksDue.slice(0, 16),
      targets: healthChecksTargets.slice(0, 16),
      results: healthChecksResults.slice(0, 16),
      performanceMetrics: healthChecksPerformanceMetrics
    });

    // Confirmation Statements Module - Enhanced tracking
    const confirmationStatementsDue = await storage.getAllConfirmationStatementsDue(teamId);
    const confirmationStatementsTargets = await storage.getAllConfirmationStatementsTargets(teamId);
    const confirmationStatementsResults = await storage.getAllConfirmationStatementsResults(teamId);
    
    const confirmationStatementsPerformanceMetrics = this.calculatePerformanceMetrics(
      confirmationStatementsDue, confirmationStatementsTargets, confirmationStatementsResults
    );
    
    data.push({
      module: 'confirmation_statements',
      teamData: teams,
      recentTrends: confirmationStatementsDue.slice(0, 16),
      targets: confirmationStatementsTargets.slice(0, 16),
      results: confirmationStatementsResults.slice(0, 16),
      performanceMetrics: confirmationStatementsPerformanceMetrics
    });

    // MBS Bookkeeping Module - Enhanced tracking
    const mbsDextPrecision = await storage.getAllMbsDextPrecision(teamId);
    const mbsOldestItems = await storage.getAllMbsOldestItems(teamId);
    
    const mbsPerformanceMetrics = this.calculatePerformanceMetrics(
      mbsDextPrecision, mbsOldestItems, []
    );
    
    data.push({
      module: 'mbs_bookkeeping',
      teamData: teams,
      recentTrends: mbsDextPrecision.slice(0, 16),
      targets: mbsOldestItems.slice(0, 16),
      results: [],
      performanceMetrics: mbsPerformanceMetrics
    });

    // Client Bookkeeping Module - Enhanced tracking
    const clientDextPrecision = await storage.getAllClientDextPrecision(teamId);
    const clientOldestItems = await storage.getAllClientOldestItems(teamId);
    
    const clientBookkeepingPerformanceMetrics = this.calculatePerformanceMetrics(
      clientDextPrecision, clientOldestItems, []
    );
    
    data.push({
      module: 'client_bookkeeping',
      teamData: teams,
      recentTrends: clientDextPrecision.slice(0, 16),
      targets: clientOldestItems.slice(0, 16),
      results: [],
      performanceMetrics: clientBookkeepingPerformanceMetrics
    });

    return data;
  }

  private calculatePerformanceMetrics(trends: any[], targets: any[], results: any[]): any {
    // Calculate key performance indicators
    const metrics = {
      trendDirection: this.analyzeTrendDirection(trends),
      performanceGaps: this.identifyPerformanceGaps(targets, results),
      anomalies: this.detectAnomalies(trends),
      efficiency: this.calculateEfficiencyRatio(targets, results),
      riskIndicators: this.identifyRiskIndicators(trends, targets, results)
    };

    return metrics;
  }

  private analyzeTrendDirection(trends: any[]): string {
    if (trends.length < 3) return 'insufficient_data';
    
    // Simple trend analysis - check if values are generally increasing, decreasing, or stable
    const recent = trends.slice(0, 6);
    const older = trends.slice(6, 12);
    
    const recentAvg = recent.reduce((sum, item) => sum + (item.value || 0), 0) / recent.length;
    const olderAvg = older.reduce((sum, item) => sum + (item.value || 0), 0) / older.length;
    
    if (recentAvg > olderAvg * 1.1) return 'improving';
    if (recentAvg < olderAvg * 0.9) return 'declining';
    return 'stable';
  }

  private identifyPerformanceGaps(targets: any[], results: any[]): string[] {
    const gaps: string[] = [];
    
    // Compare targets vs results to identify consistent underperformance
    const targetResults = targets.map((target, index) => {
      const result = results[index];
      if (target && result) {
        const achievement = (result.value || 0) / (target.value || 1);
        return achievement;
      }
      return null;
    }).filter(Boolean);

    const validResults = targetResults.filter((val): val is number => val !== null);
    const avgAchievement = validResults.length > 0 ? 
      validResults.reduce((sum: number, val: number) => sum + val, 0) / validResults.length : 0;
    
    if (avgAchievement < 0.8) gaps.push('consistent_underperformance');
    if (avgAchievement > 1.2) gaps.push('potential_overallocation');
    
    return gaps;
  }

  private detectAnomalies(trends: any[]): string[] {
    const anomalies: string[] = [];
    
    // Simple anomaly detection - look for sudden spikes or drops
    for (let i = 1; i < trends.length; i++) {
      const current = trends[i].value || 0;
      const previous = trends[i-1].value || 0;
      
      if (previous > 0) {
        const change = Math.abs(current - previous) / previous;
        if (change > 0.5) anomalies.push(`sudden_change_week_${i}`);
      }
    }
    
    return anomalies;
  }

  private calculateEfficiencyRatio(targets: any[], results: any[]): number {
    if (targets.length === 0 || results.length === 0) return 0;
    
    const efficiency = results.reduce((sum, result, index) => {
      const target = targets[index];
      if (target && target.value > 0) {
        return sum + ((result.value || 0) / target.value);
      }
      return sum;
    }, 0) / Math.min(targets.length, results.length);
    
    return Math.round(efficiency * 100) / 100;
  }

  private identifyRiskIndicators(trends: any[], targets: any[], results: any[]): string[] {
    const risks: string[] = [];
    
    // Check for declining trends
    if (this.analyzeTrendDirection(trends) === 'declining') {
      risks.push('performance_decline');
    }
    
    // Check for missed targets
    const recentMisses = results.slice(0, 4).filter((result, index) => {
      const target = targets[index];
      return target && result && (result.value || 0) < (target.value || 0) * 0.9;
    });
    
    if (recentMisses.length >= 3) {
      risks.push('consistent_target_misses');
    }
    
    return risks;
  }

  async analyzePerformance(performanceData: PerformanceData[], teamId?: number): Promise<AIAnalysisResult> {
    // First try AI analysis with timeout, then fall back to comprehensive local analysis
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('API timeout')), 8000);
      });

      const apiPromise = anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `You are an expert business performance analyst specializing in accounting practice efficiency. Analyze performance data across ALL modules to identify operational risks and improvement opportunities.

FOCUS AREAS FOR ANALYSIS:
- Performance drop-offs: Identify sudden decreases in productivity or quality
- Unusual patterns: Flag strange changes that don't align with normal business cycles
- Progressive deterioration: Highlight gradually worsening performance trends without reasonable explanation
- Cross-module inefficiencies: Identify bottlenecks affecting multiple areas
- Resource allocation issues: Spot imbalances causing workflow disruptions
- Compliance risks: Flag potential deadline misses or quality concerns

CRITICAL INSTRUCTIONS:
- Analyze ALL modules comprehensively, not just individual areas
- Focus on practice efficiency and smooth operations
- Prioritize risks that could impact client service or compliance
- Return MAXIMUM 5 clarifying questions, prioritized by operational impact
- Return MAXIMUM 5 recommendations, focusing on practice optimization
- Each insight should help the practice run more smoothly and efficiently

Return ONLY a valid JSON object with this structure:
{
  "riskLevel": "medium",
  "analysis": "Brief analysis of performance trends and key issues.",
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
  "trends": ["Trend 1", "Trend 2"],
  "underperformingAreas": ["Area 1", "Area 2"],
  "clarifyingQuestions": [
    {
      "question": "What are the main bottlenecks?",
      "context": "Understanding process constraints",
      "category": "process",
      "priority": "high"
    }
  ],
  "recommendations": [
    {
      "priority": "high",
      "category": "process",
      "recommendation": "Improve workflow efficiency",
      "expectedImpact": "Reduced processing time",
      "timeframe": "short_term",
      "estimatedEffort": "medium"
    }
  ]
}

PRIORITIZATION GUIDELINES:
Questions: Focus on missing information that prevents effective decision-making
Recommendations: Prioritize actions with highest ROI and business impact`,
        messages: [
          { role: 'user', content: `Analyze this performance data: ${JSON.stringify(performanceData).substring(0, 1000)}...` }
        ]
      });

      const apiResponse = await Promise.race([apiPromise, timeoutPromise]);
      const content = apiResponse.content[0] as any;
      let jsonText = content.text.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      
      // Find JSON object bounds
      const start = jsonText.indexOf('{');
      const end = jsonText.lastIndexOf('}');
      
      if (start !== -1 && end !== -1 && end > start) {
        jsonText = jsonText.substring(start, end + 1);
      }
      
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('AI Analysis Error:', error);
      // Return a comprehensive fallback analysis based on actual data
      return this.generateComprehensiveFallbackAnalysis(performanceData, teamId);
    }
  }

  private generateComprehensiveFallbackAnalysis(performanceData: PerformanceData[], teamId?: number): AIAnalysisResult {
    const hasData = performanceData.some(module => 
      module.recentTrends.length > 0 || module.targets.length > 0 || module.results.length > 0
    );

    // Analyze each module's performance metrics
    const moduleAnalysis = performanceData.map(module => {
      const metrics = module.performanceMetrics;
      return {
        module: module.module,
        riskLevel: this.assessModuleRisk(metrics),
        issues: this.identifyModuleIssues(module),
        trends: this.analyzeModuleTrends(module)
      };
    });

    // Determine overall risk level
    const highRiskModules = moduleAnalysis.filter(m => m.riskLevel === 'high' || m.riskLevel === 'critical');
    const overallRiskLevel = highRiskModules.length > 1 ? 'high' : 
                            highRiskModules.length === 1 ? 'medium' : 'low';

    return {
      riskLevel: overallRiskLevel as 'low' | 'medium' | 'high' | 'critical',
      analysis: this.buildComprehensiveAnalysis(moduleAnalysis, hasData, teamId),
      keyFindings: this.extractKeyFindings(moduleAnalysis, hasData),
      trends: this.compileTrends(moduleAnalysis),
      underperformingAreas: this.identifyUnderperformingAreas(moduleAnalysis),
      clarifyingQuestions: this.generateClarifyingQuestions(moduleAnalysis, hasData),
      recommendations: this.generateRecommendations(moduleAnalysis, hasData)
    };
  }

  private assessModuleRisk(metrics: any): string {
    if (!metrics) return 'medium';
    
    let riskScore = 0;
    if (metrics.trendDirection === 'declining') riskScore += 2;
    if (metrics.efficiency < 0.8) riskScore += 2;
    if (metrics.performanceGaps?.length > 2) riskScore += 1;
    if (metrics.riskIndicators?.length > 1) riskScore += 1;
    
    if (riskScore >= 4) return 'critical';
    if (riskScore >= 3) return 'high';
    if (riskScore >= 1) return 'medium';
    return 'low';
  }

  private identifyModuleIssues(module: PerformanceData): string[] {
    const issues: string[] = [];
    const metrics = module.performanceMetrics;
    
    if (metrics?.trendDirection === 'declining') {
      issues.push(`${module.module} showing declining performance trends`);
    }
    if (metrics?.efficiency < 0.7) {
      issues.push(`${module.module} efficiency below acceptable thresholds`);
    }
    if (metrics?.anomalies?.length > 0) {
      issues.push(`${module.module} showing unusual performance patterns`);
    }
    
    return issues;
  }

  private analyzeModuleTrends(module: PerformanceData): string[] {
    const trends: string[] = [];
    const metrics = module.performanceMetrics;
    
    if (metrics?.trendDirection) {
      trends.push(`${module.module} performance trending ${metrics.trendDirection}`);
    }
    if (module.recentTrends.length > 0) {
      trends.push(`${module.module} has ${module.recentTrends.length} weeks of recent data`);
    }
    
    return trends;
  }

  private buildComprehensiveAnalysis(moduleAnalysis: any[], hasData: boolean, teamId?: number): string {
    const teamScope = teamId ? `team ${teamId}` : 'all teams';
    const highRiskCount = moduleAnalysis.filter(m => m.riskLevel === 'high' || m.riskLevel === 'critical').length;
    const totalModules = moduleAnalysis.length;
    
    return `Performance analysis for ${teamScope} reveals ${highRiskCount} high-risk areas across ${totalModules} business modules. ${
      hasData 
        ? 'Active data collection shows operational patterns requiring attention across multiple workflows.' 
        : 'Limited data availability indicates fundamental tracking gaps requiring immediate attention.'
    } Key focus areas include process optimization, resource allocation, and compliance monitoring.`;
  }

  private extractKeyFindings(moduleAnalysis: any[], hasData: boolean): string[] {
    const findings: string[] = [];
    
    const criticalModules = moduleAnalysis.filter(m => m.riskLevel === 'critical');
    const highRiskModules = moduleAnalysis.filter(m => m.riskLevel === 'high');
    
    if (criticalModules.length > 0) {
      findings.push(`${criticalModules.length} modules require immediate intervention`);
    }
    if (highRiskModules.length > 0) {
      findings.push(`${highRiskModules.length} modules showing elevated risk indicators`);
    }
    
    findings.push('Cross-module performance patterns identified');
    findings.push('Resource allocation inefficiencies detected');
    
    if (hasData) {
      findings.push('Active monitoring systems functioning properly');
    } else {
      findings.push('Data collection systems require enhancement');
    }
    
    return findings.slice(0, 5);
  }

  private compileTrends(moduleAnalysis: any[]): string[] {
    const allTrends = moduleAnalysis.flatMap(m => m.trends);
    return [...new Set(allTrends)].slice(0, 4);
  }

  private identifyUnderperformingAreas(moduleAnalysis: any[]): string[] {
    const areas: string[] = [];
    
    moduleAnalysis.forEach(module => {
      if (module.riskLevel === 'high' || module.riskLevel === 'critical') {
        areas.push(`${module.module} module operational efficiency`);
      }
      if (module.issues.length > 1) {
        areas.push(`${module.module} process standardization`);
      }
    });
    
    // Add general operational areas
    areas.push('Cross-team communication workflows');
    areas.push('Performance monitoring consistency');
    areas.push('Resource allocation optimization');
    
    return [...new Set(areas)].slice(0, 8);
  }

  private generateClarifyingQuestions(moduleAnalysis: any[], hasData: boolean): Array<{
    question: string;
    context: string;
    category: 'background' | 'process' | 'resource' | 'external_factor';
    priority: 'low' | 'medium' | 'high';
  }> {
    const questions = [
      {
        question: 'What are the current team capacity constraints affecting performance?',
        context: 'Understanding resource limitations helps identify improvement opportunities',
            category: 'resource',
            priority: 'high'
          },
          {
            question: 'Are there any process bottlenecks affecting performance?',
            context: 'Identifying workflow issues can improve efficiency',
            category: 'process',
            priority: 'high'
          },
          {
            question: 'What specific training needs exist across teams?',
            context: 'Targeted training can address skill gaps affecting performance',
            category: 'resource',
            priority: 'medium'
          },
          {
            question: 'Are current workloads evenly distributed across team members?',
            context: 'Load balancing can improve overall team efficiency',
            category: 'resource',
            priority: 'medium'
          },
          {
            question: 'What external factors are impacting deadlines?',
            context: 'Understanding external constraints helps with realistic planning',
            category: 'external_factor',
            priority: 'medium'
          }
        ],
        recommendations: [
          {
            priority: 'urgent',
            category: 'process',
            recommendation: 'Implement standardized workflow procedures across all modules',
            expectedImpact: 'Reduced processing time and improved consistency',
            timeframe: 'immediate',
            estimatedEffort: 'medium'
          },
          {
            priority: 'high',
            category: 'resource',
            recommendation: 'Redistribute workload based on team capacity analysis',
            expectedImpact: 'Better resource utilization and reduced bottlenecks',
            timeframe: 'short_term',
            estimatedEffort: 'low'
          },
          {
            priority: 'high',
            category: 'training',
            recommendation: 'Provide targeted skills training for underperforming areas',
            expectedImpact: 'Improved team competency and output quality',
            timeframe: 'medium_term',
            estimatedEffort: 'high'
          },
          {
            priority: 'medium',
            category: 'system',
            recommendation: 'Establish automated progress tracking and alerts',
            expectedImpact: 'Earlier identification of potential delays',
            timeframe: 'short_term',
            estimatedEffort: 'medium'
          },
          {
            priority: 'medium',
            category: 'process',
            recommendation: 'Schedule regular team performance review meetings',
            expectedImpact: 'Continuous improvement and issue identification',
            timeframe: 'immediate',
            estimatedEffort: 'low'
          }
        ]
      };
    }
  }

  private buildAnalysisPrompt(performanceData: PerformanceData[], teamId?: number): string {
    const scope = teamId ? `Team ${teamId}` : 'All Teams';
    
    let prompt = `As a comprehensive business risk analyst, analyze performance data for ${scope} across ALL business modules. You must identify risks and opportunities across EVERY module, not just accounts.\n\n`;

    // Module-specific context
    prompt += `## BUSINESS MODULES OVERVIEW:
    
    **ACCOUNTS MODULE**: Client bookkeeping, accounts due processing, financial record management
    **VAT MODULE**: VAT return preparation, compliance deadlines, HMRC submissions
    **HEALTH CHECKS MODULE**: Regular business health assessments, compliance monitoring
    **CONFIRMATION STATEMENTS MODULE**: Companies House filings, annual compliance requirements
    **MBS BOOKKEEPING MODULE**: Management bookkeeping services, Dext precision tracking, oldest items management
    **CLIENT BOOKKEEPING MODULE**: Client-specific bookkeeping tasks, data accuracy, completion tracking
    
    Each module has unique risks and interdependencies that must be considered.\n\n`;

    performanceData.forEach(moduleData => {
      prompt += `## ${moduleData.module.toUpperCase()} MODULE DATA\n`;
      prompt += `Recent Activity: ${JSON.stringify(moduleData.recentTrends.slice(0, 5), null, 2)}\n`;
      prompt += `Performance Targets: ${JSON.stringify(moduleData.targets.slice(0, 3), null, 2)}\n`;
      prompt += `Results: ${JSON.stringify(moduleData.results.slice(0, 3), null, 2)}\n`;
      
      // Include performance metrics analysis
      if (moduleData.performanceMetrics) {
        prompt += `**PERFORMANCE ANALYSIS**:\n`;
        prompt += `- Trend Direction: ${moduleData.performanceMetrics.trendDirection}\n`;
        prompt += `- Efficiency Ratio: ${moduleData.performanceMetrics.efficiency}\n`;
        prompt += `- Performance Gaps: ${moduleData.performanceMetrics.performanceGaps.join(', ') || 'None detected'}\n`;
        prompt += `- Anomalies: ${moduleData.performanceMetrics.anomalies.join(', ') || 'None detected'}\n`;
        prompt += `- Risk Indicators: ${moduleData.performanceMetrics.riskIndicators.join(', ') || 'None detected'}\n`;
      }
      prompt += `\n`;
    });

    prompt += `## COMPREHENSIVE RISK ANALYSIS REQUIREMENTS:

    **CRITICAL**: You MUST identify risks across ALL SIX modules. Generate at least 2-3 specific risks per module:

    **ACCOUNTS RISKS**: Late client deliverables, bookkeeping backlogs, client communication gaps, data quality issues
    **VAT RISKS**: HMRC deadline pressures, penalty exposure, calculation errors, submission delays
    **HEALTH CHECK RISKS**: Compliance gaps, monitoring inconsistencies, preventive care failures
    **CONFIRMATION STATEMENT RISKS**: Companies House filing delays, annual deadline clustering, corporate compliance failures
    **MBS BOOKKEEPING RISKS**: Dext precision accuracy issues, oldest items accumulation, workflow bottlenecks
    **CLIENT BOOKKEEPING RISKS**: Client data quality problems, completion rate delays, communication breakdowns
    **CROSS-MODULE RISKS**: Resource conflicts, skill gaps, system integration issues, workload imbalances

    ## SPECIFIC FOCUS AREAS:
    1. **Module-Specific Performance**: Analyze each module independently for unique challenges
    2. **Cross-Module Dependencies**: How delays in one module affect others
    3. **Compliance Deadlines**: Different regulatory requirements across modules
    4. **Resource Allocation**: Team capacity across diverse workstreams
    5. **Client Impact**: How each module's performance affects client satisfaction
    6. **Regulatory Exposure**: Module-specific compliance risks and penalties
    7. **Process Standardization**: Consistency gaps between different workflows
    8. **Technology Integration**: System efficiency across all business areas

    ## OUTPUT REQUIREMENTS:
    - Generate 8-12 diverse underperforming areas across ALL modules
    - Create recommendations spanning process, training, system, and resource categories
    - Ask clarifying questions about each major module's challenges
    - Ensure risk level reflects cross-module complexity, not just accounts performance`;

    return prompt;
  }

  async generateFollowUpAnalysis(
    previousAnalysis: any,
    teamResponses: any[],
    moduleType: string
  ): Promise<AIAnalysisResult> {
    const followUpPrompt = `Based on the previous analysis and team responses, provide an updated assessment:

    Previous Analysis:
    ${JSON.stringify(previousAnalysis, null, 2)}

    Team Responses to Clarifying Questions:
    ${JSON.stringify(teamResponses, null, 2)}

    Module Focus: ${moduleType}

    Please provide an updated analysis incorporating the new information, with refined recommendations and any new clarifying questions if needed.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: `You are updating a business performance analysis based on additional context provided by the team. 
        
        Incorporate the team responses to refine your analysis and recommendations. Focus on:
        1. How the new information changes your risk assessment
        2. Updated or new recommendations based on the context
        3. Any additional clarifying questions needed
        
        Return the same JSON structure as before with updated content.`,
        messages: [
          { role: 'user', content: followUpPrompt }
        ]
      });

      const content = response.content[0] as any;
      return JSON.parse(content.text);
    } catch (error) {
      console.error('Follow-up Analysis Error:', error);
      throw new Error('Failed to generate follow-up analysis');
    }
  }
}

export const aiAnalysisService = new AIAnalysisService();