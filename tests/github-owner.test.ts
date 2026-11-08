import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

declare module 'node:fs' {
  export function readdirSync(
    path: string,
    options: { withFileTypes: true },
  ): Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
}

const SELF = 'tests/github-owner.test.ts';

/** Content packs stay out of this check. Copyright is allowed in the scan. */
const SKIP_DIRS = new Set(['node_modules', '.git', 'data', 'dist', 'test-results', 'playwright-report', 'coverage']);
const TEXT_EXT = new Set([
  '.yml',
  '.yaml',
  '.md',
  '.json',
  '.ts',
  '.js',
  '.mjs',
  '.cjs',
  '.py',
  '.html',
  '.css',
  '.toml',
  '.txt',
  '.sh',
  '.svg',
  '.geojson',
]);

const NEW_OWNER = 'Lewis-AI-Collab';
const SITE_REPOS = [
  'health-claims',
  'psychedelics',
  'indigenous-australia',
  'celtic-ireland',
  'ancient-greece-med',
  'uk-medicinal-plants',
  'geography-quiz',
  'pdf-to-audiobook',
];

/** Cloudflare Pages project names and hostnames. These are not GitHub owners. */
const CLOUDFLARE_LINES = [
  'PAGES_PROJECT=lewisagi-psychedelics',
  'EXPECTED_SUBDOMAIN=lewisagi-psychedelics.pages.dev',
  'PAGES_PROJECT=lewisagi-indigenous-australia',
  'EXPECTED_SUBDOMAIN=lewisagi-indigenous-australia.pages.dev',
  'PAGES_PROJECT=lewisagi-celtic-ireland',
  'EXPECTED_SUBDOMAIN=lewisagi-celtic-ireland.pages.dev',
  'PAGES_PROJECT=lewisagi-ancient-greece-med',
  'EXPECTED_SUBDOMAIN=lewisagi-ancient-greece-med.pages.dev',
  'PAGES_PROJECT=lewisagi-uk-medicinal-plants',
  'EXPECTED_SUBDOMAIN=lewisagi-uk-medicinal-plants.pages.dev',
  'PAGES_PROJECT=lewisagi-geography-quiz',
  'EXPECTED_SUBDOMAIN=lewisagi-geography-quiz.pages.dev',
  'PAGES_PROJECT=lewisagi-pdf-to-audiobook',
  'EXPECTED_SUBDOMAIN=lewisagi-pdf-to-audiobook.pages.dev',
  '"lewisagi-psychedelics": "lewisagi-psychedelics.pages.dev",',
  '"lewisagi-indigenous-australia": "lewisagi-indigenous-australia.pages.dev",',
  '"lewisagi-celtic-ireland": "lewisagi-celtic-ireland.pages.dev",',
  '"lewisagi-ancient-greece-med": "lewisagi-ancient-greece-med.pages.dev",',
  '"lewisagi-uk-medicinal-plants": "lewisagi-uk-medicinal-plants.pages.dev",',
  '"lewisagi-geography-quiz": "lewisagi-geography-quiz.pages.dev",',
  '"lewisagi-pdf-to-audiobook": "lewisagi-pdf-to-audiobook.pages.dev",',
];

const CLOUDFLARE_PROJECT = /lewisagi-[a-z0-9-]+(?:\.pages\.dev)?/g;

/**
 * Obsolete GitHub owner. Matches the old handle as a github.com owner, an
 * owner/repo path, or a bare owner token. A following hyphen keeps Cloudflare
 * project names such as lewisagi-psychedelics out of the match.
 */
const OBSOLETE_GITHUB_OWNER =
  /(?:github\.com[:/]|git@github\.com:)lewisagi(?![a-z0-9-])|(?<![a-z0-9-])lewisagi(?![a-z0-9-])/gi;

type Hit = { line: number; text: string };

function obsoleteGithubOwnerHits(text: string): Hit[] {
  const hits: Hit[] = [];
  text.split('\n').forEach((line, index) => {
    if (/copyright\s*\(c\)/i.test(line) && !/github\.com|git@github\.com/i.test(line)) {
      return;
    }
    const stripped = line.replace(CLOUDFLARE_PROJECT, '');
    OBSOLETE_GITHUB_OWNER.lastIndex = 0;
    if (OBSOLETE_GITHUB_OWNER.test(stripped)) {
      hits.push({ line: index + 1, text: line.trim() });
    }
  });
  return hits;
}

function extname(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot);
}

function readRepo(rel: string): string {
  return readFileSync(rel, 'utf8');
}

function textFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      const rel = dir === '.' ? entry.name : `${dir}/${entry.name}`;
      if (rel === SELF) {
        continue;
      }
      if (entry.isDirectory()) {
        walk(rel);
      } else if (entry.isFile() && (TEXT_EXT.has(extname(entry.name)) || entry.name === 'LICENSE')) {
        out.push(rel);
      }
    }
  };
  walk('.');
  return out;
}

/** Top-level `on:` keys. Nested keys under a trigger are not triggers. */
function workflowTriggers(yaml: string): string[] {
  const lines = yaml.split('\n');
  const start = lines.findIndex((line) => line === 'on:');
  if (start < 0) {
    throw new Error('workflow is missing a top-level on: block');
  }
  const triggers: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    if (!line.startsWith(' ')) {
      break;
    }
    const match = /^  ([A-Za-z0-9_-]+):/.exec(line);
    if (match) {
      triggers.push(match[1]);
    }
  }
  return triggers;
}

describe('GitHub owner identity', () => {
  it('flags obsolete executable GitHub owner refs and ignores Cloudflare names and copyright', () => {
    const obsolete = [
      'SITE_REMOTE=https://github.com/LewisAGI/health-claims.git',
      'git@github.com:LewisAGI/wildlife-migration-atlas.git',
      'echo "LewisAGI/${SITE_NAME}"',
      'description: LewisAGI repository',
      'https://github.com/lewisagi/health-claims.git',
    ].join('\n');
    expect(obsoleteGithubOwnerHits(obsolete)).toHaveLength(5);

    const allowed = [
      'PAGES_PROJECT=lewisagi-psychedelics',
      'EXPECTED_SUBDOMAIN=lewisagi-psychedelics.pages.dev',
      '"lewisagi-pdf-to-audiobook": "lewisagi-pdf-to-audiobook.pages.dev",',
      'Copyright (c) 2026 LewisAGI',
      'https://github.com/Lewis-AI-Collab/health-claims.git',
      'echo "Lewis-AI-Collab/${SITE_NAME}"',
    ].join('\n');
    expect(obsoleteGithubOwnerHits(allowed)).toEqual([]);

    const copyrightWithUrl = 'Copyright (c) 2026 LewisAGI https://github.com/LewisAGI/history-of-humanity-map.git';
    expect(obsoleteGithubOwnerHits(copyrightWithUrl)).toHaveLength(1);
  });

  it('has no obsolete GitHub owner refs outside content packs', () => {
    const hits = textFiles().flatMap((file) =>
      obsoleteGithubOwnerHits(readRepo(file)).map((hit) => `${file}:${hit.line}: ${hit.text}`),
    );
    expect(hits, hits.join('\n')).toEqual([]);
  });

  it('keeps the licence copyright notice', () => {
    const license = readRepo('LICENSE');
    expect(license).toContain('Copyright (c) 2026 LewisAGI');
    expect(obsoleteGithubOwnerHits(license)).toEqual([]);
  });

  it('points deploy remotes at the renamed GitHub owner', () => {
    const staticSite = readRepo('.github/workflows/deploy-static-site.yml');
    const atlas = readRepo('.github/workflows/deploy-wildlife-atlas.yml');
    for (const repo of SITE_REPOS) {
      const remote = `https://github.com/${NEW_OWNER}/${repo}.git`;
      expect(staticSite.split(remote).length - 1).toBe(2);
    }
    expect(staticSite.split(`https://github.com/${NEW_OWNER}/wildlife-migration-atlas.git`).length - 1).toBe(0);
    expect(atlas.split(`https://github.com/${NEW_OWNER}/wildlife-migration-atlas.git`).length - 1).toBe(3);
    expect(staticSite).toContain(`description: ${NEW_OWNER} repository.`);
    expect(staticSite).toContain(`Lewis-AI-Collab/\${SITE_NAME}`);
    expect(atlas).toContain('Lewis-AI-Collab/wildlife-migration-atlas');
  });

  it('keeps lewisagi Cloudflare project names and pages.dev hostnames', () => {
    const staticSite = readRepo('.github/workflows/deploy-static-site.yml');
    const found = staticSite
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.includes('lewisagi-'));
    expect(found).toEqual(CLOUDFLARE_LINES);
    expect(obsoleteGithubOwnerHits(staticSite)).toEqual([]);
  });

  it('does not add deploy triggers that publish on branch push', () => {
    const staticSite = readRepo('.github/workflows/deploy-static-site.yml');
    const atlas = readRepo('.github/workflows/deploy-wildlife-atlas.yml');
    const pages = readRepo('.github/workflows/pages.yml');
    expect(workflowTriggers(staticSite)).toEqual(['workflow_dispatch']);
    expect(workflowTriggers(atlas)).toEqual(['workflow_dispatch', 'schedule']);
    expect(atlas.match(/cron:/g)).toEqual(['cron:']);
    expect(atlas).toContain('cron: "*/30 * * * *"');
    expect(workflowTriggers(pages)).toEqual(['push']);
    expect(pages).toContain("if: github.ref == 'refs/heads/main'");
    expect(pages).toContain("if: github.ref != 'refs/heads/main'");
  });
});
