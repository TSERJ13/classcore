// Core types for ClassCore

export type OrgType = 'dance' | 'sports' | 'yoga' | 'fitness';

export type ThemeKey = 'indigo' | 'violet' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'fuchsia';

export type StaffRole = 'owner' | 'manager' | 'teacher';

export interface StaffPermissions {
    canViewAttendance: boolean;
    canViewSubscriptions: boolean;
    canViewStudents: boolean;
    canViewCalendar: boolean;
    canEditCalendar: boolean;
    canViewGroups: boolean;
    canViewTeachers: boolean;
    canViewHalls: boolean;
    canViewShop: boolean;
    canViewAnalytics: boolean;
    canViewSMS: boolean;
    // Legacy / Admin
    canAddStudents?: boolean;
    canDeleteRecords?: boolean;
    manageBilling?: boolean;
    viewFinancials?: boolean;
    manageInventory?: boolean;
}

export interface TrashItem {
    id: string;
    type: 'student' | 'subscription' | 'sale' | 'staff' | 'hall';
    data: any;
    branchId: string;
    sms_templates?: Record<string, Record<string, string>>;
    owner_info?: {
        first_name?: string;
        last_name?: string;
        email?: string;
        phone?: string;
        client_id?: string;
    };
    deletedAt: string;
    deletedBy: string;
}

export interface SubscriptionLog {
    id: string;
    studentId: string;
    studentName: string;
    planName: string;
    amount: number;
    paymentMethod?: 'cash' | 'card' | 'transfer';
    category?: string;
    date: string;
    issuedBy: string;
    issuedByName?: string;
    branchId: string;
    branchName?: string;
    groupName?: string;
}

export interface StaffMember {
    id: string;
    org_id: string;
    full_name: string;
    first_name?: string;
    last_name?: string;
    phone: string;
    phone_number?: string;
    email?: string;
    password?: string;
    role: StaffRole | string;
    permissions: StaffPermissions;
    photo_url?: string;
    allowedBranchIds?: string[];
    // Teacher specific
    specialty?: string[];
    bio?: string;
    rate_per_hour?: number;
    rate_per_month?: number;
    salary_percentage?: number;
    assigned_group_ids?: string[];
    assigned_individual?: boolean;
    status: 'active' | 'on_leave' | 'inactive';
    created_at: string;
}

export interface Branch {
    id: string;
    name: string;
    address?: string;
    is_active: boolean;
    created_at?: string;
}

export interface StudioSettings {
    orgId?: string;               // Persistent UUID for the studio
    suspended?: boolean;          // Platform-level lock
    studioName: string;
    studioSlug: string;
    isWizardCompleted?: boolean;
    logoDataUrl: string | null;   // base64 image or null
    plan?: 'trial' | 'pro' | 'custom';
    currency: 'GEL' | 'USD' | 'EUR';
    language: 'ka' | 'ru' | 'en';
    timezone: string;
    googleCalendarEnabled: boolean;
    themeKey: ThemeKey;
    accentColor: string;          // CSS HSL value
    notifications: {
        newStudent: boolean;
        lowSessions: boolean;
        dailyReport: boolean;
        telegramBot: boolean;
        autoSms: boolean;
    };
    security: {
        twoFactor: boolean;
        sessionTimeout: number; // minutes
    };
    pausePrices: {
        '7': number;
        '14': number;
        '30': number;
        '60': number;
    };
    landingContent: {
        heroTitle: string;
        heroSubtitle: string;
        features: Array<{ title: string; desc: string; icon: string }>;
    };
    sms_templates: {
        ka: {
            expiration_day_0: string;
            low_visits: string;
            birthday: string;
            new_year: string;
            easter: string;
            march_8: string;
            sept_1: string;
        };
        ru: {
            expiration_day_0: string;
            low_visits: string;
            birthday: string;
            new_year: string;
            easter: string;
            march_8: string;
            sept_1: string;
        };
        en: {
            expiration_day_0: string;
            low_visits: string;
            birthday: string;
            new_year: string;
            easter: string;
            march_8: string;
            sept_1: string;
        };
    };
    sms_enabled: boolean;
    primary_lang?: 'ka' | 'ru' | 'en';
    owner_info: {
        first_name: string;
        last_name: string;
        email: string;
        phone: string;
        client_id?: string;
    } | null;
    updatedAt?: string;
    cabinetCode?: string;
    customRoles?: string[];
    branches: Branch[];
    staff: StaffMember[];
    trash?: TrashItem[];
    subscriptionLogs?: SubscriptionLog[];
    subscription_plans?: any[]; // For recovery/sync
    halls?: any[];              // For recovery/sync
    // Non-synced / Local only
    activeBranchId: string;
}

// ─── Hall / Room ────────────────────────────────────────────────
export interface Hall {
    id: string;
    org_id: string;
    name: string;
    capacity?: number;
    sq_meters?: number;
    color: string;        // hex or tailwind color token
    photo_url?: string;
    description?: string;
    is_active: boolean;
    created_at: string;
}

// ─── Calendar Event ─────────────────────────────────────────────
export type EventType = 'group_class' | 'individual' | 'rental' | 'other';

export interface CalendarEvent {
    id: string;
    org_id: string;
    title: string;
    type: EventType;
    hall_id?: string;
    teacher_id?: string;
    secondary_teacher_id?: string;
    group_id?: string;
    student_id?: string;  // for individual
    date: string;         // YYYY-MM-DD
    start_time: string;   // HH:MM
    end_time: string;     // HH:MM
    color?: string;
    notes?: string;
    recurring?: 'none' | 'weekly';
    reminder_30m?: boolean;
    created_at: string;
}

export type UserRole = 'admin' | 'coach' | 'student';

export type SubscriptionStatus = 'active' | 'expired' | 'paused' | 'cancelled';

export type PlatformPlanStatus = 'trial' | 'active' | 'expired' | 'cancelled';

// ─── Organization ──────────────────────────────────────────────
export interface Organization {
    id: string;
    name: string;
    org_type: OrgType;
    owner_id: string;
    trial_ends_at: string;
    platform_plan: 'starter' | 'growth' | 'enterprise';
    platform_plan_status: PlatformPlanStatus;
    created_at: string;
}

// ─── Student ───────────────────────────────────────────────────
export interface Student {
    id: string;
    org_id: string;
    full_name: string; // Keep for convenience/compat
    first_name?: string;
    last_name?: string;
    phone: string;
    email?: string;
    birth_date?: string;
    notes?: string;
    parent_name?: string;
    // dance niche
    dance_style?: string;
    // sports/admin niche
    medical_cert_expires_at?: string;
    passport_expires_at?: string;
    // photo & access
    photo_url?: string;
    qr_code?: string;
    nfc_uid?: string;
    // social
    social_links?: {
        facebook?: string;
        instagram?: string;
        telegram?: string;
        whatsapp?: string;
    };
    // status
    status?: 'active' | 'inactive' | 'lead';
    // group enrollments
    enrolled_group_ids?: string[];
    // language preference
    preferred_language?: 'ka' | 'ru' | 'en';
    // balance / credit (overpayments)
    balance?: number;
    // notifications
    sms_reminders?: boolean;
    // branch
    branch_id?: string;
    gender?: 'male' | 'female';
    contact_person?: string;
    discount_type?: 'fixed' | 'percent';
    discount_value?: number;
    created_at: string;
}

export type StudentPatch = Partial<Student>;

// ─── Group ─────────────────────────────────────────────────────
export interface Group {
    id: string;
    org_id: string;
    name: string;
    coach_name?: string;
    schedule?: string; // e.g. "Mon/Wed/Fri 18:00"
    capacity?: number;
    color?: string;
    created_at: string;
}

// ─── Subscription Plans ────────────────────────────────────────
export type SubscriptionType = 'group' | 'individual' | 'rental';
export type SessionPeriod = 'sessions' | 'monthly' | 'unlimited';

export interface SubscriptionPlan {
    id: string;
    org_id: string;
    name: string;
    type: SubscriptionType;
    period: SessionPeriod;
    session_count?: number;   // null = unlimited
    validity_days?: number;   // calendar validity
    price: number;            // in GEL
    coach_name?: string;      // for individual plans
    group_id?: string;        // for group plans
    is_active: boolean;
    created_at: string;
}

export interface StudentSubscription {
    id: string;
    student_id: string;
    plan_id: string;
    plan?: SubscriptionPlan;
    student?: Student;
    sessions_total?: number;
    sessions_used: number;
    started_at: string;
    expires_at: string;
    status: SubscriptionStatus;
    paid: boolean;
    amount_paid: number;
}

// ─── Attendance ────────────────────────────────────────────────
export interface AttendanceRecord {
    id: string;
    student_id: string;
    group_id?: string;
    org_id: string;
    date: string;
    status: 'present' | 'absent';
    notes?: string;
}

// ─── Hall Rental ───────────────────────────────────────────────
export type RentalType = 'hourly' | 'multiday' | 'monthly';
export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'cancelled';

export interface HallRental {
    id: string;
    org_id: string;
    renter_name: string;
    renter_phone: string;
    renter_email?: string;
    hall_name?: string;      // if multiple halls
    rental_type: RentalType;
    start_date: string;
    end_date: string;
    start_time?: string;     // for hourly
    end_time?: string;       // for hourly
    total_price: number;
    deposit: number;
    payment_status: PaymentStatus;
    event_type?: string;     // party, rehearsal, etc.
    contract_url?: string;   // PDF or image
    notes?: string;
    created_at: string;
}

// ─── Teacher / Staff ───────────────────────────────────────────
export type TeacherStatus = 'active' | 'on_leave' | 'inactive';

export interface Teacher {
    id: string;
    org_id: string;
    first_name: string;
    last_name: string;
    full_name?: string;           // Optional for backward compatibility
    role?: string;                // Role: Teacher, Accountant, etc.
    phone: string;
    email?: string;
    specialty: string[];          // e.g. ['Contemporary', 'Ballet']
    bio?: string;
    photo_url?: string;
    rate_per_hour?: number;       // GEL per hour (for individual lessons)
    rate_per_month?: number;      // GEL flat (for groups)
    salary_percentage?: number;   // percentage share of revenue
    password?: string;            // For personal access
    assigned_group_ids: string[]; // group IDs
    working_schedule?: any[];     // availability slots [{dayOfWeek, startTime, endTime}]
    assigned_individual: boolean; // takes individual sessions?
    status: TeacherStatus;
    allowedBranchIds?: string[]; // Standardized camelCase
    permissions?: {
        canViewAttendance: boolean;
        canViewSubscriptions: boolean;
        canViewStudents: boolean;
        canViewCalendar: boolean;
        canEditCalendar: boolean;
        canViewGroups: boolean;
        canViewTeachers: boolean;
        canViewHalls: boolean;
        canViewShop: boolean;
        canViewAnalytics: boolean;
        canViewSMS: boolean;
    };
    created_at: string;
}

// ─── Platform Subscription (SaaS) ─────────────────────────────
export type SaasBillingPeriod = 'monthly' | 'annual';

export interface PlatformSubscription {
    id: string;
    org_id: string;
    plan: 'starter' | 'growth' | 'enterprise';
    billing_period: SaasBillingPeriod;
    amount: number;
    status: PlatformPlanStatus;
    trial_ends_at: string;
    current_period_ends_at: string;
    payment_gateway: 'flitt' | 'tbc' | 'bog' | null;
    gateway_subscription_id?: string;
}

// ─── Client Portal Token ───────────────────────────────────────
export interface ClientAccessToken {
    id: string;
    student_id: string;
    token: string;
    expires_at: string;
    created_at: string;
}
// ─── Shop / Inventory ──────────────────────────────────────────
export interface Product {
    id: string;
    org_id: string;
    name: string;
    category?: string;
    description?: string;
    price: number;
    cost_price?: number;
    quantity: number;
    size?: string;
    weight?: string;
    color?: string;
    photo_url?: string;
    is_active: boolean;
    created_at: string;
}

export interface Sale {
    id: string;
    org_id: string;
    student_id: string;
    items: {
        product_id: string;
        quantity: number;
        price_at_sale: number;
    }[];
    total_amount: number;
    payment_method: 'cash' | 'card' | 'transfer' | 'balance';
    notes?: string;
    created_at: string;
}
