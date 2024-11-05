import { useRouter } from 'next/navigation';

export default function MenuSelection() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          管理系统
        </h1>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => router.push('/orders')}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            订单管理
          </button>
          <button
            onClick={() => router.push('/products')}
            className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
          >
            货品管理
          </button>
        </div>
      </div>
    </div>
  );
} 