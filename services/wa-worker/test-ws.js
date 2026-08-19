const https = require('https')

const options = {
  hostname: 'web.whatsapp.com',
  port: 443,
  path: '/',
  method: 'GET',
  timeout: 10000,
}

const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode)
  console.log('Headers:', JSON.stringify(res.headers, null, 2))
  res.on('data', () => {})
  res.on('end', () => process.exit(0))
})

req.on('error', (e) => {
  console.error('Connection error:', e.message)
  process.exit(1)
})

req.on('timeout', () => {
  console.error('Connection timeout')
  req.destroy()
  process.exit(1)
})

req.end()
