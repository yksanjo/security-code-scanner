#!/usr/bin/env node

import { Command } from 'commander';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf8')
);

const program = new Command();

program
  .name('security-scanner')
  .description('Security-focused code scanner - detect vulnerabilities and security issues')
  .version(packageJson.version);

// Security patterns to detect
const SECURITY_PATTERNS = [
  { name: 'Hardcoded Password', pattern: /password\s*=\s*['"][^'"]+['"]/i, severity: 'HIGH' },
  { name: 'Hardcoded API Key', pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/i, severity: 'HIGH' },
  { name: 'Hardcoded Secret', pattern: /secret\s*=\s*['"][^'"]+['"]/i, severity: 'HIGH' },
  { name: 'Private Key', pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/i, severity: 'CRITICAL' },
  { name: 'AWS Key', pattern: /(AKIA|ASIA)[A-Z0-9]{16}/i, severity: 'CRITICAL' },
  { name: 'GitHub Token', pattern: /gh[pousr]_[A-Za-z0-9]{36,}/i, severity: 'CRITICAL' },
  { name: 'Generic Token', pattern: /token\s*=\s*['"][A-Za-z0-9_\-]{20,}['"]/i, severity: 'MEDIUM' },
  { name: 'Database URL', pattern: /(mysql|postgres|mongodb):\/\/[^:]+:[^@]+@/i, severity: 'HIGH' },
  { name: 'SQL Injection Risk', pattern: /['"]\s*\+\s*[^;]+\+\s*['"]/i, severity: 'MEDIUM' },
  { name: 'Eval Usage', pattern: /\beval\s*\(/i, severity: 'HIGH' },
  { name: 'Inner HTML', pattern: /\.innerHTML\s*=/i, severity: 'MEDIUM' },
  { name: 'Command Injection', pattern: /exec\s*\(\s*[^)]+\)/i, severity: 'HIGH' },
  { name: 'Weak Crypto', pattern: /md5|sha1/i, severity: 'MEDIUM' },
  { name: 'Disabled SSL', pattern: /rejectUnauthorized\s*:\s*false/i, severity: 'HIGH' },
  { name: 'Debug Mode', pattern: /debug\s*:\s*true/i, severity: 'LOW' },
];

// Scan file for security issues
function scanFile(filePath, content) {
  const issues = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    for (const pattern of SECURITY_PATTERNS) {
      if (pattern.pattern.test(line)) {
        issues.push({
          file: filePath,
          line: lineNum,
          issue: pattern.name,
          severity: pattern.severity,
          snippet: line.trim().substring(0, 100)
        });
      }
    }
  }
  
  return issues;
}

// Scan command
program
  .command('scan')
  .description('Scan files or directories for security issues')
  .argument('<paths...>', 'Files or directories to scan')
  .option('-r, --recursive', 'Scan directories recursively')
  .option('-o, --output <file>', 'Save results to JSON file')
  .option('--severity <level>', 'Filter by severity: CRITICAL, HIGH, MEDIUM, LOW')
  .action(async (paths, options) => {
    const fs = await import('fs');
    const path = await import('path');
    
    console.log('🔒 Security Scanner\n');
    
    const allIssues = [];
    const filesScanned = [];
    
    for (const scanPath of paths) {
      const stat = fs.statSync(scanPath);
      
      if (stat.isDirectory() && options.recursive) {
        const scanDir = (dir) => {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            const fullPath = path.join(dir, item);
            const itemStat = fs.statSync(fullPath);
            if (itemStat.isDirectory()) {
              scanDir(fullPath);
            } else if (itemStat.isFile()) {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const issues = scanFile(fullPath, content);
              allIssues.push(...issues);
              filesScanned.push(fullPath);
            }
          }
        };
        scanDir(scanPath);
      } else if (stat.isFile()) {
        const content = fs.readFileSync(scanPath, 'utf-8');
        const issues = scanFile(scanPath, content);
        allIssues.push(...issues);
        filesScanned.push(scanPath);
      }
    }
    
    // Filter by severity if specified
    let filteredIssues = allIssues;
    if (options.severity) {
      filteredIssues = allIssues.filter(i => i.severity === options.severity.toUpperCase());
    }
    
    // Sort by severity
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    filteredIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    
    // Print results
    console.log(`Scanned ${filesScanned.length} files`);
    console.log(`Found ${filteredIssues.length} security issues\n`);
    
    if (filteredIssues.length > 0) {
      console.log('═'.repeat(60));
      console.log('SECURITY ISSUES FOUND');
      console.log('═'.repeat(60));
      
      const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
      for (const issue of filteredIssues) {
        bySeverity[issue.severity]++;
        const icon = issue.severity === 'CRITICAL' ? '🔴' : 
                     issue.severity === 'HIGH' ? '🟠' : 
                     issue.severity === 'MEDIUM' ? '🟡' : '⚪';
        console.log(`\n${icon} [${issue.severity}] ${issue.issue}`);
        console.log(`   File: ${issue.file}:${issue.line}`);
        console.log(`   Code: ${issue.snippet}`);
      }
      
      console.log('\n' + '═'.repeat(60));
      console.log('SUMMARY');
      console.log('═'.repeat(60));
      console.log(`CRITICAL: ${bySeverity.CRITICAL}`);
      console.log(`HIGH: ${bySeverity.HIGH}`);
      console.log(`MEDIUM: ${bySeverity.MEDIUM}`);
      console.log(`LOW: ${bySeverity.LOW}`);
    } else {
      console.log('✅ No security issues found!');
    }
    
    // Save to file if requested
    if (options.output) {
      const report = {
        scanned: filesScanned.length,
        issues: filteredIssues,
        summary: {
          CRITICAL: filteredIssues.filter(i => i.severity === 'CRITICAL').length,
          HIGH: filteredIssues.filter(i => i.severity === 'HIGH').length,
          MEDIUM: filteredIssues.filter(i => i.severity === 'MEDIUM').length,
          LOW: filteredIssues.filter(i => i.severity === 'LOW').length,
        }
      };
      fs.writeFileSync(options.output, JSON.stringify(report, null, 2));
      console.log(`\n📁 Report saved to: ${options.output}`);
    }
    
    // Exit with error if critical issues found
    const criticalCount = filteredIssues.filter(i => i.severity === 'CRITICAL').length;
    if (criticalCount > 0) {
      process.exit(1);
    }
  });

// Check GitHub PR for security issues
program
  .command('pr')
  .description('Scan GitHub PR for security issues')
  .requiredOption('-o, --owner <owner>', 'Repository owner')
  .requiredOption('-r, --repo <repo>', 'Repository name')
  .requiredOption('-p, --pr-number <number>', 'PR number')
  .option('-t, --token <token>', 'GitHub token')
  .action(async (options) => {
    const { Octokit } = await import('octokit');
    const token = options.token || process.env.GITHUB_TOKEN;
    
    if (!token) {
      console.error('Error: GitHub token required');
      process.exit(1);
    }
    
    const octokit = new Octokit({ auth: token });
    
    console.log('🔒 Scanning PR for security issues...\n');
    
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner: options.owner,
      repo: options.repo,
      pull_number: parseInt(options.prNumber),
      per_page: 100
    });
    
    let totalIssues = 0;
    
    for (const file of files) {
      if (!file.patch) continue;
      
      const issues = scanFile(file.filename, file.patch);
      if (issues.length > 0) {
        totalIssues += issues.length;
        console.log(`\n📄 ${file.filename}`);
        for (const issue of issues) {
          console.log(`   ${issue.severity}: ${issue.issue}`);
        }
      }
    }
    
    console.log(`\n✅ Found ${totalIssues} security issues in PR`);
  });

program.parse();
