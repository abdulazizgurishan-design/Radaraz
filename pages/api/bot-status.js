// pages/api/bot-status.js
// API لحالة البوت الآلي

import { getBot } from '../../lib/botEngine';

export default async function handler(req, res) {
  // ✅ السماح لجميع الطلبات (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const bot = getBot();

  try {
    if (req.method === 'GET') {
      const status = bot.getStatus();
      return res.status(200).json({
        success: true,
        ...status,
        timestamp: new Date().toISOString(),
      });
    }

    if (req.method === 'POST') {
      const { action } = req.body;

      if (action === 'start') {
        const result = bot.start();
        return res.status(200).json({ success: true, ...result });
      }

      if (action === 'stop') {
        const result = bot.stop();
        return res.status(200).json({ success: true, ...result });
      }

      if (action === 'reset') {
        bot.resetDailyPL();
        return res.status(200).json({
          success: true,
          message: 'Daily P&L reset successfully',
          timestamp: new Date().toISOString(),
        });
      }

      if (action === 'status') {
        const status = bot.getStatus();
        return res.status(200).json({ success: true, ...status });
      }

      return res.status(400).json({
        success: false,
        error: 'Invalid action. Use: start, stop, reset, status',
      });
    }

    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`,
    });
  } catch (error) {
    console.error('❌ Bot status error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}
