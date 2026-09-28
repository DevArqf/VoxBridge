const path = require('node:path');

module.exports = (client, files) => {
  const eventRoot = path.join(__dirname, '..', 'events');
  for (const file of files) {
    const event = require(path.join(eventRoot, file));
    const handler = (...args) => event.execute(...args, client);
    if (event.once) client.once(event.name, handler);
    else client.on(event.name, handler);
  }
};
