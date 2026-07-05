import { Octokit } from 'octokit';

let instance: Octokit | undefined;

export function getOctokit(): Octokit {
  if (instance) return instance;
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }
  instance = new Octokit({ auth: token });
  return instance;
}
