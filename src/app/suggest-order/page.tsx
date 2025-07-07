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
    
    // --- Slide-out Sidebar Filter States ---
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
            if (customersData.success) setCustomers(customersData.data); else message.error('加载客户列表失败');
            const productsData = await productsRes.json();
            if (productsData.success) setProducts(productsData.data); else message.error('加载商品列表失败');
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

    const handleSubmit = async () => {
        if (!selectedCustomer) {
            message.warning('请先选择客户');
            return;
        }
        if (cart.size === 0) {
            message.warning('购物车是空的');
            return;
        }
        setSubmitting(true);
        const { id: salespersonId, role } = checkAuth();
        if (role !== 'admin' && !salespersonId) {
            message.error('无法获取业务员信息，请重新登录');
            setSubmitting(false);
            return;
        }
        const productsList = cartArray.map(item => ({
            productId: item.product._id,
            productName: item.product.title,
            quantity: item.quantity,
            price: parseFloat(item.product.price) || 0
        }));
        try {
            const response = await fetch('/api/suggested-orders/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId: selectedCustomer._openid, salespersonId, productsList })
            });
            const result = await response.json();
            if (result.success) {
                message.success('建议单已成功生成！');
                setSelectedCustomer(null);
                setCart(new Map());
                setIsCartDrawerOpen(false);
            } else {
                throw new Error(result.error || '提交失败');
            }
        } catch (error) {
            message.error(`提交建议单失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            setSubmitting(false);
        }
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
                     <Button icon={<QrcodeOutlined />} onClick={() => setIsScannerOpen(true)} size="large" aria-label="扫码搜索" />
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
                    itemLayout="horizontal"
                    dataSource={filteredProducts}
                    renderItem={product => {
                        const cartItem = cart.get(product._id);
                        return (
                            <List.Item className="bg-white p-3 rounded-lg shadow mb-2">
                                <List.Item.Meta
                                    title={<span className="font-semibold">{product.title}</span>}
                                    description={`${BRAND_MAP[product.brand as keyof typeof BRAND_MAP] || product.brand} | ¥${product.price}`}
                                />
                                <div className="flex items-center">
                                    {cartItem ? (
                                        <>
                                            <Button icon={<MinusOutlined />} onClick={() => handleUpdateQuantity(product._id, cartItem.quantity - 1)} size="small" />
                                            <span className="mx-2 w-8 text-center font-semibold">{cartItem.quantity}</span>
                                            <Button icon={<PlusOutlined />} onClick={() => handleUpdateQuantity(product._id, cartItem.quantity + 1)} size="small" />
                                        </>
                                    ) : (
                                        <Button type="primary" onClick={() => handleAddToCart(product)}>添加</Button>
                                    )}
                                </div>
                            </List.Item>
                        );
                    }}
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
                <Input 
                    placeholder="搜索客户名称或联凯编码"
                    prefix={<SearchOutlined />}
                    onChange={e => setCustomerSearchTerm(e.target.value)}
                    className="mb-4"
                />
                <List
                    dataSource={filteredCustomers}
                    renderItem={customer => (
                        <List.Item
                            onClick={() => { setSelectedCustomer(customer); setIsCustomerModalOpen(false); }}
                            className="cursor-pointer hover:bg-gray-100"
                        >
                            <List.Item.Meta
                                title={customer.userStoreName}
                                description={`${customer.userStoreNameLiankai ? customer.userStoreNameLiankai + ' | ' : ''}业务员: ${customer.salesPerson}`}
                            />
                        </List.Item>
                    )}
                    className="h-96 overflow-y-auto"
                />
            </Modal>

            <Drawer title="订单预览" placement="bottom" open={isCartDrawerOpen} onClose={() => setIsCartDrawerOpen(false)} height="80%" className="z-40">
                {cart.size === 0 ? (
                    <Empty description="购物车是空的" />
                ) : (
                    <div className="flex flex-col h-full">
                        <div className="flex-1 overflow-y-auto p-2">
                            <List
                                dataSource={cartArray}
                                renderItem={item => (
                                    <List.Item>
                                        <List.Item.Meta
                                            title={item.product.title}
                                            description={`¥${item.product.price}`}
                                        />
                                        <div className="flex items-center">
                                            <Button icon={<MinusOutlined />} onClick={() => handleUpdateQuantity(item.product._id, item.quantity - 1)} size="small" />
                                            <span className="mx-2 w-8 text-center">{item.quantity}</span>
                                            <Button icon={<PlusOutlined />} onClick={() => handleUpdateQuantity(item.product._id, item.quantity + 1)} size="small" />
                                        </div>
                                    </List.Item>
                                )}
                            />
                        </div>
                        <footer className="p-4 border-t bg-white">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-lg font-bold">总计:</span>
                                <span className="text-xl font-bold text-red-600">¥{totalCartPrice.toFixed(2)}</span>
                            </div>
                            <Button type="primary" block size="large" onClick={handleSubmit} loading={submitting}>
                                {submitting ? '正在提交...' : '生成建议单'}
                            </Button>
                        </footer>
                    </div>
                )}
            </Drawer>

            <Modal title="扫描条形码" open={isScannerOpen} onCancel={() => setIsScannerOpen(false)} footer={null} destroyOnClose width="100%" style={{ maxWidth: '600px', top: 20 }} bodyStyle={{ padding: 0 }}>
                {isScannerOpen && <BarcodeScanner onScan={handleScanSuccess} onClose={() => setIsScannerOpen(false)} />}
            </Modal>

            {/* --- Slide-out Filter Drawer --- */}
            <Drawer
                title="筛选商品"
                placement="left" 
                onClose={() => setIsFilterDrawerOpen(false)}
                open={isFilterDrawerOpen}
                width="85%"
                className="z-40"
                footer={
                    <Button type="primary" block size="large" onClick={() => setIsFilterDrawerOpen(false)}>
                        完成
                    </Button>
                }
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-700">按分类筛选</h3>
                    <Button type="link" size="small" onClick={() => setSelectedCategories(new Set())}>清空</Button>
                </div>
                <div className="flex flex-wrap gap-2 mb-6">
                    {Object.entries(CATEGORY_NAMES).map(([id, name]) => (
                        <Button key={id} type={selectedCategories.has(id) ? 'primary' : 'default'} onClick={() => handleCategoryToggle(id)}>
                            {name}
                        </Button>
                    ))}
                </div>

                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-gray-700">按品牌筛选</h3>
                    <Button type="link" size="small" onClick={() => setSelectedBrands(new Set())}>清空</Button>
                </div>
                <Input placeholder="搜索品牌" value={brandSearchTerm} onChange={e => setBrandSearchTerm(e.target.value)} className="mb-2" />
                <div className="space-y-1 max-h-48 overflow-y-auto">
                    {filteredBrandList.map(brand => (
                        <Checkbox key={brand} checked={selectedBrands.has(brand)} onChange={() => handleBrandToggle(brand)} className="w-full p-2 hover:bg-gray-100 rounded">
                            {BRAND_MAP[brand as keyof typeof BRAND_MAP] || brand}
                        </Checkbox>
                    ))}
                </div>
            </Drawer>
        </div>
    );
};

export default SuggestOrderPage;