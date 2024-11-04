'use client';

import cloudbase from "@cloudbase/js-sdk";

let db: any = null;

if (typeof window !== 'undefined') {
  const app = cloudbase.init({
    env: "tangmao-6ga5x8ct393e0fe9",
    region: "ap-shanghai"
  });

  const auth = app.auth({
    persistence: "local"
  });

  auth.anonymousAuthProvider().signIn().catch(err => {
    console.error("登录失败", err);
  });

  db = app.database();
}

export { db };