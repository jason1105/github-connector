import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeOctokit } from '../helpers/fakeOctokit.js';

const mockCreate = vi.fn();
const mockListForRepo = vi.fn();
const mockGet = vi.fn();
const mockCreateComment = vi.fn();

const fakeOctokit = createFakeOctokit({
  create: mockCreate,
  listForRepo: mockListForRepo,
  get: mockGet,
  createComment: mockCreateComment,
});

import { createIssue, listIssues, getIssue, createIssueComment } from '../../src/github/issues.js';

describe('createIssue', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates an issue with title, body, and labels', async () => {
    mockCreate.mockResolvedValue({ data: { number: 42, html_url: 'https://github.com/o/r/issues/42' } });

    const result = await createIssue(fakeOctokit, {
      owner: 'octo',
      repo: 'hello',
      title: 'Bug found',
      body: 'Details here',
      labels: ['bug'],
    });

    expect(mockCreate).toHaveBeenCalledWith({
      owner: 'octo',
      repo: 'hello',
      title: 'Bug found',
      body: 'Details here',
      labels: ['bug'],
    });
    expect(result).toEqual({ number: 42, url: 'https://github.com/o/r/issues/42' });
  });
});

describe('listIssues', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists issues filtered by state, defaulting to open', async () => {
    mockListForRepo.mockResolvedValue({
      data: [{ number: 1, title: 'First', state: 'open', html_url: 'url1', pull_request: undefined }],
    });

    const result = await listIssues(fakeOctokit, { owner: 'octo', repo: 'hello' });

    expect(mockListForRepo).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'octo', repo: 'hello', state: 'open' })
    );
    expect(result).toEqual([{ number: 1, title: 'First', state: 'open', url: 'url1' }]);
  });

  it('excludes pull requests from issue results', async () => {
    mockListForRepo.mockResolvedValue({
      data: [
        { number: 1, title: 'An issue', state: 'open', html_url: 'url1', pull_request: undefined },
        { number: 2, title: 'A PR', state: 'open', html_url: 'url2', pull_request: {} },
      ],
    });

    const result = await listIssues(fakeOctokit, { owner: 'octo', repo: 'hello' });

    expect(result).toEqual([{ number: 1, title: 'An issue', state: 'open', url: 'url1' }]);
  });
});

describe('getIssue', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gets a single issue by number', async () => {
    mockGet.mockResolvedValue({
      data: { number: 5, title: 'Title', state: 'closed', body: 'Body text', html_url: 'url5' },
    });

    const result = await getIssue(fakeOctokit, { owner: 'octo', repo: 'hello', issueNumber: 5 });

    expect(mockGet).toHaveBeenCalledWith({ owner: 'octo', repo: 'hello', issue_number: 5 });
    expect(result).toEqual({ number: 5, title: 'Title', state: 'closed', body: 'Body text', url: 'url5' });
  });
});

describe('createIssueComment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a comment on an issue or PR', async () => {
    mockCreateComment.mockResolvedValue({ data: { html_url: 'url-comment' } });

    const result = await createIssueComment(fakeOctokit, {
      owner: 'octo',
      repo: 'hello',
      issueNumber: 7,
      body: 'Nice work!',
    });

    expect(mockCreateComment).toHaveBeenCalledWith({
      owner: 'octo',
      repo: 'hello',
      issue_number: 7,
      body: 'Nice work!',
    });
    expect(result).toEqual({ url: 'url-comment' });
  });
});
