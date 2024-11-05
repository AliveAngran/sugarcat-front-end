"use client";

import { useEffect, useState } from "react";
import { dbPromise } from "@/utils/cloudbase";

interface Product {
  _id?: string;
  spuId: string;
  title: string;
  brand: string;
  desc: string;
  price: string;
  originPrice: string;
  primaryImage: string;
  minBuyNum: number;
  unit: string;
  shelfLife: string;
  origin: string;
  images: string[];
}

// 添加 loadcos 函数
const loadcos = (url: string) => {
  if (url.indexOf('cloud://') === 0) {
    const first = url.indexOf('.');
    const end = url.indexOf('/', first);
    return `https://${url.slice(first + 1, end)}.tcb.qcloud.la/${url.slice(end + 1, url.length)}`;
  }
  return url;
};

// 由于 Product 已经包含 _id，这个接口可以简化
interface EditingProduct extends Product {
  // 不需要再定义 _id，因为已经在 Product 中定义了
}

function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [brands, setBrands] = useState<Set<string>>(new Set());
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<EditingProduct | null>(null);

  // 获取商品数据
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/products');
        const result = await response.json();

        if (result.success && result.data) {
          setProducts(result.data);
          const brandSet = new Set<string>(
            result.data
              .map((p: Product) => p.brand)
              .filter((brand: string): brand is string => typeof brand === 'string')
          );
          setBrands(brandSet); 
        } else {
          throw new Error(result.error || '获取失败');
        }
      } catch (error) {
        console.error("获取商品数据失败:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // 过滤商品
  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.spuId.includes(searchTerm);
    const matchesBrand = selectedBrand === "all" || product.brand === selectedBrand;
    return matchesSearch && matchesBrand;
  });

  // 修改保存编辑的函数
  const handleSave = async (product: EditingProduct) => {
    try {
      const response = await fetch('/api/products/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(product),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '更新失败');
      }

      // 更新本地状态
      setProducts(products.map(p => 
        p._id === product._id ? product : p
      ));
      setIsEditModalOpen(false);
      setEditingProduct(null);
    } catch (error) {
      console.error("更新商品失败:", error);
      alert("更新失败，请重试");
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* 左侧品牌筛选 */}
      <div className="w-64 bg-white p-4 shadow-md">
        <h2 className="text-xl font-bold mb-4">品牌筛选</h2>
        <div className="space-y-2">
          <button
            className={`w-full text-left px-3 py-2 rounded ${
              selectedBrand === "all" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
            }`}
            onClick={() => setSelectedBrand("all")}
          >
            全部品牌
          </button>
          {Array.from(brands).map((brand) => (
            <button
              key={brand}
              className={`w-full text-left px-3 py-2 rounded ${
                selectedBrand === brand ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
              }`}
              onClick={() => setSelectedBrand(brand)}
            >
              {brand || "未分类"}
            </button>
          ))}
        </div>
      </div>

      {/* 右侧主内容区 */}
      <div className="flex-1 p-6">
        {/* 搜索框 */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="搜索商品名称或条码..."
            className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* 商品列表 - 改为表格形式 */}
        <div className="bg-white rounded-lg shadow">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">商品名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">条码</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">规格</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">价格</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最小购买量</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr key={product.spuId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{product.title}</div>
                    <div className="text-sm text-gray-500">{product.brand}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.spuId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.desc}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-red-600 font-medium">¥{product.price}</div>
                    <div className="text-sm text-gray-400 line-through">¥{product.originPrice}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.minBuyNum}{product.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        setEditingProduct(product);
                        setIsEditModalOpen(true);
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      编辑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 编辑模态框 */}
        {isEditModalOpen && editingProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">编辑商品</h2>
              <form onSubmit={(e) => {
                e.preventDefault();
                handleSave(editingProduct);
              }}>
                <div className="space-y-4">
                  {/* 主图显示 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">主图</label>
                    <div className="relative">
                      <img
                        src={loadcos(editingProduct.primaryImage)}
                        alt="主图"
                        className="w-40 h-40 object-cover rounded-lg"
                      />
                      <div className="mt-2">
                        <label className="block text-sm font-medium text-gray-700">主图URL:</label>
                        <input
                          type="text"
                          value={editingProduct.primaryImage}
                          readOnly
                          className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 所有图片显示 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">所有图片</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {editingProduct.images?.map((imageUrl, index) => (
                        <div key={index} className="space-y-2">
                          <img
                            src={loadcos(imageUrl)}
                            alt={`图片 ${index + 1}`}
                            className="w-full h-40 object-cover rounded-lg"
                          />
                          <div>
                            <label className="block text-xs font-medium text-gray-700">图片 {index + 1} URL:</label>
                            <input
                              type="text"
                              value={imageUrl}
                              readOnly
                              className="mt-1 block w-full text-xs rounded-md border-gray-300 bg-gray-50 shadow-sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 原有的编辑字段 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">商品名称</label>
                    <input
                      type="text"
                      value={editingProduct.title}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct,
                        title: e.target.value
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">售价</label>
                      <input
                        type="text"
                        value={editingProduct.price}
                        onChange={(e) => setEditingProduct({
                          ...editingProduct,
                          price: e.target.value
                        })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">原价</label>
                      <input
                        type="text"
                        value={editingProduct.originPrice}
                        onChange={(e) => setEditingProduct({
                          ...editingProduct,
                          originPrice: e.target.value
                        })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">规格描述</label>
                    <input
                      type="text"
                      value={editingProduct.desc}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct,
                        desc: e.target.value
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">最小购买数量</label>
                      <input
                        type="number"
                        value={editingProduct.minBuyNum}
                        onChange={(e) => setEditingProduct({
                          ...editingProduct,
                          minBuyNum: parseInt(e.target.value)
                        })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">单位</label>
                      <input
                        type="text"
                        value={editingProduct.unit}
                        onChange={(e) => setEditingProduct({
                          ...editingProduct,
                          unit: e.target.value
                        })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 mt-6">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditModalOpen(false);
                        setEditingProduct(null);
                      }}
                      className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300"
                    >
                      取消
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <ProductManagement />;
} 