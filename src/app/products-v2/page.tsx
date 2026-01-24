"use client";

import { useEffect, useState, useMemo } from "react";
import { checkAuth } from "@/utils/auth";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { ALL_CATEGORIES, CATEGORY_NAMES } from "@/constants/categories";
import { uploadImageToCOS } from "@/utils/cos";

interface Product {
  _id?: string;
  spuId: string;
  title: string;
  etitle?: string;
  brand: string;
  desc: string;
  price: string;
  minSalePrice: string;
  maxLinePrice: string;
  originPrice: string;
  primaryImage: string;
  minBuyNum: number;
  unit: string;
  shelfLife?: string;
  origin?: string;
  images: string[];
  categoryIds?: string[];
  isPutOnSale: number;
  available?: number;
  buyAtMultipleTimes?: boolean;
  createTime?: string;
}

type SortKey = "title" | "price" | "createTime" | "brand";
type SortOrder = "asc" | "desc";
type ModalType = "none" | "detail" | "edit" | "add" | "delete";

const emptyProduct: Omit<Product, "_id"> = {
  spuId: "",
  title: "",
  etitle: "",
  brand: "",
  desc: "",
  price: "",
  minSalePrice: "",
  maxLinePrice: "",
  originPrice: "",
  primaryImage: "",
  minBuyNum: 1,
  unit: "",
  shelfLife: "",
  origin: "",
  images: [],
  categoryIds: [],
  isPutOnSale: 1,
  available: 1000000,
  buyAtMultipleTimes: true,
};

export default function ProductsV2Page() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("createTime");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  
  const [modalType, setModalType] = useState<ModalType>("none");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const auth = checkAuth();
    if (!auth) router.push("/");
  }, [router]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/products", { cache: "no-store" });
      const result = await response.json();
      if (result.success && result.data) {
        setProducts(result.data);
      }
    } catch (error) {
      console.error("获取商品失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const brands = useMemo(() => {
    const brandSet = new Set(products.map((p) => p.brand).filter(Boolean));
    return Array.from(brandSet).sort();
  }, [products]);

  const stats = useMemo(() => {
    const total = products.length;
    const onSale = products.filter((p) => p.isPutOnSale === 1).length;
    const offSale = total - onSale;
    const brandCount = new Set(products.map((p) => p.brand).filter(Boolean)).size;
    return { total, onSale, offSale, brandCount };
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = products.filter((product) => {
      const matchesSearch =
        product.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.spuId?.includes(searchTerm) ||
        product.brand?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesBrand = selectedBrand === "all" || product.brand === selectedBrand;
      const matchesStatus =
        selectedStatus === "all" ||
        (selectedStatus === "on" && product.isPutOnSale === 1) ||
        (selectedStatus === "off" && product.isPutOnSale !== 1);
      return matchesSearch && matchesBrand && matchesStatus;
    });

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case "title":
          comparison = (a.title || "").localeCompare(b.title || "");
          break;
        case "price":
          comparison = parseFloat(a.price || "0") - parseFloat(b.price || "0");
          break;
        case "brand":
          comparison = (a.brand || "").localeCompare(b.brand || "");
          break;
        case "createTime":
          comparison = new Date(a.createTime || 0).getTime() - new Date(b.createTime || 0).getTime();
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [products, searchTerm, selectedBrand, selectedStatus, sortKey, sortOrder]);

  const handleToggleStatus = async (product: Product) => {
    if (!product._id) return;
    const newStatus = product.isPutOnSale === 1 ? 0 : 1;
    try {
      const response = await fetch("/api/products/toggle-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product._id, newStatus }),
      });
      const result = await response.json();
      if (result.success) {
        setProducts((prev) =>
          prev.map((p) => (p._id === product._id ? { ...p, isPutOnSale: newStatus } : p))
        );
        if (selectedProduct?._id === product._id) {
          setSelectedProduct({ ...selectedProduct, isPutOnSale: newStatus });
        }
      }
    } catch (error) {
      console.error("状态切换失败:", error);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const handleSaveProduct = async () => {
    if (!editingProduct) return;
    setIsProcessing(true);
    
    try {
      const isNew = !editingProduct._id;
      const url = isNew ? "/api/products/add" : "/api/products/update";
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingProduct),
      });
      
      const result = await response.json();
      
      if (result.success) {
        if (isNew) {
          setProducts([result.data, ...products]);
        } else {
          setProducts(products.map((p) => (p._id === editingProduct._id ? editingProduct : p)));
        }
        closeModal();
      } else {
        alert(result.error || "保存失败");
      }
    } catch (error) {
      console.error("保存失败:", error);
      alert("保存失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct?._id) return;
    setIsProcessing(true);
    
    try {
      const response = await fetch("/api/products/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedProduct._id }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setProducts(products.filter((p) => p._id !== selectedProduct._id));
        closeModal();
      } else {
        alert(result.error || "删除失败");
      }
    } catch (error) {
      console.error("删除失败:", error);
      alert("删除失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const openDetail = (product: Product) => {
    setSelectedProduct(product);
    setModalType("detail");
  };

  const openEdit = (product: Product) => {
    // 深拷贝商品数据，确保图片数组正确初始化
    const editProduct: Product = {
      ...product,
      images: Array.isArray(product.images) ? [...product.images] : [],
      primaryImage: product.primaryImage || "",
      categoryIds: Array.isArray(product.categoryIds) ? [...product.categoryIds] : [],
    };
    setEditingProduct(editProduct);
    setModalType("edit");
  };

  const openAdd = () => {
    setEditingProduct({ ...emptyProduct } as Product);
    setModalType("add");
  };

  const openDelete = (product: Product) => {
    setSelectedProduct(product);
    setModalType("delete");
  };

  const closeModal = () => {
    setModalType("none");
    setSelectedProduct(null);
    setEditingProduct(null);
  };

  const loadCosImage = (url: string) => {
    if (!url) return "";
    if (url.indexOf("cloud://") === 0) {
      const first = url.indexOf(".");
      const end = url.indexOf("/", first);
      const bucket = url.slice(first + 1, end);
      const filepath = url.slice(end + 1);
      return `https://${bucket}.cos.ap-guangzhou.myqcloud.com/pics_v2/pic_v2/${filepath}`;
    }
    return url;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-5 h-5 border border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-7xl mx-auto px-6 py-16">
          {/* Header */}
          <header className="mb-12 flex items-end justify-between">
            <div>
              <p className="text-xs tracking-widest text-neutral-400 uppercase mb-3">Inventory</p>
              <h1 className="text-4xl font-light text-neutral-800 tracking-tight">商品管理</h1>
            </div>
            <button
              onClick={openAdd}
              className="px-5 py-2.5 text-sm bg-neutral-800 text-white rounded 
                       hover:bg-neutral-700 transition-colors"
            >
              添加商品
            </button>
          </header>

          {/* Stats */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-x-12 gap-y-6 mb-16">
            {[
              { label: "商品总数", value: stats.total },
              { label: "在售商品", value: stats.onSale },
              { label: "补货中", value: stats.offSale },
              { label: "品牌数", value: stats.brandCount },
            ].map((item, i) => (
              <div key={i} className="group">
                <p className="text-xs text-neutral-400 mb-1">{item.label}</p>
                <p className="text-2xl font-light text-neutral-800 tracking-tight">{item.value}</p>
              </div>
            ))}
          </section>

          {/* Filters */}
          <section className="mb-10 space-y-6">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索商品名称、条码或品牌..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-96 px-0 py-3 bg-transparent border-0 border-b border-neutral-200 
                         text-neutral-800 placeholder-neutral-400 text-sm
                         focus:outline-none focus:border-neutral-400 transition-colors"
              />
            </div>

            <div className="flex flex-wrap gap-8 items-center">
              <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-400">品牌</span>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="px-0 py-1 bg-transparent border-0 border-b border-neutral-200 
                           text-sm text-neutral-700 focus:outline-none focus:border-neutral-400 
                           cursor-pointer min-w-[120px]"
                >
                  <option value="all">全部</option>
                  {brands.map((brand) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-400">状态</span>
                <div className="flex gap-4">
                  {[
                    { key: "all", label: "全部" },
                    { key: "on", label: "在售" },
                    { key: "off", label: "补货中" },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setSelectedStatus(key)}
                      className={`text-sm transition-colors ${
                        selectedStatus === key ? "text-neutral-800" : "text-neutral-400 hover:text-neutral-600"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ml-auto">
                <span className="text-xs text-neutral-400">{filteredProducts.length} 件商品</span>
              </div>
            </div>
          </section>

          {/* Table */}
          <section>
            <div className="grid grid-cols-12 gap-4 py-3 border-b border-neutral-200 text-xs text-neutral-400">
              <div className="col-span-1"></div>
              <SortHeader label="商品名称" sortKey="title" currentKey={sortKey} order={sortOrder} onSort={handleSort} span={4} />
              <SortHeader label="品牌" sortKey="brand" currentKey={sortKey} order={sortOrder} onSort={handleSort} span={2} />
              <SortHeader label="价格" sortKey="price" currentKey={sortKey} order={sortOrder} onSort={handleSort} span={2} />
              <div className="col-span-2 text-left">状态</div>
              <div className="col-span-1"></div>
            </div>

            <div className="divide-y divide-neutral-100">
              {filteredProducts.map((product) => (
                <div
                  key={product._id || product.spuId}
                  className="grid grid-cols-12 gap-4 py-4 items-center group hover:bg-neutral-50/50 transition-colors"
                >
                  <div className="col-span-1">
                    <div className="w-12 h-12 bg-neutral-100 rounded overflow-hidden">
                      {product.primaryImage && (
                        <img src={loadCosImage(product.primaryImage)} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                  </div>

                  <div className="col-span-4">
                    <p className="text-sm text-neutral-800 truncate">{product.title}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{product.spuId}</p>
                  </div>

                  <div className="col-span-2">
                    <p className="text-sm text-neutral-600">{product.brand || "-"}</p>
                  </div>

                  <div className="col-span-2">
                    <p className="text-sm text-neutral-800">¥{product.price}</p>
                  </div>

                  <div className="col-span-2">
                    <button
                      onClick={() => handleToggleStatus(product)}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        product.isPutOnSale === 1
                          ? "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                          : "text-amber-600 bg-amber-50 hover:bg-amber-100"
                      }`}
                    >
                      {product.isPutOnSale === 1 ? "在售" : "补货中"}
                    </button>
                  </div>

                  <div className="col-span-1 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openDetail(product)} className="text-xs text-neutral-400 hover:text-neutral-600">
                      查看
                    </button>
                    <button onClick={() => openEdit(product)} className="text-xs text-neutral-400 hover:text-neutral-600">
                      编辑
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="py-20 text-center">
                <p className="text-sm text-neutral-400">暂无匹配的商品</p>
              </div>
            )}
          </section>

          <footer className="mt-20 pt-8 border-t border-neutral-100">
            <p className="text-xs text-neutral-300">数据更新于 {new Date().toLocaleDateString("zh-CN")}</p>
          </footer>
        </div>
      </div>

      {/* Modals */}
      {modalType === "detail" && selectedProduct && (
        <DetailPanel
          product={selectedProduct}
          onClose={closeModal}
          onEdit={() => { closeModal(); openEdit(selectedProduct); }}
          onDelete={() => { closeModal(); openDelete(selectedProduct); }}
          onStatusChange={handleToggleStatus}
          loadCosImage={loadCosImage}
        />
      )}

      {(modalType === "edit" || modalType === "add") && editingProduct && (
        <EditPanel
          product={editingProduct}
          isNew={modalType === "add"}
          isProcessing={isProcessing}
          onChange={setEditingProduct}
          onSave={handleSaveProduct}
          onClose={closeModal}
          loadCosImage={loadCosImage}
        />
      )}

      {modalType === "delete" && selectedProduct && (
        <DeleteConfirm
          product={selectedProduct}
          isProcessing={isProcessing}
          onConfirm={handleDeleteProduct}
          onClose={closeModal}
        />
      )}
    </>
  );
}

function SortHeader({ label, sortKey, currentKey, order, onSort, span }: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  order: SortOrder;
  onSort: (key: SortKey) => void;
  span: number;
}) {
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`col-span-${span} text-left hover:text-neutral-600 transition-colors flex items-center gap-1`}
    >
      {label}
      {currentKey === sortKey && <span>{order === "asc" ? "↑" : "↓"}</span>}
    </button>
  );
}


// Detail Panel
function DetailPanel({
  product,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  loadCosImage,
}: {
  product: Product;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (product: Product) => void;
  loadCosImage: (url: string) => string;
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const images = product.images?.length > 0 ? product.images : product.primaryImage ? [product.primaryImage] : [];

  const getCategoryNames = (categoryIds?: string[]) => {
    if (!categoryIds || categoryIds.length === 0) return "-";
    return categoryIds.map((id) => (CATEGORY_NAMES as Record<string, string>)[id] || id).join(", ");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto animate-slide-in">
        <div className="p-8">
          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="text-xs tracking-widest text-neutral-400 uppercase mb-2">Detail</p>
              <h2 className="text-xl font-light text-neutral-800">{product.title}</h2>
            </div>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 transition-colors p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {images.length > 0 && (
            <div className="mb-8">
              <div className="aspect-square bg-neutral-100 rounded-lg overflow-hidden mb-3">
                <img src={loadCosImage(images[activeImageIndex])} alt="" className="w-full h-full object-contain" />
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImageIndex(i)}
                      className={`w-16 h-16 flex-shrink-0 rounded overflow-hidden border-2 transition-colors ${
                        i === activeImageIndex ? "border-neutral-800" : "border-transparent"
                      }`}
                    >
                      <img src={loadCosImage(img)} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <InfoRow label="条码" value={product.spuId} />
            <InfoRow label="品牌" value={product.brand || "-"} />
            <InfoRow label="规格" value={product.desc || "-"} />
            <InfoRow label="单位" value={product.unit || "-"} />
            <InfoRow label="分类" value={getCategoryNames(product.categoryIds)} />

            <div className="pt-4 border-t border-neutral-100 grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-neutral-400 mb-1">售价</p>
                <p className="text-2xl font-light text-neutral-800">¥{product.price}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400 mb-1">原价</p>
                <p className="text-2xl font-light text-neutral-400">¥{product.originPrice || "-"}</p>
              </div>
            </div>

            <InfoRow label="起订量" value={`${product.minBuyNum} ${product.unit || "件"}`} />

            <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 mb-1">销售状态</p>
                <p className={`text-sm ${product.isPutOnSale === 1 ? "text-emerald-600" : "text-amber-600"}`}>
                  {product.isPutOnSale === 1 ? "在售" : "补货中"}
                </p>
              </div>
              <button
                onClick={() => onStatusChange(product)}
                className="text-xs px-4 py-2 border border-neutral-200 rounded text-neutral-600 hover:border-neutral-400 transition-colors"
              >
                {product.isPutOnSale === 1 ? "设为补货中" : "上架商品"}
              </button>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-neutral-100 flex gap-3">
            <button onClick={onDelete} className="px-4 py-2.5 text-sm text-red-600 hover:text-red-700 transition-colors">
              删除
            </button>
            <div className="flex-1" />
            <button onClick={onClose} className="px-4 py-2.5 text-sm text-neutral-600 border border-neutral-200 rounded hover:border-neutral-400 transition-colors">
              关闭
            </button>
            <button onClick={onEdit} className="px-4 py-2.5 text-sm text-white bg-neutral-800 rounded hover:bg-neutral-700 transition-colors">
              编辑
            </button>
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slide-in 0.2s ease-out; }
      `}</style>
    </div>
  );
}

// Edit Panel
function EditPanel({
  product,
  isNew,
  isProcessing,
  onChange,
  onSave,
  onClose,
  loadCosImage,
}: {
  product: Product;
  isNew: boolean;
  isProcessing: boolean;
  onChange: (product: Product) => void;
  onSave: () => void;
  onClose: () => void;
  loadCosImage: (url: string) => string;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const selectedCategories = product.categoryIds?.map(Number) || [];

  const updateField = <K extends keyof Product>(key: K, value: Product[K]) => {
    onChange({ ...product, [key]: value });
  };

  const handleCategoryToggle = (categoryId: number) => {
    const current = selectedCategories;
    const updated = current.includes(categoryId)
      ? current.filter((id) => id !== categoryId)
      : [...current, categoryId];
    updateField("categoryIds", updated.map(String));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isPrimary: boolean) => {
    const file = e.target.files?.[0];
    if (!file || !product.spuId) return;

    setIsUploading(true);
    try {
      const imageUrl = await uploadImageToCOS(file, product.spuId, isPrimary) as string;
      if (isPrimary) {
        // 主图：更新 primaryImage，并将主图放到 images 数组第一位
        const currentImages = product.images || [];
        const otherImages = currentImages.length > 0 ? currentImages.slice(1) : [];
        onChange({
          ...product,
          primaryImage: imageUrl,
          images: [imageUrl, ...otherImages],
        });
      } else {
        // 附图：追加到 images 数组
        const currentImages = product.images || [];
        onChange({
          ...product,
          images: [...currentImages, imageUrl],
        });
      }
    } catch (error) {
      console.error("上传失败:", error);
      alert("图片上传失败");
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    const currentImages = product.images || [];
    const newImages = currentImages.filter((_, i) => i !== index);
    // 如果删除的是主图（index 0），更新 primaryImage
    const newPrimaryImage = index === 0 ? (newImages[0] || "") : product.primaryImage;
    onChange({
      ...product,
      images: newImages,
      primaryImage: newPrimaryImage,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white shadow-xl overflow-y-auto">
        <div className="p-8">
          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="text-xs tracking-widest text-neutral-400 uppercase mb-2">{isNew ? "Add Product" : "Edit Product"}</p>
              <h2 className="text-xl font-light text-neutral-800">{isNew ? "添加商品" : "编辑商品"}</h2>
            </div>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 transition-colors p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            {/* Basic Info */}
            <section>
              <h3 className="text-xs text-neutral-400 uppercase tracking-wider mb-4">基本信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <InputField label="商品名称" value={product.title} onChange={(v) => updateField("title", v)} required />
                <InputField label="条码" value={product.spuId} onChange={(v) => updateField("spuId", v)} required disabled={!isNew} />
                <InputField label="品牌" value={product.brand} onChange={(v) => updateField("brand", v)} />
                <InputField label="单位" value={product.unit} onChange={(v) => updateField("unit", v)} />
                <div className="col-span-2">
                  <InputField label="规格描述" value={product.desc} onChange={(v) => updateField("desc", v)} />
                </div>
              </div>
            </section>

            {/* Price */}
            <section>
              <h3 className="text-xs text-neutral-400 uppercase tracking-wider mb-4">价格信息</h3>
              <div className="grid grid-cols-3 gap-4">
                <InputField label="售价" value={product.price} onChange={(v) => updateField("price", v)} type="number" />
                <InputField label="原价" value={product.originPrice} onChange={(v) => updateField("originPrice", v)} type="number" />
                <InputField label="起订量" value={String(product.minBuyNum)} onChange={(v) => updateField("minBuyNum", parseInt(v) || 1)} type="number" />
              </div>
            </section>

            {/* Categories */}
            <section>
              <h3 className="text-xs text-neutral-400 uppercase tracking-wider mb-4">商品分类</h3>
              <div className="flex flex-wrap gap-2">
                {ALL_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryToggle(cat.id)}
                    className={`px-3 py-1.5 text-xs rounded transition-colors ${
                      selectedCategories.includes(cat.id)
                        ? "bg-neutral-800 text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </section>

            {/* Images */}
            <section>
              <h3 className="text-xs text-neutral-400 uppercase tracking-wider mb-4">商品图片</h3>
              
              <div className="mb-4">
                <p className="text-xs text-neutral-500 mb-2">主图</p>
                <div className="flex items-center gap-4">
                  {product.primaryImage && (
                    <div className="w-24 h-24 bg-neutral-100 rounded overflow-hidden">
                      <img src={loadCosImage(product.primaryImage)} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <label className="px-4 py-2 text-xs border border-neutral-200 rounded cursor-pointer hover:border-neutral-400 transition-colors">
                    {isUploading ? "上传中..." : "上传主图"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, true)} disabled={isUploading || !product.spuId} />
                  </label>
                </div>
              </div>

              <div>
                <p className="text-xs text-neutral-500 mb-2">附图</p>
                <div className="flex flex-wrap gap-2">
                  {product.images.slice(1).map((img, i) => (
                    <div key={i} className="relative w-20 h-20 bg-neutral-100 rounded overflow-hidden group">
                      <img src={loadCosImage(img)} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(i + 1)}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                  <label className="w-20 h-20 border border-dashed border-neutral-300 rounded flex items-center justify-center cursor-pointer hover:border-neutral-400 transition-colors">
                    <span className="text-neutral-400 text-xl">+</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, false)} disabled={isUploading || !product.spuId} />
                  </label>
                </div>
              </div>
            </section>

            {/* Status */}
            <section>
              <h3 className="text-xs text-neutral-400 uppercase tracking-wider mb-4">销售状态</h3>
              <div className="flex gap-4">
                <button
                  onClick={() => updateField("isPutOnSale", 1)}
                  className={`px-4 py-2 text-sm rounded transition-colors ${
                    product.isPutOnSale === 1 ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  在售
                </button>
                <button
                  onClick={() => updateField("isPutOnSale", 0)}
                  className={`px-4 py-2 text-sm rounded transition-colors ${
                    product.isPutOnSale !== 1 ? "bg-amber-100 text-amber-700" : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  补货中
                </button>
              </div>
            </section>
          </div>

          <div className="mt-10 pt-6 border-t border-neutral-100 flex gap-3 justify-end">
            <button onClick={onClose} className="px-5 py-2.5 text-sm text-neutral-600 border border-neutral-200 rounded hover:border-neutral-400 transition-colors">
              取消
            </button>
            <button
              onClick={onSave}
              disabled={isProcessing || !product.title || !product.spuId}
              className="px-5 py-2.5 text-sm text-white bg-neutral-800 rounded hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Delete Confirm
function DeleteConfirm({
  product,
  isProcessing,
  onConfirm,
  onClose,
}: {
  product: Product;
  isProcessing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        <h2 className="text-lg font-light text-neutral-800 mb-2">确认删除</h2>
        <p className="text-sm text-neutral-500 mb-6">
          确定要删除商品 <span className="text-neutral-800">{product.title}</span> 吗？此操作无法撤销。
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-600 border border-neutral-200 rounded hover:border-neutral-400 transition-colors">
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isProcessing ? "删除中..." : "确认删除"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Input Field Component
function InputField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-neutral-400 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded
                 focus:outline-none focus:border-neutral-400 transition-colors
                 disabled:bg-neutral-100 disabled:text-neutral-400"
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-xs text-neutral-400">{label}</span>
      <span className="text-sm text-neutral-700">{value}</span>
    </div>
  );
}
