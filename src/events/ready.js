const { ActivityType } = require('discord.js');
const logger = require('../utils/logger');
const { getAllGuildSettings } = require('../db');

const ROTATING_ACTIVITIES = [
  { name: 'your squad speak every language', type: ActivityType.Listening },
  { name: 'GGs, callouts & clutch plays', type: ActivityType.Playing },
  { name: 'for translated gaming comms', type: ActivityType.Watching },
  { name: '/proxy status • /translate', type: ActivityType.Listening },
  { name: 'breaking language barriers', type: ActivityType.Playing },
];
const ROTATION_INTERVAL_MS = 45_000;

function rotateActivity(client, index) {
  if (!client.user) return;
  const activity = ROTATING_ACTIVITIES[index % ROTATING_ACTIVITIES.length];
  try {
    client.user.setPresence({
      activities: [activity],
      status: 'online',
    });
    logger.debug({ activity: activity.name, type: activity.type }, 'Discord presence rotated.');
  } catch (error) {
    logger.warn({ err: error }, 'Could not update Discord presence.');
  }
}

module.exports = {
  name: 'clientReady',
  once: true,
  execute(client) {
    logger.info({ botTag: client.user.tag }, 'VoxBridge is online.');
    logger.info({ configurationCount: getAllGuildSettings().length }, 'Persistent guild settings loaded.');
    let index = 0;
    rotateActivity(client, index++);
    const timer = setInterval(() => rotateActivity(client, index++), ROTATION_INTERVAL_MS);
    timer.unref?.();
    client.vpbActivityTimer = timer;
  },
};
