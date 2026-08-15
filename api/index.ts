// Vercel serverless entrypoint. Every request is routed here (see
// vercel.json) and handled by the same Express app used for local dev
// (src/index.ts) - just without app.listen() or the in-process schedulers,
// neither of which make sense in a stateless function.
import app from '../src/app';

export default app;
