// pages/api/debug.js
export default function handler(req, res) {
  res.status(200).json({
    message: '✅ Debug endpoint works',
    timestamp: new Date().toISOString(),
    env: process.env.VERCEL_ENV,
  });
}
