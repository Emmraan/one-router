import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const BLOCKING_SEVERITIES = new Set(['high', 'critical']);

/**
 * @typedef {object} AuditFinding
 * @property {string} [id]
 * @property {string} name
 * @property {string} severity
 * @property {string} [title]
 */

/**
 * @param {string} text
 * @returns {AuditFinding[]}
 */
export function parseAuditReport(text) {
  let report;
  try {
    report = JSON.parse(text);
  } catch {
    throw new Error('Could not parse the audit JSON output.');
  }

  if (report?.error) {
    const detail = report.error.summary ?? report.error.code ?? 'unknown error';
    throw new Error(`Audit failed: ${detail}`);
  }

  const findings = [];

  if (report?.advisories && typeof report.advisories === 'object') {
    for (const advisory of Object.values(report.advisories)) {
      findings.push({
        id: advisory.github_advisory_id ?? String(advisory.id ?? ''),
        name: advisory.module_name ?? 'unknown',
        severity: String(advisory.severity ?? 'unknown').toLowerCase(),
        title: advisory.title ?? '',
      });
    }
  }

  if (report?.vulnerabilities && typeof report.vulnerabilities === 'object') {
    for (const [name, vulnerability] of Object.entries(report.vulnerabilities)) {
      const via = vulnerability?.via?.[0];
      findings.push({
        id: typeof via === 'object' ? (via.url ?? name) : name,
        name,
        severity: String(vulnerability?.severity ?? 'unknown').toLowerCase(),
        title:
          typeof via === 'object'
            ? (via.title ?? '')
            : typeof via === 'string'
              ? via
              : '',
      });
    }
  }

  const seen = new Set();
  return findings.filter((finding) => {
    const key = `${finding.id}|${finding.name}|${finding.severity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * @param {AuditFinding[]} findings
 * @returns {AuditFinding[]}
 */
export function blockingFindings(findings) {
  return findings.filter((finding) =>
    BLOCKING_SEVERITIES.has(String(finding.severity).toLowerCase()),
  );
}

function isMain() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMain()) {
  const command = 'pnpm audit --json';
  const audit =
    process.platform === 'win32'
      ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', command], {
          encoding: 'utf8',
          maxBuffer: 32 * 1024 * 1024,
        })
      : spawnSync('pnpm', ['audit', '--json'], {
          encoding: 'utf8',
          maxBuffer: 32 * 1024 * 1024,
        });

  const output = audit.stdout?.trim() ?? '';
  if (!output) {
    console.error('Audit produced no JSON output; failing closed.');
    if (audit.stderr?.trim()) console.error(audit.stderr.trim());
    process.exit(1);
  }

  let findings;
  try {
    findings = parseAuditReport(output);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const counts = new Map();
  for (const finding of findings) {
    counts.set(finding.severity, (counts.get(finding.severity) ?? 0) + 1);
  }

  console.log(
    `Audit findings: ${findings.length === 0 ? 'none' : [...counts].map(([severity, count]) => `${severity} ${count}`).join(', ')}`,
  );

  for (const finding of findings) {
    console.log(`  ${finding.severity.padEnd(8)} ${finding.name}  ${finding.title}`);
  }

  const blocking = blockingFindings(findings);
  if (blocking.length > 0) {
    console.error(`${blocking.length} high or critical finding(s); audit gate failed.`);
    process.exit(1);
  }

  console.log('No high or critical findings.');
}
