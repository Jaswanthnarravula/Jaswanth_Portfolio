/** Build-time GitHub snapshot — shared/17-github-live-data.md. Validated by `scripts/lib/github-snapshot.mjs`. */
export interface GithubUser {
  readonly login: string;
  readonly name: string | null;
  readonly followers: number;
  readonly publicRepos: number;
  readonly url: string;
}

export interface GithubRepo {
  readonly name: string;
  readonly url: string;
  readonly description: string | null;
  readonly stars: number;
  readonly forks: number;
  readonly language: string | null;
  readonly languages?: Readonly<Record<string, number>>;
  readonly topics: readonly string[];
  readonly pushedAt: string;
  readonly archived: boolean;
}

export interface GithubSnapshot {
  readonly v: 1;
  readonly fetchedAt: string | null;
  readonly user: GithubUser | null;
  readonly repos: readonly GithubRepo[];
  readonly pinned: readonly string[];
  readonly contributions: { readonly total: number; readonly weeks: readonly (readonly number[])[] } | null;
}
