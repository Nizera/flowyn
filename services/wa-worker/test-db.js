require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

async function test() {
  const p = new PrismaClient({ log: ['error'] })
  try {
    await p.$connect()
    console.log('Connected!')
    const result = await p.$queryRaw`SELECT 1 as test`
    console.log('Query result:', result)
  } catch (e) {
    console.error('Error:', e.message)
  } finally {
    await p.$disconnect()
  }
}

test()
