"use client";

import { useState } from 'react';
import MenuSelection from '@/components/MenuSelection';
import { setAuth } from '@/utils/auth';

export default function Home() {
  const [accessKey, setAccessKey] = useState<string>("");
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const correctAccessKey = "chaodan";

  const handleAccessKeySubmit = () => {
    if (accessKey === correctAccessKey) {
      setIsAuthorized(true);
      setAuth();
    } else {
      alert("访问密钥错误");
    }
  };

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-r from-purple-800 to-blue-600">
        <div className="bg-black bg-opacity-50 p-8 rounded-xl shadow-2xl backdrop-filter backdrop-blur-lg border border-gray-700">
          <h2 className="text-3xl text-white mb-6 text-center">请输入访问密钥</h2>
          <div className="flex flex-col items-center">
            <input
              type="password"
              placeholder="访问密钥"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              className="w-80 px-4 py-2 mb-4 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-400"
            />
            <button
              onClick={handleAccessKeySubmit}
              className="w-80 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-purple-600 hover:to-blue-500 text-white font-semibold py-2 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
            >
              提交
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <MenuSelection />;
} 