const { getQueue } = require('../utils/audioQueue');
const logger = require('../utils/logger');

module.exports = {
  name: 'voiceStateUpdate',
  execute(oldState, newState, client) {
    if (oldState.member?.id === client.user?.id || newState.member?.id === client.user?.id) return;
    const queue = getQueue(oldState.guild.id);
    if (!queue.connection) return;
    const channel = oldState.guild.channels.cache.get(queue.connection.joinConfig.channelId);
    if (!channel?.isVoiceBased()) return;
    const humans = channel.members.filter((member) => !member.user.bot).size;
    logger.debug(`Voice channel ${channel.id} now has ${humans} human member(s).`);
    if (humans === 0) queue.scheduleEmptyDisconnect();
    else queue.cancelEmptyDisconnect();
  },
};
