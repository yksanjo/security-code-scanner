#!/usr/bin/env node

import { Command } from 'commander';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import { GitHubAnalyzer } from './analyzers/github.js';
import { LocalAnalyzer } from './analyzers/local.js';
import { ClaudeAnalyzer } from './analyzers/claude.js';
import { ReviewFormatter } from './formatters/reviewFormatter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf8')
);

const program = new Command();

program
  .name('code-review')
  .description('Claude-Powered Code Review Assistant - Analyze pull requests and provide thoughtful feedback')
  .version(packageJson.version);

// Command: Review a GitHub Pull Request
program
  .command('pr')
  .description('Review a GitHub pull request')
  .requiredOption('-o, --owner <owner>', 'Repository owner')
  .requiredOption('-r, --repo <repo>', 'Repository name')
  .requiredOption('-p, --pr-number <number>', 'Pull request number')
  .option('-t, --token <token>', 'GitHub token (or set GITHUB_TOKEN env variable)')
  .option('--no-post', 'Only analyze without posting review')
  .option('--approval', 'Approve the PR after review')
  .option('--format <format>', 'Output format: markdown, json, text', 'markdown')
  .action(async (options) => {
    const token = options.token || process.env.GITHUB_TOKEN;
    if (!token) {
      console.error('Error: GitHub token required. Use --token or set GITHUB_TOKEN environment variable.');
      process.exit(1);
    }

    const analyzer = new GitHubAnalyzer(token);
    const claude = new ClaudeAnalyzer();
    const formatter = new ReviewFormatter();

    try {
      console.log(`🔍 Fetching pull request #${options.prNumber} from ${options.owner}/${options.repo}...`);
      
      const prDetails = await analyzer.getPullRequest(options.owner, options.repo, options.prNumber);
      const files = await analyzer.getPullRequestFiles(options.owner, options.repo, options.prNumber);
      
      console.log(`📄 Found ${files.length} changed files\n`);
      
      // Analyze each file
      const reviews = [];
      for (const file of files) {
        console.log(`  Analyzing: ${file.filename}`);
        const analysis = await claude.analyzeCode(file);
        reviews.push({
          filename: file.filename,
          analysis,
          changes: file
        });
      }
      
      // Generate overall review
      const overallReview = await claude.generateOverallReview(prDetails, reviews);
      
      // Format output
      const formatted = formatter.format(reviews, overallReview, options.format);
      
      console.log('\n' + '='.repeat(60));
      console.log('CODE REVIEW RESULTS');
      console.log('='.repeat(60));
      console.log(formatted);
      
      // Post review if requested
      if (!options.post) {
        console.log('\n⚠️  Review not posted (--no-post flag set)');
      } else {
        const reviewBody = formatter.formatForGitHub(overallReview);
        const event = options.approval ? 'APPROVE' : 'COMMENT';
        
        await analyzer.postReview(options.owner, options.repo, options.prNumber, {
          body: reviewBody,
          event
        });
        
        console.log('\n✅ Review posted successfully!');
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Command: Review local changes (uncommitted or between branches)
program
  .command('local')
  .description('Review local code changes (uncommitted or between branches)')
  .option('-b, --base <branch>', 'Base branch to compare against', 'main')
  .option('-c, --compare <branch>', 'Branch to compare (default: current branch)')
  .option('--staged', 'Review only staged changes')
  .option('--format <format>', 'Output format: markdown, json, text', 'markdown')
  .option('-o, --output <file>', 'Save review to file')
  .action(async (options) => {
    const claude = new ClaudeAnalyzer();
    const formatter = new ReviewFormatter();
    
    try {
      const analyzer = new LocalAnalyzer();
      
      console.log('🔍 Analyzing local changes...');
      
      let files;
      if (options.staged) {
        files = await analyzer.getStagedChanges();
      } else {
        files = await analyzer.getBranchDiff(options.base, options.compare);
      }
      
      console.log(`📄 Found ${files.length} changed files\n`);
      
      // Analyze each file
      const reviews = [];
      for (const file of files) {
        console.log(`  Analyzing: ${file.filename}`);
        const analysis = await claude.analyzeCode(file);
        reviews.push({
          filename: file.filename,
          analysis,
          changes: file
        });
      }
      
      // Generate overall review
      const overallReview = await claude.generateLocalReview(reviews, options);
      
      // Format output
      const formatted = formatter.format(reviews, overallReview, options.format);
      
      console.log('\n' + '='.repeat(60));
      console.log('CODE REVIEW RESULTS');
      console.log('='.repeat(60));
      console.log(formatted);
      
      // Save to file if requested
      if (options.output) {
        const fs = await import('fs');
        fs.writeFileSync(options.output, formatted);
        console.log(`\n📁 Review saved to: ${options.output}`);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Command: Setup and configuration
program
  .command('setup')
  .description('Setup configuration and API keys')
  .action(async () => {
    const { writeFileSync } = await import('fs');
    const envPath = join(process.cwd(), '.env.example');
    
    const exampleContent = `# Claude Code Review Assistant Configuration

# GitHub Token (for PR reviews)
# Get it from: https://github.com/settings/tokens
GITHUB_TOKEN=your_github_token_here

# Anthropic API Key (for Claude analysis)
# Get it from: https://console.anthropic.com/
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional: Custom review settings
# REVIEW_MAX_FILES=50
# REVIEW_INCLUDE_STATS=true
`;
    
    writeFileSync(envPath, exampleContent);
    console.log('✅ Created .env.example configuration file');
    console.log('\nTo configure:');
    console.log('1. Copy .env.example to .env');
    console.log('2. Add your GitHub token and/or Anthropic API key');
    console.log('3. Run "code-review pr" or "code-review local" commands');
  });

// Command: GitHub Actions integration
program
  .command('action')
  .description('Run in GitHub Actions context (automated from GITHUB_TOKEN env)')
  .option('-e, --event-path <path>', 'GitHub event JSON file path')
  .action(async (options) => {
    const token = process.env.GITHUB_TOKEN;
    const eventPath = options.eventPath || process.env.GITHUB_EVENT_PATH;
    
    if (!token) {
      console.error('Error: GITHUB_TOKEN environment variable required for GitHub Actions');
      process.exit(1);
    }
    
    if (!eventPath) {
      console.error('Error: GitHub event file not found');
      process.exit(1);
    }
    
    const fs = await import('fs');
    const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    
    if (!event.pull_request) {
      console.log('Not a pull request event, skipping review');
      process.exit(0);
    }
    
    const analyzer = new GitHubAnalyzer(token);
    const claude = new ClaudeAnalyzer();
    const formatter = new ReviewFormatter();
    
    const owner = process.env.GITHUB_REPOSITORY?.split('/')[0];
    const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
    const prNumber = event.pull_request.number;
    
    console.log(`🔍 Running automated review for PR #${prNumber}`);
    
    const prDetails = await analyzer.getPullRequest(owner, repo, prNumber);
    const files = await analyzer.getPullRequestFiles(owner, repo, prNumber);
    
    const reviews = [];
    for (const file of files) {
      const analysis = await claude.analyzeCode(file);
      reviews.push({ filename: file.filename, analysis, changes: file });
    }
    
    const overallReview = await claude.generateOverallReview(prDetails, reviews);
    const reviewBody = formatter.formatForGitHub(overallReview);
    
    await analyzer.postReview(owner, repo, prNumber, {
      body: reviewBody,
      event: 'COMMENT'
    });
    
    console.log('✅ Automated review posted');
  });

// Parse and execute
program.parse();
