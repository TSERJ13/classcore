'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, ChevronDown, ChevronRight, Trash2, Copy, Pencil, Loader2, Tag } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { addNotification } from '@/lib/notification-store';
import { cn } from '@/lib/utils';
import { SearchSelectOption } from '@/components/ui/SearchSelect';
import { getGroupsAction } from '@/app/actions/groups';
import {
    listSmsCategoriesAction, listSmsTemplatesAction, createSmsCategoryAction, toggleSmsCategoryAction,
    deleteSmsCategoryAction, deleteSmsTemplateAction, duplicateSmsTemplateAction,
    type SmsCategory, type SmsTemplate,
} from '@/app/actions/sms-templates';
import { TemplateModal } from './TemplateModal';

interface CategoryTemplatesTabProps {
    branches: SearchSelectOption[];
    students: SearchSelectOption[];
}

/**
 * The categories → templates management surface (SMS PRD §3/§4) that
 * replaces the old fixed 7-field "Manage Texts" tab. Reads/writes through
 * src/app/actions/sms-templates.ts (Phase 1 of docs/tasks.md's "SMS Module
 * PRD alignment"). Personal/Holiday/Stats tabs on the parent page are
 * untouched — they still read the old settings.sms_templates blob; nothing
 * here sends anything yet (recipient targeting/frequency limits are
 * stored but not enforced by any send path — that's a later phase).
 */
export function CategoryTemplatesTab({ branches, students }: CategoryTemplatesTabProps) {
    const { lang } = useT();
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    const { confirm } = useConfirm();

    const [categories, setCategories] = useState<SmsCategory[]>([]);
    const [templatesByCategory, setTemplatesByCategory] = useState<Record<string, SmsTemplate[]>>({});
    const [groups, setGroups] = useState<SearchSelectOption[]>([]);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [addingCategory, setAddingCategory] = useState(false);
    const [modalState, setModalState] = useState<{ categoryId: string; template: SmsTemplate | null } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [catsResult, groupRows] = await Promise.all([listSmsCategoriesAction(), getGroupsAction()]);
            if (catsResult.error) {
                addNotification(catsResult.error.message, 'bg-rose-500');
                return;
            }
            setCategories(catsResult.data);
            setGroups(groupRows.map(g => ({ value: g.id, label: g.name })));

            const templateResults = await Promise.all(catsResult.data.map(c => listSmsTemplatesAction({ categoryId: c.id })));
            const map: Record<string, SmsTemplate[]> = {};
            catsResult.data.forEach((c, i) => { map[c.id] = templateResults[i].data ?? []; });
            setTemplatesByCategory(map);
            setExpanded(prev => {
                const next = { ...prev };
                catsResult.data.forEach(c => { if (!(c.id in next)) next[c.id] = true; });
                return next;
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    async function handleAddCategory() {
        if (!newCategoryName.trim()) return;
        const result = await createSmsCategoryAction({ name: newCategoryName.trim() });
        if (result.error) {
            addNotification(result.error.message, 'bg-rose-500');
            return;
        }
        setNewCategoryName('');
        setAddingCategory(false);
        await load();
    }

    async function handleToggleCategory(cat: SmsCategory) {
        const result = await toggleSmsCategoryAction({ id: cat.id, enabled: !cat.enabled });
        if (result.error) { addNotification(result.error.message, 'bg-rose-500'); return; }
        await load();
    }

    async function handleDeleteCategory(cat: SmsCategory) {
        const ok = await confirm({
            title: l('კატეგორიის წაშლა', 'Удалить категорию', 'Delete Category'),
            message: l(
                `წაშლის შემდეგ "${cat.name}" კატეგორია და მისი ყველა შაბლონი სამუდამოდ წაიშლება. დარწმუნებული ხართ?`,
                `После удаления категория "${cat.name}" и все её шаблоны будут удалены навсегда. Вы уверены?`,
                `Deleting "${cat.name}" will permanently remove the category and all its templates. Are you sure?`
            ),
        });
        if (!ok) return;
        const result = await deleteSmsCategoryAction({ id: cat.id });
        if (result.error) { addNotification(result.error.message, 'bg-rose-500'); return; }
        await load();
    }

    async function handleDeleteTemplate(template: SmsTemplate) {
        const ok = await confirm({
            title: l('შაბლონის წაშლა', 'Удалить шаблон', 'Delete Template'),
            message: l(`"${template.name}" წაიშლება სამუდამოდ. დარწმუნებული ხართ?`, `"${template.name}" будет удалён навсегда. Вы уверены?`, `"${template.name}" will be permanently deleted. Are you sure?`),
        });
        if (!ok) return;
        const result = await deleteSmsTemplateAction({ id: template.id });
        if (result.error) { addNotification(result.error.message, 'bg-rose-500'); return; }
        await load();
    }

    async function handleDuplicateTemplate(template: SmsTemplate) {
        const result = await duplicateSmsTemplateAction({ id: template.id });
        if (result.error) { addNotification(result.error.message, 'bg-rose-500'); return; }
        await load();
    }

    if (loading) {
        return <div className="py-16 flex items-center justify-center text-muted/40"><Loader2 className="w-5 h-5 animate-spin" /></div>;
    }

    return (
        <div className="space-y-4">
            {categories.map(cat => {
                const templates = templatesByCategory[cat.id] || [];
                const isOpen = expanded[cat.id];
                return (
                    <div key={cat.id} className="bg-surface rounded-2xl border border-border-subtle overflow-hidden">
                        <div className="p-4 flex items-center justify-between gap-3">
                            <button onClick={() => setExpanded(p => ({ ...p, [cat.id]: !p[cat.id] }))} className="flex items-center gap-2 flex-1 min-w-0">
                                {isOpen ? <ChevronDown className="w-4 h-4 text-muted shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted shrink-0" />}
                                <Tag className="w-4 h-4 text-indigo-400 shrink-0" />
                                <span className="text-sm font-black text-primary truncate">{cat.name}</span>
                                <span className="text-[10px] font-bold text-muted/50 shrink-0">({templates.length})</span>
                                {cat.moduleKey && (
                                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 shrink-0">{cat.moduleKey}</span>
                                )}
                            </button>
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => setModalState({ categoryId: cat.id, template: null })}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black text-indigo-500 hover:bg-indigo-500/10 transition-colors">
                                    <Plus className="w-3.5 h-3.5" /> {l('შაბლონი', 'Шаблон', 'Template')}
                                </button>
                                <button onClick={() => handleToggleCategory(cat)}
                                    className={`w-10 h-5 rounded-full transition-colors relative focus:outline-none ${cat.enabled ? 'bg-emerald-500' : 'bg-border-subtle'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm ${cat.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </button>
                                <button onClick={() => handleDeleteCategory(cat)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted/50 hover:text-rose-500 hover:bg-rose-500/10 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {isOpen && (
                            <div className="border-t border-border-subtle divide-y divide-border-subtle/60">
                                {templates.length === 0 ? (
                                    <p className="px-4 py-6 text-center text-xs text-muted/40">{l('შაბლონი არ არსებობს', 'Нет шаблонов', 'No templates yet')}</p>
                                ) : templates.map(tpl => (
                                    <div key={tpl.id} className="p-4 flex items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-black text-primary">{tpl.name}</span>
                                                <span className={cn('text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded',
                                                    tpl.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500')}>
                                                    {tpl.status === 'active' ? l('აქტიური', 'Активен', 'Active') : l('დრაფტი', 'Черновик', 'Draft')}
                                                </span>
                                                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface border border-border-subtle text-muted/60">
                                                    {tpl.recipientScope === 'all' ? l('ყველა', 'Все', 'All')
                                                        : tpl.recipientScope === 'group' ? l('ჯგუფი', 'Группа', 'Group')
                                                        : tpl.recipientScope === 'branch' ? l('ფილიალი', 'Филиал', 'Branch')
                                                        : l('ადამიანი', 'Человек', 'Person')}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-muted/60 mt-1 truncate">{tpl.textKa || tpl.textRu || tpl.textEn || '—'}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button onClick={() => setModalState({ categoryId: cat.id, template: tpl })} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted/50 hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => handleDuplicateTemplate(tpl)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted/50 hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors">
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => handleDeleteTemplate(tpl)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted/50 hover:text-rose-500 hover:bg-rose-500/10 transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}

            {addingCategory ? (
                <div className="bg-surface rounded-2xl border border-border-subtle p-4 flex items-center gap-3">
                    <input autoFocus value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                        placeholder={l('კატეგორიის სახელი', 'Название категории', 'Category name')}
                        className="flex-1 bg-white border border-border-subtle rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500/50" />
                    <button onClick={handleAddCategory} disabled={!newCategoryName.trim()} className="px-4 py-2.5 bg-indigo-600 text-white text-xs font-black rounded-xl disabled:opacity-50">
                        {l('შექმნა', 'Создать', 'Create')}
                    </button>
                    <button onClick={() => { setAddingCategory(false); setNewCategoryName(''); }} className="px-4 py-2.5 text-xs font-black text-muted hover:bg-surface rounded-xl">
                        {l('გაუქმება', 'Отмена', 'Cancel')}
                    </button>
                </div>
            ) : (
                <button onClick={() => setAddingCategory(true)}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-border-subtle text-muted hover:border-indigo-500/40 hover:text-indigo-500 transition-colors text-xs font-black">
                    <Plus className="w-4 h-4" /> {l('ახალი კატეგორია', 'Новая категория', 'New Category')}
                </button>
            )}

            {modalState && (
                <TemplateModal
                    open
                    onClose={() => setModalState(null)}
                    categoryId={modalState.categoryId}
                    template={modalState.template}
                    groups={groups}
                    branches={branches}
                    students={students}
                    onSaved={load}
                />
            )}
        </div>
    );
}
