require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
p.$queryRaw`SELECT id, user_id, phone_number, status, last_connected_at, error_message, reconnect_count FROM wa_sessions`
  .then(r => { console.log(JSON.stringify(r, null, 2)); return p.$disconnect() })
