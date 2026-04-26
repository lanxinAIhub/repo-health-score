#!/usr/bin/env node

/**
 * Repo Health Score CLI
 */

const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const RepoHealthScorer = require('./scorer');

const program = new Command();

program
  .name('health-score')
  .description('Evaluate open source project health scores')
  .version('1.0.0');

program
  .command('score <owner/repo>')
  .description('Score a repository health')
  .option('-o, --output <type>', 'Output format: text, json', 'text')
  .action(async (repo, options) => {
    const [owner, repoName] = repo.split('/');
    
    if (!owner || !repoName) {
      console.error(chalk.red('❌ Invalid format. Use: health-score owner/repo'));
      process.exit(1);
    }

    const spinner = ora({
      text: 'Analyzing repository health...',
      spinner: 'dots',
    }).start();

    try {
      const scorer = new RepoHealthScorer();
      const result = await scorer.scoreRepo(owner, repoName);
      spinner.succeed('Analysis complete!\n');

      if (options.output === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printReport(result);
      }
    } catch (error) {
      spinner.fail('Analysis failed');
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('compare <repo1> <repo2>')
  .description('Compare two repositories')
  .action(async (repo1, repo2) => {
    const parse = r => r.split('/');
    const [owner1, name1] = parse(repo1);
    const [owner2, name2] = parse(repo2);

    const spinner = ora('Comparing repositories...').start();

    try {
      const scorer = new RepoHealthScorer();
      const [result1, result2] = await Promise.all([
        scorer.scoreRepo(owner1, name1),
        scorer.scoreRepo(owner2, name2),
      ]);
      spinner.succeed();

      console.log('\n' + chalk.bold('\n📊 Comparison Report\n'));
      console.log(chalk.cyan('=' .repeat(50)));
      console.log(chalk.bold(`\n  ${result1.repo}`));
      console.log(`  ${chalk.yellow('⭐')} ${result1.totalScore}/100 (${result1.grade.letter})`);
      console.log(chalk.bold(`\n  ${result2.repo}`));
      console.log(`  ${chalk.yellow('⭐')} ${result2.totalScore}/100 (${result2.grade.letter})`);
      console.log(chalk.cyan('='.repeat(50)));

      const winner = result1.totalScore > result2.totalScore ? result1 : result2;
      console.log(chalk.green(`\n🏆 Winner: ${winner.repo} (${winner.totalScore}/100)\n`));
    } catch (error) {
      spinner.fail();
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

function printReport(result) {
  const { totalScore, grade, metrics, summary, suggestions, meta } = result;

  // 标题
  console.log(chalk.bold.cyan(`\n📊 Repo Health Report: ${result.repo}\n`));
  console.log(chalk.cyan('─'.repeat(50)));

  // 总分
  console.log(chalk.bold(`\n  Overall Score: `) + chalk.bold[`${grade.color}`](`${totalScore}/100 (${grade.letter})`) + ` ${grade.meaning}`);
  console.log(`\n  ${summary}\n`);

  // 雷达图式展示
  console.log(chalk.bold('\n  📈 Metrics Breakdown:\n'));
  
  const metricRows = [
    ['⭐ Stars', metrics.stars],
    ['💻 Commits', metrics.commits],
    ['📋 Issues', metrics.issues],
    ['🔀 Pull Requests', metrics.prs],
    ['🤝 Contributors', metrics.contributors],
    ['⏱️ Responsiveness', metrics.responsiveness],
    ['📈 Growth', metrics.growth],
    ['🔥 Activity', metrics.activity],
  ];

  for (const [name, data] of metricRows) {
    const bar = getScoreBar(data.score);
    console.log(`  ${name.padEnd(18)} ${bar} ${chalk.gray(`${data.score}/100`)}`);
  }

  // Meta 信息
  console.log(chalk.cyan('\n  ── Repository Info ──\n'));
  console.log(`  ${chalk.yellow('⭐')} Stars: ${meta.stars.toLocaleString()}`);
  console.log(`  ${chalk.yellow('🍴')} Forks: ${meta.forks.toLocaleString()}`);
  console.log(`  ${chalk.yellow('📂')} Open Issues: ${meta.openIssues}`);
  console.log(`  ${chalk.yellow('💬')} Language: ${meta.language || 'N/A'}`);
  console.log(`  ${chalk.yellow('📜')} License: ${meta.license}`);
  console.log(`  ${chalk.yellow('📅')} Created: ${new Date(meta.createdAt).toLocaleDateString()}`);

  // 建议
  console.log(chalk.bold('\n  💡 Suggestions:\n'));
  for (const s of suggestions) {
    console.log(`  ${s}`);
  }

  console.log(chalk.cyan('\n  ──'.padEnd(50, '─')) + '\n');
  console.log(chalk.gray(`  Analyzed at: ${new Date(meta.analyzedAt).toLocaleString()}\n`));
}

function getScoreBar(score) {
  const total = 10;
  const filled = Math.round(score / 10);
  const empty = total - filled;
  
  let color = chalk.green;
  if (score < 60) color = chalk.yellow;
  if (score < 40) color = chalk.red;

  return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

program.parse(process.argv);
