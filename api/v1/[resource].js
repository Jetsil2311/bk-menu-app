// Vercel function for every /api/v1/<resource> route (one function on
// purpose). The logic lives in server/posApi/handler.js; docs/POS_API.md.
import { handle } from '../../server/posApi/handler.js'

export default function handler(req, res) {
  return handle(req, res, req.query?.resource)
}
