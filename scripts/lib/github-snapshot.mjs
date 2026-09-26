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
    const isLevel = (value) => Number.isInteger(value) && value >= 0 && value <= 4;
    if (
      !c ||
      !isCount(c.total) ||
      !Array.isArray(c.weeks) ||
      !c.weeks.every((week) => Array.isArray(week) && week.every(isCount)) ||
      (c.start !== undefined && !(isString(c.start) && /^\d{4}-\d{2}-\d{2}$/.test(c.start))) ||
      (c.levels !== undefined &&
        !(
          Array.isArray(c.levels) &&
          c.levels.length === c.weeks.length &&
          c.levels.every(
            (week, index) => Array.isArray(week) && week.length === c.weeks[index].length && week.every(isLevel),
          )
        ))
    )
      problems.push('contributions');
  }
  return problems;
}

/** Group dated days (any order) into Sunday-first weeks, like GitHub's calendar; keeps the last 53 weeks. */
export function toCalendar(days, total) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return null;
  const dayMs = 86_400_000;
  const first = Date.parse(`${sorted[0].date}T00:00:00Z`);
  const firstSunday = first - new Date(first).getUTCDay() * dayMs;
  const weeks = [];
  const levels = [];
  for (const day of sorted) {
    const index = Math.floor((Date.parse(`${day.date}T00:00:00Z`) - firstSunday) / (7 * dayMs));
    (weeks[index] ??= []).push(day.count);
    (levels[index] ??= []).push(day.level);
  }
  const keep = Math.max(0, weeks.length - 53);
  const kept = weeks.slice(keep);
  // The first kept week may be partial: its first day is the calendar's start.
  const startMs = keep === 0 ? first : firstSunday + keep * 7 * dayMs;
  return {
    total,
    start: new Date(startMs).toISOString().slice(0, 10),
    weeks: kept.map((week) => week ?? []),
    levels: levels.slice(keep).map((week) => week ?? []),
  };
}

/**
 * Parse GitHub's public contribution calendar (`github.com/users/{login}/contributions`) — the same calendar the
 * profile shows, including private contributions when the account publishes them. Returns null if the markup changed.
 */
export function parseContributionsPage(html) {
  const text = String(html);
  const totalMatch = text.match(/id="js-contribution-activity-description"[^>]*>\s*([\d,]+)\s+contributions?/);
  const counts = new Map();
  for (const match of text.matchAll(/<tool-tip[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const label = match[2].trim();
    const count = /^No contributions/.test(label)
      ? 0
      : Number((label.match(/^([\d,]+) contributions?/) ?? [])[1]?.replace(/,/g, ''));
    if (Number.isInteger(count)) counts.set(match[1], count);
  }
  const days = [];
  for (const match of text.matchAll(/<td\b[^>]*\bContributionCalendar-day\b[^>]*>/g)) {
    const tag = match[0];
    const date = tag.match(/\bdata-date="(\d{4}-\d{2}-\d{2})"/)?.[1];
    const level = Number(tag.match(/\bdata-level="(\d)"/)?.[1]);
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    if (!date || !Number.isInteger(level) || !id || !counts.has(id)) continue;
    days.push({ date, level, count: counts.get(id) });
  }
  if (!totalMatch || days.length < 7) return null;
  return toCalendar(days, Number(totalMatch[1].replace(/,/g, '')));
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
  const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
  if (token) {
    const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{contributionCount contributionLevel date}}}} pinnedItems(first:6,types:REPOSITORY){nodes{... on Repository{name}}}}}`;
    const graph = await request(`${base}/graphql`, {
      method: 'POST',
      body: JSON.stringify({ query, variables: { login: username } }),
      headers: { 'Content-Type': 'application/json' },
    });
    const user = graph?.data?.user;
    const calendar = user?.contributionsCollection?.contributionCalendar;
    if (calendar)
      contributions = toCalendar(
        calendar.weeks.flatMap((week) =>
          week.contributionDays.map((day) => ({
            date: day.date,
            count: day.contributionCount,
            level: LEVELS[day.contributionLevel] ?? 0,
          })),
        ),
        calendar.totalContributions,
      );
    pinned = (user?.pinnedItems?.nodes ?? []).map((node) => node?.name).filter(Boolean);
  }
  // No token (or no calendar): the public profile calendar needs none. A failure here only drops the calendar.
  if (!contributions) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`https://github.com/users/${encodeURIComponent(username)}/contributions`, {
        signal: controller.signal,
        headers: { Accept: 'text/html', 'User-Agent': 'portfolio-build' },
      });
      if (response.ok) contributions = parseContributionsPage(await response.text());
    } catch {
      /* keep contributions null */
    } finally {
      clearTimeout(timer);
    }
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
