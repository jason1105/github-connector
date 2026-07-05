import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
const mockList = vi.fn();
const mockGet = vi.fn();
const mockMerge = vi.fn();

vi.mock('../../src/github/client.js', () => ({
  getOctokit: () => ({
    rest: {
      pulls: {
        create: mockCreate,
        list: mockList,
        get: mockGet,
        merge: mockMerge,
      },
    },
  }),
}));

import { createPullRequest, listPullRequests, getPullRequest, mergePullRequest } from '../../src/github/pulls.js';

describe('createPullRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a PR with head/base/title/body', async () => {
    mockCreate.mockResolvedValue({ data: { number: 10, html_url: 'url-pr-10' } });

    const result = await createPullRequest({
      owner: 'octo',
      repo: 'hello',
      title: 'My PR',
      head: 'feature-branch',
      base: 'main',
      body: 'Description',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      owner: 'octo',
      repo: 'hello',
      title: 'My PR',
      head: 'feature-branch',
      base: 'main',
      body: 'Description',
    });
    expect(result).toEqual({ number: 10, url: 'url-pr-10' });
  });
});

describe('listPullRequests', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists PRs filtered by state, defaulting to open', async () => {
    mockList.mockResolvedValue({
      data: [{ number: 1, title: 'PR one', state: 'open', html_url: 'url1' }],
    });

    const result = await listPullRequests({ owner: 'octo', repo: 'hello' });

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'octo', repo: 'hello', state: 'open' })
    );
    expect(result).toEqual([{ number: 1, title: 'PR one', state: 'open', url: 'url1' }]);
  });
});

describe('getPullRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gets a single PR by number', async () => {
    mockGet.mockResolvedValue({
      data: {
        number: 3,
        title: 'PR three',
        state: 'open',
        body: 'body text',
        mergeable: true,
        html_url: 'url3',
      },
    });

    const result = await getPullRequest({ owner: 'octo', repo: 'hello', pullNumber: 3 });

    expect(mockGet).toHaveBeenCalledWith({ owner: 'octo', repo: 'hello', pull_number: 3 });
    expect(result).toEqual({
      number: 3,
      title: 'PR three',
      state: 'open',
      body: 'body text',
      mergeable: true,
      url: 'url3',
    });
  });
});

describe('mergePullRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('merges a PR with the given merge method, defaulting to merge', async () => {
    mockMerge.mockResolvedValue({ data: { merged: true, sha: 'mergesha', message: 'Pull Request successfully merged' } });

    const result = await mergePullRequest({ owner: 'octo', repo: 'hello', pullNumber: 3 });

    expect(mockMerge).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'octo', repo: 'hello', pull_number: 3, merge_method: 'merge' })
    );
    expect(result).toEqual({ merged: true, sha: 'mergesha', message: 'Pull Request successfully merged' });
  });

  it('passes through a custom merge_method', async () => {
    mockMerge.mockResolvedValue({ data: { merged: true, sha: 'sha2', message: 'ok' } });

    await mergePullRequest({ owner: 'octo', repo: 'hello', pullNumber: 4, mergeMethod: 'squash' });

    expect(mockMerge).toHaveBeenCalledWith(
      expect.objectContaining({ merge_method: 'squash' })
    );
  });
});
