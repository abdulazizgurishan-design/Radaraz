// pages/api/scan-2.js
// نسخة 2 من scan — تشتغل في وقت مختلف
import handler from "./scan";
export const config = { maxDuration: 60 };
export default handler;
