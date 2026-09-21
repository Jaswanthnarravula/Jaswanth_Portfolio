/**
 * Build-time GitHub snapshot — shared/17. Schema validation + deterministic serialization + best-effort fetching.
 * Types live in data/github-schema.ts. Nothing here ever throws to the caller: failures keep the committed snapshot.
 */

export const EMPTY_SNAPSHOT = Object.freeze({
  v: 1,
  fetchedAt: null,
  user: null,
  repos: [],
  pinned: [],
  contributions: null,
});

const isString = (value) => typeof value === 'string';
const isCount = (value) => Number.isInteger(value) && value >= 0;

/** @returns {string[]} problems (empty = valid) */
export function validateSnapshot(snapshot) {
  const problems = [];
  if (!snapshot || typeof snapshot !== 'object') return ['not an object'];
  if (snapshot.v !== 1) problems.push('v must be 1');
  if (snapshot.fetchedAt !== null && !isString(snapshot.fetchedAt)) problems.push('fetchedAt');
  if (snapshot.user !== null) {
    const user = snapshot.user;
    if (
      !user ||
      !isString(user.login) ||
      !(user.name === null || isString(user.name)) ||
      !isCount(user.followers) ||
      !isCount(user.publicRepos) ||
      !isString(user.url)
    )
      problems.push('user');
  }
  if (!Array.isArray(snapshot.repos)) problems.push('repos');
  else
    snapshot.repos.forEach((repo, index) => {
      const ok =
        repo &&
        isString(repo.name) &&
        isString(repo.url) &&
        repo.url.startsWith('https://github.com/') &&
        (repo.description === null || isString(repo.description)) &&
        isCount(repo.stars) &&
        isCount(repo.forks) &&
        (repo.language === null || isString(repo.language)) &&
        Array.isArray(repo.topics) &&
        repo.topics.every(isString) &&
        isString(repo.pushedAt) &&
        typeof repo.archived === 'boolean';
      if (!ok) problems.push(`repos[${index}]`);
    });
  if (!Array.isArray(snapshot.pinned) || !snapshot.pinned.every(isString)) problems.push('pinned');
  if (snapshot.contributions !== null) {
    const c = snapshot.contributions;
    if (
      !c ||
      !isCount(c.total) ||
      !Array.isArray(c.weeks) ||
      !c.weeks.every((week) => Array.isArray(week) && week.every(isCount))
    )
      problems.push('contributions');
  }
  return problems;
}

/** Stable key order so committed diffs are meaningful. */
export function serializeSnapshot(snapshot) {
  const sortKeys = (value) => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, sortKeys(value[key])]),
      );
    return value;
  };
  return `${JSON.stringify(sortKeys(snapshot), null, 2)}\n`;
}

export function toRepo(raw) {
  return {
    name: raw.name,
    url: raw.html_url,
    description: raw.description ?? null,
    stars: raw.stargazers_count ?? 0,
    forks: raw.forks_count ?? 0,
    language: raw.language ?? null,
    topics: Array.isArray(raw.topics) ? raw.topics : [],
    pushedAt: raw.pushed_at,
    archived: raw.archived === true,
  };
}

/**
 * Fetch and assemble a snapshot. Public repos only; forks excluded unless referenced by a project; ≤ 100 repos;
 * ≤ 3 REST requests without a token. With a token: contribution calendar + pinned repositories via GraphQL.
 * @param {{ username: string, token?: string | null, fetch: typeof fetch, timeoutMs?: number, referencedRepos?: string[], now?: () => Date }} options
 */
export async function fetchGithubSnapshot({
  username,
  token = null,
  fetch: fetchImpl,
  timeoutMs = 8000,
  referencedRepos = [],
  now = () => new Date(),
}) {
  const request = async (url, init = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'portfolio-build',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init.headers ?? {}),
        },
      });
      if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  };
  const base = 'https://api.github.com';
  const rawUser = await request(`${base}/users/${encodeURIComponent(username)}`);
  const rawRepos = await request(
    `${base}/users/${encodeURIComponent(username)}/repos?per_page=100&sort=pushed&type=owner`,
  );
  const referenced = new Set(
    referencedRepos.map((url) =>
      url
        .toLowerCase()
        .replace(/\.git$/, '')
        .replace(/\/+$/, ''),
    ),
  );
  const repos = (Array.isArray(rawRepos) ? rawRepos : [])
    .filter((repo) => !repo.private && (!repo.fork || referenced.has(String(repo.html_url).toLowerCase())))
    .slice(0, 100)
    .map(toRepo);

  let contributions = null;
  let pinned = [];
  if (token) {
    const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{contributionCount}}}} pinnedItems(first:6,types:REPOSITORY){nodes{... on Repository{name}}}}}`;
    const graph = await request(`${base}/graphql`, {
      method: 'POST',
      body: JSON.stringify({ query, variables: { login: username } }),
      headers: { 'Content-Type': 'application/json' },
    });
    const user = graph?.data?.user;
    const calendar = user?.contributionsCollection?.contributionCalendar;
    if (calendar)
      contributions = {
        total: calendar.totalContributions,
        weeks: calendar.weeks.slice(-53).map((week) => week.contributionDays.map((day) => day.contributionCount)),
      };
    pinned = (user?.pinnedItems?.nodes ?? []).map((node) => node?.name).filter(Boolean);
  }

  return {
    v: 1,
    fetchedAt: now().toISOString(),
    user: {
      login: rawUser.login,
      name: rawUser.name ?? null,
      followers: rawUser.followers ?? 0,
      publicRepos: rawUser.public_repos ?? 0,
      url: rawUser.html_url,
    },
    repos,
    pinned,
    contributions,
  };
}
