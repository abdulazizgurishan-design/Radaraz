// pages/api/bot-status.js
// API لحالة البوت

import { getBot } from '../../lib/botEngine';

export default async function handler(req, res) {
  const bot = getBot();
  
  if (req.method === 'GET') {
    // جلب حالة البوت
    const status = bot.getStatus();
    return res.status(200).json(status);
  }
  
  if (req.method === 'POST') {
    const { action } = req.body;
    
    if (action === 'start') {
      const result = bot.start();
      return res.status(200).json(result);
    }
    
    if (action === 'stop') {
      const result = bot.stop();
      return res.status(200).json(result);
    }
    
    if (action === 'reset') {
      bot.resetDailyPL();
      return res.status(200).json({ success: true, message: 'Daily P&L reset' });
    }
    
    return res.status(400).json({ error: 'Invalid action' });
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
