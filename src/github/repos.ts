import type { Octokit } from 'octokit';

export interface TreeEntry {
  path: string;
  type: string;
  sha: string;
  size?: number;
}

export async function listRepoTree(
  octokit: Octokit,
  params: {
    owner: string;
    repo: string;
    ref?: string;
    path?: string;
  }
): Promise<{ entries: TreeEntry[]; truncated: boolean }> {
  const { data } = await octokit.rest.git.getTree({
    owner: params.owner,
    repo: params.repo,
    tree_sha: params.ref ?? 'HEAD',
    recursive: '1',
  });

  const entries: TreeEntry[] = data.tree.map((entry) => ({
    path: entry.path ?? '',
    type: entry.type ?? 'blob',
    sha: entry.sha ?? '',
    size: entry.size,
  }));

  const truncated = data.truncated ?? false;

  if (!params.path) return { entries, truncated };
  const prefix = params.path.endsWith('/') ? params.path : `${params.path}/`;
  const filtered = entries.filter((e) => e.path === params.path || e.path.startsWith(prefix));
  return { entries: filtered, truncated };
}

export async function getFileContent(
  octokit: Octokit,
  params: {
    owner: string;
    repo: string;
    path: string;
    ref?: string;
  }
): Promise<{ path: string; content: string; sha: string }> {
  const { data } = await octokit.rest.repos.getContent({
    owner: params.owner,
    repo: params.repo,
    path: params.path,
    ref: params.ref,
  });

  if (Array.isArray(data) || data.type !== 'file' || !('content' in data)) {
    throw new Error(`${params.path} is a directory, not a file`);
  }

  return {
    path: data.path,
    content: Buffer.from(data.content, 'base64').toString('utf-8'),
    sha: data.sha,
  };
}

async function fetchExistingSha(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<string | undefined> {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref: branch });
    if (!Array.isArray(data) && data.type === 'file') return data.sha;
    return undefined;
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
      return undefined;
    }
    throw err;
  }
}

export async function createOrUpdateFile(
  octokit: Octokit,
  params: {
    owner: string;
    repo: string;
    path: string;
    content: string;
    message: string;
    branch: string;
    createBranch?: boolean;
    baseBranch?: string;
  }
): Promise<{ commitSha: string; contentSha: string }> {
  if (params.createBranch) {
    const base = params.baseBranch ?? 'main';
    const { data: refData } = await octokit.rest.git.getRef({
      owner: params.owner,
      repo: params.repo,
      ref: `heads/${base}`,
    });
    await octokit.rest.git.createRef({
      owner: params.owner,
      repo: params.repo,
      ref: `refs/heads/${params.branch}`,
      sha: refData.object.sha,
    });
  }

  const sha = await fetchExistingSha(octokit, params.owner, params.repo, params.path, params.branch);

  const { data } = await octokit.rest.repos.createOrUpdateFileContents({
    owner: params.owner,
    repo: params.repo,
    path: params.path,
    message: params.message,
    content: Buffer.from(params.content, 'utf-8').toString('base64'),
    branch: params.branch,
    sha,
  });

  return {
    commitSha: data.commit.sha ?? '',
    contentSha: data.content?.sha ?? '',
  };
}
