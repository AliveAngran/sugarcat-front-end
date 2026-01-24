import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { checkAuth } from '@/utils/auth';

interface MenuSelectionProps {
  onLogout: () => void;
}

export default function MenuSelection({ onLogout }: MenuSelectionProps) {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    setUserRole(checkAuth().role);
  }, []);
  
  const allMenuItems = [
    { title: '数据看板', path: '/dashboard', icon: '📊', roles: ['admin'] },
    { title: '趋势分析', path: '/trends', icon: '📈', roles: ['admin'] },
    { title: '订单管理', path: '/orders', icon: '📋', roles: ['admin'] },
    { title: '货品管理', path: '/products', icon: '📦', roles: ['admin'] },
    { title: '商品管理', path: '/products-v2', icon: '🏷️', roles: ['admin'] },
    { title: '配送规划', path: '/delivery-planning', icon: '🚚', roles: ['admin'] },
    { title: '店铺管理', path: '/store-management', icon: '🏪', roles: ['admin'] },
    { title: '抽奖活动', path: '/lucky-draw', icon: '🎉', roles: ['admin'] },
    { title: '满减活动', path: '/discount-rules', icon: '💰', roles: ['admin'] },
    { title: '订单建议', path: '/suggest-order', icon: '💡', roles: ['admin', 'salesperson'] }
  ];

  const menuItems = allMenuItems.filter(item => userRole && item.roles.includes(userRole));

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            管理系统
          </h1>
          <button onClick={onLogout} className="text-sm text-blue-600 hover:underline">退出登录</button>
        </div>
        
        <div className="grid gap-4">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className="w-full bg-white hover:bg-gray-50 p-4 rounded-lg border border-gray-200 
                        flex items-center justify-between text-left
                        transition-colors duration-200"
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium text-gray-900">{item.title}</span>
              </div>
              <svg
                className="h-5 w-5 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}