/**
 * Dashboard widget catalog + slot layout — owner asked to make the
 * dashboard's blocks into swappable widgets, managed studio-wide (every
 * staff member sees the same layout) directly from the Dashboard page
 * (not a separate Settings screen).
 *
 * Deliberately NOT a free drag-and-drop grid: the owner's own description
 * of what they want ("every slot should have its own options") is a
 * content-swap within a fixed layout, not free repositioning/resizing —
 * so this reuses the existing settings-sync infrastructure
 * (StudioContext's `updateSettings`) instead of a new grid library, new
 * table, or new Server Action. `settings.dashboardWidgets` is a plain
 * `{ slotId: widgetKey }` map, persisted exactly like every other studio
 * setting (pausePrices, enabledFeatures, ...).
 *
 * Each slot has a fixed SIZE (its visual shape/position never changes) —
 * only which widget of that size occupies it can be swapped.
 */

export type WidgetSlotSize = 'stat' | 'large' | 'side' | 'bottom';

export type SlotId = 'stat1' | 'stat2' | 'stat3' | 'stat4' | 'mainLarge' | 'sideTop' | 'sideBottom' | 'bottom1' | 'bottom2' | 'bottom3';

export const SLOT_SIZES: Record<SlotId, WidgetSlotSize> = {
    stat1: 'stat', stat2: 'stat', stat3: 'stat', stat4: 'stat',
    mainLarge: 'large',
    sideTop: 'side', sideBottom: 'side',
    bottom1: 'bottom', bottom2: 'bottom', bottom3: 'bottom',
};

export interface WidgetDef {
    key: string;
    size: WidgetSlotSize;
    label: { ka: string; ru: string; en: string };
}

export const WIDGET_CATALOG: WidgetDef[] = [
    // stat-sized (the 4 top donut cards)
    { key: 'students', size: 'stat', label: { ka: 'სტუდენტები', ru: 'Студенты', en: 'Students' } },
    { key: 'revenue', size: 'stat', label: { ka: 'თვის შემოსავალი', ru: 'Доход за месяц', en: 'Monthly Revenue' } },
    { key: 'subscriptions', size: 'stat', label: { ka: 'აბონემენტები', ru: 'Абонементы', en: 'Subscriptions' } },
    { key: 'attendance', size: 'stat', label: { ka: 'დღევანდელი დასწრება', ru: 'Посещаемость сегодня', en: "Today's Attendance" } },
    // large slot
    { key: 'todaySchedule', size: 'large', label: { ka: 'დღევანდელი განრიგი', ru: 'Расписание', en: "Today's Schedule" } },
    // side slots
    { key: 'quickActions', size: 'side', label: { ka: 'სასწრაფო მოქმედებები', ru: 'Быстрые действия', en: 'Quick Actions' } },
    { key: 'todaySummary', size: 'side', label: { ka: 'დღევანდელი შედეგები', ru: 'Итоги дня', en: "Today's Summary" } },
    // bottom slots
    { key: 'upcomingEvents', size: 'bottom', label: { ka: 'მოსალოდნელი ღონისძიებები', ru: 'Ближайшие события', en: 'Upcoming Events' } },
    { key: 'recentActivity', size: 'bottom', label: { ka: 'ბოლო აქტივობა', ru: 'Последняя активность', en: 'Recent Activity' } },
    { key: 'groupProgress', size: 'bottom', label: { ka: 'ჯგუფების დატვირთვა', ru: 'Заполненность групп', en: 'Group Progress' } },
];

export const DEFAULT_DASHBOARD_LAYOUT: Record<SlotId, string> = {
    stat1: 'students', stat2: 'revenue', stat3: 'subscriptions', stat4: 'attendance',
    mainLarge: 'todaySchedule',
    sideTop: 'quickActions', sideBottom: 'todaySummary',
    bottom1: 'upcomingEvents', bottom2: 'recentActivity', bottom3: 'groupProgress',
};

export function resolveSlotWidget(dashboardWidgets: Record<string, string> | undefined, slot: SlotId): string {
    return dashboardWidgets?.[slot] || DEFAULT_DASHBOARD_LAYOUT[slot];
}

export function widgetsForSize(size: WidgetSlotSize): WidgetDef[] {
    return WIDGET_CATALOG.filter(w => w.size === size);
}

export function widgetLabel(key: string, lang: 'ka' | 'ru' | 'en'): string {
    const w = WIDGET_CATALOG.find(x => x.key === key);
    return w ? w.label[lang] : key;
}
