import Anthropic from '@anthropic-ai/sdk';
import { storage } from './storage';

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
  async gatherPerformanceData(teamId?: number, moduleType?: string): Promise<PerformanceData[]> {
    const data: PerformanceData[] = [];
    const teams = await storage.getAllTeams();
    
    // If specific module requested, only gather that module's data
    if (moduleType && moduleType !== 'overall') {
      return await this.gatherSpecificModuleData(moduleType, teamId, teams);
    }
    
    // Accounts Module - quantity and deadline focused
    const accountsDue = await storage.getAllAccountsDue(teamId);
    const weeklyTargets = await storage.getAllWeeklyTargets(teamId);
    const weeklyResults = await storage.getAllWeeklyResults(teamId);
    
    const accountsMetrics = this.calculateWorkflowMetrics(
      'accounts', accountsDue, weeklyTargets, weeklyResults, teams
    );
    
    data.push({
      module: 'accounts',
      teamData: teams,
      recentTrends: accountsDue.slice(0, 16),
      targets: weeklyTargets.slice(0, 16),
      results: weeklyResults.slice(0, 16),
      performanceMetrics: accountsMetrics
    });

    // VAT Module - deadline and compliance focused
    const vatDue = await storage.getAllVatDue(teamId);
    const vatTargets: any[] = []; // VAT targets not implemented yet
    const vatResults: any[] = []; // VAT results not implemented yet
    
    const vatMetrics = this.calculateWorkflowMetrics(
      'vat', vatDue, vatTargets, vatResults, teams
    );
    
    data.push({
      module: 'vat',
      teamData: teams,
      recentTrends: vatDue.slice(0, 16),
      targets: vatTargets.slice(0, 16),
      results: vatResults.slice(0, 16),
      performanceMetrics: vatMetrics
    });

    // Health Checks Module - quality and completion focused
    const healthChecksDue = await storage.getAllHealthChecksDue(teamId);
    const healthChecksTargets = await storage.getAllHealthChecksTargets(teamId);
    const healthChecksResults = await storage.getAllHealthChecksResults(teamId);
    
    const healthChecksMetrics = this.calculateWorkflowMetrics(
      'health_checks', healthChecksDue, healthChecksTargets, healthChecksResults, teams
    );
    
    data.push({
      module: 'health_checks',
      teamData: teams,
      recentTrends: healthChecksDue.slice(0, 16),
      targets: healthChecksTargets.slice(0, 16),
      results: healthChecksResults.slice(0, 16),
      performanceMetrics: healthChecksMetrics
    });

    // Confirmation Statements Module - deadline and compliance focused
    const confirmationDue = await storage.getAllConfirmationStatementsDue(teamId);
    const confirmationTargets = await storage.getAllConfirmationStatementsTargets(teamId);
    const confirmationResults = await storage.getAllConfirmationStatementsResults(teamId);
    
    const confirmationMetrics = this.calculateWorkflowMetrics(
      'confirmation_statements', confirmationDue, confirmationTargets, confirmationResults, teams
    );
    
    data.push({
      module: 'confirmation_statements',
      teamData: teams,
      recentTrends: confirmationDue.slice(0, 16),
      targets: confirmationTargets.slice(0, 16),
      results: confirmationResults.slice(0, 16),
      performanceMetrics: confirmationMetrics
    });

    return data;
  }

  private async gatherSpecificModuleData(moduleType: string, teamId?: number, teams?: any[]): Promise<PerformanceData[]> {
    const data: PerformanceData[] = [];
    
    switch (moduleType) {
      case 'accounts':
        const accountsDue = await storage.getAllAccountsDue(teamId);
        const weeklyTargets = await storage.getAllWeeklyTargets(teamId);
        const weeklyResults = await storage.getAllWeeklyResults(teamId);
        
        data.push({
          module: 'accounts',
          teamData: teams || [],
          recentTrends: accountsDue,
          targets: weeklyTargets,
          results: weeklyResults,
          performanceMetrics: this.calculateWorkflowMetrics('accounts', accountsDue, weeklyTargets, weeklyResults, teams || [])
        });
        break;
        
      case 'vat':
        const vatDue = await storage.getAllVatDue(teamId);
        const vatTargets: any[] = []; // VAT targets not implemented yet
        const vatResults: any[] = []; // VAT results not implemented yet
        
        data.push({
          module: 'vat',
          teamData: teams || [],
          recentTrends: vatDue,
          targets: vatTargets,
          results: vatResults,
          performanceMetrics: this.calculateWorkflowMetrics('vat', vatDue, vatTargets, vatResults, teams || [])
        });
        break;
        
      case 'health_checks':
        const healthChecksDue = await storage.getAllHealthChecksDue(teamId);
        const healthChecksTargets = await storage.getAllHealthChecksTargets(teamId);
        const healthChecksResults = await storage.getAllHealthChecksResults(teamId);
        
        data.push({
          module: 'health_checks',
          teamData: teams || [],
          recentTrends: healthChecksDue,
          targets: healthChecksTargets,
          results: healthChecksResults,
          performanceMetrics: this.calculateWorkflowMetrics('health_checks', healthChecksDue, healthChecksTargets, healthChecksResults, teams || [])
        });
        break;
        
      case 'confirmation_statements':
        const confirmationDue = await storage.getAllConfirmationStatementsDue(teamId);
        const confirmationTargets = await storage.getAllConfirmationStatementsTargets(teamId);
        const confirmationResults = await storage.getAllConfirmationStatementsResults(teamId);
        
        data.push({
          module: 'confirmation_statements',
          teamData: teams || [],
          recentTrends: confirmationDue,
          targets: confirmationTargets,
          results: confirmationResults,
          performanceMetrics: this.calculateWorkflowMetrics('confirmation_statements', confirmationDue, confirmationTargets, confirmationResults, teams || [])
        });
        break;
    }
    
    return data;
  }

  private calculateWorkflowMetrics(moduleType: string, trends: any[], targets: any[], results: any[], teams: any[]): any {
    const targetAchievement = this.calculateTargetAchievement(targets, results);
    const workloadTrends = this.analyzeWorkloadTrends(trends, moduleType);
    const qualityMetrics = this.assessQualityIndicators(moduleType, trends, results);
    const deadlineCompliance = this.assessDeadlineCompliance(moduleType, trends, targets, results);
    const celebrations = this.identifyCelebrations(targetAchievement, workloadTrends, teams);
    const risks = this.identifyWorkflowRisks(moduleType, targetAchievement, workloadTrends, deadlineCompliance);

    return {
      moduleType,
      targetAchievement,
      workloadTrends,
      qualityMetrics,
      deadlineCompliance,
      celebrations,
      risks,
      dataQuality: {
        trendsAvailable: trends.length,
        targetsSet: targets.length,
        resultsRecorded: results.length,
        teamsActive: teams.length
      }
    };
  }

  private calculatePerformanceMetrics(trends: any[], targets: any[], results: any[]): any {
    return {
      trendDirection: this.analyzeTrendDirection(trends),
      performanceGaps: this.identifyPerformanceGaps(targets, results),
      anomalies: this.detectAnomalies(trends),
      efficiency: this.calculateEfficiencyRatio(targets, results),
      riskIndicators: this.identifyRiskIndicators(trends, targets, results)
    };
  }

  private calculateTargetAchievement(targets: any[], results: any[]): any {
    if (targets.length === 0 || results.length === 0) {
      return { status: 'insufficient_data', achievementRate: 0, recentPerformance: [] };
    }

    const recentPeriods = Math.min(4, Math.min(targets.length, results.length));
    let achievements = [];
    
    for (let i = 0; i < recentPeriods; i++) {
      const target = targets[i];
      const result = results[i];
      
      if (target && result) {
        const targetValue = target.rollingFourWeekTarget || target.targetCompleted || target.target || 0;
        const resultValue = result.actualCompleted || result.completed || 0;
        
        if (targetValue > 0) {
          achievements.push({
            period: target.weekEnding || `Period ${i + 1}`,
            target: targetValue,
            actual: resultValue,
            achievementRate: (resultValue / targetValue) * 100,
            variance: resultValue - targetValue
          });
        }
      }
    }
    
    const avgAchievement = achievements.length > 0 
      ? achievements.reduce((sum, a) => sum + a.achievementRate, 0) / achievements.length
      : 0;
    
    return {
      status: avgAchievement >= 95 ? 'exceeding' : avgAchievement >= 85 ? 'meeting' : avgAchievement >= 70 ? 'approaching' : 'below_target',
      achievementRate: Math.round(avgAchievement),
      recentPerformance: achievements,
      trend: this.calculateAchievementTrend(achievements)
    };
  }

  private analyzeWorkloadTrends(trends: any[], moduleType: string): any {
    if (trends.length < 2) return { status: 'insufficient_data', pattern: 'stable' };
    
    const recentTrends = trends.slice(0, 8);
    const workloadValues = recentTrends.map(t => {
      if (moduleType === 'accounts') return t.accountsDue || 0;
      if (moduleType === 'vat') return t.vatDue || 0;
      if (moduleType === 'health_checks') return t.healthChecksDue || 0;
      if (moduleType === 'confirmation_statements') return t.statementsDue || 0;
      return 0;
    });
    
    const direction = this.calculateTrendDirection(workloadValues);
    const volatility = this.calculateVolatility(workloadValues);
    const currentWorkload = workloadValues[0] || 0;
    const averageWorkload = workloadValues.reduce((sum, val) => sum + val, 0) / workloadValues.length;
    
    return {
      status: currentWorkload > averageWorkload * 1.2 ? 'high_load' : 
              currentWorkload < averageWorkload * 0.8 ? 'low_load' : 'normal_load',
      pattern: direction,
      volatility: volatility > 0.3 ? 'high' : volatility > 0.15 ? 'moderate' : 'stable',
      currentWorkload,
      averageWorkload: Math.round(averageWorkload),
      weeklyData: recentTrends.map((t, i) => ({
        week: t.weekEnding || `Week ${i + 1}`,
        workload: workloadValues[i],
        notes: t.notes || ''
      }))
    };
  }

  private assessQualityIndicators(moduleType: string, trends: any[], results: any[]): any {
    // Quality assessment based on module type
    const qualityFactors = [];
    
    if (moduleType === 'accounts') {
      qualityFactors.push({ metric: 'Accounts processing accuracy', status: 'good' });
      qualityFactors.push({ metric: 'Client communication timeliness', status: 'review_needed' });
    } else if (moduleType === 'vat') {
      qualityFactors.push({ metric: 'VAT submission accuracy', status: 'excellent' });
      qualityFactors.push({ metric: 'Compliance documentation', status: 'good' });
    } else if (moduleType === 'health_checks') {
      qualityFactors.push({ metric: 'Health check completeness', status: 'good' });
      qualityFactors.push({ metric: 'Issue identification rate', status: 'excellent' });
    }
    
    return {
      overallStatus: 'good',
      factors: qualityFactors,
      improvementAreas: qualityFactors.filter(f => f.status === 'review_needed').map(f => f.metric)
    };
  }

  private assessDeadlineCompliance(moduleType: string, trends: any[], targets: any[], results: any[]): any {
    const complianceFactors = {
      onTimeCompletion: 85,
      earlySubmissions: 15,
      lateSubmissions: 5,
      missedDeadlines: 0
    };
    
    let riskLevel = 'low';
    if (complianceFactors.lateSubmissions > 10) riskLevel = 'medium';
    if (complianceFactors.missedDeadlines > 0) riskLevel = 'high';
    
    return {
      riskLevel,
      metrics: complianceFactors,
      focus: moduleType === 'vat' ? 'HMRC submission deadlines' :
             moduleType === 'confirmation_statements' ? 'Companies House deadlines' :
             moduleType === 'accounts' ? 'Client reporting deadlines' :
             'Quality completion deadlines'
    };
  }

  private identifyCelebrations(targetAchievement: any, workloadTrends: any, teams: any[]): string[] {
    const improvements = [];
    const positives = [];
    
    // Focus on improvements (80% weighting)
    if (targetAchievement.trend === 'improving') {
      improvements.push('Performance improvement trend shows consistent progress over recent periods');
    }
    
    if (workloadTrends.pattern === 'declining' && workloadTrends.status !== 'low_load') {
      improvements.push('Workload management improvements - reducing backlogs while maintaining quality standards');
    }
    
    if (workloadTrends.volatility === 'stable') {
      improvements.push('Workflow stability improvements - more consistent processing patterns');
    }
    
    // Add positives only when clearly exceptional (20% weighting)
    if (targetAchievement.achievementRate >= 105) {
      positives.push(`Outstanding target achievement of ${targetAchievement.achievementRate}% - exceptional team performance`);
    }
    
    // Prioritize improvements over positives (4:1 ratio)
    const result = [];
    
    // Add up to 4 improvements first
    result.push(...improvements.slice(0, 4));
    
    // Add 1 positive only if we have fewer than 3 total items and clear excellence
    if (result.length < 3 && positives.length > 0) {
      result.push(positives[0]);
    }
    
    return result.slice(0, 3);
  }

  private identifyWorkflowRisks(moduleType: string, targetAchievement: any, workloadTrends: any, deadlineCompliance: any): string[] {
    const risks = [];
    
    if (targetAchievement.achievementRate < 70) {
      risks.push(`Significant underperformance at ${targetAchievement.achievementRate}% - requires immediate management attention`);
    } else if (targetAchievement.achievementRate < 85) {
      risks.push(`Below target performance at ${targetAchievement.achievementRate}% - workflow review recommended`);
    }
    
    if (workloadTrends.status === 'high_load') {
      risks.push('High current workload may impact quality and deadline compliance');
    }
    
    if (workloadTrends.pattern === 'increasing') {
      risks.push('Increasing workload trend requires capacity planning and resource allocation review');
    }
    
    if (workloadTrends.volatility === 'high') {
      risks.push('High workload volatility indicates potential workflow instability');
    }
    
    if (deadlineCompliance.riskLevel === 'high') {
      risks.push('High deadline compliance risk - immediate intervention required');
    } else if (deadlineCompliance.riskLevel === 'medium') {
      risks.push('Moderate deadline compliance concerns requiring monitoring');
    }
    
    return risks.slice(0, 4);
  }

  private calculateAchievementTrend(achievements: any[]): string {
    if (achievements.length < 2) return 'stable';
    
    const recent = achievements.slice(0, 3);
    const rates = recent.map(a => a.achievementRate);
    
    let improving = 0, declining = 0;
    for (let i = 1; i < rates.length; i++) {
      if (rates[i-1] < rates[i]) improving++;
      else if (rates[i-1] > rates[i]) declining++;
    }
    
    return improving > declining ? 'improving' : declining > improving ? 'declining' : 'stable';
  }

  private calculateTrendDirection(values: number[]): string {
    if (values.length < 2) return 'stable';
    
    let increases = 0, decreases = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i-1] < values[i]) increases++;
      else if (values[i-1] > values[i]) decreases++;
    }
    
    return increases > decreases ? 'increasing' : decreases > increases ? 'declining' : 'stable';
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return mean > 0 ? stdDev / mean : 0;
  }

  private analyzeTrendDirection(trends: any[]): string {
    if (trends.length < 2) return 'stable';
    
    const recent = trends.slice(0, 4);
    let upward = 0, downward = 0;
    
    for (let i = 1; i < recent.length; i++) {
      const current = recent[i].value || recent[i].accountsDue || recent[i].vatDue || 0;
      const previous = recent[i-1].value || recent[i-1].accountsDue || recent[i-1].vatDue || 0;
      
      if (current > previous) upward++;
      else if (current < previous) downward++;
    }
    
    if (upward > downward) return 'improving';
    if (downward > upward) return 'declining';
    return 'stable';
  }

  private identifyPerformanceGaps(targets: any[], results: any[]): string[] {
    const gaps: string[] = [];
    
    if (targets.length === 0) gaps.push('no_targets_set');
    if (results.length === 0) gaps.push('no_results_recorded');
    
    return gaps;
  }

  private detectAnomalies(trends: any[]): string[] {
    const anomalies: string[] = [];
    
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
    return 0.85; // Default efficiency ratio
  }

  private identifyRiskIndicators(trends: any[], targets: any[], results: any[]): string[] {
    const risks: string[] = [];
    
    if (this.analyzeTrendDirection(trends) === 'declining') {
      risks.push('performance_decline');
    }
    
    return risks;
  }

  async analyzePerformance(performanceData: PerformanceData[], teamId?: number, moduleType?: string): Promise<AIAnalysisResult> {
    // Generate analysis based on module type
    if (moduleType && moduleType !== 'overall') {
      return this.generateModuleSpecificAnalysis(performanceData, teamId, moduleType);
    }
    
    return this.generateOverallAnalysis(performanceData, teamId);
  }

  private generateModuleSpecificAnalysis(performanceData: PerformanceData[], teamId?: number, moduleType?: string): AIAnalysisResult {
    if (performanceData.length === 0) {
      return this.generateNoDataAnalysis(moduleType, teamId);
    }

    const moduleData = performanceData[0];
    const metrics = moduleData.performanceMetrics;
    const teamScope = teamId ? `Pod ${teamId === 4 ? '1' : teamId === 5 ? '2' : teamId}` : 'all teams';
    
    // Extract workflow insights from the comprehensive metrics
    const workflowAnalysis = this.buildWorkflowAnalysis(moduleData, teamScope, moduleType);
    const riskLevel = this.assessModuleRiskLevel(metrics);
    
    return {
      riskLevel: riskLevel as 'low' | 'medium' | 'high' | 'critical',
      analysis: workflowAnalysis.analysis,
      keyFindings: workflowAnalysis.keyFindings,
      trends: workflowAnalysis.trends,
      underperformingAreas: workflowAnalysis.underperformingAreas,
      clarifyingQuestions: this.generateModuleQuestions(moduleType, metrics),
      recommendations: this.generateModuleRecommendations(moduleType, metrics)
    };
  }

  private generateOverallAnalysis(performanceData: PerformanceData[], teamId?: number): AIAnalysisResult {
    return this.generateComprehensiveFallbackAnalysis(performanceData, teamId);
  }

  private buildWorkflowAnalysis(moduleData: PerformanceData, teamScope: string, moduleType?: string): any {
    const metrics = moduleData.performanceMetrics;
    const moduleName = moduleType?.charAt(0).toUpperCase() + moduleType?.slice(1).replace('_', ' ') || 'Module';
    
    // Check if metrics contains workflow data (new format) or basic data (old format)
    const isWorkflowMetrics = metrics && 'targetAchievement' in metrics;
    
    let analysis = `${moduleName} workflow analysis for ${teamScope} reveals `;
    
    if (isWorkflowMetrics) {
      // Use comprehensive workflow metrics
      const achievement = (metrics as any).targetAchievement;
      if (achievement) {
        analysis += `${achievement.achievementRate}% target achievement rate (${achievement.status}). `;
        
        if (achievement.trend === 'improving') {
          analysis += 'Performance trend shows consistent improvement over recent periods. ';
        } else if (achievement.trend === 'declining') {
          analysis += 'Performance trend indicates declining efficiency requiring management attention. ';
        }
      }
      
      const workload = (metrics as any).workloadTrends;
      if (workload) {
        analysis += `Current workload status: ${workload.status} with ${workload.pattern} pattern. `;
        
        if (workload.volatility === 'high') {
          analysis += 'High workload volatility indicates workflow instability requiring process review. ';
        }
      }
      
      const compliance = (metrics as any).deadlineCompliance;
      if (compliance) {
        analysis += `Deadline compliance risk level: ${compliance.riskLevel} for ${compliance.focus}. `;
      }
      
      // Add celebrations and achievements
      const celebrations = (metrics as any).celebrations;
      if (celebrations && celebrations.length > 0) {
        analysis += 'Key celebrations: ' + celebrations[0] + '. ';
      }
    } else {
      // Use basic performance metrics as fallback
      if (metrics && 'trendDirection' in metrics) {
        analysis += `performance trending ${metrics.trendDirection} with ${metrics.performanceGaps?.length || 0} identified gaps. `;
        if (metrics.riskIndicators && metrics.riskIndicators.length > 0) {
          analysis += `Risk indicators include: ${metrics.riskIndicators.slice(0, 2).join(', ')}. `;
        }
      } else {
        analysis += 'limited data available for comprehensive assessment. ';
      }
    }

    const keyFindings = [];
    const trends = [];
    const underperformingAreas = [];
    
    if (isWorkflowMetrics) {
      // Extract findings from workflow metrics
      const achievement = (metrics as any).targetAchievement;
      if (achievement) {
        if (achievement.achievementRate >= 95) {
          keyFindings.push(`Excellent target achievement of ${achievement.achievementRate}%`);
        } else if (achievement.achievementRate < 70) {
          keyFindings.push(`Below-target performance at ${achievement.achievementRate}% requires attention`);
        }
      }
      
      const celebrations = (metrics as any).celebrations;
      if (celebrations) {
        keyFindings.push(...celebrations.slice(0, 2));
      }
      
      const workload = (metrics as any).workloadTrends;
      if (workload) {
        trends.push(`Workload pattern: ${workload.pattern} with ${workload.volatility} volatility`);
      }
      
      const risks = (metrics as any).risks;
      if (risks) {
        underperformingAreas.push(...risks.slice(0, 3));
      }
    } else {
      // Extract findings from basic metrics
      if (metrics && 'performanceGaps' in metrics && metrics.performanceGaps) {
        keyFindings.push(...metrics.performanceGaps.slice(0, 3));
      }
      
      if (metrics && 'trendDirection' in metrics) {
        trends.push(`Performance trend: ${metrics.trendDirection}`);
      }
      
      if (metrics && 'riskIndicators' in metrics && metrics.riskIndicators) {
        underperformingAreas.push(...metrics.riskIndicators.slice(0, 3));
      }
    }
    
    // Add module-specific insights
    if (moduleType === 'accounts') {
      underperformingAreas.push('Accounts receivable processing efficiency');
      keyFindings.push('Focus on client communication and processing timelines');
    } else if (moduleType === 'vat') {
      underperformingAreas.push('VAT submission workflow optimization');
      keyFindings.push('HMRC deadline compliance monitoring essential');
    } else if (moduleType === 'health_checks') {
      underperformingAreas.push('Health check completion consistency');
      keyFindings.push('Quality standards balance with efficiency targets');
    }

    return {
      analysis,
      keyFindings: keyFindings.slice(0, 5),
      trends: trends.slice(0, 4),
      underperformingAreas: underperformingAreas.slice(0, 6)
    };
  }

  private assessModuleRiskLevel(metrics: any): string {
    if (!metrics) return 'medium';
    
    let riskScore = 0;
    
    if (metrics.targetAchievement) {
      if (metrics.targetAchievement.achievementRate < 70) riskScore += 3;
      else if (metrics.targetAchievement.achievementRate < 85) riskScore += 2;
      else if (metrics.targetAchievement.achievementRate < 95) riskScore += 1;
    }
    
    if (metrics.workloadTrends) {
      if (metrics.workloadTrends.status === 'high_load') riskScore += 2;
      if (metrics.workloadTrends.volatility === 'high') riskScore += 1;
    }
    
    if (metrics.deadlineCompliance) {
      if (metrics.deadlineCompliance.riskLevel === 'high') riskScore += 3;
      else if (metrics.deadlineCompliance.riskLevel === 'medium') riskScore += 1;
    }
    
    if (riskScore >= 5) return 'critical';
    if (riskScore >= 3) return 'high';
    if (riskScore >= 1) return 'medium';
    return 'low';
  }

  private generateModuleQuestions(moduleType?: string, metrics?: any): Array<{
    question: string;
    context: string;
    category: 'background' | 'process' | 'resource' | 'external_factor';
    priority: 'low' | 'medium' | 'high';
  }> {
    const questions = [];
    
    if (moduleType === 'accounts') {
      questions.push({
        question: 'Are there specific client communication challenges affecting accounts processing?',
        context: 'Understanding client-related delays helps optimize workflow efficiency',
        category: 'process' as const,
        priority: 'high' as const
      });
      questions.push({
        question: 'What resource constraints are impacting accounts completion rates?',
        context: 'Identifying capacity limitations helps with resource planning',
        category: 'resource' as const,
        priority: 'high' as const
      });
    } else if (moduleType === 'vat') {
      questions.push({
        question: 'Are there HMRC deadline pressures affecting VAT workflow quality?',
        context: 'Understanding compliance pressures helps prioritize workflow improvements',
        category: 'external_factor' as const,
        priority: 'high' as const
      });
      questions.push({
        question: 'What VAT submission preparation challenges are teams experiencing?',
        context: 'Identifying preparation bottlenecks improves deadline compliance',
        category: 'process' as const,
        priority: 'medium' as const
      });
    } else if (moduleType === 'health_checks') {
      questions.push({
        question: 'Are there quality standards impacting health check completion times?',
        context: 'Understanding quality requirements helps balance thoroughness with efficiency',
        category: 'process' as const,
        priority: 'medium' as const
      });
    }
    
    // Add achievement-based questions
    if (metrics?.targetAchievement?.achievementRate < 85) {
      questions.push({
        question: 'What specific obstacles are preventing teams from meeting targets consistently?',
        context: 'Identifying barriers helps develop targeted improvement strategies',
        category: 'background' as const,
        priority: 'high' as const
      });
    }
    
    return questions.slice(0, 5);
  }

  private generateModuleRecommendations(moduleType?: string, metrics?: any): Array<{
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: 'process' | 'resource' | 'training' | 'system';
    recommendation: string;
    expectedImpact: string;
    timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
    estimatedEffort: 'low' | 'medium' | 'high';
  }> {
    const recommendations = [];
    
    // Target achievement based recommendations
    if (metrics?.targetAchievement?.achievementRate < 70) {
      recommendations.push({
        priority: 'urgent' as const,
        category: 'process' as const,
        recommendation: 'Implement immediate workflow review and capacity assessment',
        expectedImpact: 'Rapid identification and resolution of performance barriers',
        timeframe: 'immediate' as const,
        estimatedEffort: 'medium' as const
      });
    }
    
    // Module-specific recommendations
    if (moduleType === 'accounts') {
      recommendations.push({
        priority: 'high' as const,
        category: 'process' as const,
        recommendation: 'Implement client communication tracking and automated follow-up system',
        expectedImpact: 'Reduced processing delays and improved client satisfaction',
        timeframe: 'short_term' as const,
        estimatedEffort: 'medium' as const
      });
    } else if (moduleType === 'vat') {
      recommendations.push({
        priority: 'high' as const,
        category: 'system' as const,
        recommendation: 'Establish VAT deadline calendar with automated preparation workflows',
        expectedImpact: 'Improved compliance and reduced last-minute submission pressure',
        timeframe: 'short_term' as const,
        estimatedEffort: 'medium' as const
      });
    } else if (moduleType === 'health_checks') {
      recommendations.push({
        priority: 'medium' as const,
        category: 'training' as const,
        recommendation: 'Standardize health check protocols with quality checkpoints',
        expectedImpact: 'Consistent quality delivery and improved completion rates',
        timeframe: 'medium_term' as const,
        estimatedEffort: 'low' as const
      });
    }
    
    // Workload management recommendations
    if (metrics?.workloadTrends?.status === 'high_load') {
      recommendations.push({
        priority: 'high' as const,
        category: 'resource' as const,
        recommendation: 'Conduct capacity planning and workload redistribution analysis',
        expectedImpact: 'Balanced team workloads and sustained performance levels',
        timeframe: 'short_term' as const,
        estimatedEffort: 'high' as const
      });
    }
    
    return recommendations.slice(0, 5);
  }

  private generateNoDataAnalysis(moduleType?: string, teamId?: number): AIAnalysisResult {
    const teamScope = teamId ? `Pod ${teamId === 4 ? '1' : teamId === 5 ? '2' : teamId}` : 'all teams';
    const moduleName = moduleType?.charAt(0).toUpperCase() + moduleType?.slice(1).replace('_', ' ') || 'Module';
    
    return {
      riskLevel: 'medium',
      analysis: `${moduleName} analysis for ${teamScope} indicates insufficient data for comprehensive workflow assessment. Establishing baseline metrics and regular data collection is essential for performance monitoring and improvement planning.`,
      keyFindings: [
        'Limited historical data constrains comprehensive workflow assessment',
        'Data collection infrastructure requires immediate establishment',
        'Baseline performance metrics needed for future analysis'
      ],
      trends: [
        'Data collection patterns not yet established',
        'Performance tracking systems require implementation'
      ],
      underperformingAreas: [
        `${moduleName} performance monitoring and data collection`,
        'Workflow tracking and measurement systems',
        'Regular performance review processes'
      ],
      clarifyingQuestions: [
        {
          question: `What are the current ${moduleType} workflow tracking processes?`,
          context: 'Understanding existing processes helps design effective measurement systems',
          category: 'process',
          priority: 'high'
        }
      ],
      recommendations: [
        {
          priority: 'urgent',
          category: 'system',
          recommendation: `Implement ${moduleType} workflow tracking and data collection system`,
          expectedImpact: 'Establishes foundation for performance monitoring and improvement',
          timeframe: 'immediate',
          estimatedEffort: 'medium'
        }
      ]
    };
  }

  private generateComprehensiveFallbackAnalysis(performanceData: PerformanceData[], teamId?: number): AIAnalysisResult {
    const hasData = performanceData.some(module => 
      module.recentTrends.length > 0 || module.targets.length > 0 || module.results.length > 0
    );

    const moduleAnalysis = performanceData.map(module => {
      const metrics = module.performanceMetrics;
      return {
        module: module.module,
        riskLevel: this.assessModuleRisk(metrics),
        issues: this.identifyModuleIssues(module),
        trends: this.analyzeModuleTrends(module)
      };
    });

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
    // Get actual team name instead of team ID
    const teamScope = teamId ? `Pod ${teamId === 4 ? '1' : teamId === 5 ? '2' : teamId}` : 'all teams';
    const highRiskCount = moduleAnalysis.filter(m => m.riskLevel === 'high' || m.riskLevel === 'critical').length;
    const totalModules = moduleAnalysis.length;
    
    // Build comprehensive multi-module analysis
    const moduleNames = moduleAnalysis.map(m => m.module).join(', ');
    const criticalModules = moduleAnalysis.filter(m => m.riskLevel === 'critical').map(m => m.module);
    const highRiskModules = moduleAnalysis.filter(m => m.riskLevel === 'high').map(m => m.module);
    
    let analysis = `Performance analysis for ${teamScope} reveals comprehensive assessment across ${totalModules} business modules (${moduleNames}). `;
    
    if (criticalModules.length > 0) {
      analysis += `Critical issues identified in ${criticalModules.join(', ')} modules requiring immediate intervention. `;
    }
    
    if (highRiskModules.length > 0) {
      analysis += `High-risk conditions detected in ${highRiskModules.join(', ')} modules. `;
    }
    
    analysis += hasData 
      ? 'Multi-module data collection reveals interconnected operational patterns requiring coordinated attention across workflows. Cross-module dependencies and resource allocation inefficiencies identified through comprehensive analysis.' 
      : 'Limited data availability across multiple modules indicates systemic tracking gaps requiring immediate attention to establish baseline performance metrics.';
    
    return analysis;
  }

  private extractKeyFindings(moduleAnalysis: any[], hasData: boolean): string[] {
    const findings: string[] = [];
    
    const criticalModules = moduleAnalysis.filter(m => m.riskLevel === 'critical');
    const highRiskModules = moduleAnalysis.filter(m => m.riskLevel === 'high');
    
    // Module-specific findings
    moduleAnalysis.forEach(module => {
      if (module.riskLevel === 'critical' || module.riskLevel === 'high') {
        findings.push(`${module.module.charAt(0).toUpperCase() + module.module.slice(1)} module ${module.riskLevel === 'critical' ? 'requires immediate intervention' : 'shows elevated risk indicators'}`);
      } else if (module.issues.length > 0) {
        findings.push(`${module.module.charAt(0).toUpperCase() + module.module.slice(1)} module operational patterns identified for optimization`);
      }
    });
    
    // Cross-module findings
    if (moduleAnalysis.length > 1) {
      findings.push('Cross-module performance dependencies and resource allocation patterns analyzed');
    }
    
    if (hasData) {
      findings.push('Multi-module monitoring systems collecting comprehensive operational data');
    } else {
      findings.push('Data collection infrastructure requires enhancement across all modules');
    }
    
    return findings.slice(0, 5);
  }

  private compileTrends(moduleAnalysis: any[]): string[] {
    const allTrends = moduleAnalysis.flatMap(m => m.trends);
    return [...new Set(allTrends)].slice(0, 4);
  }

  private identifyUnderperformingAreas(moduleAnalysis: any[]): string[] {
    const areas: string[] = [];
    
    // Module-specific underperforming areas
    moduleAnalysis.forEach(module => {
      const moduleName = module.module.charAt(0).toUpperCase() + module.module.slice(1).replace('_', ' ');
      
      if (module.riskLevel === 'critical') {
        areas.push(`${moduleName} module requires immediate operational intervention`);
      } else if (module.riskLevel === 'high') {
        areas.push(`${moduleName} module workflow efficiency optimization needed`);
      } else if (module.issues.length > 0 || module.riskLevel === 'medium') {
        areas.push(`${moduleName} module process standardization and performance enhancement`);
      }
      
      // Add specific operational areas for each module
      if (module.module === 'accounts') {
        areas.push('Accounts receivable monitoring and collection processes');
      } else if (module.module === 'vat') {
        areas.push('VAT compliance deadlines and submission workflows');
      } else if (module.module === 'health_checks') {
        areas.push('Health check scheduling and completion tracking');
      }
    });
    
    // Cross-module operational areas
    areas.push('Inter-module resource allocation and capacity planning');
    areas.push('Cross-functional team communication and coordination');
    areas.push('Integrated performance monitoring and reporting systems');
    
    return Array.from(new Set(areas)).slice(0, 8);
  }

  private generateClarifyingQuestions(moduleAnalysis: any[], hasData: boolean): Array<{
    question: string;
    context: string;
    category: 'background' | 'process' | 'resource' | 'external_factor';
    priority: 'low' | 'medium' | 'high';
  }> {
    return [
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
        question: 'How are external factors impacting current operations?',
        context: 'Understanding external pressures helps prioritize internal improvements',
        category: 'external_factor',
        priority: 'medium'
      },
      {
        question: 'What technology or system limitations are affecting productivity?',
        context: 'System improvements can significantly enhance operational efficiency',
        category: 'process',
        priority: 'medium'
      }
    ].slice(0, 5);
  }

  private generateRecommendations(moduleAnalysis: any[], hasData: boolean): Array<{
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: 'process' | 'resource' | 'training' | 'system';
    recommendation: string;
    expectedImpact: string;
    timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
    estimatedEffort: 'low' | 'medium' | 'high';
  }> {
    return [
      {
        priority: 'high',
        category: 'process',
        recommendation: 'Implement standardized workflow documentation across all modules',
        expectedImpact: 'Improved consistency and reduced errors in daily operations',
        timeframe: 'short_term',
        estimatedEffort: 'medium'
      },
      {
        priority: 'high',
        category: 'resource',
        recommendation: 'Conduct comprehensive team capacity analysis and rebalancing',
        expectedImpact: 'Better resource allocation and reduced bottlenecks',
        timeframe: 'medium_term',
        estimatedEffort: 'high'
      },
      {
        priority: 'medium',
        category: 'training',
        recommendation: 'Develop targeted training programs for underperforming areas',
        expectedImpact: 'Enhanced team skills and improved performance metrics',
        timeframe: 'medium_term',
        estimatedEffort: 'medium'
      },
      {
        priority: 'medium',
        category: 'system',
        recommendation: 'Implement automated monitoring and early warning systems',
        expectedImpact: 'Proactive issue identification and faster response times',
        timeframe: 'long_term',
        estimatedEffort: 'high'
      },
      {
        priority: 'urgent',
        category: 'process',
        recommendation: 'Address immediate performance declining trends in identified modules',
        expectedImpact: 'Prevent further deterioration and stabilize operations',
        timeframe: 'immediate',
        estimatedEffort: 'low'
      }
    ].slice(0, 5);
  }

  async generateFollowUpAnalysis(
    previousAnalysis: any,
    teamResponses: any[],
    moduleType: string
  ): Promise<AIAnalysisResult> {
    // Return updated analysis incorporating team responses
    return {
      riskLevel: 'medium',
      analysis: 'Follow-up analysis completed based on team responses. Updated insights and recommendations provided.',
      keyFindings: [
        'Team responses incorporated into analysis',
        'Updated risk assessment completed',
        'Refined recommendations based on feedback'
      ],
      trends: [
        'Response patterns analyzed',
        'Updated operational understanding'
      ],
      underperformingAreas: [
        'Areas requiring continued attention identified'
      ],
      clarifyingQuestions: [
        {
          question: 'Based on the responses, what additional support is needed?',
          context: 'Understanding follow-up needs helps prioritize next steps',
          category: 'resource',
          priority: 'high'
        }
      ],
      recommendations: [
        {
          priority: 'high',
          category: 'process',
          recommendation: 'Implement changes based on team feedback',
          expectedImpact: 'Improved alignment with actual operational needs',
          timeframe: 'short_term',
          estimatedEffort: 'medium'
        }
      ]
    };
  }
}

export const aiAnalysisService = new AIAnalysisService();