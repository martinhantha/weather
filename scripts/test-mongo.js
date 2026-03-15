#!/usr/bin/env node
/**
 * Test MongoDB connection. Uses MONGODB_URI from env (or .env via --env-file).
 *
 *   node scripts/test-mongo.js
 *   node --env-file=.env scripts/test-mongo.js
 *   MONGODB_URI="mongodb://..." node scripts/test-mongo.js
 */

import mongoose from 'mongoose'

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('Missing MONGODB_URI. Set it in .env or: MONGODB_URI="mongodb://..." node scripts/test-mongo.js')
  process.exit(1)
}

// Hide password in log
const safeUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')

async function run() {
  console.log('Connecting to', safeUri, '...')
  try {
    await mongoose.connect(uri)
    console.log('Connected. readyState:', mongoose.connection.readyState)

    const admin = mongoose.connection.db.admin()
    const { version } = await admin.buildInfo()
    console.log('Server version:', version)

    const collections = await mongoose.connection.db.listCollections().toArray()
    console.log('Collections:', collections.length ? collections.map((c) => c.name).join(', ') : '(none)')

    if (collections.some((c) => c.name === 'measurement')) {
      const count = await mongoose.connection.db.collection('measurement').countDocuments()
      console.log('measurement documents:', count)
    }

    console.log('OK – MongoDB is reachable.')
  } catch (err) {
    console.error('Connection failed:', err.message)
    if (err.reason) console.error('Reason:', err.reason)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    process.exit(0)
  }
}

run()
