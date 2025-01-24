import { init } from '@cloudbase/node-sdk';

const app = init({
  env: process.env.CLOUDBASE_ENV || "tangmao-6ga5x8ct393e0fe9",
  secretId: process.env.SECRET_ID,
  secretKey: process.env.SECRET_KEY,
});

const db = app.database();

export { db };
