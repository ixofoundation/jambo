import { describe, expect, it } from 'vitest';

import { configSchema } from '@constants/config.schema';
import shippedConfig from '@constants/config.json';

/**
 * Tests for the config contract itself.
 *
 * These assert on the *message text*, not just that validation failed. The whole
 * point of the schema is that a wrong config tells you what to do about it, so the
 * wording is part of the contract and belongs under test.
 */

/** A minimal valid config; each test breaks exactly one thing. */
const validConfig = () => ({
  siteName: 'Test dApp',
  siteUrl: 'https://example.org',
  siteTitleMeta: 'Test dApp',
  siteDescriptionMeta: 'A dApp for testing',
  fontUrl: 'https://fonts.googleapis.com/css2?family=Roboto&display=swap',
  fontName: 'Roboto',
  headerShowName: true,
  headerShowLogo: true,
  about: 'About',
  termsAndConditions: 'Terms',
  actions: [
    {
      id: 'send',
      name: 'Send',
      description: 'Send tokens',
      image: 'send.png',
      steps: [
        { id: 'select_token_and_amount', name: 'Select token and amount' },
        { id: 'get_receiver_address', name: 'Get receiver address' },
        { id: 'bank_MsgSend', name: 'Review and sign' },
      ],
    },
  ],
});

const messagesFrom = (config: unknown) => {
  const result = configSchema.safeParse(config);
  expect(result.success, 'expected this config to be rejected').toBe(false);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('the shipped config', () => {
  it('is valid', () => {
    const result = configSchema.safeParse(shippedConfig);
    const problems = result.success
      ? []
      : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    expect(problems).toEqual([]);
  });
});

describe('config validation', () => {
  it('accepts the minimal valid config', () => {
    expect(configSchema.safeParse(validConfig()).success).toBe(true);
  });

  it('rejects an unknown step id', () => {
    const config = validConfig();
    config.actions[0].steps[1].id = 'get_reciever_address';

    // zod reports the enum mismatch; scripts/validate-config.ts turns this into a
    // "did you mean" suggestion.
    expect(configSchema.safeParse(config).success).toBe(false);
  });

  it('rejects a step that is declared in the enum but has no component', () => {
    const config = validConfig();
    config.actions[0].steps[1].id = 'send_token_to_receiver';

    expect(messagesFrom(config).join('\n')).toMatch(/no component wired into/);
  });

  it('rejects an action that ends on an input step', () => {
    const config = validConfig();
    config.actions[0].steps = config.actions[0].steps.slice(0, 2);

    expect(messagesFrom(config).join('\n')).toMatch(/must end with a step that completes the flow/);
  });

  it('accepts an action ending on an external step, such as the on-ramp', () => {
    const config = validConfig();
    config.actions[0].steps = [{ id: 'kado_buy_crypto', name: 'Buy' }];

    expect(configSchema.safeParse(config).success).toBe(true);
  });

  it('rejects a step placed before the step whose data it reads', () => {
    const config = validConfig();
    config.actions[0].steps = [
      { id: 'select_amount_delegate', name: 'Amount' },
      { id: 'get_validator_delegate', name: 'Validator' },
      { id: 'staking_MsgDelegate', name: 'Review and sign' },
    ];

    expect(messagesFrom(config).join('\n')).toMatch(/must appear earlier in this action/);
  });

  it('rejects duplicate action ids, since they become URL paths', () => {
    const config = validConfig();
    config.actions.push({ ...config.actions[0] });

    expect(messagesFrom(config).join('\n')).toMatch(/Duplicate action id/);
  });

  it('rejects an action id that is not URL-safe', () => {
    const config = validConfig();
    config.actions[0].id = 'send tokens/now';

    expect(messagesFrom(config).join('\n')).toMatch(/URL path segment/);
  });

  it('rejects config supplied to a step that accepts none', () => {
    const config = validConfig();
    (config.actions[0].steps[1] as Record<string, unknown>).config = { amountLabel: 'Nope' };

    expect(messagesFrom(config).join('\n')).toMatch(/accepts no config/);
  });

  it('accepts config on the one step that does take it', () => {
    const config = validConfig();
    (config.actions[0].steps[0] as Record<string, unknown>).config = { amountLabel: 'How much?' };

    expect(configSchema.safeParse(config).success).toBe(true);
  });

  it('rejects an unknown key inside a step config rather than ignoring it', () => {
    const config = validConfig();
    (config.actions[0].steps[0] as Record<string, unknown>).config = { amuontLabel: 'typo' };

    expect(configSchema.safeParse(config).success).toBe(false);
  });

  it('rejects a placeholder siteUrl', () => {
    const config = validConfig();
    config.siteUrl = 'config.siteUrl';

    expect(messagesFrom(config).join('\n')).toMatch(/absolute URL/);
  });

  it('rejects an action with no steps', () => {
    const config = validConfig();
    config.actions[0].steps = [];

    expect(messagesFrom(config).join('\n')).toMatch(/at least one step/);
  });
});
