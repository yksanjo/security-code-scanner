/**
 * Claude Code Review Analyzer
 * Uses Claude API to analyze code changes and provide thoughtful feedback
 */

export class ClaudeAnalyzer {
  constructor(apiKey = null) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY;
    this.model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
  }

  async analyzeCode(file) {
    const { filename, patch, status } = file;
    
    // If we have Claude API, use it for intelligent analysis
    if (this.apiKey) {
      return await this.analyzeWithClaude(file);
    }
    
    // Fallback to static analysis
    return this.analyzeWithStaticAnalysis(file);
  }

  async analyzeWithClaude(file) {
    const { filename, patch, status } = file;
    
    const systemPrompt = `You are an expert code reviewer with deep knowledge of software engineering best practices, design patterns, and multiple programming languages. Your role is to provide thoughtful, constructive feedback on code changes.

When reviewing code, consider:
1. **Code Quality**: Is the code clear, readable, and maintainable?
2. **Potential Bugs**: Are there edge cases, null/undefined handling, race conditions, or logic errors?
3. **Security**: Are there security vulnerabilities (injection, XSS, secrets exposure)?
4. **Performance**: Are there obvious performance issues or memory leaks?
5. **Architecture**: Does the code follow project conventions and design patterns?
6. **Testing**: Are there adequate tests for the changes?
7. **Error Handling**: Are errors handled properly?

Provide your review in a structured format. Be constructive and helpful - focus on improving the code rather than just criticizing.`;

    const userPrompt = `Please review the following code change:

**File**: ${filename}
**Status**: ${status}
**Changes**:
\`\`\`diff
${patch || '(No diff available)'}
\`\`\`

Provide a detailed review with:
1. A brief summary of what changed
2. Any issues or concerns (categorized: Bug, Security, Performance, Style, Suggestion)
3. Specific line-by-line comments if applicable
4. Overall recommendation`;

    try {
      const response = await this.callClaudeAPI(systemPrompt, userPrompt);
      return this.parseClaudeResponse(response, file);
    } catch (error) {
      console.warn(`Claude API failed for ${filename}, using static analysis: ${error.message}`);
      return this.analyzeWithStaticAnalysis(file);
    }
  }

  async callClaudeAPI(systemPrompt, userPrompt) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Claude API error');
    }

    const data = await response.json();
    return data.content[0].text;
  }

  parseClaudeResponse(response, file) {
    // Parse the structured response
    const sections = this.extractSections(response);
    
    return {
      summary: sections.summary || 'Code reviewed by Claude',
      issues: this.extractIssues(sections.content || response),
      suggestions: this.extractSuggestions(sections.content || response),
      security: this.extractSecurityIssues(sections.content || response),
      performance: this.extractPerformanceIssues(sections.content || response),
      rating: this.calculateRating(sections),
      rawResponse: response
    };
  }

  extractSections(response) {
    // Try to extract structured sections from the response
    const summaryMatch = response.match(/summary:?\s*(.+?)(?:\n\n|$)/i);
    const issuesMatch = response.match(/issues:?\s*([\s\S]+?)(?:\n\nsuggestions:|$)/i);
    const suggestionsMatch = response.match(/suggestions:?\s*([\s\S]+?)$/i);
    
    return {
      summary: summaryMatch?.[1]?.trim(),
      content: response
    };
  }

  extractIssues(content) {
    const issues = [];
    const issuePatterns = [
      /[-•*]\s*(?:bug|issue|concern):\s*(.+)/gi,
      /(\d+)\.\s*(?:bug|issue|concern):\s*(.+)/gi
    ];
    
    for (const pattern of issuePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        issues.push({
          type: 'issue',
          severity: this.detectSeverity(match[1]),
          description: match[1] || match[2]
        });
      }
    }
    
    return issues;
  }

  extractSuggestions(content) {
    const suggestions = [];
    const suggestionPatterns = [
      /[-•*]\s*(?:suggestion|recommendation|consider):\s*(.+)/gi,
      /(\d+)\.\s*(?:suggestion|recommendation):\s*(.+)/gi
    ];
    
    for (const pattern of suggestionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        suggestions.push({
          type: 'suggestion',
          description: match[1] || match[2]
        });
      }
    }
    
    return suggestions;
  }

  extractSecurityIssues(content) {
    const securityKeywords = ['security', 'vulnerability', 'injection', 'xss', 'csrf', 'auth', 'credential', 'secret'];
    const issues = [];
    
    const lines = content.split('\n');
    for (const line of lines) {
      if (securityKeywords.some(kw => line.toLowerCase().includes(kw))) {
        issues.push({ description: line.trim(), severity: 'high' });
      }
    }
    
    return issues;
  }

  extractPerformanceIssues(content) {
    const perfKeywords = ['performance', 'memory', 'leak', 'optimization', 'inefficient', 'slow'];
    const issues = [];
    
    const lines = content.split('\n');
    for (const line of lines) {
      if (perfKeywords.some(kw => line.toLowerCase().includes(kw))) {
        issues.push({ description: line.trim() });
      }
    }
    
    return issues;
  }

  detectSeverity(text) {
    const highKeywords = ['critical', 'danger', 'bug', 'vulnerability', 'security'];
    const mediumKeywords = ['concern', 'warning', 'issue'];
    
    const lower = text.toLowerCase();
    if (highKeywords.some(kw => lower.includes(kw))) return 'high';
    if (mediumKeywords.some(kw => lower.includes(kw))) return 'medium';
    return 'low';
  }

  calculateRating(sections) {
    // Simple rating based on presence of issues
    return 'good'; // Could be enhanced with more sophisticated analysis
  }

  analyzeWithStaticAnalysis(file) {
    const { filename, patch, status } = file;
    const issues = [];
    const suggestions = [];
    
    if (!patch) {
      return {
        summary: 'No diff available for analysis',
        issues: [],
        suggestions: [],
        rating: 'neutral'
      };
    }

    // Static analysis rules
    const lines = patch.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      
      // Check for console.log / debug statements
      if (line.includes('console.log') || line.includes('console.debug')) {
        issues.push({
          type: 'style',
          line: lineNum,
          severity: 'low',
          description: 'Debug statement found. Consider removing before merging.'
        });
      }
      
      // Check for TODO/FIXME
      if (line.includes('TODO') || line.includes('FIXME') || line.includes('HACK')) {
        suggestions.push({
          type: 'maintenance',
          line: lineNum,
          description: `Found "${line.trim()}" - ensure this is tracked in your issue tracker.`
        });
      }
      
      // Check for hardcoded credentials (basic check)
      if (line.match(/password\s*=\s*['"][^'"]+['"]/i) ||
          line.match(/api[_-]?key\s*=\s*['"][^'"]+['"]/i) ||
          line.match(/secret\s*=\s*['"][^'"]+['"]/i)) {
        issues.push({
          type: 'security',
          line: lineNum,
          severity: 'high',
          description: 'Potential hardcoded credential detected. Use environment variables instead.'
        });
      }
      
      // Check for empty catch blocks
      if (line.includes('catch') && lines[i + 1]?.includes('}')) {
        suggestions.push({
          type: 'best-practice',
          line: lineNum,
          description: 'Empty catch block detected. Consider at least logging the error.'
        });
      }
      
      // Check for async without await (potential bug)
      if (line.match(/\.then\s*\(/) && !line.includes('await')) {
        suggestions.push({
          type: 'potential-bug',
          line: lineNum,
          description: 'Promise chain detected. Consider using async/await for better readability.'
        });
      }
      
      // Check for long lines
      if (line.length > 120) {
        suggestions.push({
          type: 'style',
          line: lineNum,
          description: `Line exceeds 120 characters (${line.length} chars). Consider breaking it up.`
        });
      }
    }

    // Check file extension for common issues
    const ext = filename.split('.').pop();
    
    if (ext === 'js' || ext === 'ts') {
      // Check for var usage (should use let/const)
      if (patch.includes('var ')) {
        suggestions.push({
          type: 'style',
          description: 'Use "let" or "const" instead of "var" for better scoping.'
        });
      }
    }

    return {
      summary: this.generateSummary(issues, suggestions),
      issues,
      suggestions,
      security: issues.filter(i => i.type === 'security'),
      performance: [],
      rating: issues.length > 0 ? 'needs-attention' : 'good'
    };
  }

  generateSummary(issues, suggestions) {
    if (issues.length === 0 && suggestions.length === 0) {
      return 'Code looks good! No major issues detected.';
    }
    
    const highIssues = issues.filter(i => i.severity === 'high');
    if (highIssues.length > 0) {
      return `Found ${highIssues.length} high-priority issue(s) that should be addressed.`;
    }
    
    const total = issues.length + suggestions.length;
    return `Found ${total} item(s) to review: ${issues.length} issue(s), ${suggestions.length} suggestion(s).`;
  }

  async generateOverallReview(prDetails, reviews) {
    const totalFiles = reviews.length;
    const totalIssues = reviews.reduce((sum, r) => sum + (r.analysis.issues?.length || 0), 0);
    const totalSuggestions = reviews.reduce((sum, r) => sum + (r.analysis.suggestions?.length || 0), 0);
    const securityIssues = reviews.reduce((sum, r) => sum + (r.analysis.security?.length || 0), 0);
    
    // Generate review body
    let reviewBody = `## Code Review Summary\n\n`;
    reviewBody += `Analyzed ${totalFiles} file(s) with Claude Code Review Assistant.\n\n`;
    reviewBody += `### Overview\n`;
    reviewBody += `- **Files Changed**: ${totalFiles}\n`;
    reviewBody += `- **Issues Found**: ${totalIssues}\n`;
    reviewBody += `- **Suggestions**: ${totalSuggestions}\n`;
    reviewBody += `- **Security Concerns**: ${securityIssues}\n\n`;
    
    if (prDetails) {
      reviewBody += `### Pull Request\n`;
      reviewBody += `- **Title**: ${prDetails.title}\n`;
      reviewBody += `- **Author**: ${prDetails.author}\n`;
      reviewBody += `- **Base**: ${prDetails.baseBranch}\n`;
      reviewBody += `\n`;
    }
    
    // Add summary of key issues
    if (totalIssues > 0 || securityIssues > 0) {
      reviewBody += `### Key Findings\n`;
      
      if (securityIssues > 0) {
        reviewBody += `⚠️ **Security**: Found ${securityIssues} potential security concern(s). Please review carefully.\n\n`;
      }
      
      if (totalIssues > 0) {
        reviewBody += `### Issues by File\n`;
        for (const review of reviews) {
          if (review.analysis.issues?.length > 0) {
            reviewBody += `\n**${review.filename}**\n`;
            for (const issue of review.analysis.issues) {
              reviewBody += `- ${issue.description}\n`;
            }
          }
        }
      }
    }
    
    reviewBody += `\n---\n`;
    reviewBody += `*Reviewed with Claude Code Review Assistant*`;
    
    return {
      summary: reviewBody,
      stats: {
        totalFiles,
        totalIssues,
        totalSuggestions,
        securityIssues
      }
    };
  }

  async generateLocalReview(reviews, options) {
    const totalFiles = reviews.length;
    const totalIssues = reviews.reduce((sum, r) => sum + (r.analysis.issues?.length || 0), 0);
    const totalSuggestions = reviews.reduce((sum, r) => sum + (r.analysis.suggestions?.length || 0), 0);
    
    return {
      summary: `## Local Code Review\n\nAnalyzed ${totalFiles} file(s).\n\nFound ${totalIssues} issue(s) and ${totalSuggestions} suggestion(s).`,
      stats: {
        totalFiles,
        totalIssues,
        totalSuggestions
      },
      options
    };
  }
}
