import { useRouter } from 'next/navigation';
export default function MenuSelection() {
  const router = useRouter();
  
  const menuItems = [
    { title: '数据看板', path: '/dashboard', icon: '📊' },
    { title: '订单管理', path: '/orders', icon: '📋' },
    { title: '货品管理', path: '/products', icon: '📦' },
    { title: '配送规划', path: '/delivery-planning', icon: '��' },
    { title: '店铺管理', path: '/store-management', icon: '🏪' },
    { title: '抽奖活动', path: '/lucky-draw', icon: '🎉' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          管理系统
        </h1>
        
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