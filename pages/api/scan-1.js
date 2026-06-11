// pages/api/scan-1.js
// نسخة 1 من scan — تشتغل في وقت مختلف
import handler from "./scan";
export const config = { maxDuration: 60 };
export default handler;
