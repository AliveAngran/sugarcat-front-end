'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  
  // 主导航菜单项
  const menuItems = [
    { title: '数据看板', path: '/dashboard', icon: '📊' },
    { title: '趋势分析', path: '/trends', icon: '📈' },
    { title: '订单管理', path: '/orders', icon: '📋' },
    { title: '货品管理', path: '/products', icon: '📦' },
    { title: '商品管理', path: '/products-v2', icon: '🏷️' },
    { title: '配送规划', path: '/delivery-planning', icon: '🚚' },
    { title: '店铺管理', path: '/store-management', icon: '🏪' },
    { title: '抽奖活动', path: '/lucky-draw', icon: '🎉' },
    { title: '满减规则', path: '/discount-rules', icon: '💰' },
  ];

  // 监听滚动事件来改变导航栏样式
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // 获取当前页面的标题
  const getCurrentPageTitle = () => {
    const currentItem = menuItems.find(item => pathname?.startsWith(item.path));
    return currentItem?.title || '管理系统';
  };

  // 返回首页
  const goHome = () => {
    router.push('/');
  };

  // 检查当前路径是否匹配菜单项
  const isActive = (path: string) => {
    return pathname?.startsWith(path);
  };

  return (
    <div className="sticky top-0 z-50">
      <nav className={`bg-white ${scrolled ? 'shadow-md' : ''} transition-shadow duration-300`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* 左侧: Logo和标题 */}
            <div className="flex items-center">
              <button 
                onClick={goHome} 
                className="flex-shrink-0 flex items-center mr-4 hover:opacity-80 transition-opacity duration-200"
              >
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  糖猫管理
                </span>
              </button>
              
              {/* 面包屑导航 - 仅在桌面端显示 */}
              <div className="hidden md:flex items-center">
                <span className="text-gray-400 mx-2">/</span>
                <span className="text-gray-600 font-medium">{getCurrentPageTitle()}</span>
              </div>
            </div>
            
            {/* 桌面端导航菜单 */}
            <div className="hidden md:flex md:items-center md:space-x-2">
              {menuItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    router.push(item.path);
                    setIsMenuOpen(false);
                  }}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200
                    ${isActive(item.path) 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-gray-700 hover:text-blue-700 hover:bg-blue-50'}`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.title}
                </button>
              ))}
            </div>
            
            {/* 移动端菜单按钮 */}
            <div className="flex items-center md:hidden">
              <button
                onClick={toggleMenu}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                aria-expanded="false"
              >
                <span className="sr-only">打开菜单</span>
                {/* 菜单图标 */}
                <svg
                  className={`${isMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
                {/* 关闭图标 */}
                <svg
                  className={`${isMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* 移动端展开菜单 */}
        <div className={`${isMenuOpen ? 'block' : 'hidden'} md:hidden bg-white shadow-lg z-10`}>
          <div className="pt-2 pb-3 space-y-1 px-4">
            {/* 移动端显示当前页面标题 */}
            <div className="border-b border-gray-200 pb-2 mb-2">
              <span className="text-sm font-medium text-gray-500">当前页面</span>
              <p className="text-base font-medium text-blue-700">{getCurrentPageTitle()}</p>
            </div>
            
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  router.push(item.path);
                  setIsMenuOpen(false);
                }}
                className={`w-full flex items-center px-3 py-3 text-base font-medium rounded-md
                  ${isActive(item.path) 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-700 hover:text-blue-700 hover:bg-blue-50'}`}
              >
                <span className="mr-3 text-xl">{item.icon}</span>
                {item.title}
                
                {isActive(item.path) && (
                  <span className="ml-auto">
                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" clipRule="evenodd"></path>
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
          
          {/* 底部额外操作区域 */}
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="px-4 space-y-1">
              <button onClick={goHome} className="w-full flex items-center px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-700 hover:bg-blue-50 rounded-md">
                <span className="mr-3">🏠</span>
                首页
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* 移动端页面标题 */}
      <div className="md:hidden bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600 border-b border-gray-200">
        {getCurrentPageTitle()}
      </div>
    </div>
  );
} 