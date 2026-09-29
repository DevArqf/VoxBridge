process.env.DISCORD_TOKEN ||= 'test-discord-token-1234567890';
process.env.DISCORD_CLIENT_ID ||= '123456789012345678';
process.env.DEEPL_AUTH_KEY ||= 'test-deepl-key:fx';
process.env.STRIPE_WEBHOOK_SECRET ||= 'whsec_test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createWebhookApp, guildReference, applyEvent } = require('../src/stripe/webhookServer');

function databaseMock() {
  const events = new Set();
  const subscriptions = new Map();
  return {
    events,
    subscriptions,
    database: () => ({ prepare: () => ({ get: (id) => events.has(id) ? { exists: 1 } : null }) }),
    recordStripeEvent: (id) => { events.add(id); return true; },
    upsertGuildSubscription: (value) => { subscriptions.set(value.guildId, value); },
    getGuildSubscriptionByStripeSubscriptionId: (id) => [...subscriptions.values()].find((s) => s.subscriptionId === id) || null,
  };
}

test('guild reference validation accepts only Discord snowflakes', () => {
  assert.equal(guildReference('not-a-guild', '12345678901234567'), '12345678901234567');
  assert.equal(guildReference('123'), null);
});

test('subscription lifecycle events activate Pro and revoke it when canceled or past due', async () => {
  const database = databaseMock();
  const stripe = {};
  const subscription = { id: 'sub_lifecycle', customer: 'cus_lifecycle', metadata: { guild_id: '12345678901234567' }, items: { data: [{ price: { id: 'price_pro' }, current_period_end: 4_102_444_800 }] } };
  await applyEvent({ id: 'evt_created', type: 'customer.subscription.created', created: 100, data: { object: { ...subscription, status: 'active' } } }, stripe, database);
  assert.equal(database.subscriptions.get('12345678901234567').status, 'active');
  await applyEvent({ id: 'evt_due', type: 'customer.subscription.updated', created: 101, data: { object: { ...subscription, status: 'past_due' } } }, stripe, database);
  assert.equal(database.subscriptions.get('12345678901234567').status, 'past_due');
  await applyEvent({ id: 'evt_deleted', type: 'customer.subscription.deleted', created: 102, data: { object: { ...subscription, status: 'active' } } }, stripe, database);
  assert.equal(database.subscriptions.get('12345678901234567').status, 'canceled');
});

test('Stripe listener is limited to webhook POST and verifies signature before sync', async (t) => {
  const database = databaseMock();
  const event = {
    id: 'evt_checkout', type: 'checkout.session.completed', created: 200,
    data: { object: { mode: 'subscription', client_reference_id: '12345678901234567', subscription: 'sub_123' } },
  };
  const stripe = {
    webhooks: { constructEvent: (_body, signature) => {
      if (signature !== 'valid') throw new Error('invalid signature');
      return event;
    } },
    subscriptions: { retrieve: async () => ({
      id: 'sub_123', customer: 'cus_123', status: 'active', current_period_end: 4_102_444_800,
      items: { data: [{ current_period_end: 4_102_444_800, price: { id: 'price_pro' } }] },
    }) },
  };
  const server = createWebhookApp({ stripe, database }).listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;

  assert.equal((await fetch(origin)).status, 404);
  assert.equal((await fetch(`${origin}/`, { method: 'POST', body: '{}' })).status, 404);
  assert.equal((await fetch(`${origin}/stripe/webhook`, { method: 'POST', body: '{}', headers: { 'stripe-signature': 'bad' } })).status, 400);
  const response = await fetch(`${origin}/stripe/webhook`, { method: 'POST', body: '{}', headers: { 'stripe-signature': 'valid' } });
  assert.equal(response.status, 200);
  assert.equal(database.subscriptions.get('12345678901234567').status, 'active');
  assert.equal((await fetch(`${origin}/stripe/webhook`, { method: 'POST', body: '{}', headers: { 'stripe-signature': 'valid' } })).status, 200);
});
