'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import {
    Plus, Search, ShoppingBag, Package, TrendingUp, Filter,
    ArrowUpRight, Tag, Camera, CheckCircle2, Trash2, Edit
} from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { useStudio } from '@/contexts/StudioContext';
import { cn, formatCurrency } from '@/lib/utils';
import { recordSale, getSales, deleteSale, updateSale, type ShopSale } from '@/lib/sales-store';
import { getUidRegistry } from '@/lib/student-store';
import type { Product } from '@/types';
import { SearchSelect } from '@/components/ui/SearchSelect';

const INITIAL_PRODUCTS: Product[] = [
    {
        id: 'p1', org_id: 'demo', name: 'Ballet Shoes', category: 'categoryShoes',
        price: 45, quantity: 12, size: '38', weight: '200g', is_active: true, created_at: '2025-01-01'
    },
    {
        id: 'p2', org_id: 'demo', name: 'Studio T-shirt', category: 'categoryClothing',
        price: 35, quantity: 8, size: 'M', weight: '150g', is_active: true, created_at: '2025-01-01'
    },
    {
        id: 'p3', org_id: 'demo', name: 'Water Bottle ClassCore', category: 'categoryAccessories',
        price: 25, quantity: 20, is_active: true, created_at: '2025-01-01'
    }
];

export default function ShopPage() {
    const { t } = useT();
    const { settings } = useStudio();
    const confirm = useConfirm();
    const { user, profile } = useUser();
    const isDemo = !user || profile?.studio_name === 'Demo Dance Studio' || !profile?.studio_name;

    const [products, setProducts] = useState<Product[]>([]);
    const [search, setSearch] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isSellOpen, setIsSellOpen] = useState(false);
    const [isEditSaleOpen, setIsEditSaleOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedSale, setSelectedSale] = useState<ShopSale | null>(null);
    const [sellForm, setSellForm] = useState({ studentId: '', quantity: 1, customerName: '' });

    const [form, setForm] = useState<Partial<Product>>({
        name: '', category: 'categoryAccessories', price: 0, quantity: 1, size: '', weight: '', photo_url: ''
    });

    useEffect(() => {
        const load = () => {
            const saved = localStorage.getItem('cc_shop_products');
            if (saved) {
                setProducts(JSON.parse(saved));
            } else {
                setProducts(isDemo ? INITIAL_PRODUCTS : [INITIAL_PRODUCTS[0]]);
            }
        };

        load();
        window.addEventListener('cc_product_update', load);
        window.addEventListener('cc_sale_update', refreshSales);

        return () => {
            window.removeEventListener('cc_product_update', load);
            window.removeEventListener('cc_sale_update', refreshSales);
        };
    }, [isDemo]);

    const saveProducts = (newProds: Product[]) => {
        setProducts(newProds);
        localStorage.setItem('cc_shop_products', JSON.stringify(newProds));
    };

    const handleAdd = () => {
        if (!form.name?.trim()) return;
        const newProd: Product = {
            ...form as Product,
            id: 'p' + Math.random().toString(36).substring(2, 7),
            org_id: 'demo',
            is_active: true,
            created_at: new Date().toISOString(),
            quantity: Number(form.quantity) || 0,
            price: Number(form.price) || 0
        };
        saveProducts([newProd, ...products]);
        setIsAddOpen(false);
        setForm({ name: '', category: 'categoryAccessories', price: 0, quantity: 1, size: '', weight: '', photo_url: '' });
    };

    const handleSell = () => {
        if (!selectedProduct) return;
        const qty = Number(sellForm.quantity);
        if (qty > selectedProduct.quantity) {
            alert(t.insufficientStock);
            return;
        }

        const newProds = products.map(p =>
            p.id === selectedProduct.id ? { ...p, quantity: p.quantity - qty } : p
        );
        saveProducts(newProds);

        // Record sale
        const registry = getUidRegistry();
        const student = sellForm.studentId === 'other'
            ? { studentName: sellForm.customerName || t.otherCustomer }
            : registry[sellForm.studentId];

        recordSale({
            studentId: sellForm.studentId,
            studentName: student?.studentName || t.unknownClient,
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            quantity: qty,
            price: selectedProduct.price * qty
        });

        setIsSellOpen(false);
        setSellForm({ studentId: '', quantity: 1, customerName: '' });
    };

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setForm({ ...form, photo_url: reader.result as string });
            reader.readAsDataURL(file);
        }
    };

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.category?.toLowerCase().includes(search.toLowerCase())
    );

    const totalStock = products.reduce((acc, p) => acc + p.quantity, 0);
    const inventoryValue = products.reduce((acc, p) => acc + (p.price * p.quantity), 0);

    const [recentSales, setRecentSales] = useState<ShopSale[]>([]);

    const refreshSales = () => {
        setRecentSales(getSales().slice(0, 5));
    };

    useEffect(() => {
        refreshSales();
    }, [products]); // Update when products change (e.g. after a sale)

    const handleDeleteSale = async (id: string) => {
        if (!await confirm(t.deleteConfirm)) return;
        deleteSale(id);
        refreshSales();
    };

    const handleEditSale = () => {
        if (!selectedSale) return;
        const diff = Number(sellForm.quantity) - selectedSale.quantity;
        const prod = products.find(p => p.id === selectedSale.productId);

        if (prod && diff > prod.quantity) {
            alert(t.insufficientStock);
            return;
        }

        if (prod) {
            const newProds = products.map(p =>
                p.id === prod.id ? { ...p, quantity: p.quantity - diff } : p
            );
            saveProducts(newProds);
        }

        updateSale(selectedSale.id, {
            quantity: Number(sellForm.quantity),
            price: (selectedSale.price / selectedSale.quantity) * Number(sellForm.quantity)
        });

        setIsEditSaleOpen(false);
        refreshSales();
    };

    const totalSalesValue = getSales().reduce((acc, s) => acc + s.price, 0);

    return (
        <div className="space-y-8 animate-fade-up max-w-5xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-primary tracking-tight">{t.shop}</h1>
                    <p className="text-xs sm:text-sm text-muted font-medium opacity-60">{products.length} {t.categories} · {totalStock} {t.inventory}</p>
                </div>
                <button
                    onClick={() => setIsAddOpen(true)}
                    className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 active:scale-[0.97] transition-all text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl shadow-amber-500/20 whitespace-nowrap"
                >
                    <Plus className="w-4 h-4" />
                    <span>{t.addNew}</span>
                </button>
            </div>

            {/* Modal */}
            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddOpen(false)} />
                    <div className="relative bg-card border border-border-subtle w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h2 className="text-xl font-black text-primary mb-6">{t.addNew}</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest block mb-2 opacity-50">{t.productTitle}</label>
                                <input
                                    className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest block mb-2 opacity-50">{t.price} ({settings.currency})</label>
                                    <input
                                        type="number"
                                        className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                                        value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest block mb-2 opacity-50">{t.stockValue}</label>
                                    <input
                                        type="number"
                                        className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                                        value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest block mb-2 opacity-50">{t.size}</label>
                                    <input
                                        className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                                        value={form.size} onChange={e => setForm({ ...form, size: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest block mb-2 opacity-50">{t.weight}</label>
                                    <input
                                        className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                                        value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest block mb-2 opacity-50">{t.photo}</label>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-surface border border-dashed border-border-subtle flex items-center justify-center overflow-hidden">
                                        {form.photo_url ? (
                                            <img src={form.photo_url} className="w-full h-full object-cover" />
                                        ) : (
                                            <Camera className="w-6 h-6 text-muted/30" />
                                        )}
                                    </div>
                                    <input type="file" id="photo-up" className="hidden" accept="image/*" onChange={handleFile} />
                                    <label htmlFor="photo-up" className="px-4 py-2 bg-surface border border-border-subtle rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-amber-50 transition-colors">{t.upload}</label>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setIsAddOpen(false)} className="flex-1 py-3 font-bold text-sm text-muted">{t.cancel}</button>
                            <button onClick={handleAdd} className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-amber-500/20 active:scale-95 transition-all">{t.add}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {[
                    { label: t.inventory, value: String(totalStock), icon: Package, cls: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
                    { label: t.priceValue, value: formatCurrency(inventoryValue, settings.currency), icon: Tag, cls: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
                    { label: t.totalSales, value: formatCurrency(totalSalesValue, settings.currency), icon: TrendingUp, cls: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
                ].map(s => (
                    <div key={s.label} className="bg-card border border-border-subtle rounded-3xl p-3 sm:p-5 flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-4 shadow-sm group hover:shadow-xl hover:shadow-black/5 transition-all text-center sm:text-left">
                        <div className={cn('w-10 h-10 sm:w-12 sm:h-12 rounded-2xl border flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform', s.cls)}>
                            <s.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-lg sm:text-xl font-black text-primary tabular-nums leading-none tracking-tight">{s.value}</p>
                            <p className="text-[8px] sm:text-[10px] text-muted font-black uppercase tracking-widest mt-1 opacity-40 truncate">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search & Filter */}
            <div className="flex gap-3">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-amber-500 transition-colors pointer-events-none" />
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder={t.search + '...'}
                        className="w-full bg-card border border-border-subtle rounded-2xl pl-11 pr-5 py-3 text-sm text-primary placeholder:text-muted/30 focus:outline-none focus:border-amber-500/60 transition-all shadow-sm"
                    />
                </div>
                <button className="w-12 h-12 flex items-center justify-center rounded-2xl bg-card border border-border-subtle text-muted hover:text-primary transition-all active:scale-95">
                    <Filter className="w-5 h-5" />
                </button>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filtered.map(product => (
                    <div key={product.id} className="group bg-card border border-border-subtle hover:border-amber-500/30 hover:shadow-xl rounded-2xl overflow-hidden transition-all duration-300">
                        <div className="aspect-square bg-surface relative overflow-hidden flex items-center justify-center">
                            {product.photo_url ? (
                                <img src={product.photo_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            ) : (
                                <ShoppingBag className="w-8 h-8 text-muted opacity-10 group-hover:scale-110 transition-transform duration-500" />
                            )}
                            {product.quantity <= 3 && (
                                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-red-500 text-white text-[7px] font-black uppercase tracking-widest shadow-lg">
                                    {t.lowStockLabel}
                                </span>
                            )}
                        </div>
                        <div className="p-3">
                            <div className="mb-1">
                                <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest opacity-60">{(t[product.category as keyof typeof t] as string) || product.category}</p>
                                <h3 className="text-sm font-black text-primary truncate tracking-tight">{product.name}</h3>
                            </div>

                            <div className="flex items-center justify-between mt-3">
                                <p className="text-lg font-black text-emerald-500 tabular-nums">{formatCurrency(product.price, settings.currency)}</p>
                                <span className={cn('text-[10px] font-black tabular-nums', product.quantity <= 3 ? 'text-red-500' : 'text-muted opacity-40')}>{product.quantity} ც.</span>
                            </div>

                            <button
                                onClick={() => { setSelectedProduct(product); setIsSellOpen(true); }}
                                className="w-full mt-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/10 active:scale-95 flex items-center justify-center gap-2"
                            >
                                <TrendingUp className="w-3 h-3" />
                                {t.sellAction}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Sell Modal */}
            {isSellOpen && selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSellOpen(false)} />
                    <div className="relative bg-card border border-border-subtle w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                                <ShoppingBag className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-primary">{t.sellAction}</h2>
                                <p className="text-xs font-bold text-muted truncate max-w-[200px]">{selectedProduct.name}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest block mb-2 opacity-50">{t.stockValue} ({t.inventory}: {selectedProduct.quantity})</label>
                                <input
                                    type="number" min="1" max={selectedProduct.quantity}
                                    className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50"
                                    value={sellForm.quantity} onChange={e => setSellForm({ ...sellForm, quantity: Number(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest block mb-2 opacity-50">{t.studentLabel}</label>
                                <div className="mb-3">
                                    <SearchSelect
                                        options={[
                                            ...Object.values(getUidRegistry()).map(s => ({
                                                value: s.studentId, label: s.studentName
                                            })),
                                            { value: 'other', label: t.otherCustomer }
                                        ]}
                                        value={sellForm.studentId}
                                        onChange={(val: string) => setSellForm({ ...sellForm, studentId: val })}
                                        className="!border-border-subtle hover:!border-indigo-500/50 [&>div]:py-3 [&>div]:text-sm"
                                        placeholder={t.selectClient}
                                    />
                                </div>
                                {sellForm.studentId === 'other' && (
                                    <input
                                        placeholder={t.teacherName}
                                        className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 animate-in fade-in slide-in-from-top-1"
                                        value={sellForm.customerName} onChange={e => setSellForm({ ...sellForm, customerName: e.target.value })}
                                    />
                                )}
                            </div>

                            <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex items-center justify-between">
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{t.totalAmount}:</span>
                                <span className="text-xl font-black text-indigo-600 font-mono tracking-tighter">{formatCurrency(selectedProduct.price * sellForm.quantity, settings.currency)}</span>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setIsSellOpen(false)} className="flex-1 py-3 font-bold text-sm text-muted">{t.cancel}</button>
                            <button onClick={handleSell} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                {t.save}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Sale Modal */}
            {isEditSaleOpen && selectedSale && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditSaleOpen(false)} />
                    <div className="relative bg-card border border-border-subtle w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                                <Edit className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-primary">{t.editSale}</h2>
                                <p className="text-xs font-bold text-muted truncate max-w-[200px]">{selectedSale.productName}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest block mb-2 opacity-50">{t.stockValue} ({t.active}: {selectedSale.quantity})</label>
                                <input
                                    type="number" min="1"
                                    className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                                    value={sellForm.quantity} onChange={e => setSellForm({ ...sellForm, quantity: Number(e.target.value) })}
                                />
                            </div>

                            <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-center justify-between">
                                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{t.totalAmount} (new):</span>
                                <span className="text-xl font-black text-amber-600 font-mono tracking-tighter">{formatCurrency((selectedSale.price / selectedSale.quantity) * Number(sellForm.quantity), settings.currency)}</span>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setIsEditSaleOpen(false)} className="flex-1 py-3 font-bold text-sm text-muted">{t.cancel}</button>
                            <button onClick={handleEditSale} className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                {t.save}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Recent Sales History */}
            <div className="bg-surface/50 border border-border-subtle rounded-[2.5rem] p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-lg font-black text-primary tracking-tight">{t.recentSalesTitle}</h2>
                        <p className="text-xs text-muted font-medium opacity-60">{t.transactionHistory}</p>
                    </div>
                    <button className="flex items-center gap-2 text-[10px] font-black text-amber-600 uppercase tracking-widest group">
                        {t.allFilter} <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </button>
                </div>
                <div className="space-y-4">
                    {recentSales.map((sale) => (
                        <div key={sale.id} className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border-subtle/50 shadow-sm hover:border-amber-500/20 transition-all group">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <ShoppingBag className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-primary">{sale.productName}</p>
                                    <p className="text-[10px] font-bold text-muted opacity-60">
                                        {sale.studentName} · {sale.date}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right flex items-center gap-4">
                                <div>
                                    <p className="text-sm font-black text-primary tabular-nums">{formatCurrency(sale.price, settings.currency)}</p>
                                    <p className="text-[9px] font-bold text-muted opacity-40 uppercase">{sale.time}</p>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedSale(sale);
                                        setSellForm({ studentId: sale.studentId, quantity: sale.quantity, customerName: sale.studentName });
                                        setIsEditSaleOpen(true);
                                    }}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-amber-500/20 hover:text-amber-500 hover:bg-amber-500/5 transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteSale(sale.id); }}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500/20 hover:text-red-500 hover:bg-red-500/5 transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {recentSales.length === 0 && (
                        <div className="py-10 text-center text-muted/30">
                            <p className="text-xs font-bold italic">{t.noSalesRecorded}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
