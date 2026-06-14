import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import { resolveTeamNameForCategory } from './tickets.service';

describe('resolveTeamNameForCategory', () => {
  it('routes billing-related categories to Billing & Payments', () => {
    expect(resolveTeamNameForCategory('Billing')).toBe('Billing & Payments');
    expect(resolveTeamNameForCategory('Payment failure')).toBe(
      'Billing & Payments',
    );
    expect(resolveTeamNameForCategory('Invoice dispute')).toBe(
      'Billing & Payments',
    );
    expect(resolveTeamNameForCategory('Refund request')).toBe(
      'Billing & Payments',
    );
    expect(resolveTeamNameForCategory('Subscription charge')).toBe(
      'Billing & Payments',
    );
  });

  it('routes account/login/access categories to Account & Access', () => {
    expect(resolveTeamNameForCategory('Account Access')).toBe(
      'Account & Access',
    );
    expect(resolveTeamNameForCategory('Login problem')).toBe(
      'Account & Access',
    );
    expect(resolveTeamNameForCategory('Password reset')).toBe(
      'Account & Access',
    );
    expect(resolveTeamNameForCategory('MFA lockout')).toBe('Account & Access');
  });

  it('routes technical/problem categories to Technical Support', () => {
    expect(resolveTeamNameForCategory('Technical Issue')).toBe(
      'Technical Support',
    );
    expect(resolveTeamNameForCategory('Bug report')).toBe('Technical Support');
    expect(resolveTeamNameForCategory('API integration error')).toBe(
      'Technical Support',
    );
  });

  it('falls back to the default team for unknown or missing categories', () => {
    expect(resolveTeamNameForCategory('General question')).toBe(
      'Technical Support',
    );
    expect(resolveTeamNameForCategory(null)).toBe('Technical Support');
    expect(resolveTeamNameForCategory('')).toBe('Technical Support');
  });

  it('is case-insensitive and applies billing before later rules', () => {
    expect(resolveTeamNameForCategory('BILLING')).toBe('Billing & Payments');
    // Contains both a billing and an access keyword; billing is the first rule.
    expect(resolveTeamNameForCategory('Billing access question')).toBe(
      'Billing & Payments',
    );
  });
});
