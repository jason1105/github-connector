import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listRepoTree, getFileContent, createOrUpdateFile } from '../github/repos.js';
import { createIssue, listIssues, getIssue, createIssueComment } from '../github/issues.js';
import { createPullRequest, listPullRequests, getPullRequest, mergePullRequest } from '../github/pulls.js';

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerAllTools(server: McpServer): void {
  server.registerTool(
    'list_repo_tree',
    {
      description: 'Recursively list files and directories in a GitHub repository (optionally scoped to a path).',
      inputSchema: {
        owner: z.string().describe('Repository owner (user or org)'),
        repo: z.string().describe('Repository name'),
        ref: z.string().optional().describe('Branch, tag, or commit SHA (defaults to the repo HEAD)'),
        path: z.string().optional().describe('Restrict results to this path prefix'),
      },
    },
    async ({ owner, repo, ref, path }) => textResult(await listRepoTree({ owner, repo, ref, path }))
  );

  server.registerTool(
    'get_file_content',
    {
      description: 'Read the decoded text content of a single file in a GitHub repository.',
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        path: z.string().describe('File path within the repository'),
        ref: z.string().optional().describe('Branch, tag, or commit SHA'),
      },
    },
    async ({ owner, repo, path, ref }) => textResult(await getFileContent({ owner, repo, path, ref }))
  );

  server.registerTool(
    'create_or_update_file',
    {
      description: 'Create a new file or update an existing file in a GitHub repository, committing directly to a branch.',
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        path: z.string(),
        content: z.string().describe('New file content as plain text (not base64)'),
        message: z.string().describe('Commit message'),
        branch: z.string().describe('Branch to commit to'),
        createBranch: z.boolean().optional().describe('If true, create `branch` from `baseBranch` before committing'),
        baseBranch: z.string().optional().describe('Branch to base the new branch on when createBranch is true (default: main)'),
      },
    },
    async ({ owner, repo, path, content, message, branch, createBranch, baseBranch }) =>
      textResult(
        await createOrUpdateFile({ owner, repo, path, content, message, branch, createBranch, baseBranch })
      )
  );

  server.registerTool(
    'create_issue',
    {
      description: 'Create a new issue in a GitHub repository.',
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        title: z.string(),
        body: z.string().optional(),
        labels: z.array(z.string()).optional(),
      },
    },
    async ({ owner, repo, title, body, labels }) =>
      textResult(await createIssue({ owner, repo, title, body, labels }))
  );

  server.registerTool(
    'list_issues',
    {
      description: 'List issues in a GitHub repository (pull requests are excluded from results).',
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        state: z.enum(['open', 'closed', 'all']).optional().describe('Defaults to open'),
      },
    },
    async ({ owner, repo, state }) => textResult(await listIssues({ owner, repo, state }))
  );

  server.registerTool(
    'get_issue',
    {
      description: 'Get details of a single issue by number.',
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        issueNumber: z.number().int().describe('Issue number'),
      },
    },
    async ({ owner, repo, issueNumber }) => textResult(await getIssue({ owner, repo, issueNumber }))
  );

  server.registerTool(
    'create_issue_comment',
    {
      description: 'Post a comment on an issue or a pull request (GitHub treats PRs as issues for comments).',
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        issueNumber: z.number().int().describe('Issue or pull request number'),
        body: z.string(),
      },
    },
    async ({ owner, repo, issueNumber, body }) =>
      textResult(await createIssueComment({ owner, repo, issueNumber, body }))
  );

  server.registerTool(
    'create_pull_request',
    {
      description: 'Create a pull request from one branch into another.',
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        title: z.string(),
        head: z.string().describe('Branch containing the changes'),
        base: z.string().describe('Branch to merge into'),
        body: z.string().optional(),
      },
    },
    async ({ owner, repo, title, head, base, body }) =>
      textResult(await createPullRequest({ owner, repo, title, head, base, body }))
  );

  server.registerTool(
    'list_pull_requests',
    {
      description: 'List pull requests in a GitHub repository.',
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        state: z.enum(['open', 'closed', 'all']).optional().describe('Defaults to open'),
      },
    },
    async ({ owner, repo, state }) => textResult(await listPullRequests({ owner, repo, state }))
  );

  server.registerTool(
    'get_pull_request',
    {
      description: 'Get details of a single pull request by number.',
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        pullNumber: z.number().int().describe('Pull request number'),
      },
    },
    async ({ owner, repo, pullNumber }) => textResult(await getPullRequest({ owner, repo, pullNumber }))
  );

  server.registerTool(
    'merge_pull_request',
    {
      description: 'Merge an open pull request.',
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        pullNumber: z.number().int().describe('Pull request number'),
        mergeMethod: z.enum(['merge', 'squash', 'rebase']).optional().describe('Defaults to merge'),
      },
    },
    async ({ owner, repo, pullNumber, mergeMethod }) =>
      textResult(await mergePullRequest({ owner, repo, pullNumber, mergeMethod }))
  );
}
