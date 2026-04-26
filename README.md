# 🏥 Repo Health Score

> AI-powered open source project health scoring system - evaluate repo health based on star growth, issue response, commit frequency, and PR merge rates

[![CI](https://github.com/lanxinAIhub/repo-health-score/actions/workflows/ci.yml/badge.svg)](https://github.com/lanxinAIhub/repo-health-score/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 📊 **8 Health Metrics** - Comprehensive scoring based on stars, commits, issues, PRs, and more
- 🤖 **AI-Powered** - Intelligent analysis using GitHub's rich data
- ⚡ **Instant Results** - Get health scores in seconds
- 🌐 **Web Interface** - Beautiful visual dashboard
- 📈 **Trend Analysis** - Track project health over time
- 💡 **Actionable Suggestions** - Get recommendations to improve project health

## 📊 Scoring Metrics

| Metric | Weight | Description |
|--------|--------|-------------|
| ⭐ Stars | 15% | Total stars + growth rate |
| 💻 Commits | 15% | Frequency + trend |
| 📋 Issues | 15% | Response time + resolution rate |
| 🔀 PRs | 15% | Merge rate + time |
| 🤝 Contributors | 10% | Contributor count |
| ⏱️ Responsiveness | 10% | Issue/PR response speed |
| 📈 Growth | 10% | Star + commit growth |
| 🔥 Activity | 10% | Overall activity level |

## 🚀 Quick Start

### CLI

```bash
# Install
npm install -g repo-health-score

# Score a repository
health-score score owner/repo

# Compare two repositories
health-score compare owner/repo1 owner/repo2
```

### Web

```bash
# Start web server
npm run web

# Visit http://localhost:3000
```

### API

```bash
# Start server
npm run web

# Analyze via API
curl -X POST http://localhost:3000/api/score \
  -H "Content-Type: application/json" \
  -d '{"owner": "facebook", "repo": "react"}'
```

## 🌐 Live Demo

Visit our website to analyze repositories visually:
- [repo-health-score.example.com](https://repo-health-score.example.com)

## 📖 How It Works

### Score Calculation

Each metric is scored 0-100 based on performance thresholds:

- **Stars**: Total count (50%) + weekly growth rate (50%)
- **Commits**: Weekly average (70%) + trend direction (30%)
- **Issues**: Open count (40%) + response time (30%) + resolution rate (30%)
- **PRs**: Merge rate (50%) + merge time (50%)
- **Contributors**: Contributor count tiers

### Grade Scale

| Score | Grade | Meaning |
|-------|-------|---------|
| 90-100 | A+ | Excellent |
| 85-89 | A | Excellent |
| 80-84 | A- | Very Good |
| 75-79 | B+ | Very Good |
| 70-74 | B | Good |
| 65-69 | B- | Good |
| 60-64 | C+ | Fair |
| 55-59 | C | Fair |
| 50-54 | C- | Fair |
| 40-49 | D | Needs Work |
| 0-39 | F | Poor |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 📧 Contact

- GitHub: [@lanxinAIhub](https://github.com/lanxinAIhub)
