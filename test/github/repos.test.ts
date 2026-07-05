import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTree = vi.fn();
const mockGetContent = vi.fn();
const mockCreateOrUpdateFileContents = vi.fn();
const mockGetRef = vi.fn();
const mockCreateRef = vi.fn();

vi.mock('../../src/github/client.js', () => ({
  getOctokit: () => ({
    rest: {
      git: {
        getTree: mockGetTree,
        getRef: mockGetRef,
        createRef: mockCreateRef,
      },
      repos: {
        getContent: mockGetContent,
        createOrUpdateFileContents: mockCreateOrUpdateFileContents,
      },
    },
  }),
}));

import { listRepoTree, getFileContent, createOrUpdateFile } from '../../src/github/repos.js';

describe('listRepoTree', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves ref to a tree sha via getContent when path is root, then lists recursively', async () => {
    mockGetTree.mockResolvedValue({
      data: {
        tree: [
          { path: 'src/index.ts', type: 'blob', sha: 'abc123', size: 42 },
          { path: 'src', type: 'tree', sha: 'def456' },
        ],
        truncated: false,
      },
    });

    const result = await listRepoTree({ owner: 'octo', repo: 'hello', ref: 'main' });

    expect(mockGetTree).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'octo', repo: 'hello', tree_sha: 'main', recursive: '1' })
    );
    expect(result).toEqual({
      entries: [
        { path: 'src/index.ts', type: 'blob', sha: 'abc123', size: 42 },
        { path: 'src', type: 'tree', sha: 'def456' },
      ],
      truncated: false,
    });
  });

  it('defaults ref to HEAD when not provided', async () => {
    mockGetTree.mockResolvedValue({ data: { tree: [], truncated: false } });

    await listRepoTree({ owner: 'octo', repo: 'hello' });

    expect(mockGetTree).toHaveBeenCalledWith(
      expect.objectContaining({ tree_sha: 'HEAD' })
    );
  });

  it('filters results to under a given path prefix', async () => {
    mockGetTree.mockResolvedValue({
      data: {
        tree: [
          { path: 'src/index.ts', type: 'blob', sha: 'abc123' },
          { path: 'docs/readme.md', type: 'blob', sha: 'def456' },
        ],
        truncated: false,
      },
    });

    const result = await listRepoTree({ owner: 'octo', repo: 'hello', path: 'src' });

    expect(result).toEqual({
      entries: [{ path: 'src/index.ts', type: 'blob', sha: 'abc123' }],
      truncated: false,
    });
  });

  it('propagates truncated: true when GitHub reports the tree was too large to return in full', async () => {
    mockGetTree.mockResolvedValue({
      data: {
        tree: [{ path: 'src/index.ts', type: 'blob', sha: 'abc123' }],
        truncated: true,
      },
    });

    const result = await listRepoTree({ owner: 'octo', repo: 'hello', ref: 'main' });

    expect(result).toEqual({
      entries: [{ path: 'src/index.ts', type: 'blob', sha: 'abc123' }],
      truncated: true,
    });
  });
});

describe('getFileContent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('decodes base64 content for a file', async () => {
    mockGetContent.mockResolvedValue({
      data: {
        type: 'file',
        path: 'README.md',
        content: Buffer.from('hello world').toString('base64'),
        sha: 'shavalue',
      },
    });

    const result = await getFileContent({ owner: 'octo', repo: 'hello', path: 'README.md' });

    expect(result).toEqual({ path: 'README.md', content: 'hello world', sha: 'shavalue' });
  });

  it('throws a descriptive error when path is a directory', async () => {
    mockGetContent.mockResolvedValue({ data: [{ path: 'src', type: 'dir' }] });

    await expect(
      getFileContent({ owner: 'octo', repo: 'hello', path: 'src' })
    ).rejects.toThrow(/directory, not a file/i);
  });
});

describe('createOrUpdateFile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a new file without sha when it does not exist yet', async () => {
    mockGetContent.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    mockCreateOrUpdateFileContents.mockResolvedValue({
      data: { commit: { sha: 'commitsha' }, content: { sha: 'contentsha' } },
    });

    const result = await createOrUpdateFile({
      owner: 'octo',
      repo: 'hello',
      path: 'new.txt',
      content: 'hi',
      message: 'add new.txt',
      branch: 'main',
    });

    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'octo',
        repo: 'hello',
        path: 'new.txt',
        message: 'add new.txt',
        branch: 'main',
        content: Buffer.from('hi').toString('base64'),
      })
    );
    const callArgs = mockCreateOrUpdateFileContents.mock.calls[0][0];
    expect(callArgs.sha).toBeUndefined();
    expect(result).toEqual({ commitSha: 'commitsha', contentSha: 'contentsha' });
  });

  it('includes existing sha when file already exists', async () => {
    mockGetContent.mockResolvedValue({ data: { type: 'file', sha: 'existingsha' } });
    mockCreateOrUpdateFileContents.mockResolvedValue({
      data: { commit: { sha: 'commitsha2' }, content: { sha: 'contentsha2' } },
    });

    await createOrUpdateFile({
      owner: 'octo',
      repo: 'hello',
      path: 'existing.txt',
      content: 'updated',
      message: 'update existing.txt',
      branch: 'main',
    });

    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({ sha: 'existingsha' })
    );
  });

  it('creates a new branch from baseBranch before committing when createBranch is true', async () => {
    mockGetRef.mockResolvedValue({ data: { object: { sha: 'basesha' } } });
    mockCreateRef.mockResolvedValue({ data: {} });
    mockGetContent.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    mockCreateOrUpdateFileContents.mockResolvedValue({
      data: { commit: { sha: 'commitsha3' }, content: { sha: 'contentsha3' } },
    });

    await createOrUpdateFile({
      owner: 'octo',
      repo: 'hello',
      path: 'feature.txt',
      content: 'feature content',
      message: 'add feature.txt',
      branch: 'feature-branch',
      createBranch: true,
      baseBranch: 'main',
    });

    expect(mockGetRef).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'octo', repo: 'hello', ref: 'heads/main' })
    );
    expect(mockCreateRef).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'octo',
        repo: 'hello',
        ref: 'refs/heads/feature-branch',
        sha: 'basesha',
      })
    );
    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({ branch: 'feature-branch' })
    );
  });
});
