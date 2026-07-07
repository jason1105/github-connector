import { Octokit } from 'octokit';

export function getOctokit(token: string): Octokit {
  return new Octokit({ auth: token });
}
