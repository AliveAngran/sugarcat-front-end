'use client';

import cloudbase from "@cloudbase/js-sdk";

let db: any = null;
let dbPromise: Promise<any>;

if (typeof window !== 'undefined') {
  const app = cloudbase.init({
    env: "tangmao-6ga5x8ct393e0fe9",
    region: "ap-shanghai"
  });

  const auth = app.auth({
    persistence: "local"
  });

  // 创建一个 Promise 来处理异步初始化
  dbPromise = auth.anonymousAuthProvider().signIn().then(() => {
    console.log('匿名登录成功');
    console.log('当前登录状态:', auth.hasLoginState());
    console.log('登录用户信息:', auth.currentUser);
    
    db = app.database();
    return db;
  }).catch(err => {
    console.error("登录失败", err);
    throw err;
  });
}

export { db, dbPromise };