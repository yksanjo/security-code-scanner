# Claude Code Review Assistant

A powerful, AI-powered code review tool that analyzes pull requests and provides thoughtful, context-aware feedback on code quality, potential bugs, and architectural suggestions.

## Features

- 🤖 **AI-Powered Analysis**: Uses Claude API for intelligent code review
- 🔍 **Static Analysis**: Built-in static analysis when API not available
- 🔒 **Security Scanning**: Detects hardcoded credentials and security issues
- 📝 **Multi-Format Output**: Markdown, JSON, and text formats
- 🔗 **GitHub Integration**: Direct PR reviews via GitHub API
- ⚡ **GitHub Actions**: Automated reviews on every PR
- 💻 **Local Reviews**: Review local changes before committing

## Installation

```bash
# Clone or download this repository
cd code-review-assistant

# Install dependencies
npm install
```

## Configuration

### Environment Variables

Create a `.env` file (see `.env.example`):

```bash
# Required for GitHub PR reviews
GITHUB_TOKEN=your_github_token_here

# Optional - for AI-powered analysis (recommended)
# Get from: https://console.anthropic.com/
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional: Customize analysis
# CLAUDE_MODEL=claude-3-5-sonnet-20241022
```

### Getting GitHub Token

1. Go to: https://github.com/settings/tokens
2. Generate new token (classic)
3. Select scopes: `repo` (for private repos) or `public_repo` (for public repos)

### Getting Anthropic API Key

1. Go to: https://console.anthropic.com/
2. Sign up/Login
3. Navigate to API Keys
4. Create new API key

## Usage

### Review a GitHub Pull Request

```bash
# Basic usage
npm start -- pr -o owner -r repo -p pr-number

# With token (or use GITHUB_TOKEN env var)
npm start -- pr -o owner -r repo -p pr-number -t your_token

# Post review to GitHub
npm start -- pr -o owner -r repo -p pr-number --post

# Approve PR after review
npm start -- pr -o owner -r repo -p pr-number --post --approval

# Different output format
npm start -- pr -o owner -r repo -p pr-number --format json
npm start -- pr -o owner -r repo -p pr-number --format text

# Dry run (don't post)
npm start -- pr -o owner -r repo -p pr-number --no-post
```

### Review Local Changes

```bash
# Review staged changes
npm start -- local --staged

# Review changes between branches
npm start -- local -b main

# Compare specific branches
npm start -- local -b main -c feature-branch

# Save to file
npm start -- local --staged -o review.md

# JSON output
npm start -- local --staged --format json
```

### Setup

```bash
npm start -- setup
```

### GitHub Actions

Add to your repository as `.github/workflows/code-review.yml`:

```yaml
name: Claude Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Code Review
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          # Your setup steps
          node src/index.js action
```

Add these secrets in your GitHub repo settings:
- `ANTHROPIC_API_KEY`: Your Anthropic API key

## What It Checks

### Security Issues
- Hardcoded credentials (passwords, API keys, secrets)
- Potential security vulnerabilities
- Authentication/authorization issues

### Code Quality
- Code style and formatting
- Use of deprecated patterns
- Empty catch blocks
- Console.log/debug statements

### Best Practices
- Use of modern JavaScript (let/const vs var)
- Proper error handling
- Async/await vs Promise chains

### Maintenance
- TODO/FIXME comments
- Long lines (>120 characters)

## Example Output

```
════════════════════════════════════════════════════════════
  CODE REVIEW RESULTS
════════════════════════════════════════════════════════════

Summary:
  Files analyzed: 3
  Issues found:   2
  Suggestions:    4
  Security:       1

────────────────────────────────────────────────────────────
File Reviews:
────────────────────────────────────────────────────────────

📄 src/utils/auth.js
   Rating: needs-attention
   Found 1 high-priority issue(s) that should be addressed.

   Issues:
   - [high] Potential hardcoded credential detected. Use environment variables instead.

   Suggestions:
   - Use "let" or "const" instead of "var" for better scoping.

📄 src/components/Login.jsx
   Rating: good
   Code looks good! No major issues detected.

   Suggestions:
   - Line 42 exceeds 120 characters (145 chars). Consider breaking it up.
```

## License

MIT
