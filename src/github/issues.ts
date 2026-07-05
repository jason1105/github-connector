import { getOctokit } from './client.js';

export async function createIssue(params: {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
}): Promise<{ number: number; url: string }> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.issues.create({
    owner: params.owner,
    repo: params.repo,
    title: params.title,
    body: params.body,
    labels: params.labels,
  });
  return { number: data.number, url: data.html_url };
}

export async function listIssues(params: {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
}): Promise<Array<{ number: number; title: string; state: string; url: string }>> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.issues.listForRepo({
    owner: params.owner,
    repo: params.repo,
    state: params.state ?? 'open',
  });
  return data
    .filter((issue) => !issue.pull_request)
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      url: issue.html_url,
    }));
}

export async function getIssue(params: {
  owner: string;
  repo: string;
  issueNumber: number;
}): Promise<{ number: number; title: string; state: string; body: string | null; url: string }> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.issues.get({
    owner: params.owner,
    repo: params.repo,
    issue_number: params.issueNumber,
  });
  return {
    number: data.number,
    title: data.title,
    state: data.state,
    body: data.body ?? null,
    url: data.html_url,
  };
}

export async function createIssueComment(params: {
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;
}): Promise<{ url: string }> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.issues.createComment({
    owner: params.owner,
    repo: params.repo,
    issue_number: params.issueNumber,
    body: params.body,
  });
  return { url: data.html_url };
}
