#!/usr/bin/env node

/**
 * Backfill script to ensure all existing users have tenant resource metadata.
 *
 * The script performs the following actions for every user document:
 * 1. Generates a deterministic resourceId when missing.
 * 2. Populates per-user database/bot/scheduler/scraper endpoints via the
 *    provisioning service.
 * 3. Applies default role/isActive values when absent.
 *
 * Usage:
 *   NODE_ENV=development node scripts/backfillResourceIds.js
 *
 * Required environment variables:
 *   MONGO_URI - points to the admin-backend MongoDB instance.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const { provisionResourcesForUser } = require('../services/provisioningService');

const connect = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI must be defined to run the backfill script.');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10_000
  });
};

const backfill = async () => {
  const users = await User.find({}).lean();
  let updatedCount = 0;

  for (const user of users) {
    const updates = {};

    if (!user.role) {
      updates.role = 'user';
    }

    if (typeof user.isActive === 'undefined') {
      updates.isActive = true;
    }

  if (!user.resourceId || !user.databaseUri || !user.botEndpoint || !user.schedulerEndpoint || !user.scraperEndpoint || !user.vectorStorePath) {
      const resources = provisionResourcesForUser({
        userId: user._id.toString(),
        username: user.username,
        resourceId: user.resourceId
      });
      Object.assign(updates, resources);
    }

    if (Object.keys(updates).length === 0) {
      continue;
    }

    await User.updateOne({ _id: user._id }, { $set: updates });
    updatedCount += 1;

    console.log(`✅ Updated user ${user.username} (${user._id})`);
  }

  console.log(`\nFinished backfill. Updated ${updatedCount} user(s).`);
};

(async () => {
  try {
    console.log('🔄 Starting user resource backfill...');
    await connect();
    await backfill();
  } catch (err) {
    console.error('❌ Backfill failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();
