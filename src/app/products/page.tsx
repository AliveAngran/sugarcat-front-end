"use client";

import { useEffect, useState } from "react";
import { dbPromise } from "@/utils/cloudbase";
import { checkAuth } from "@/utils/auth";
import { useRouter } from 'next/navigation';
import { pinyin } from 'pinyin-pro';

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
  buyAtMultipleTimes?: boolean;
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

// 添加品牌分组和排序的工具函数
const getPinyinInitial = (brand: string): string => {
  // 简单处理：如果是字母开头就返回首字母，否则归类到 "#" 组
  const first = brand.charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
};



const groupBrandsByInitial = (brands: Set<string>): Map<string, string[]> => {
  const groups = new Map<string, string[]>();
  
  // 将品牌按首字母分组
  Array.from(brands).forEach(brand => {
    const initial = getPinyinInitial(brand);
    if (!groups.has(initial)) {
      groups.set(initial, []);
    }
    groups.get(initial)?.push(brand);
  });
  
  // 返回排序后的 Map
  return new Map(
    Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  );
};

// 添加新的接口定义
interface NewProduct {
  title: string;
  etitle?: string;
  desc: string;
  spuId: string;
  brand: string;
  price: string;
  originPrice: string;
  minBuyNum: number;
  unit: string;
  shelfLife: string;
  origin: string;
  primaryImage: string;
  images: string[];
  available?: number;
  isPutOnSale?: number;
  buyAtMultipleTimes?: boolean;
}

function ProductManagement() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [brands, setBrands] = useState<Set<string>>(new Set());
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<EditingProduct | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState<NewProduct>({
    title: '',
    etitle: '',
    desc: '',
    spuId: '',
    brand: '',
    price: '',
    originPrice: '',
    minBuyNum: 1,
    unit: '',
    shelfLife: '',
    origin: '',
    primaryImage: '',
    images: [],
    available: 1000000,
    isPutOnSale: 1,
    buyAtMultipleTimes: true
  });
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // 修改编辑商品的函数
  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    
    try {
      const response = await fetch('/api/products/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingProduct),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '更新失败');
      }

      // 更新本地状态
      setProducts(products.map(p => 
        p._id === editingProduct._id ? editingProduct : p
      ));
      
      // 关闭编辑模态框
      setIsEditModalOpen(false);
      setEditingProduct(null);
      
      // 显示成功消息
      alert('商品更新成功');
    } catch (error) {
      console.error("更新商品失败:", error);
      alert("更新失败，请重试");
    }
  };

  // 添加 generateImageUrl 函数在这里
  const generateImageUrl = (title: string, isPrimary: boolean = false) => {
    const brand = newProduct.brand.toLowerCase();
    const spuId = newProduct.spuId;
    
    // 确保品牌名称存在，否则使用默认值
    const brandFolder = brand || 'other';
    
    const baseUrl = 'cloud://tangmao-6ga5x8ct393e0fe9.7461-tangmao-6ga5x8ct393e0fe9-1327435676/';
    
    // 生成文件名：品牌文件夹/商品编码-zt.jpg（主图）或品牌文件夹/商品编码-数字.jpg（其他图片）
    const fileName = `${brandFolder}/${spuId}${isPrimary ? '-zt' : ''}.jpg`;
    
    if (isPrimary) {
      setNewProduct({...newProduct, primaryImage: baseUrl + fileName});
    } else {
      // 为附图添加序号
      const currentImages = newProduct.images;
      const nextIndex = currentImages.length + 1;
      const fileNameWithIndex = `${brandFolder}/${spuId}-${nextIndex}.jpg`;
      const newImages = [...currentImages, baseUrl + fileNameWithIndex];
      setNewProduct({...newProduct, images: newImages});
    }
  };

  useEffect(() => {
    const auth = checkAuth();
    if (!auth) {
      router.push('/');  // 如果未授权，重定向到首页
    } else {
      setIsAuthorized(true);
    }
  }, [router]);

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

  // 添加保存新商品的函数
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/products/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newProduct),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '添加失败');
      }

      // 更新商品列表
      setProducts([...products, result.data]);
      setIsAddModalOpen(false);
      // 重置表单
      setNewProduct({
        title: '',
        etitle: '',
        desc: '',
        spuId: '',
        brand: '',
        price: '',
        originPrice: '',
        minBuyNum: 1,
        unit: '',
        shelfLife: '',
        origin: '',
        primaryImage: '',
        images: [],
        available: 1000000,
        isPutOnSale: 1,
        buyAtMultipleTimes: true
      });
    } catch (error) {
      console.error("添加商品失败:", error);
      alert("添加失败，请重试");
    }
  };

  // 获取分组后���品牌列表
  const groupedBrands = groupBrandsByInitial(brands);

  // 添加删除商品的函数
  const handleDeleteProduct = async () => {
    try {
      const response = await fetch('/api/products/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId: editingProduct?._id }),
      });

      const result = await response.json();

      if (result.success) {
        // 更新商品列表
        setProducts(products.filter(p => p._id !== editingProduct?._id));
        // 关闭所有模态框
        setIsDeleteConfirmOpen(false);
        setIsEditModalOpen(false);
        // 显示成功消息
        alert('商品删除成功');
      } else {
        throw new Error(result.error || '删除失败');
      }
    } catch (error) {
      console.error('删除商品失败:', error);
      alert('删除商品失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  if (!isAuthorized) {
    return null; // 未授权时不渲染任何内容，等待重定向
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* 左侧品牌筛选 - 添加高度限制和滚动 */}
      <div className="w-64 bg-white shadow-lg flex flex-col h-screen sticky top-0">
        {/* 标题固定在顶部 */}
        <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">品牌筛选</h2>
        </div>
        
        {/* 品牌列表可滚动区域 */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="divide-y divide-gray-100">
            {/* 全部品牌选项 - 固定在滚动区域顶部 */}
            <div className="p-2 bg-white sticky top-0 z-10">
              <button
                className={`w-full text-left px-4 py-2 rounded-md transition-colors ${
                  selectedBrand === "all" 
                    ? "bg-blue-50 text-blue-600 font-medium" 
                    : "hover:bg-gray-50"
                }`}
                onClick={() => setSelectedBrand("all")}
              >
                全部品牌
              </button>
            </div>

            {/* 分组显示品牌 */}
            <div className="py-2">
              {Array.from(groupedBrands.entries()).map(([initial, brandList]) => (
                <div key={initial} className="mb-4">
                  {/* 字母分类标签 - 粘性定位 */}
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-[52px] z-10">
                    {initial}
                  </div>
                  <div className="space-y-1 mt-1">
                    {brandList.map(brand => (
                      <button
                        key={brand}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          selectedBrand === brand 
                            ? "bg-blue-50 text-blue-600 font-medium" 
                            : "hover:bg-gray-50"
                        }`}
                        onClick={() => setSelectedBrand(brand)}
                      >
                        <div className="truncate">
                          {brand || "未分类"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 右侧主内容区 */}
      <div className="flex-1 p-6">
        {/* 添加新增商品按钮和搜索框 */}
        <div className="mb-6 flex justify-between items-center">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            新增商品
          </button>
          
          <input
            type="text"
            placeholder="搜索商品名称或条码..."
            className="w-96 px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">编辑商品</h2>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  关闭
                </button>
              </div>
              
              {/* 添加编辑表单 */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">商品名称</label>
                  <input
                    type="text"
                    value={editingProduct.title}
                    onChange={(e) => setEditingProduct({...editingProduct, title: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">商品编码</label>
                  <input
                    type="text"
                    value={editingProduct.spuId}
                    onChange={(e) => setEditingProduct({...editingProduct, spuId: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">品牌</label>
                  <input
                    type="text"
                    value={editingProduct.brand}
                    onChange={(e) => setEditingProduct({...editingProduct, brand: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">规格描述</label>
                  <input
                    type="text"
                    value={editingProduct.desc}
                    onChange={(e) => setEditingProduct({...editingProduct, desc: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">售价</label>
                    <input
                      type="text"
                      value={editingProduct.price}
                      onChange={(e) => setEditingProduct({...editingProduct, price: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">原价</label>
                    <input
                      type="text"
                      value={editingProduct.originPrice}
                      onChange={(e) => setEditingProduct({...editingProduct, originPrice: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">最小购买量</label>
                    <input
                      type="number"
                      value={editingProduct.minBuyNum}
                      onChange={(e) => setEditingProduct({...editingProduct, minBuyNum: parseInt(e.target.value)})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">单位</label>
                    <input
                      type="text"
                      value={editingProduct.unit}
                      onChange={(e) => setEditingProduct({...editingProduct, unit: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center mt-4">
                  <input
                    type="checkbox"
                    id="editBuyAtMultipleTimes"
                    checked={editingProduct.buyAtMultipleTimes}
                    onChange={(e) => setEditingProduct({...editingProduct, buyAtMultipleTimes: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="editBuyAtMultipleTimes" className="ml-2 block text-sm text-gray-900">
                    倍购
                  </label>
                </div>
              </div>

              <div className="flex justify-between mt-6">
                <button
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  删除商品
                </button>
                <div className="space-x-2">
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleUpdateProduct}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 删除确认对话框 */}
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">确认删除</h3>
              <p className="mb-6">确定要删除商品 "{editingProduct?.title}" 吗？此操作不可撤销。</p>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteProduct}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 新增商品模态框 */}
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">新增商品</h2>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleAddProduct} className="space-y-6">
                {/* 基本信息 */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                  <h3 className="font-medium text-gray-900">基本信息</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">商品名称 *</label>
                      <input
                        type="text"
                        required
                        value={newProduct.title}
                        onChange={(e) => setNewProduct({...newProduct, title: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">英文名称</label>
                      <input
                        type="text"
                        value={newProduct.etitle}
                        onChange={(e) => setNewProduct({...newProduct, etitle: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">商品编码 *</label>
                      <input
                        type="text"
                        required
                        value={newProduct.spuId}
                        onChange={(e) => setNewProduct({...newProduct, spuId: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">品牌</label>
                      <input
                        type="text"
                        value={newProduct.brand}
                        onChange={(e) => setNewProduct({...newProduct, brand: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">规格描述</label>
                    <input
                      type="text"
                      value={newProduct.desc}
                      onChange={(e) => setNewProduct({...newProduct, desc: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* 价格信息 */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                  <h3 className="font-medium text-gray-900">价格信息</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">售价 *</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        value={newProduct.price}
                        onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">原价</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newProduct.originPrice}
                        onChange={(e) => setNewProduct({...newProduct, originPrice: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 销售信息 */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                  <h3 className="font-medium text-gray-900">销售信息</h3>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">最小购买数量</label>
                      <input
                        type="number"
                        value={newProduct.minBuyNum}
                        onChange={(e) => setNewProduct({...newProduct, minBuyNum: parseInt(e.target.value)})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">单位</label>
                      <input
                        type="text"
                        value={newProduct.unit}
                        onChange={(e) => setNewProduct({...newProduct, unit: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">库存数量</label>
                      <input
                        type="number"
                        value={newProduct.available}
                        onChange={(e) => setNewProduct({...newProduct, available: parseInt(e.target.value)})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">保质期</label>
                      <input
                        type="text"
                        value={newProduct.shelfLife}
                        onChange={(e) => setNewProduct({...newProduct, shelfLife: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">产地</label>
                      <input
                        type="text"
                        value={newProduct.origin}
                        onChange={(e) => setNewProduct({...newProduct, origin: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="isPutOnSale"
                        checked={newProduct.isPutOnSale === 1}
                        onChange={(e) => setNewProduct({...newProduct, isPutOnSale: e.target.checked ? 1 : 0})}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="isPutOnSale" className="ml-2 block text-sm text-gray-900">
                        上架销售
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="buyAtMultipleTimes"
                        checked={newProduct.buyAtMultipleTimes}
                        onChange={(e) => setNewProduct({...newProduct, buyAtMultipleTimes: e.target.checked})}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="buyAtMultipleTimes" className="ml-2 block text-sm text-gray-900">
                        倍购
                      </label>
                    </div>
                  </div>
                </div>

                {/* 图片信息 */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                  <h3 className="font-medium text-gray-900">图片信息</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">主图URL</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newProduct.primaryImage}
                        onChange={(e) => setNewProduct({...newProduct, primaryImage: e.target.value})}
                        className="mt-1 flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => generateImageUrl(newProduct.title, true)}
                        className="mt-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                      >
                        生成URL
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">图片URL列表（每行一个URL）</label>
                    <div className="flex gap-2 mb-2">
                      <textarea
                        value={newProduct.images.join('\n')}
                        onChange={(e) => setNewProduct({...newProduct, images: e.target.value.split('\n').filter(url => url.trim())})}
                        rows={4}
                        className="mt-1 flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => generateImageUrl(newProduct.title, false)}
                        className="mt-1 px-4 py-2 h-fit bg-blue-500 text-white rounded-md hover:bg-blue-600"
                      >
                        添加URL
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    取消
                  </button>
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