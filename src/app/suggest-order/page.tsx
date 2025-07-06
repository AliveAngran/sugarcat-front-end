"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { checkAuth } from '@/utils/auth';
import { pinyin } from 'pinyin-pro';
import { CATEGORY_NAMES } from '@/constants/categories';
import { BRAND_MAP } from '@/constants/brands';

// Ant Design Components & Icons
import { Button, Input, Modal, message, Spin, Tabs, List, Badge, Empty, Checkbox, Drawer, Tag } from 'antd';
import { UserOutlined, SearchOutlined, ShoppingCartOutlined, PlusOutlined, MinusOutlined, FunnelPlotOutlined, QrcodeOutlined } from '@ant-design/icons';

// Dynamically import the BarcodeScanner to avoid SSR issues with camera access
const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), { ssr: false });

// Type definitions
interface Product {
  _id: string;
  spuId: string;
  title: string;
  brand: string;
  price: string;
  primaryImage: string;
  desc: string;
  categoryIds?: string[];
}

interface Customer {
  _id: string;
  _openid: string;
  userStoreName: string;
  userStoreNameLiankai?: string;
  salesPerson: string;
  userAvatar?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

const SuggestOrderPage = () => {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    
    // Data states
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);

    // UI & interaction states
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');

    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('all');

    const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
    const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
    
    // --- Mobile-First Filter States ---
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
    const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
    const [brandSearchTerm, setBrandSearchTerm] = useState('');

    // --- Barcode Scanner State ---
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const [submitting, setSubmitting] = useState(false);
    
    // Initial Auth and Data Fetching
    useEffect(() => {
        const auth = checkAuth();
        if (!auth.isAuth) {
            router.push('/');
        } else {
            setIsAuthorized(true);
            fetchInitialData(auth.role, auth.id);
        }
    }, [router]);

    const fetchInitialData = async (role: string | null, id: string | null) => {
        setInitialLoading(true);
        try {
            const [customersRes, productsRes] = await Promise.all([
                fetch('/api/users'),
                fetch('/api/products')
            ]);

            const customersData = await customersRes.json();
            if (customersData.success) {
                setCustomers(customersData.data);
            } else {
                message.error('加载客户列表失败');
            }

            const productsData = await productsRes.json();
            if (productsData.success) {
                setProducts(productsData.data);
            } else {
                message.error('加载商品列表失败');
            }

        } catch (error) {
            message.error('加载基础数据失败');
            console.error(error);
        } finally {
            setInitialLoading(false);
        }
    };

    // --- Handlers ---
    const handleAddToCart = (product: Product) => {
        const newCart = new Map(cart);
        const existingItem = newCart.get(product._id);
        newCart.set(product._id, { product, quantity: (existingItem?.quantity || 0) + 1 });
        setCart(newCart);
    };
    
    const handleUpdateQuantity = (productId: string, newQuantity: number) => {
        const newCart = new Map(cart);
        if (newQuantity > 0) {
            const existingItem = newCart.get(productId);
            if(existingItem) newCart.set(productId, { ...existingItem, quantity: newQuantity });
        } else {
            newCart.delete(productId);
        }
        setCart(newCart);
    };

    const handleScanSuccess = (result: string) => {
        message.success(`扫码成功: ${result}`);
        setProductSearchTerm(result);
        setIsScannerOpen(false);
    };

    // --- Memoized Calculations & Filters ---
    const filteredCustomers = useMemo(() => {
        if (!customerSearchTerm) return customers;
        const lowercasedTerm = customerSearchTerm.toLowerCase();
        return customers.filter(c => 
            c.userStoreName.toLowerCase().includes(lowercasedTerm) ||
            (c.userStoreNameLiankai && c.userStoreNameLiankai.toLowerCase().includes(lowercasedTerm)) ||
            pinyin(c.userStoreName, { toneType: 'none' }).toLowerCase().replace(/\s/g, '').includes(lowercasedTerm)
        );
    }, [customers, customerSearchTerm]);

    const allBrands = useMemo(() => Array.from(new Set(products.map(p => p.brand).filter(Boolean))).sort(), [products]);

    const filteredBrandList = useMemo(() => {
        if (!brandSearchTerm) return allBrands;
        const lowercasedTerm = brandSearchTerm.toLowerCase();
        return allBrands.filter(brand => 
            (BRAND_MAP[brand as keyof typeof BRAND_MAP] || brand).toLowerCase().includes(lowercasedTerm) ||
            pinyin(brand, { toneType: 'none' }).toLowerCase().replace(/\s/g, '').includes(lowercasedTerm)
        );
    }, [allBrands, brandSearchTerm]);

    const filteredProducts = useMemo(() => {
        let filtered = products;
        if (selectedBrands.size > 0) {
            filtered = filtered.filter(p => p.brand && selectedBrands.has(p.brand));
        }
        if (selectedCategories.size > 0) {
            filtered = filtered.filter(p => p.categoryIds && p.categoryIds.some(catId => selectedCategories.has(catId)));
        }
        if (productSearchTerm) {
            const lowercasedTerm = productSearchTerm.toLowerCase();
            filtered = filtered.filter(p => 
                p.title.toLowerCase().includes(lowercasedTerm) ||
                (p.brand && p.brand.toLowerCase().includes(lowercasedTerm)) ||
                pinyin(p.title, { toneType: 'none' }).toLowerCase().replace(/\s/g, '').includes(lowercasedTerm) ||
                (p.spuId && p.spuId.includes(lowercasedTerm))
            );
        }
        return filtered;
    }, [products, productSearchTerm, selectedBrands, selectedCategories]);

    const cartArray = useMemo(() => Array.from(cart.values()), [cart]);
    const totalCartItems = useMemo(() => cartArray.reduce((sum, item) => sum + item.quantity, 0), [cartArray]);
    const totalCartPrice = useMemo(() => cartArray.reduce((sum, item) => sum + (parseFloat(item.product.price) || 0) * item.quantity, 0), [cartArray]);

    const handleSubmit = async () => {
      // ... (submission logic remains the same)
    };
    
    const handleBrandToggle = (brand: string) => {
        const newSet = new Set(selectedBrands);
        newSet.has(brand) ? newSet.delete(brand) : newSet.add(brand);
        setSelectedBrands(newSet);
    };

    const handleCategoryToggle = (categoryId: string) => {
        const newSet = new Set(selectedCategories);
        newSet.has(categoryId) ? newSet.delete(categoryId) : newSet.add(categoryId);
        setSelectedCategories(newSet);
    };

    const handleClearAllFilters = () => {
        setSelectedBrands(new Set());
        setSelectedCategories(new Set());
        setBrandSearchTerm('');
    };

    if (initialLoading || !isAuthorized) {
        return <div className="flex justify-center items-center h-screen bg-gray-100"><Spin size="large" tip="正在加载数据..." /></div>;
    }

    // --- JSX Render ---
    const renderFilterTags = () => (
        (selectedBrands.size > 0 || selectedCategories.size > 0) && (
            <div className="p-2 bg-white border-b sticky top-[118px] z-10">
                <div className="flex flex-wrap gap-2 items-center">
                    {Array.from(selectedBrands).map(brand => (
                        <Tag key={brand} closable onClose={() => handleBrandToggle(brand)}>{BRAND_MAP[brand as keyof typeof BRAND_MAP] || brand}</Tag>
                    ))}
                    {Array.from(selectedCategories).map(catId => (
                        <Tag key={catId} closable onClose={() => handleCategoryToggle(catId)}>{CATEGORY_NAMES[Number(catId) as keyof typeof CATEGORY_NAMES] || '未知分类'}</Tag>
                    ))}
                    <Button type="link" onClick={handleClearAllFilters} size="small">全部清除</Button>
                </div>
            </div>
        )
    );

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            {/* Header */}
            <header className="sticky top-0 z-20 bg-white shadow-md p-2">
                <Button icon={<UserOutlined />} onClick={() => setIsCustomerModalOpen(true)} className="w-full mb-2 text-left" size="large">
                    {selectedCustomer ? selectedCustomer.userStoreName : '请选择客户'}
                </Button>
                <div className="flex items-center gap-2">
                    <Input 
                        placeholder="搜索或扫码查找商品"
                        prefix={<SearchOutlined />}
                        value={productSearchTerm}
                        onChange={e => setProductSearchTerm(e.target.value)}
                        size="large"
                        className="flex-1"
                    />
                     <Button 
                        icon={<QrcodeOutlined />} 
                        onClick={() => setIsScannerOpen(true)}
                        size="large"
                        aria-label="扫码搜索"
                    />
                    <Badge dot={selectedBrands.size > 0 || selectedCategories.size > 0}>
                        <Button icon={<FunnelPlotOutlined />} onClick={() => setIsFilterDrawerOpen(true)} size="large" />
                    </Badge>
                </div>
            </header>
            
            {renderFilterTags()}
            
            {/* Body */}
            <main className="flex-1 overflow-y-auto p-2">
                <Tabs activeKey={activeTab} onChange={setActiveTab} centered>
                    <Tabs.TabPane tab="全部商品" key="all" />
                    <Tabs.TabPane tab="常购清单" key="frequent" disabled={!selectedCustomer} />
                </Tabs>
                
                <List
                    grid={{ gutter: 16, xs: 2, sm: 3, md: 4, lg: 5, xl: 6 }}
                    dataSource={filteredProducts}
                    renderItem={product => {
                        const cartItem = cart.get(product._id);
                        return (
                            <List.Item>
                                <div className="bg-white p-3 rounded-lg shadow hover:shadow-lg transition-shadow h-full flex flex-col">
                                    <div className="flex-grow">
                                        <p className="font-semibold text-sm mb-1 line-clamp-2">{product.title}</p>
                                        <p className="text-xs text-gray-500 mb-2">{BRAND_MAP[product.brand as keyof typeof BRAND_MAP] || product.brand}</p>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <p className="text-red-600 font-medium text-base">{`¥${product.price}`}</p>
                                        <div className="flex items-center">
                                            {cartItem ? (
                                                <>
                                                    <Button icon={<MinusOutlined />} onClick={() => handleUpdateQuantity(product._id, cartItem.quantity - 1)} size="small" className="w-6 h-6" />
                                                    <span className="mx-1 w-6 text-center font-semibold">{cartItem.quantity}</span>
                                                    <Button icon={<PlusOutlined />} onClick={() => handleUpdateQuantity(product._id, cartItem.quantity + 1)} size="small" className="w-6 h-6" />
                                                </>
                                            ) : (
                                                <Button type="primary" onClick={() => handleAddToCart(product)} size="small">添加</Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </List.Item>
                        );
                    }}
                    className="bg-transparent"
                />
            </main>
            
            {/* Cart FAB */}
            <div className="fixed bottom-6 right-6 z-30">
                <Badge count={totalCartItems} size="default">
                    <Button type="primary" shape="circle" icon={<ShoppingCartOutlined />} size="large" onClick={() => setIsCartDrawerOpen(true)} className="shadow-lg" style={{ width: 60, height: 60, fontSize: '24px' }} />
                </Badge>
            </div>

            {/* Modals & Drawers */}
            <Modal title="选择客户" open={isCustomerModalOpen} onCancel={() => setIsCustomerModalOpen(false)} footer={null} destroyOnClose>
                {/* ... Customer selection UI ... */}
            </Modal>

            <Drawer title="订单预览" placement="bottom" onClose={() => setIsCartDrawerOpen(false)} open={isCartDrawerOpen} height="80%" className="z-40">
                {/* ... Cart UI ... */}
            </Drawer>

            <Drawer title="筛选商品" placement="bottom" onClose={() => setIsFilterDrawerOpen(false)} open={isFilterDrawerOpen} height="70%" className="z-40" footer={<Button type="primary" block size="large" onClick={() => setIsFilterDrawerOpen(false)}>完成</Button>}>
                {/* ... Filter UI ... */}
            </Drawer>

            <Modal
                title="扫描条形码"
                open={isScannerOpen}
                onCancel={() => setIsScannerOpen(false)}
                footer={null}
                destroyOnClose
                width="100%"
                style={{ maxWidth: '600px', top: 20 }}
                bodyStyle={{ padding: 0 }}
            >
                {isScannerOpen && <BarcodeScanner onScan={handleScanSuccess} onClose={() => setIsScannerOpen(false)} />}
            </Modal>
        </div>
    );
};

export default SuggestOrderPage;