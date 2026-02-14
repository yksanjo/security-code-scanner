import { Octokit } from 'octokit';

export class GitHubAnalyzer {
  constructor(token) {
    this.octokit = new Octokit({ auth: token });
  }

  async getPullRequest(owner, repo, prNumber) {
    try {
      const { data: pr } = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });
      
      return {
        number: pr.number,
        title: pr.title,
        body: pr.body,
        author: pr.user.login,
        state: pr.state,
        baseBranch: pr.base.ref,
        headBranch: pr.head.ref,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changed_files,
        url: pr.html_url,
        isDraft: pr.draft,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at
      };
    } catch (error) {
      throw new Error(`Failed to fetch pull request: ${error.message}`);
    }
  }

  async getPullRequestFiles(owner, repo, prNumber) {
    try {
      const { data: files } = await this.octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100
      });
      
      return files.map(file => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch,
        rawUrl: file.contents_url,
        previousFilename: file.previous_filename
      }));
    } catch (error) {
      throw new Error(`Failed to fetch pull request files: ${error.message}`);
    }
  }

  async postReview(owner, repo, prNumber, review) {
    try {
      const { data } = await this.octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: prNumber,
        body: review.body,
        event: review.event, // 'APPROVE', 'REQUEST_CHANGES', 'COMMENT'
        comments: review.comments || []
      });
      
      return data;
    } catch (error) {
      throw new Error(`Failed to post review: ${error.message}`);
    }
  }

  async getFileContent(owner, repo, path, ref) {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref
      });
      
      if (data.content) {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async getCommitDiff(owner, repo, sha) {
    try {
      const { data } = await this.octokit.rest.repos.getCommit({
        owner,
        repo,
        sha,
        per_page: 100
      });
      
      return data.files?.map(file => ({
        filename: file.filename,
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch,
        status: file.status
      })) || [];
    } catch (error) {
      throw new Error(`Failed to get commit diff: ${error.message}`);
    }
  }
}
