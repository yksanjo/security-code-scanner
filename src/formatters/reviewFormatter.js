/**
 * Review Formatter
 * Formats code review results in various output formats
 */

export class ReviewFormatter {
  constructor() {
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      dim: '\x1b[2m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m'
    };
  }

  format(reviews, overallReview, format = 'markdown') {
    switch (format.toLowerCase()) {
      case 'json':
        return this.formatJSON(reviews, overallReview);
      case 'text':
        return this.formatText(reviews, overallReview);
      case 'markdown':
      default:
        return this.formatMarkdown(reviews, overallReview);
    }
  }

  formatJSON(reviews, overallReview) {
    const output = {
      summary: overallReview.summary,
      stats: overallReview.stats,
      files: reviews.map(r => ({
        filename: r.filename,
        analysis: r.analysis
      }))
    };
    
    return JSON.stringify(output, null, 2);
  }

  formatText(reviews, overallReview) {
    let output = '';
    
    // Header
    output += this.colorize('═'.repeat(60), 'cyan') + '\n';
    output += this.colorize('  CODE REVIEW RESULTS', 'bright') + '\n';
    output += this.colorize('═'.repeat(60), 'cyan') + '\n\n';
    
    // Summary stats
    if (overallReview.stats) {
      output += this.colorize('Summary:', 'bright') + '\n';
      output += `  Files analyzed: ${overallReview.stats.totalFiles}\n`;
      output += `  Issues found:   ${overallReview.stats.totalIssues}\n`;
      output += `  Suggestions:    ${overallReview.stats.totalSuggestions}\n`;
      if (overallReview.stats.securityIssues !== undefined) {
        output += `  Security:       ${overallReview.stats.securityIssues}\n`;
      }
      output += '\n';
    }
    
    // Overall review
    if (overallReview.summary) {
      output += this.colorize('Overall Review:', 'bright') + '\n';
      output += this.stripMarkdown(overallReview.summary) + '\n\n';
    }
    
    // File-by-file results
    output += this.colorize('─'.repeat(60), 'cyan') + '\n';
    output += this.colorize('File Reviews:', 'bright') + '\n';
    output += this.colorize('─'.repeat(60), 'cyan') + '\n\n';
    
    for (const review of reviews) {
      output += this.formatFileText(review) + '\n';
    }
    
    return output;
  }

  formatFileText(review) {
    let output = '';
    const { filename, analysis } = review;
    
    // Rating color
    const ratingColor = this.getRatingColor(analysis.rating);
    output += this.colorize(`📄 ${filename}`, 'bright') + '\n';
    output += this.colorize(`   Rating: ${analysis.rating || 'N/A'}`, ratingColor) + '\n';
    
    if (analysis.summary) {
      output += `   ${this.stripMarkdown(analysis.summary)}\n`;
    }
    
    // Issues
    if (analysis.issues?.length > 0) {
      output += this.colorize('   Issues:', 'red') + '\n';
      for (const issue of analysis.issues) {
        const severity = issue.severity ? ` [${issue.severity}]` : '';
        output += this.colorize(`   - ${issue.description}${severity}`, 'yellow') + '\n';
      }
    }
    
    // Suggestions
    if (analysis.suggestions?.length > 0) {
      output += this.colorize('   Suggestions:', 'cyan') + '\n';
      for (const suggestion of analysis.suggestions) {
        output += `   - ${suggestion.description}\n`;
      }
    }
    
    return output;
  }

  formatMarkdown(reviews, overallReview) {
    let output = '';
    
    // Header
    output += '# Code Review Results\n\n';
    
    // Summary stats
    if (overallReview.stats) {
      output += '## Summary\n\n';
      output += `| Metric | Value |\n`;
      output += `|--------|-------|\n`;
      output += `| Files Analyzed | ${overallReview.stats.totalFiles} |\n`;
      output += `| Issues Found | ${overallReview.stats.totalIssues} |\n`;
      output += `| Suggestions | ${overallReview.stats.totalSuggestions} |\n`;
      if (overallReview.stats.securityIssues !== undefined) {
        output += `| Security Concerns | ${overallReview.stats.securityIssues} |\n`;
      }
      output += '\n';
    }
    
    // Overall review
    if (overallReview.summary) {
      output += overallReview.summary + '\n\n';
    }
    
    // File-by-file results
    output += '---\n\n';
    output += '## File Reviews\n\n';
    
    for (const review of reviews) {
      output += this.formatFileMarkdown(review) + '\n';
    }
    
    return output;
  }

  formatFileMarkdown(review) {
    let output = '';
    const { filename, analysis, changes } = review;
    
    // File header with status indicator
    const statusIcon = this.getStatusIcon(changes?.status);
    output += `### ${statusIcon} ${filename}\n\n`;
    
    // Changes summary
    if (changes) {
      output += `**Changes:** `;
      const parts = [];
      if (changes.additions) parts.push(`+${changes.additions}`);
      if (changes.deletions) parts.push(`-${changes.deletions}`);
      output += parts.join(', ') || 'None';
      output += '\n\n';
    }
    
    // Rating
    if (analysis.rating) {
      const ratingBadge = this.getRatingBadge(analysis.rating);
      output += `${ratingBadge}\n\n`;
    }
    
    // Summary
    if (analysis.summary) {
      output += `**Summary:** ${analysis.summary}\n\n`;
    }
    
    // Issues
    if (analysis.issues?.length > 0) {
      output += '#### Issues\n\n';
      for (const issue of analysis.issues) {
        const severity = issue.severity ? ` **[${issue.severity.toUpperCase()}]**` : '';
        output += `- ${issue.description}${severity}\n`;
      }
      output += '\n';
    }
    
    // Suggestions
    if (analysis.suggestions?.length > 0) {
      output += '#### Suggestions\n\n';
      for (const suggestion of analysis.suggestions) {
        output += `- ${suggestion.description}\n`;
      }
      output += '\n';
    }
    
    return output;
  }

  formatForGitHub(overallReview) {
    let output = '';
    
    // Summary stats
    if (overallReview.stats) {
      output += '## Code Review Summary\n\n';
      output += `🤖 *Analyzed with Claude Code Review Assistant*\n\n`;
      output += `| Metric | Value |\n`;
      output += `|--------|-------|\n`;
      output += `| Files Changed | ${overallReview.stats.totalFiles} |\n`;
      output += `| Issues Found | ${overallReview.stats.totalIssues} |\n`;
      output += `| Suggestions | ${overallReview.stats.totalSuggestions} |\n`;
      if (overallReview.stats.securityIssues !== undefined) {
        const securityIcon = overallReview.stats.securityIssues > 0 ? '⚠️' : '✅';
        output += `| Security | ${securityIcon} ${overallReview.stats.securityIssues} |\n`;
      }
      output += '\n';
    }
    
    // Overall summary
    if (overallReview.summary) {
      output += overallReview.summary + '\n\n';
    }
    
    return output;
  }

  // Helper methods
  colorize(text, color) {
    // Check if we should use colors (not in CI/GitHub Actions)
    if (process.env.CI || process.env.GITHUB_ACTIONS || !process.stdout.isTTY) {
      return text;
    }
    return `${this.colors[color] || ''}${text}${this.colors.reset}`;
  }

  stripMarkdown(text) {
    return text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`/g, '')
      .replace(/[-*]/g, '')
      .trim();
  }

  getRatingColor(rating) {
    switch (rating) {
      case 'good':
        return 'green';
      case 'needs-attention':
        return 'yellow';
      case 'poor':
        return 'red';
      default:
        return 'reset';
    }
  }

  getRatingBadge(rating) {
    switch (rating) {
      case 'good':
        return '✅ **Good** - No major issues detected';
      case 'needs-attention':
        return '⚠️ **Needs Attention** - Some issues found';
      case 'poor':
        return '❌ **Issues Found** - Requires changes before merge';
      default:
        return '';
    }
  }

  getStatusIcon(status) {
    switch (status) {
      case 'added':
        return '✨';
      case 'removed':
        return '🗑️';
      case 'modified':
        return '📝';
      case 'renamed':
        return '📦';
      default:
        return '📄';
    }
  }
}
