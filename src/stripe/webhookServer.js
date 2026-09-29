const express = require('express');
const Stripe = require('stripe');
const config = require('../config');
const db = require('../db');
const logger = require('../utils/logger');

const HANDLED_SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

function guildReference(...candidates) {
  for (const value of candidates) {
    if (typeof value === 'string' && /^\d{17,20}$/.test(value)) return value;
  }
  return null;
}

function subscriptionData(subscription, guildId, eventCreated) {
  const item = subscription.items?.data?.[0];
  const periodEnd = item?.current_period_end || subscription.current_period_end;
  return {
    guildId,
    customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
    subscriptionId: subscription.id,
    priceId: item?.price?.id,
    status: subscription.status || 'canceled',
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    eventCreated,
  };
}

async function applyEvent(event, stripe, database) {
  const object = event.data.object;
  if (event.type === 'checkout.session.completed' && object.mode === 'subscription' && object.subscription) {
    const guildId = guildReference(object.client_reference_id, object.metadata?.guild_id);
    if (!guildId) {
      logger.warn({ eventId: event.id }, 'Stripe checkout completed without a valid Discord guild reference.');
      return;
    }
    const subscriptionId = typeof object.subscription === 'string' ? object.subscription : object.subscription.id;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    database.upsertGuildSubscription(subscriptionData(subscription, guildId, event.created));
    logger.info({ guildId, subscriptionId, status: subscription.status }, 'Guild subscription linked from Stripe checkout.');
    return;
  }

  if (!HANDLED_SUBSCRIPTION_EVENTS.has(event.type)) return;
  const guildIdFromMetadata = guildReference(object.metadata?.guild_id, object.metadata?.client_reference_id);
  const existing = database.getGuildSubscriptionByStripeSubscriptionId(object.id);
  const guildId = guildIdFromMetadata || existing?.guild_id;
  if (!guildId) {
    logger.warn({ subscriptionId: object.id, eventType: event.type }, 'Stripe subscription event has no linked Discord guild yet.');
    return;
  }

  const subscription = event.type === 'customer.subscription.deleted'
    ? { ...object, status: 'canceled' }
    : object;
  database.upsertGuildSubscription(subscriptionData(subscription, guildId, event.created));
  logger.info({ guildId, subscriptionId: object.id, status: subscription.status }, 'Guild subscription synchronized from Stripe.');
}

function createWebhookApp({ stripe = null, database = db } = {}) {
  const app = express();
  const stripeClient = stripe || (config.STRIPE_SECRET_KEY ? new Stripe(config.STRIPE_SECRET_KEY) : null);
  app.post('/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
    if (!stripeClient || !config.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Stripe webhook is not configured.');
    let event;
    try {
      event = stripeClient.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      logger.warn({ err: error }, 'Rejected Stripe webhook with an invalid signature.');
      return res.status(400).send('Invalid webhook signature.');
    }

    try {
      if (database.database().prepare('SELECT 1 FROM stripe_webhook_events WHERE event_id = ?').get(event.id)) {
        return res.json({ received: true, duplicate: true });
      }
      await applyEvent(event, stripeClient, database);
      database.recordStripeEvent(event.id, event.type);
      return res.json({ received: true });
    } catch (error) {
      logger.error({ err: error, eventId: event.id, eventType: event.type }, 'Stripe webhook processing failed.');
      return res.status(500).send('Webhook processing failed.');
    }
  });
  app.use((_req, res) => res.sendStatus(404));
  return app;
}

let server;
function startWebhookServer() {
  if (server) return server;
  server = createWebhookApp().listen(config.WEBSITE_PORT, '0.0.0.0', () => {
    logger.info({ port: config.WEBSITE_PORT }, 'Stripe webhook listener started.');
  });
  server.on('error', (error) => logger.error({ err: error, port: config.WEBSITE_PORT }, 'Stripe webhook listener failed.'));
  return server;
}

function stopWebhookServer() {
  if (!server) return Promise.resolve();
  return new Promise((resolve, reject) => server.close((error) => {
    server = null;
    if (error) reject(error);
    else resolve();
  }));
}

module.exports = { createWebhookApp, startWebhookServer, stopWebhookServer, applyEvent, guildReference };
