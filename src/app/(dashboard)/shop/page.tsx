'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import {
    Plus, Search, ShoppingBag, Package, TrendingUp, Filter,
    ArrowUpRight, Tag, Camera, CheckCircle2, Trash2, Edit, Edit2, AlertTriangle, ArrowRight
} from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { useStudio } from '@/contexts/StudioContext';
import { cn, formatCurrency } from '@/lib/utils';
import { recordSale, getSales, deleteSale, updateSale, type ShopSale } from '@/lib/sales-store';
import { getStudentsAllBranches } from '@/lib/student-store';
import type { Product } from '@/types';
import { SearchSelect } from '@/components/ui/SearchSelect';

const INITIAL_PRODUCTS: Product[] = [];

export default function ShopPage() {
    const { t } = useT();
    const { settings } = useStudio();
    const { confirm, alert } = useConfirm();
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
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [form, setForm] = useState<Partial<Product>>({
        name: '', category: 'categoryAccessories', price: 0, quantity: 1, size: '', weight: '', photo_url: ''
    });

    useEffect(() => {
        const load = () => {
            const saved = localStorage.getItem('cc_shop_products');
            if (saved) {
                setProducts(JSON.parse(saved));
            } else {
                setProducts(isDemo && INITIAL_PRODUCTS.length > 0 ? [INITIAL_PRODUCTS[0]] : []);
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

    const handleSaveProduct = () => {
        if (!form.name?.trim()) return;

        if (editingProduct) {
            const newProds = products.map(p =>
                p.id === editingProduct.id
                    ? { ...p, ...form as Product, quantity: Number(form.quantity) || 0, price: Number(form.price) || 0 }
                    : p
            );
            saveProducts(newProds);
        } else {
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
        }
        setIsAddOpen(false);
        setEditingProduct(null);
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
        const allStudents = getStudentsAllBranches();
        const student = sellForm.studentId === 'other'
            ? { full_name: sellForm.customerName || t.otherCustomer }
            : allStudents.find(s => s.id === sellForm.studentId);

        recordSale({
            studentId: sellForm.studentId,
            studentName: student?.full_name || t.unknownClient,
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
    }, [products]);

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
        <div className="space-y-8 animate-fade-up max-w-6xl mx-auto pb-10">
            {/* Header: Stats + Add in one row */}
            <div className="flex flex-row items-center justify-between gap-3 sm:gap-4 lg:gap-8">
                {/* Quick stats pills */}
                <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-6 overflow-x-auto no-scrollbar flex-1 sm:flex-none py-1">
                    {[
                        { label: t.inventory, value: totalStock, icon: Package, colorCls: 'text-amber-600', bgCls: 'bg-amber-500/5' },
                        { label: t.priceValue, value: formatCurrency(inventoryValue, settings.currency), icon: Tag, colorCls: 'text-emerald-600', bgCls: 'bg-emerald-500/5' },
                        { label: t.totalSales, value: formatCurrency(totalSalesValue, settings.currency), icon: TrendingUp, colorCls: 'text-indigo-600', bgCls: 'bg-indigo-500/5' },
                    ].map(s => (
                        <div key={s.label} className={`flex flex-col justify-center px-4 sm:px-6 lg:px-10 h-10 sm:h-12 lg:h-20 rounded-full border border-border-subtle/50 min-w-fit shadow-sm group hover:shadow-xl hover:shadow-black/5 transition-all text-center sm:text-left ${s.bgCls}`}>
                            <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
                                <s.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-6 lg:h-6 ${s.colorCls} opacity-60`} />
                                <span className="text-[13px] sm:text-[16px] lg:text-2xl font-black text-primary leading-none tabular-nums tracking-tight">{s.value}</span>
                            </div>
                            <p className="text-[7px] sm:text-[8px] lg:text-[10px] text-muted font-black tracking-widest mt-1 lg:mt-2 opacity-40 uppercase">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Add Product Action */}
                <button
                    onClick={() => {
                        setEditingProduct(null);
                        setForm({ name: '', category: 'categoryAccessories', price: 0, quantity: 1, size: '', weight: '', photo_url: '' });
                        setIsAddOpen(true);
                    }}
                    className="flex-shrink-0 flex items-center justify-center gap-2 w-12 h-12 sm:w-auto px-0 sm:px-5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-[11px] font-black tracking-widest rounded-[1.25rem] shadow-lg shadow-amber-500/20 transition-all touch-manipulation"
                >
                    <div className="relative flex items-center">
                        <ShoppingBag className="w-5 h-5 sm:w-4 sm:h-4" />
                        <Plus className="absolute -top-1 -right-2.5 w-3 h-3 text-white" />
                    </div>
                    <span className="hidden sm:inline">{t.addNew}</span>
                </button>
            </div>

            {/* Modal */}
            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/20" onClick={() => { setIsAddOpen(false); setEditingProduct(null); }} />
                    <div className="relative bg-card border border-border-subtle w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h2 className="text-xl font-black text-primary mb-6">{editingProduct ? t.edit : t.addNew}</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-muted tracking-widest block mb-2 opacity-50">{t.productTitle}</label>
                                <input
                                    className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-muted tracking-widest block mb-2 opacity-50">{t.price} ({settings.currency})</label>
                                    <input
                                        type="number"
                                        className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                                        value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-muted tracking-widest block mb-2 opacity-50">{t.stockValue}</label>
                                    <input
                                        type="number"
                                        className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                                        value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-muted tracking-widest block mb-2 opacity-50">{t.size}</label>
                                    <input
                                        className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                                        value={form.size} onChange={e => setForm({ ...form, size: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-muted tracking-widest block mb-2 opacity-50">{t.weight}</label>
                                    <input
                                        className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                                        value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-muted tracking-widest block mb-2 opacity-50">{t.photo}</label>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-surface border border-dashed border-border-subtle flex items-center justify-center overflow-hidden">
                                        {form.photo_url ? (
                                            <img src={form.photo_url} className="w-full h-full object-cover" />
                                        ) : (
                                            <Camera className="w-6 h-6 text-muted/30" />
                                        )}
                                    </div>
                                    <input type="file" id="photo-up" className="hidden" accept="image/*" onChange={handleFile} />
                                    <label htmlFor="photo-up" className="px-4 py-2 bg-surface border border-border-subtle rounded-xl text-[10px] font-black tracking-widest cursor-pointer hover:bg-amber-50 transition-colors">{t.upload}</label>
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 space-y-3">
                            {editingProduct && (
                                <button
                                    onClick={async () => {
                                        if (await confirm(t.deleteConfirm)) {
                                            const newProds = products.filter(p => p.id !== editingProduct.id);
                                            saveProducts(newProds);
                                            setIsAddOpen(false);
                                            setEditingProduct(null);
                                        }
                                    }}
                                    className="w-full py-2.5 text-red-500/60 hover:text-red-500 text-[10px] font-black tracking-widest uppercase border border-red-500/10 hover:border-red-500/30 rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    <Trash2 className="w-3 h-3" /> {t.delete}
                                </button>
                            )}
                            <div className="flex gap-3">
                                <button onClick={() => { setIsAddOpen(false); setEditingProduct(null); }} className="flex-1 py-3 font-bold text-sm text-muted">{t.cancel}</button>
                                <button onClick={handleSaveProduct} className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-amber-500/20 active:scale-95 transition-all">{editingProduct ? t.save : t.add}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Grid - Enlarged to 2 columns on desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6 stagger">
                {filtered.map(product => (
                    <div key={product.id} className="group bg-card border border-border-subtle hover:border-amber-500/40 hover:shadow-xl hover:shadow-amber-500/5 rounded-[2rem] p-6 transition-all duration-300 relative overflow-hidden flex flex-col gap-5">
                        <div className="flex items-start gap-5">
                        {/* Product Image Container (No overflow-hidden to allow badge out) */}
                        <div className="relative w-16 h-16 flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                            {/* Inner Image Wrapper (With overflow-hidden for rounded corners) */}
                            <div className="w-full h-full rounded-[1.25rem] overflow-hidden bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 border-2 border-white/10">
                                {product.photo_url ? (
                                    <img src={product.photo_url} className="w-full h-full object-cover" alt={product.name} />
                                ) : (
                                    <ShoppingBag className="w-7 h-7 text-white/40" />
                                )}
                            </div>
                            
                            {/* Quantity Badge Overlay - "Commercial" style (half-in/half-out) */}
                            <div className={cn('absolute -bottom-2 -right-2 min-w-[24px] h-[24px] px-1.5 flex items-center justify-center rounded-full border-[2.5px] border-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] z-20 transition-all scale-95 group-hover:scale-105',
                                product.quantity <= 3 ? 'bg-red-500 text-white animate-pulse' : 'bg-indigo-600 text-white')}>
                                <span className="text-[10px] font-black leading-none">{product.quantity}</span>
                            </div>
                        </div>

                        {/* Base Info & Action Row */}
                        <div className="flex-1 min-w-0 pt-0.5 flex flex-col min-h-[64px]">
                            <div>
                                <p className="text-[10px] font-black text-amber-600 tracking-widest opacity-60 uppercase truncate mb-1">
                                    {(t[product.category as keyof typeof t] as string) || product.category}
                                </p>
                                <p className="text-base font-black text-primary group-hover:text-amber-600 transition-colors tracking-tight truncate leading-tight">{product.name}</p>
                            </div>
                            
                            <div className="flex items-center justify-end gap-3 pointer-events-auto mt-auto">
                                <span className="text-lg font-black text-indigo-600 leading-none">{formatCurrency(product.price || 0, settings.currency)}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedProduct(product); setIsSellOpen(true); }}
                                    className="h-9 px-4 flex items-center gap-2 rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 active:scale-95 hover:bg-indigo-600 transition-all text-[10px] font-black tracking-widest uppercase"
                                >
                                    <ShoppingBag className="w-3.5 h-3.5" strokeWidth={3} />
                                    {t.sellAction}
                                </button>
                            </div>
                        </div>

                            {/* Actions - faint by default, prominent on hover */}
                            <div className="absolute top-4 right-4 flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingProduct(product);
                                        setForm({ ...product });
                                        setIsAddOpen(true);
                                    }}
                                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-surface border border-border-subtle text-muted hover:text-amber-600 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all shadow-sm"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                    </div>
                ))}
            </div>

            {/* Transaction History Section */}
            <div className="bg-card border border-border-subtle rounded-[2.5rem] p-6 sm:p-10 shadow-sm mt-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-lg sm:text-xl font-black text-primary tracking-tight">{t.recentSalesTitle}</h2>
                        <p className="text-[10px] sm:text-xs text-muted font-bold opacity-60 tracking-wider mt-1">{t.transactionHistory}</p>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-border-subtle text-[10px] font-black text-amber-600 tracking-widest group hover:bg-amber-50 transition-all">
                        {t.allFilter} <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </button>
                </div>

                <div className="space-y-4">
                    {recentSales.map((sale) => (
                        <div key={sale.id} className="flex items-center justify-between p-4 sm:p-6 rounded-[1.5rem] bg-surface/50 border border-border-subtle/50 hover:border-amber-500/30 hover:bg-card transition-all group relative overflow-hidden shadow-sm">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500/20 group-hover:bg-indigo-500 transition-colors" />

                            <div className="flex items-center gap-4 sm:gap-6">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                                    <ShoppingBag className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm sm:text-base font-black text-primary leading-tight">{sale.productName}</p>
                                    <div className="flex items-center gap-2 mt-1 whitespace-nowrap overflow-hidden">
                                        <p className="text-[10px] sm:text-[11px] font-bold text-muted opacity-70">{sale.studentName}</p>
                                        <span className="w-1 h-1 rounded-full bg-border-subtle" />
                                        <p className="text-[10px] sm:text-[11px] font-bold text-muted opacity-40">{sale.date}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 sm:gap-8">
                                <div className="text-right">
                                    <p className="text-sm sm:text-lg font-black text-primary tabular-nums tracking-tight">{formatCurrency(sale.price, settings.currency)}</p>
                                    <p className="text-[9px] sm:text-[10px] font-black text-muted opacity-40 tracking-widest">{sale.time}</p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedSale(sale);
                                            setSellForm({ studentId: sale.studentId, quantity: sale.quantity, customerName: sale.studentName });
                                            setIsEditSaleOpen(true);
                                        }}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-card border border-border-subtle text-muted hover:text-amber-600 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all shadow-sm"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteSale(sale.id); }}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-card border border-border-subtle text-muted hover:text-red-500 hover:border-red-500/40 hover:bg-red-500/5 transition-all shadow-sm"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {recentSales.length === 0 && (
                        <div className="py-20 text-center text-muted/20">
                            <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p className="text-xs font-black tracking-[0.2em] uppercase">{t.noSalesRecorded}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Sell Modal */}
            {isSellOpen && selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/20" onClick={() => setIsSellOpen(false)} />
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
                                <label className="text-[10px] font-black text-muted tracking-widest block mb-2 opacity-50">{t.stockValue} ({t.inventory}: {selectedProduct.quantity})</label>
                                <input
                                    type="number" min="1" max={selectedProduct.quantity}
                                    className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50"
                                    value={sellForm.quantity} onChange={e => setSellForm({ ...sellForm, quantity: Number(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-muted tracking-widest block mb-2 opacity-50">{t.studentLabel}</label>
                                <div className="mb-3">
                                    <SearchSelect
                                        options={[
                                            ...getStudentsAllBranches().map(s => ({
                                                value: s.id, label: s.full_name + (s.branch_id ? ` (${s.branch_id})` : '')
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
                                <span className="text-[10px] font-black text-indigo-600 tracking-widest">{t.totalAmount}:</span>
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
                    <div className="absolute inset-0 bg-black/20" onClick={() => setIsEditSaleOpen(false)} />
                    <div className="relative bg-card border border-border-subtle w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                                <Edit2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-primary">{t.editSale}</h2>
                                <p className="text-xs font-bold text-muted truncate max-w-[200px]">{selectedSale.productName}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-muted tracking-widest block mb-2 opacity-50">{t.stockValue} ({t.active}: {selectedSale.quantity})</label>
                                <input
                                    type="number" min="1"
                                    className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                                    value={sellForm.quantity} onChange={e => setSellForm({ ...sellForm, quantity: Number(e.target.value) })}
                                />
                            </div>

                            <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-center justify-between">
                                <span className="text-[10px] font-black text-amber-600 tracking-widest">{t.totalAmount} (new):</span>
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
        </div>
    );
}
