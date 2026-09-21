import { dirname, resolve } from 'node:path';

const osPath = /(?:^|\/)components\/os\/(ios|macos|windows|android|linux)\//;
const normalize = (value) => value.replaceAll('\\', '/');

/** Local rule, using ESLint's public API; no additional plugin dependency. */
export const boundaries = {
  meta: { type: 'problem', schema: [], messages: { boundary: '{{reason}}' } },
  create(context) {
    const filename = normalize(context.filename);
    const currentOs = filename.match(osPath)?.[1];
    const pureModule = /\/(?:lib\/kernel|lib\/terminal)\//.test(filename);
    const ui = /\/(?:app|components|hooks|stores)\//.test(filename);
    const inspect = (node) => {
      const source = node.source;
      if (!source || typeof source.value !== 'string') return;
      const value = source.value;
      const target = normalize(
        value.startsWith('@/')
          ? resolve(context.cwd, value.slice(2))
          : value.startsWith('.')
            ? resolve(dirname(filename), value)
            : value,
      );
      const targetOs = target.match(osPath)?.[1];
      let reason;
      if (currentOs && targetOs && targetOs !== currentOs)
        reason = 'OS modules must share headless mechanics, never import another OS.';
      if (ui && /\/data\/portfolio(?:\.[cm]?[jt]s)?$/.test(target))
        reason = 'Read portfolio facts through data/selectors or shared content views.';
      if (pureModule && /^(react|react-dom)(\/|$)/.test(value))
        reason = 'Kernel and terminal modules are pure TypeScript and cannot import React.';
      if (/^@vercel\/(analytics|speed-insights)(\/|$)/.test(value) && !filename.includes('/lib/analytics/'))
        reason = 'Tracking adapters belong only in lib/analytics.';
      if (reason) context.report({ node: source, messageId: 'boundary', data: { reason } });
    };
    return {
      ImportDeclaration: inspect,
      ExportNamedDeclaration: inspect,
      ExportAllDeclaration: inspect,
      ImportExpression: inspect,
    };
  },
};
