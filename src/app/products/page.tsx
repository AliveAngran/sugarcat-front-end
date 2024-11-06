"use client";

import { useEffect, useState } from "react";
import { dbPromise } from "@/utils/cloudbase";
import { checkAuth } from "@/utils/auth";
import { useRouter } from 'next/navigation';
import { pinyin } from 'pinyin-pro';
import * as XLSX from 'xlsx';
import { CATEGORY_MAPPING, CATEGORY_NAMES, getOriginalCategory } from '@/constants/categories';

interface Product {
  _id?: string;
  spuId: string;
  title: string;
  brand: string;
  desc: string;
  price: string;
  minSalePrice: string;
  maxLinePrice: string;
  originPrice: string;
  primaryImage: string;
  minBuyNum: number;
  unit: string;
  shelfLife: string;
  origin: string;
  images: string[];
  buyAtMultipleTimes?: boolean;
  createTime?: string;
  categoryIds?: string[];
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
  // 不需再定义 _id，因为已经在 Product 中定义了
}

// 添加品牌和排序的工具函数
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
  minSalePrice: string;
  maxLinePrice: string;
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
  categoryIds: string[];
  skuList: any[];
  spuStockQuantity: number;
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
  const [selectedNewCategories, setSelectedNewCategories] = useState<number[]>([]);
  const [newProduct, setNewProduct] = useState<NewProduct>({
    title: '',
    etitle: '',
    desc: '',
    spuId: '',
    brand: '',
    price: '',
    minSalePrice: '',
    maxLinePrice: '',
    originPrice: '',
    minBuyNum: 1,
    unit: '',
    shelfLife: '',
    origin: '',
    primaryImage: '',
    images: [],
    available: 1000000,
    isPutOnSale: 1,
    buyAtMultipleTimes: true,
    categoryIds: [],
    skuList: [],
    spuStockQuantity: 100000
  });
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [importedProducts, setImportedProducts] = useState<any[]>([]);
  const [currentImportIndex, setCurrentImportIndex] = useState<number>(-1);

  // 修改编辑商品的函数
  const handleUpdateProduct = async () => {
    if (!editingProduct) return;

    try {
      const updatedProduct = {
        ...editingProduct,
        categoryIds: selectedCategories.map(String),
      };

      const response = await fetch('/api/products/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(updatedProduct),
      });

      const result = await response.json();

      if (result.success) {
        setIsEditModalOpen(false);
        // 直接重新获取最新数据
        window.location.reload(); // 使用页面刷新来确保获取最新数据
        alert('商品更新成功');
      } else {
        throw new Error(result.error || '更新失败');
      }
    } catch (error) {
      console.error('更新商品失败:', error);
      alert('更新商品失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  // 添加 generateImageUrl 函数在这里
  const generateImageUrl = (title: string, isPrimary: boolean = false) => {
    const brand = newProduct.brand.toLowerCase();
    const spuId = newProduct.spuId;
    
    // 确保品牌名称存在，否则使用默认值
    const brandFolder = 'other';
    
    const baseUrl = 'cloud://tangmao-6ga5x8ct393e0fe9.7461-tangmao-6ga5x8ct393e0fe9-1327435676/';
    
    if (isPrimary) {
      // 主图使用 -zt 后缀
      const fileName = `${brandFolder}/${spuId}-ZT.jpg`;
      setNewProduct({...newProduct, primaryImage: baseUrl + fileName});
    } else {
      // 附图：第一张用 -zt，之后的用 -1, -2, -3...
      const currentImages = newProduct.images;
      let fileNameWithIndex;
      
      if (currentImages.length === 0) {
        // 第一张附图用 -zt
        fileNameWithIndex = `${brandFolder}/${spuId}-ZT.jpg`;
      } else {
        // 后续附图用数字编号
        const nextIndex = currentImages.length;
        fileNameWithIndex = `${brandFolder}/${spuId}-${nextIndex}.jpg`;
      }
      
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

  // 修改获取商品数据的函数
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/products', {
          cache: 'no-store',
          headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();

        if (result.success && result.data) {
          const sortedProducts = result.data
            .sort((a: Product, b: Product) => {
              const timeA = a.createTime ? new Date(a.createTime).getTime() : 0;
              const timeB = b.createTime ? new Date(b.createTime).getTime() : 0;
              return timeB - timeA;  // 降序排序
            });
          
          setProducts(sortedProducts);
          const brandSet = new Set<string>(
            sortedProducts
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
  }, []); // 只在组件挂载时执行一次

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
      const productToAdd = {
        ...newProduct,
        categoryIds: selectedNewCategories.map(String), // 将数字转换为字符串
      };

      const response = await fetch('/api/products/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productToAdd),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '添加失败');
      }

      // 更新商品列表
      setProducts([...products, result.data]);
      
      // 如果还有下一个商品，继续处理
      if (currentImportIndex >= 0 && currentImportIndex < importedProducts.length - 1) {
        handleNextProduct();
      } else {
        // 没有更多商品了，关闭模态框并重置状态
        setIsAddModalOpen(false);
        setImportedProducts([]);
        setCurrentImportIndex(-1);
        setNewProduct({
          title: '',
          etitle: '',
          desc: '',
          spuId: '',
          brand: '',
          price: '',
          minSalePrice: '',
          maxLinePrice: '',
          originPrice: '',
          minBuyNum: 1,
          unit: '',
          shelfLife: '',
          origin: '',
          primaryImage: '',
          images: [],
          available: 1000000,
          isPutOnSale: 1,
          buyAtMultipleTimes: true,
          categoryIds: [],
          skuList: [],
          spuStockQuantity: 100000
        });
        setSelectedNewCategories([]); // 重置分类选择
      }
    } catch (error) {
      console.error("添加商品失败:", error);
      alert("添加失败，请重试");
    }
  };

  // 获取分组后品牌列表
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
        // 闭所有模态框
        setIsDeleteConfirmOpen(false);
        setIsEditModalOpen(false);
        // 显示成功消息
        alert('商品删除成功');
        // 添加页面刷新
        window.location.reload();
      } else {
        throw new Error(result.error || '删除失败');
      }
    } catch (error) {
      console.error('删除商品失败:', error);
      alert('删除商品失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  // 修改处理Excel文件的函数
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const data = await readExcelFile(file);
      if (data.length > 0) {
        setImportedProducts(data);
        setCurrentImportIndex(0); // 设置为第一个商品
        
        // 设置第一个商品的数据
        const firstRow = data[0];
        const newProductData = {
          title: firstRow['商品名称'] || firstRow['产品'] || firstRow['产品名称'] || '',
          etitle: '',
          desc: firstRow['规格型号'] || firstRow['规格'] || '',
          spuId: String(parseInt(firstRow['新条码'] || firstRow['条码'] || '0')),
          brand: '',  // 可以从Excel文件名中提取
          price: String(firstRow['小程序价格'] || firstRow['小程序价'] || '0'),
          minSalePrice: String(firstRow['小程序价格'] || firstRow['小程序价'] || '0'),
          maxLinePrice: String(firstRow['零售价'] || firstRow['建议零售价'] || '0'),
          originPrice: String(firstRow['零售价'] || firstRow['建议零售价'] || '0'),
          minBuyNum: parseInt(String(firstRow['起订量'])) || 1,
          unit: firstRow['单位'] || '',
          shelfLife: firstRow['保质期'] || '',
          origin: firstRow['产地'] || '',
          primaryImage: '',
          images: [],
          available: 1000000,
          isPutOnSale: 1,
          buyAtMultipleTimes: firstRow['倍购'] === 1,
          categoryIds: [],
          skuList: [],
          spuStockQuantity: 1000000
        };

        setNewProduct(newProductData);
        setIsAddModalOpen(true);
      }
    } catch (error) {
      console.error('读取Excel文件失败:', error);
      alert('读取Excel文件失败，请检查文件格式');
    } finally {
      setIsProcessing(false);
    }
  };

  // 添加处理下一个商品的函数
  const handleNextProduct = () => {
    if (currentImportIndex < importedProducts.length - 1) {
      const nextIndex = currentImportIndex + 1;
      const nextRow = importedProducts[nextIndex];
      
      // 重置分类选择
      setSelectedNewCategories([]);
      
      const nextProductData = {
        title: nextRow['商品名称'] || nextRow['产品'] || nextRow['产品名称'] || '',
        etitle: '',
        desc: nextRow['规格型号'] || nextRow['规格'] || '',
        spuId: String(parseInt(nextRow['新条码'] || nextRow['条码'] || '0')),
        brand: '',
        price: String(nextRow['小程序价格'] || nextRow['小程序价'] || '0'),
        minSalePrice: String(nextRow['小程序价格'] || nextRow['小程序价'] || '0'),
        maxLinePrice: String(nextRow['零售价'] || nextRow['建议零售价'] || '0'),
        originPrice: String(nextRow['零售价'] || nextRow['建议零售价'] || '0'),
        minBuyNum: parseInt(String(nextRow['起订量'])) || 1,
        unit: nextRow['单位'] || '',
        shelfLife: nextRow['保质期'] || '',
        origin: nextRow['产地'] || '',
        primaryImage: '',
        images: [],
        available: 1000000,
        isPutOnSale: 1,
        buyAtMultipleTimes: nextRow['倍购'] === 1,
        categoryIds: [],
        skuList: [],
        spuStockQuantity: 1000000
      };

      setNewProduct(nextProductData);
      setCurrentImportIndex(nextIndex);
    } else {
      setIsAddModalOpen(false);
      setImportedProducts([]);
      setCurrentImportIndex(-1);
      setSelectedNewCategories([]); // 重置分类选择
    }
  };

  const readExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true });
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  };

  useEffect(() => {
    if (editingProduct) {
      // 直接使用数据库中的 categoryIds，不需要转换
      const categories = editingProduct.categoryIds
        ? editingProduct.categoryIds
            .map(id => parseInt(id))
            .filter(id => !isNaN(id))
        : [];
      setSelectedCategories(categories);
    } else {
      setSelectedCategories([]);
    }
  }, [editingProduct]);

  if (!isAuthorized) {
    return null; // 未授权时不渲染任何内容，等待重定向
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* 左侧品牌筛选 - 添加高度制和滚动 */}
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
          <div className="flex gap-2">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              新增商品
            </button>
            <label className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors cursor-pointer">
              批量导入
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileUpload}
                onClick={(e) => (e.currentTarget.value = '')}
              />
            </label>
          </div>
          
          <input
            type="text"
            placeholder="搜索商品名称或条码..."
            className="w-96 px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* 商品列表 - 为表格形式 */}
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
            <div className="bg-white rounded-lg w-[800px] max-h-[90vh] flex flex-col">
              {/* 固定的标题栏 */}
              <div className="p-6 border-b flex justify-between items-center flex-shrink-0">
                <h2 className="text-xl font-bold">编辑商品</h2>
                <button 
                  onClick={() => setIsEditModalOpen(false)} 
                  className="text-gray-500 hover:text-gray-700"
                >
                  关闭
                </button>
              </div>

              {/* 可滚动的内容区域 */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* 表单字段 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">商品名称</label>
                    <input
                      type="text"
                      value={editingProduct?.title || ''}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev!, title: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">商品编码</label>
                    <input
                      type="text"
                      value={editingProduct?.spuId || ''}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev!, spuId: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">品牌</label>
                    <input
                      type="text"
                      value={editingProduct?.brand || ''}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev!, brand: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">售价</label>
                    <input
                      type="number"
                      value={editingProduct?.price || ''}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev!, price: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">原价</label>
                    <input
                      type="number"
                      value={editingProduct?.originPrice || ''}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev!, originPrice: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">最小购买量</label>
                    <input
                      type="number"
                      value={editingProduct?.minBuyNum || ''}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev!, minBuyNum: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">单位</label>
                    <input
                      type="text"
                      value={editingProduct?.unit || ''}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev!, unit: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">规格描述</label>
                    <textarea
                      value={editingProduct?.desc || ''}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev!, desc: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>

                  {/* 分类选择区域 */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      商品分类（可多选）
                    </label>
                    <div className="grid grid-cols-3 gap-2 p-4 border rounded-lg max-h-[200px] overflow-y-auto">
                      {Object.entries(CATEGORY_NAMES).map(([value, name]) => (
                        <label
                          key={value}
                          className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${
                            selectedCategories.includes(parseInt(value)) ? 'bg-blue-50' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(parseInt(value))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCategories([...selectedCategories, parseInt(value)]);
                              } else {
                                setSelectedCategories(
                                  selectedCategories.filter(id => id !== parseInt(value))
                                );
                              }
                            }}
                            className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm">{name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 修改底部按钮区域，添加删除按钮 */}
              <div className="p-6 border-t flex justify-between flex-shrink-0">
                {/* 左侧放删除按钮 */}
                <button
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  className="px-4 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600"
                >
                  删除商品
                </button>

                {/* 右侧放取消和保存按钮 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleUpdateProduct}
                    className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 确保删除确认对话框在编辑���态框之上 */}
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
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
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-bold">新增商品</h2>
                  {currentImportIndex >= 0 && (
                    <span className="text-sm text-gray-500">
                      进度: {currentImportIndex + 1} / {importedProducts.length}
                    </span>
                  )}
                </div>
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
                      <label className="block text-sm font-medium text-gray-700">原</label>
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

                {/* 商品分类 */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                  <h3 className="font-medium text-gray-900">商品分类</h3>
                  <div className="grid grid-cols-3 gap-2 p-4 border rounded-lg max-h-[200px] overflow-y-auto">
                    {Object.entries(CATEGORY_NAMES).map(([value, name]) => (
                      <label
                        key={value}
                        className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${
                          selectedNewCategories.includes(parseInt(value)) ? 'bg-blue-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedNewCategories.includes(parseInt(value))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedNewCategories([...selectedNewCategories, parseInt(value)]);
                            } else {
                              setSelectedNewCategories(
                                selectedNewCategories.filter(id => id !== parseInt(value))
                              );
                            }
                          }}
                          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm">{name}</span>
                      </label>
                    ))}
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