/**
 * Repo Health Score Web App
 */

const API_BASE = window.location.origin + '/api';

// State
let currentResult = null;

// Elements
const repoInput = document.getElementById('repoInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultsSection = document.getElementById('results');
const loadingOverlay = document.getElementById('loadingOverlay');

// Event Listeners
analyzeBtn.addEventListener('click', analyze);
repoInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyze();
});

document.querySelectorAll('.example-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    repoInput.value = btn.dataset.repo;
    analyze();
  });
});

async function analyze() {
  const value = repoInput.value.trim();
  if (!value) {
    alert('Please enter a repository (e.g., facebook/react)');
    return;
  }

  const [owner, repo] = value.split('/');
  if (!owner || !repo) {
    alert('Invalid format. Use: owner/repo (e.g., facebook/react)');
    return;
  }

  showLoading(true);

  try {
    const res = await fetch(`${API_BASE}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner, repo }),
    });

    const result = await res.json();

    if (!result.success) {
      throw new Error(result.error);
    }

    currentResult = result.data;
    displayResults(currentResult);
  } catch (error) {
    alert(`Analysis failed: ${error.message}`);
  } finally {
    showLoading(false);
  }
}

function showLoading(show) {
  loadingOverlay.style.display = show ? 'flex' : 'none';
}

function displayResults(data) {
  resultsSection.style.display = 'block';
  resultsSection.scrollIntoView({ behavior: 'smooth' });

  // Header
  document.getElementById('resultRepo').textContent = data.repo;
  document.getElementById('resultDesc').textContent = data.meta.description || '';

  // Score Circle
  const score = data.totalScore;
  const grade = data.grade;
  const scoreCircle = document.getElementById('scoreCircle');
  const degrees = (score / 100) * 360;
  scoreCircle.style.background = `conic-gradient(${grade.color} 0deg, ${grade.color} ${degrees}deg, var(--surface-light) ${degrees}deg)`;
  
  document.getElementById('scoreNumber').textContent = score;
  document.getElementById('scoreGrade').textContent = grade.letter;
  document.getElementById('scoreGrade').style.color = grade.color;
  document.getElementById('scoreMeaning').textContent = grade.meaning;
  document.getElementById('scoreSummary').textContent = data.summary;

  // Metrics Grid
  const metricsGrid = document.getElementById('metricsGrid');
  const metrics = [
    { key: 'stars', name: '⭐ Stars', ...data.metrics.stars },
    { key: 'commits', name: '💻 Commits', ...data.metrics.commits },
    { key: 'issues', name: '📋 Issues', ...data.metrics.issues },
    { key: 'prs', name: '🔀 PRs', ...data.metrics.prs },
    { key: 'contributors', name: '🤝 Contributors', ...data.metrics.contributors },
    { key: 'responsiveness', name: '⏱️ Responsiveness', ...data.metrics.responsiveness },
    { key: 'growth', name: '📈 Growth', ...data.metrics.growth },
    { key: 'activity', name: '🔥 Activity', ...data.metrics.activity },
  ];

  metricsGrid.innerHTML = metrics.map(m => `
    <div class="metric-card">
      <div class="metric-name">${m.name}</div>
      <div class="metric-score" style="color: ${getScoreColor(m.score)}">${m.score}</div>
      <span class="metric-label" style="background: ${getScoreColor(m.score)}20; color: ${getScoreColor(m.score)}">${m.label}</span>
      <div class="metric-details">${getMetricDetails(m)}</div>
    </div>
  `).join('');

  // Repo Info
  const m = data.meta;
  document.getElementById('repoInfo').innerHTML = `
    <div class="repo-stat">
      <div class="repo-stat-value">${m.stars.toLocaleString()}</div>
      <div class="repo-stat-label">⭐ Stars</div>
    </div>
    <div class="repo-stat">
      <div class="repo-stat-value">${m.forks.toLocaleString()}</div>
      <div class="repo-stat-label">🍴 Forks</div>
    </div>
    <div class="repo-stat">
      <div class="repo-stat-value">${m.openIssues}</div>
      <div class="repo-stat-label">📋 Open Issues</div>
    </div>
    <div class="repo-stat">
      <div class="repo-stat-value">${m.language || 'N/A'}</div>
      <div class="repo-stat-label">💬 Language</div>
    </div>
  `;

  // Suggestions
  document.getElementById('suggestionsList').innerHTML = data.suggestions
    .map(s => `<li>${s}</li>`)
    .join('');
}

function getScoreColor(score) {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#84cc16';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function getMetricDetails(m) {
  switch (m.key) {
    case 'stars':
      return `${m.total.toLocaleString()} total • ${m.perWeek}/wk`;
    case 'commits':
      return `${m.weeklyAvg}/week • ${m.trend}`;
    case 'issues':
      return `${m.openIssues} open${m.avgResponseDays ? ` • ${m.avgResponseDays}d avg` : ''}`;
    case 'prs':
      return `${m.mergeRate}% merged${m.avgMergeDays ? ` • ${m.avgMergeDays}d avg` : ''}`;
    case 'contributors':
      return `${m.count} contributors`;
    case 'responsiveness':
      return `${m.issueResponseDays ? `${m.issueResponseDays}d issue` : 'N/A'} • ${m.prMergeDays ? `${m.prMergeDays}d PR` : 'N/A'}`;
    case 'growth':
      return `${m.starGrowth} stars • ${m.commitTrend}`;
    case 'activity':
      return `${m.weeklyCommits}/week • ${m.backlogItems} backlog`;
    default:
      return '';
  }
}
