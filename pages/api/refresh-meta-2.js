// pages/api/refresh-meta-2.js
// يعالج 200 سهم بدءاً من offset 400
// يستدعي refresh-meta الأساسي داخلياً
import handler from "./refresh-meta";

export const config = { maxDuration: 25 };

export default async function batchHandler(req, res) {
  req.query.offset = "400";
  req.query.limit  = "200";
  return handler(req, res);
}
