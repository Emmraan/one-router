import { describe, expect, it } from 'vitest';
import { blockingFindings, parseAuditReport } from './audit-gate.mjs';

describe('parseAuditReport', () => {
  it('reads npm v1 advisories', () => {
    const report = {
      advisories: {
        '1': {
          id: 1,
          module_name: 'postcss',
          severity: 'moderate',
          title: 'PostCSS issue',
          github_advisory_id: 'GHSA-1',
        },
        '2': {
          id: 2,
          module_name: 'next',
          severity: 'high',
          title: 'Next issue',
          github_advisory_id: 'GHSA-2',
        },
      },
    };

    const findings = parseAuditReport(JSON.stringify(report));

    expect(findings).toHaveLength(2);
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'postcss', severity: 'moderate' }),
        expect.objectContaining({ name: 'next', severity: 'high' }),
      ]),
    );
  });

  it('reads npm v2 vulnerabilities', () => {
    const report = {
      vulnerabilities: {
        lodash: { severity: 'critical' },
        next: { severity: 'moderate' },
      },
    };

    const findings = parseAuditReport(JSON.stringify(report));

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'lodash', severity: 'critical' }),
        expect.objectContaining({ name: 'next', severity: 'moderate' }),
      ]),
    );
  });

  it('returns no findings for a clean report', () => {
    expect(parseAuditReport('{"advisories":{}}')).toEqual([]);
    expect(parseAuditReport('{"vulnerabilities":{}}')).toEqual([]);
  });

  it('rejects malformed JSON', () => {
    expect(() => parseAuditReport('not json')).toThrow(/parse/i);
  });

  it('rejects an audit error response', () => {
    expect(() =>
      parseAuditReport('{"error":{"code":"ENETUNREACH","summary":"network down"}}'),
    ).toThrow(/audit failed/i);
  });
});

describe('blockingFindings', () => {
  it('keeps only high and critical findings', () => {
    const findings = [
      { name: 'a', severity: 'low' },
      { name: 'b', severity: 'moderate' },
      { name: 'c', severity: 'high' },
      { name: 'd', severity: 'critical' },
    ];

    expect(blockingFindings(findings).map((finding) => finding.name)).toEqual([
      'c',
      'd',
    ]);
  });

  it('matches severity case-insensitively', () => {
    expect(blockingFindings([{ name: 'a', severity: 'HIGH' }])).toHaveLength(1);
  });

  it('ignores unknown severities', () => {
    expect(blockingFindings([{ name: 'a', severity: 'unknown' }])).toEqual([]);
  });
});
