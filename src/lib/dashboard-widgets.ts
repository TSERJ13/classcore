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

export type WidgetCategory = 'stat' | 'large' | 'content';

export interface WidgetDef {
    key: string;
    category: WidgetCategory;
    label: { ka: string; ru: string; en: string };
}

export const WIDGET_CATALOG: WidgetDef[] = [
    // stat-sized (the 4 top donut cards)
    { key: 'students', category: 'stat', label: { ka: 'სტუდენტები', ru: 'Студенты', en: 'Students' } },
    { key: 'revenue', category: 'stat', label: { ka: 'თვის შემოსავალი', ru: 'Доход за месяц', en: 'Monthly Revenue' } },
    { key: 'subscriptions', category: 'stat', label: { ka: 'აბონემენტები', ru: 'Абонементы', en: 'Subscriptions' } },
    { key: 'attendance', category: 'stat', label: { ka: 'დღევანდელი დასწრება', ru: 'Посещаемость сегодня', en: "Today's Attendance" } },

    // Large-only widgets (cannot go into small side/bottom slots)
    { key: 'todaySchedule', category: 'large', label: { ka: 'დღევანდელი განრიგი', ru: 'Расписание на сегодня', en: "Today's Schedule" } },
    { key: 'todayAttendance', category: 'large', label: { ka: 'დასწრება', ru: 'Посещаемость', en: 'Attendance' } },
    { key: 'calendar', category: 'large', label: { ka: 'კალენდარი', ru: 'Календарь', en: 'Calendar' } },
    { key: 'aiAnalytics', category: 'large', label: { ka: 'AI ანალიტიკა', ru: 'AI Аналитика', en: 'AI Analytics' } },

    // Content widgets (can go into side slots and bottom slots)
    { key: 'quickActions', category: 'content', label: { ka: 'სასწრაფო მოქმედებები', ru: 'Быстрые действия', en: 'Quick Actions' } },
    { key: 'todaySummary', category: 'content', label: { ka: 'დღევანდელი შედეგები', ru: 'Итоги дня', en: "Today's Summary" } },
    { key: 'upcomingEvents', category: 'content', label: { ka: 'მოსალოდნელი ღონისძიებები', ru: 'Ближайшие события', en: 'Upcoming Events' } },
    { key: 'recentActivity', category: 'content', label: { ka: 'ბოლო აქტივობა', ru: 'Последняя активность', en: 'Recent Activity' } },
    { key: 'groupProgress', category: 'content', label: { ka: 'ჯგუფების დატვირთვა', ru: 'Заполненность групп', en: 'Group Progress' } },
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
    if (size === 'stat') {
        return WIDGET_CATALOG.filter(w => w.category === 'stat');
    }
    if (size === 'large') {
        // Large slot offers ONLY: todaySchedule, todayAttendance, calendar, aiAnalytics
        return WIDGET_CATALOG.filter(w => w.category === 'large');
    }
    // Side and bottom slots accept all content widgets
    return WIDGET_CATALOG.filter(w => w.category === 'content');
}

export function widgetLabel(key: string, lang: 'ka' | 'ru' | 'en'): string {
    const w = WIDGET_CATALOG.find(x => x.key === key);
    return w ? w.label[lang] : key;
}
