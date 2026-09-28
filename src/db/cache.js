const guildSettings = new Map();
const customSlang = new Map();
const userProfiles = new Map();
const mutedUsers = new Map();

function preloadGuildSettings(rows) {
  guildSettings.clear();
  for (const row of rows) guildSettings.set(row.guild_id, row);
}

function getGuildSettings(guildId) {
  return guildSettings.get(guildId) || null;
}

function setGuildSettings(row) {
  guildSettings.set(row.guild_id, row);
}

function deleteGuildSettings(guildId) {
  guildSettings.delete(guildId);
}

function preloadCustomSlang(rows) {
  customSlang.clear();
  for (const row of rows) {
    const guildRows = customSlang.get(row.guild_id) || [];
    guildRows.push({ original_term: row.original_term, replacement_term: row.replacement_term });
    customSlang.set(row.guild_id, guildRows);
  }
}

function getCustomSlang(guildId) {
  return customSlang.get(guildId) || [];
}

function addCachedCustomSlang(guildId, originalTerm, replacementTerm) {
  const rules = [...getCustomSlang(guildId), {
    original_term: originalTerm,
    replacement_term: replacementTerm,
  }];
  customSlang.set(guildId, rules);
}

function setCachedCustomSlang(guildId, rules) {
  customSlang.set(guildId, rules);
}

function preloadUserProfiles(rows) {
  userProfiles.clear();
  for (const row of rows) userProfiles.set(row.user_id, row);
}

function getUserProfile(userId) {
  return userProfiles.get(userId) || null;
}

function setUserProfile(profile) {
  userProfiles.set(profile.user_id, profile);
}

function preloadMutedUsers(rows) {
  mutedUsers.clear();
  for (const { guild_id: guildId, user_id: userId } of rows) {
    const users = mutedUsers.get(guildId) || new Set();
    users.add(userId);
    mutedUsers.set(guildId, users);
  }
}

function isUserMuted(guildId, userId) {
  return mutedUsers.get(guildId)?.has(userId) || false;
}

function setUserMuted(guildId, userId, muted) {
  const users = mutedUsers.get(guildId) || new Set();
  if (muted) users.add(userId);
  else users.delete(userId);
  if (users.size) mutedUsers.set(guildId, users);
  else mutedUsers.delete(guildId);
}

module.exports = {
  preloadGuildSettings,
  getGuildSettings,
  setGuildSettings,
  deleteGuildSettings,
  preloadCustomSlang,
  getCustomSlang,
  addCachedCustomSlang,
  setCachedCustomSlang,
  preloadUserProfiles,
  getUserProfile,
  setUserProfile,
  preloadMutedUsers,
  isUserMuted,
  setUserMuted,
};
