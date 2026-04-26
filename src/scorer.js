/**
 * Repo Health Score Calculator
 * 基于多维度指标计算开源项目健康度
 */

const fetch = require('node-fetch');

class RepoHealthScorer {
  constructor(options = {}) {
    this.token = options.token || process.env.GITHUB_TOKEN || process.env.GITHUB_API_TOKEN;
    this.apiBase = 'https://api.github.com';
  }

  /**
   * 主评分方法
   */
  async scoreRepo(owner, repo, options = {}) {
    const { includeTrends = true } = options;
    
    console.log(`🔍 Fetching data for ${owner}/${repo}...`);
    
    // 并行获取所有数据
    const [repoData, starsData, commitsData, issuesData, prsData, contributorsData] = await Promise.all([
      this.getRepoInfo(owner, repo),
      this.getStarsData(owner, repo),
      this.getCommitsData(owner, repo),
      this.getIssuesData(owner, repo),
      this.getPRsData(owner, repo),
      this.getContributorsData(owner, repo),
    ]);

    // 计算各维度得分
    const metrics = {
      stars: this.calcStarsScore(starsData),
      commits: this.calcCommitsScore(commitsData),
      issues: this.calcIssuesScore(issuesData),
      prs: this.calcPRsScore(prsData),
      contributors: this.calcContributorsScore(contributorsData),
      responsiveness: this.calcResponsivenessScore(issuesData, prsData),
      growth: this.calcGrowthScore(starsData, commitsData),
      activity: this.calcActivityScore(commitsData, issuesData, prsData),
    };

    // 计算综合得分 (加权平均)
    const weights = {
      stars: 0.15,
      commits: 0.15,
      issues: 0.15,
      prs: 0.15,
      contributors: 0.10,
      responsiveness: 0.10,
      growth: 0.10,
      activity: 0.10,
    };

    let totalScore = 0;
    for (const [key, weight] of Object.entries(weights)) {
      totalScore += metrics[key].score * weight;
    }
    totalScore = Math.round(totalScore * 10) / 10;

    // 生成健康等级
    const grade = this.getGrade(totalScore);

    // 生成建议
    const suggestions = this.generateSuggestions(metrics);

    return {
      repo: `${owner}/${repo}`,
      totalScore,
      grade,
      metrics,
      summary: this.generateSummary(repoData, totalScore, grade),
      suggestions,
      meta: {
        analyzedAt: new Date().toISOString(),
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        openIssues: repoData.open_issues_count,
        language: repoData.language,
        license: repoData.license?.spdx_id || 'Unknown',
        createdAt: repoData.created_at,
        updatedAt: repoData.pushed_at,
        description: repoData.description,
      },
    };
  }

  /**
   * API 请求封装
   */
  async githubApi(path) {
    const url = `${this.apiBase}${path}`;
    const headers = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'repo-health-score',
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(url, { headers });
    
    if (!res.ok) {
      if (res.status === 404) throw new Error(`Repository not found`);
      if (res.status === 403) throw new Error(`API rate limit exceeded. Add GITHUB_TOKEN to increase limit.`);
      throw new Error(`GitHub API error: ${res.status}`);
    }

    return res.json();
  }

  /**
   * 获取仓库基本信息
   */
  async getRepoInfo(owner, repo) {
    return this.githubApi(`/repos/${owner}/${repo}`);
  }

  /**
   * 获取 Star 历史数据
   */
  async getStarsData(owner, repo) {
    try {
      // 使用 stars 接口获取粗略计数
      const data = await this.githubApi(`/repos/${owner}/${repo}`);
      
      // 计算 Star 增速 (每周)
      // 估算: 用 created_at 和当前时间推算
      const createdAt = new Date(data.created_at);
      const now = new Date();
      const ageInWeeks = Math.max(1, (now - createdAt) / (7 * 24 * 60 * 60 * 1000));
      const starsPerWeek = data.stargazers_count / ageInWeeks;

      // 获取最近 52 周的 commit 活动来估算活跃度
      const commitsRes = await fetch(
        `${this.apiBase}/repos/${owner}/${repo}/stats/commit_activity`,
        { headers: { 'Authorization': `Bearer ${this.token}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'repo-health-score' } }
      );
      
      let weeklyStars = starsPerWeek;
      let starGrowth = 0;
      
      if (commitsRes.ok) {
        const activity = await commitsRes.json().catch(() => []);
        if (Array.isArray(activity) && activity.length > 0) {
          // 最近 4 周 vs 之前 4 周的对比
          const recent = activity.slice(-4).reduce((s, w) => s + w.total, 0);
          const older = activity.slice(-8, -4).reduce((s, w) => s + w.total, 0);
          if (older > 0) {
            starGrowth = ((recent - older) / older) * 100;
          }
        }
      }

      return {
        total: data.stargazers_count,
        perWeek: Math.round(starsPerWeek * 10) / 10,
        starGrowth: Math.round(starGrowth),
        watchers: data.subscribers_count,
      };
    } catch (e) {
      return { total: 0, perWeek: 0, starGrowth: 0, watchers: 0 };
    }
  }

  /**
   * 获取 Commit 频率数据
   */
  async getCommitsData(owner, repo) {
    try {
      const data = await this.githubApi(`/repos/${owner}/${repo}/stats/commit_activity`);
      
      if (!Array.isArray(data) || data.length === 0) {
        // Fallback: 获取最近 30 条 commit
        const commits = await this.githubApi(`/repos/${owner}/${repo}/commits?per_page=30`);
        return {
          weeklyAvg: commits.length / 4,
          recentActivity: commits.length,
          trend: 'unknown',
        };
      }

      // 最近 12 周的 commit 统计
      const recent12 = data.slice(-12);
      const total = recent12.reduce((s, w) => s + w.total, 0);
      const weeklyAvg = total / 12;

      // 趋势判断
      const recent4 = recent12.slice(-4).reduce((s, w) => s + w.total, 0);
      const older4 = recent12.slice(-8, -4).reduce((s, w) => s + w.total, 0);
      let trend = 'stable';
      if (older4 > 0) {
        const change = ((recent4 - older4) / older4) * 100;
        if (change > 20) trend = 'increasing';
        else if (change < -20) trend = 'declining';
      }

      return {
        weeklyAvg: Math.round(weeklyAvg * 10) / 10,
        recentActivity: recent12.slice(-4).reduce((s, w) => s + w.total, 0),
        trend,
        totalWeeks: data.length,
      };
    } catch (e) {
      return { weeklyAvg: 0, recentActivity: 0, trend: 'unknown' };
    }
  }

  /**
   * 获取 Issue 数据
   */
  async getIssuesData(owner, repo) {
    try {
      // 获取 open issues
      const openIssues = await this.githubApi(`/repos/${owner}/${repo}/issues?state=open&per_page=100`);
      const openCount = Array.isArray(openIssues) ? openIssues.length : 0;

      // 获取最近关闭的 issues (用于计算响应时间)
      const closedIssues = await this.githubApi(`/repos/${owner}/${repo}/issues?state=closed&per_page=100&sort=updated`);
      
      let avgResponseTime = null;
      let resolutionRate = null;

      if (Array.isArray(closedIssues) && closedIssues.length > 0) {
        // 估算响应时间 (天)
        const responseTimes = closedIssues
          .filter(i => !i.pull_request) // 排除 PR
          .slice(0, 20)
          .map(i => {
            const created = new Date(i.created_at);
            const updated = new Date(i.updated_at);
            return (updated - created) / (1000 * 60 * 60 * 24); // 天
          })
          .filter(t => t >= 0);

        if (responseTimes.length > 0) {
          avgResponseTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length * 10) / 10;
        }

        // 估算解决率 (假设总 issues 数)
        resolutionRate = openCount > 0 ? Math.round((closedIssues.length / (openCount + closedIssues.length)) * 100) : 100;
      }

      return {
        open: openCount,
        avgResponseDays: avgResponseTime,
        resolutionRate,
      };
    } catch (e) {
      return { open: 0, avgResponseDays: null, resolutionRate: null };
    }
  }

  /**
   * 获取 PR 数据
   */
  async getPRsData(owner, repo) {
    try {
      const openPRs = await this.githubApi(`/repos/${owner}/${repo}/pulls?state=open&per_page=100`);
      const closedPRs = await this.githubApi(`/repos/${owner}/${repo}/pulls?state=closed&per_page=100&sort=updated`);

      const openCount = Array.isArray(openPRs) ? openPRs.length : 0;
      const closedCount = Array.isArray(closedPRs) ? closedPRs.length : 0;

      // 计算合并率
      const mergedCount = closedCount > 0 ? closedPRs.filter(pr => pr.merged_at).length : 0;
      const mergeRate = closedCount > 0 ? Math.round((mergedCount / closedCount) * 100) : 0;

      // 计算平均合并时间
      let avgMergeDays = null;
      if (mergedCount > 0) {
        const mergeTimes = closedPRs
          .filter(pr => pr.merged_at)
          .slice(0, 20)
          .map(pr => {
            const created = new Date(pr.created_at);
            const merged = new Date(pr.merged_at);
            return (merged - created) / (1000 * 60 * 60 * 24);
          });

        if (mergeTimes.length > 0) {
          avgMergeDays = Math.round(mergeTimes.reduce((a, b) => a + b, 0) / mergeTimes.length * 10) / 10;
        }
      }

      return {
        open: openCount,
        merged: mergedCount,
        mergeRate,
        avgMergeDays,
      };
    } catch (e) {
      return { open: 0, merged: 0, mergeRate: 0, avgMergeDays: null };
    }
  }

  /**
   * 获取贡献者数据
   */
  async getContributorsData(owner, repo) {
    try {
      const data = await this.githubApi(`/repos/${owner}/${repo}/contributors?per_page=20`);
      
      if (!Array.isArray(data)) {
        return { count: 0, top10活跃度: [] };
      }

      return {
        count: data.length,
        topContributors: data.slice(0, 10).map(c => ({
          login: c.login,
          contributions: c.contributions,
        })),
      };
    } catch (e) {
      return { count: 0, topContributors: [] };
    }
  }

  // ==================== 评分算法 ====================

  calcStarsScore(starsData) {
    const { total, perWeek } = starsData;
    
    // 总分 100，Star 总数和增速各占一半
    let score = 0;
    
    // Star 总数 (50分)
    if (total > 10000) score += 50;
    else if (total > 5000) score += 45;
    else if (total > 1000) score += 35;
    else if (total > 500) score += 25;
    else if (total > 100) score += 15;
    else if (total > 10) score += 10;
    else score += 5;

    // 增速 (50分)
    if (perWeek > 100) score += 50;
    else if (perWeek > 50) score += 45;
    else if (perWeek > 20) score += 40;
    else if (perWeek > 10) score += 35;
    else if (perWeek > 5) score += 30;
    else if (perWeek > 1) score += 20;
    else if (perWeek > 0.1) score += 10;
    else score += 5;

    return {
      score: Math.round(score / 2),
      total,
      perWeek,
      label: this.getScoreLabel(score / 2),
    };
  }

  calcCommitsScore(commitsData) {
    const { weeklyAvg, trend } = commitsData;
    
    let score = 0;
    
    // 每周平均 commit 数 (70分)
    if (weeklyAvg > 50) score += 70;
    else if (weeklyAvg > 20) score += 60;
    else if (weeklyAvg > 10) score += 50;
    else if (weeklyAvg > 5) score += 40;
    else if (weeklyAvg > 2) score += 30;
    else if (weeklyAvg > 0.5) score += 20;
    else score += 10;

    // 趋势 (30分)
    if (trend === 'increasing') score += 30;
    else if (trend === 'stable') score += 20;
    else if (trend === 'declining') score += 10;
    else score += 15;

    return {
      score: Math.round(score),
      weeklyAvg,
      trend,
      label: this.getScoreLabel(score),
    };
  }

  calcIssuesScore(issuesData) {
    const { open, avgResponseDays, resolutionRate } = issuesData;
    
    let score = 0;

    // Issue 开放数量 (40分，越少越好但不能完全没有说明没issues)
    if (open === 0) score += 20; // 新项目可能
    else if (open <= 10) score += 40;
    else if (open <= 50) score += 35;
    else if (open <= 100) score += 30;
    else if (open <= 200) score += 25;
    else if (open <= 500) score += 20;
    else score += 10;

    // 响应时间 (30分，越快越好)
    if (avgResponseDays === null) score += 15;
    else if (avgResponseDays <= 1) score += 30;
    else if (avgResponseDays <= 3) score += 28;
    else if (avgResponseDays <= 7) score += 25;
    else if (avgResponseDays <= 14) score += 20;
    else if (avgResponseDays <= 30) score += 15;
    else score += 10;

    // 解决率 (30分)
    if (resolutionRate === null) score += 15;
    else if (resolutionRate >= 90) score += 30;
    else if (resolutionRate >= 80) score += 28;
    else if (resolutionRate >= 70) score += 25;
    else if (resolutionRate >= 50) score += 20;
    else score += 15;

    return {
      score: Math.round(score),
      openIssues: open,
      avgResponseDays,
      resolutionRate,
      label: this.getScoreLabel(score),
    };
  }

  calcPRsScore(prsData) {
    const { open, mergeRate, avgMergeDays } = prsData;
    
    let score = 0;

    // PR 合并率 (50分)
    if (mergeRate >= 90) score += 50;
    else if (mergeRate >= 80) score += 45;
    else if (mergeRate >= 70) score += 40;
    else if (mergeRate >= 50) score += 35;
    else if (mergeRate >= 30) score += 25;
    else score += 15;

    // 合并时间 (50分)
    if (avgMergeDays === null) score += 25;
    else if (avgMergeDays <= 1) score += 50;
    else if (avgMergeDays <= 3) score += 45;
    else if (avgMergeDays <= 7) score += 40;
    else if (avgMergeDays <= 14) score += 35;
    else if (avgMergeDays <= 30) score += 25;
    else score += 15;

    return {
      score: Math.round(score),
      openPRs: open,
      mergeRate,
      avgMergeDays,
      label: this.getScoreLabel(score),
    };
  }

  calcContributorsScore(contributorsData) {
    const { count } = contributorsData;
    
    let score = 0;
    
    if (count >= 100) score = 100;
    else if (count >= 50) score = 90;
    else if (count >= 20) score = 80;
    else if (count >= 10) score = 70;
    else if (count >= 5) score = 60;
    else if (count >= 3) score = 50;
    else if (count >= 1) score = 40;
    else score = 30;

    return {
      score,
      count,
      label: this.getScoreLabel(score),
    };
  }

  calcResponsivenessScore(issuesData, prsData) {
    const { avgResponseDays } = issuesData;
    const { avgMergeDays, mergeRate } = prsData;

    let score = 0;

    // Issue 响应 (50分)
    if (avgResponseDays === null) score += 25;
    else if (avgResponseDays <= 1) score += 50;
    else if (avgResponseDays <= 3) score += 45;
    else if (avgResponseDays <= 7) score += 40;
    else if (avgResponseDays <= 14) score += 35;
    else if (avgResponseDays <= 30) score += 25;
    else score += 15;

    // PR 响应 (50分)
    if (avgMergeDays === null) score += 25;
    else if (avgMergeDays <= 1) score += 50;
    else if (avgMergeDays <= 3) score += 45;
    else if (avgMergeDays <= 7) score += 40;
    else if (avgMergeDays <= 14) score += 35;
    else if (avgMergeDays <= 30) score += 25;
    else score += 15;

    return {
      score: Math.round(score),
      issueResponseDays: avgResponseDays,
      prMergeDays: avgMergeDays,
      label: this.getScoreLabel(score),
    };
  }

  calcGrowthScore(starsData, commitsData) {
    const { starGrowth } = starsData;
    const { trend } = commitsData;

    let score = 0;

    // Star 增长 (60分)
    if (starGrowth >= 50) score += 60;
    else if (starGrowth >= 20) score += 55;
    else if (starGrowth >= 10) score += 50;
    else if (starGrowth >= 5) score += 45;
    else if (starGrowth >= 0) score += 40;
    else if (starGrowth >= -10) score += 35;
    else if (starGrowth >= -30) score += 25;
    else score += 15;

    // Commit 趋势 (40分)
    if (trend === 'increasing') score += 40;
    else if (trend === 'stable') score += 30;
    else score += 20;

    return {
      score: Math.round(score),
      starGrowth: `${starGrowth}%`,
      commitTrend: trend,
      label: this.getScoreLabel(score),
    };
  }

  calcActivityScore(commitsData, issuesData, prsData) {
    const { weeklyAvg, recentActivity } = commitsData;
    const { open: openIssues } = issuesData;
    const { open: openPRs } = prsData;

    // 计算每周活动量
    const activityScore = Math.min(100, weeklyAvg * 2); // 50 commits/week = 100分
    const backlogPressure = Math.min(100, (openIssues + openPRs) / 10 * 100); //  backlog 越少越好

    let score = activityScore * 0.6 + (100 - backlogPressure) * 0.4;
    score = Math.round(score);

    return {
      score,
      weeklyCommits: weeklyAvg,
      backlogItems: openIssues + openPRs,
      label: this.getScoreLabel(score),
    };
  }

  // ==================== 辅助方法 ====================

  getScoreLabel(score) {
    if (score >= 90) return '🌟 Excellent';
    if (score >= 80) return '✅ Very Good';
    if (score >= 70) return '👍 Good';
    if (score >= 60) return '⚠️ Fair';
    if (score >= 50) return '⚡ Needs Attention';
    return '❌ Poor';
  }

  getGrade(score) {
    if (score >= 90) return { letter: 'A+', color: '#22c55e', meaning: 'Excellent' };
    if (score >= 85) return { letter: 'A', color: '#22c55e', meaning: 'Excellent' };
    if (score >= 80) return { letter: 'A-', color: '#84cc16', meaning: 'Very Good' };
    if (score >= 75) return { letter: 'B+', color: '#84cc16', meaning: 'Very Good' };
    if (score >= 70) return { letter: 'B', color: '#eab308', meaning: 'Good' };
    if (score >= 65) return { letter: 'B-', color: '#eab308', meaning: 'Good' };
    if (score >= 60) return { letter: 'C+', color: '#f97316', meaning: 'Fair' };
    if (score >= 55) return { letter: 'C', color: '#f97316', meaning: 'Fair' };
    if (score >= 50) return { letter: 'C-', color: '#f97316', meaning: 'Fair' };
    if (score >= 40) return { letter: 'D', color: '#ef4444', meaning: 'Needs Work' };
    return { letter: 'F', color: '#dc2626', meaning: 'Poor' };
  }

  generateSuggestions(metrics) {
    const suggestions = [];

    if (metrics.stars.score < 50) {
      suggestions.push('📣 Star 增速较慢，建议增加项目曝光和推广');
    }
    if (metrics.commits.weeklyAvg < 5) {
      suggestions.push('💻 Commit 频率偏低，建议保持更活跃的开发');
    }
    if (metrics.issues.avgResponseDays > 7) {
      suggestions.push('⏰ Issue 响应时间较长，建议设置 SLQ 并及时回复');
    }
    if (metrics.prs.avgMergeDays > 14) {
      suggestions.push('🔀 PR 合并时间偏长，建议加快代码审查');
    }
    if (metrics.mergeRate < 70) {
      suggestions.push('📝 PR 合并率偏低，建议明确贡献指南');
    }
    if (metrics.contributors.count < 5) {
      suggestions.push('🤝 贡献者较少，建议建立社区、鼓励外部贡献');
    }
    if (metrics.activity.score < 50) {
      suggestions.push('📊 整体活跃度有下降趋势，需要关注');
    }
    if (metrics.growth.starGrowth < 0) {
      suggestions.push('📉 Star 增长为负，需要重新审视项目方向');
    }

    if (suggestions.length === 0) {
      suggestions.push('🎉 项目健康度优秀！继续保持高质量开发');
    }

    return suggestions;
  }

  generateSummary(repoData, totalScore, grade) {
    const messages = {
      'Excellent': `🌟 ${repoData.full_name} 是一个非常健康的开源项目！值得长期关注和参与。`,
      'Very Good': `✅ ${repoData.full_name} 健康状况良好，社区活跃，适合贡献。`,
      'Good': `👍 ${repoData.full_name} 基本健康，可以考虑参与。`,
      'Fair': `⚠️ ${repoData.full_name} 需要注意一些问题，参与前请仔细评估。`,
      'Needs Work': `⚡ ${repoData.full_name} 健康度一般，贡献前请三思。`,
      'Poor': `❌ ${repoData.full_name} 健康状况较差，可能存在较大问题。`,
    };
    return messages[grade.meaning] || messages['Fair'];
  }
}

module.exports = RepoHealthScorer;
