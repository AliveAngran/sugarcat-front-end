'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [currentPath, setCurrentPath] = useState(pathname);
  const isDashboard = pathname === '/dashboard';

  useEffect(() => {
    setCurrentPath(pathname);
  }, [pathname]);

  const menuItems = [
    { 
      title: '数据看板', 
      path: '/dashboard', 
      icon: (
        <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    { 
      title: '订单管理', 
      path: '/orders', 
      icon: (
        <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      )
    },
    { 
      title: '货品管理', 
      path: '/products', 
      icon: (
        <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" 
          />
        </svg>
      )
    },
    { 
      title: '配送规划', 
      path: '/delivery-planning', 
      icon: (
        <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
          />
        </svg>
      )
    },
    { 
      title: '店铺管理', 
      path: '/store-management', 
      icon: (
        <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
    { 
      title: '抽奖活动', 
      path: '/lucky-draw', 
      icon: (
        <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
        </svg>
      )
    },
    { 
      title: '满减活动', 
      path: '/discount-rules', 
      icon: (
        <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  ];

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 bg-white text-black shadow-md py-2 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex space-x-6 overflow-x-auto pb-1 w-full">
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  router.push(item.path);
                }}
                className={`
                  flex items-center space-x-2 px-3 py-2
                  transition-all duration-300 rounded-md
                  ${currentPath === item.path 
                    ? 'bg-gray-100 shadow-inner' 
                    : 'hover:bg-gray-50'}
                `}
              >
                <span className="transition-colors duration-200">
                  {item.icon}
                </span>
                <span className={`
                  font-medium whitespace-nowrap
                  ${currentPath === item.path 
                    ? 'black-breathing-text font-bold'
                    : 'black-breathing-text-muted'
                  }
                `}>
                  {item.title}
                </span>
                {currentPath === item.path && (
                  <span className="ml-1">
                    <div className={`
                      h-2 w-2 rounded-full
                      ${item.path === '/dashboard' ? 'bg-blue-400' :
                        item.path === '/orders' ? 'bg-purple-400' :
                        item.path === '/products' ? 'bg-blue-500' :
                        item.path === '/delivery-planning' ? 'bg-green-500' :
                        item.path === '/store-management' ? 'bg-amber-400' :
                        item.path === '/lucky-draw' ? 'bg-red-400' :
                        item.path === '/discount-rules' ? 'bg-cyan-400' :
                        'bg-gray-400'
                      }
                    `}></div>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* 添加占位空间，防止内容被导航栏遮挡 */}
      <div className={`
        ${currentPath === '/products' ? 'hidden' : // 对于产品页面不添加占位符，因为它有自己的布局结构
          currentPath === '/delivery-planning' ? 'h-24' : 
          currentPath === '/store-management' ? 'h-24' : 
          currentPath === '/lucky-draw' ? 'h-24' : 
          currentPath === '/discount-rules' ? 'h-24' : 
          'h-20'} 
        md:h-24
      `}></div>

      <style jsx global>{`
        @keyframes breath {
          0% {
            background-position: 0% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        
        .black-breathing-text {
          background: linear-gradient(
            90deg, 
            #000000 0%, 
            #333333 40%, 
            #666666 50%, 
            #333333 60%, 
            #000000 100%
          );
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: breath 3s ease-in-out infinite;
          font-weight: bold;
        }

        .black-breathing-text-muted {
          background: linear-gradient(
            90deg, 
            #555555 0%, 
            #777777 40%, 
            #999999 50%, 
            #777777 60%, 
            #555555 100%
          );
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: breath 4s ease-in-out infinite;
          font-weight: 600;
        }

        .shadow-glow {
          box-shadow: 0 0 8px currentColor;
        }
      `}</style>
    </>
  );
} 