import simpleGit from 'simple-git';
import { readFileSync } from 'fs';

export class LocalAnalyzer {
  constructor(cwd = process.cwd()) {
    this.git = simpleGit(cwd);
    this.cwd = cwd;
  }

  async getStagedChanges() {
    try {
      const status = await this.git.status();
      const stagedFiles = status.staged;
      
      const files = [];
      for (const file of stagedFiles) {
        const diff = await this.git.diff(['--cached', '--', file]);
        const patch = await this.generatePatch(file, diff);
        
        files.push({
          filename: file,
          status: 'modified',
          patch,
          diff
        });
      }
      
      return files;
    } catch (error) {
      throw new Error(`Failed to get staged changes: ${error.message}`);
    }
  }

  async getBranchDiff(baseBranch, compareBranch) {
    try {
      // Get current branch if compareBranch not specified
      if (!compareBranch) {
        const status = await this.git.status();
        compareBranch = status.current;
      }
      
      // Get diff between branches
      const diff = await this.git.diff([baseBranch, compareBranch]);
      
      // Parse the diff into files
      const files = this.parseDiff(diff);
      
      return files;
    } catch (error) {
      throw new Error(`Failed to get branch diff: ${error.message}`);
    }
  }

  async getUncommittedChanges() {
    try {
      const status = await this.git.status();
      const modified = [...status.modified, ...status.not_added];
      
      const files = [];
      for (const file of modified) {
        const diff = await this.git.diff(['--', file]);
        const patch = await this.generatePatch(file, diff);
        
        files.push({
          filename: file,
          status: 'modified',
          patch,
          diff
        });
      }
      
      return files;
    } catch (error) {
      throw new Error(`Failed to get uncommitted changes: ${error.message}`);
    }
  }

  async getRecentCommits(count = 10) {
    try {
      const log = await this.git.log({ maxCount: count });
      return log.all.map(commit => ({
        hash: commit.hash,
        date: commit.date,
        message: commit.message,
        author: commit.author_name,
        email: commit.author_email
      }));
    } catch (error) {
      throw new Error(`Failed to get recent commits: ${error.message}`);
    }
  }

  async generatePatch(filename, diff) {
    // If we already have a diff, format it as a patch
    if (diff && diff.trim()) {
      return this.formatAsPatch(filename, diff);
    }
    return '';
  }

  parseDiff(diffOutput) {
    const files = [];
    const fileChunks = diffOutput.split(/^diff --git/m).filter(Boolean);
    
    for (const chunk of fileChunks) {
      const lines = chunk.split('\n');
      
      // Extract filename from diff header
      const headerMatch = lines[0]?.match(/a\/(.+?) b\/(.+)/);
      if (!headerMatch) continue;
      
      const filename = headerMatch[2];
      let status = 'modified';
      
      if (lines[0]?.includes('new file')) status = 'added';
      if (lines[0]?.includes('deleted file')) status = 'deleted';
      if (lines[0]?.includes('renamed')) status = 'renamed';
      
      // Parse the patch content
      const patchLines = [];
      let inPatch = false;
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip diff metadata lines
        if (line.startsWith('index') || 
            line.startsWith('---') || 
            line.startsWith('+++') ||
            line.startsWith('@@')) {
          inPatch = true;
        }
        
        if (inPatch) {
          patchLines.push(line);
        }
      }
      
      files.push({
        filename,
        status,
        patch: patchLines.join('\n'),
        diff: chunk
      });
    }
    
    return files;
  }

  formatAsPatch(filename, diff) {
    return `diff --git a/${filename} b/${filename}\n${diff}`;
  }

  async getFileContent(filename) {
    try {
      return readFileSync(filename, 'utf-8');
    } catch {
      return null;
    }
  }

  async getBranchInfo() {
    try {
      const branch = await this.git.branch();
      return {
        current: branch.current,
        all: branch.all,
        branches: branch.branches
      };
    } catch (error) {
      throw new Error(`Failed to get branch info: ${error.message}`);
    }
  }
}
