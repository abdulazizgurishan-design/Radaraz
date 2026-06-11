// pages/api/scan-3.js
// نسخة 3 من scan — تشتغل في وقت مختلف
import handler from "./scan";
export const config = { maxDuration: 60 };
export default handler;
