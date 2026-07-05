import { getOctokit } from './client.js';

export async function createPullRequest(params: {
  owner: string;
  repo: string;
  title: string;
  head: string;
  base: string;
  body?: string;
}): Promise<{ number: number; url: string }> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.pulls.create({
    owner: params.owner,
    repo: params.repo,
    title: params.title,
    head: params.head,
    base: params.base,
    body: params.body,
  });
  return { number: data.number, url: data.html_url };
}

export async function listPullRequests(params: {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
}): Promise<Array<{ number: number; title: string; state: string; url: string }>> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.pulls.list({
    owner: params.owner,
    repo: params.repo,
    state: params.state ?? 'open',
  });
  return data.map((pr) => ({ number: pr.number, title: pr.title, state: pr.state, url: pr.html_url }));
}

export async function getPullRequest(params: {
  owner: string;
  repo: string;
  pullNumber: number;
}): Promise<{ number: number; title: string; state: string; body: string | null; mergeable: boolean | null; url: string }> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.pulls.get({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber,
  });
  return {
    number: data.number,
    title: data.title,
    state: data.state,
    body: data.body ?? null,
    mergeable: data.mergeable ?? null,
    url: data.html_url,
  };
}

export async function mergePullRequest(params: {
  owner: string;
  repo: string;
  pullNumber: number;
  mergeMethod?: 'merge' | 'squash' | 'rebase';
}): Promise<{ merged: boolean; sha: string; message: string }> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.pulls.merge({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber,
    merge_method: params.mergeMethod ?? 'merge',
  });
  return { merged: data.merged, sha: data.sha, message: data.message };
}
