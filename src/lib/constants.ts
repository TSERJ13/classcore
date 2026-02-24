import { OrgType, UserRole } from '@/types';

export const GEO = {
    // Navigation
    dashboard: 'დაფა',
    students: 'სტუდენტები',
    attendance: 'დასწრება',
    groups: 'ჯგუფები',
    settings: 'პარამეტრები',
    profile: 'პროფილი',

    // Common actions
    add: 'დამატება',
    edit: 'რედაქტირება',
    delete: 'წაშლა',
    save: 'შენახვა',
    cancel: 'გაუქმება',
    search: 'ძებნა...',
    filter: 'ფილტრი',
    loading: 'იტვირთება...',
    noData: 'მონაცემი არ არის',
    visit: 'ვიზიტი',
    visits: 'ვიზიტები',

    // Dashboard
    totalStudents: 'სულ სტუდენტები',
    activeSubscriptions: 'აქტიური სააბონემენტო',
    todayAttendance: 'დღევანდელი დასწრება',
    monthlyRevenue: 'ყოველთვიური შემოსავალი',
    recentActivity: 'ბოლო აქტივობა',
    quickActions: 'სწრაფი მოქმედებები',

    // Students
    addStudent: 'სტუდენტის დამატება',
    studentName: 'სახელი',
    studentPhone: 'ტელეფონი',
    studentGroup: 'ჯგუფი',
    studentStatus: 'სტატუსი',
    studentSubscription: 'სააბონემენტო',
    lastVisit: 'ბოლო ვიზიტი',
    medicalCert: 'სამედიცინო ცნობა',
    certExpires: 'ვადა',
    partner: 'პარტნიორი',
    categories: 'კატეგორიები',
    allStudents: 'ყველა სტუდენტი',

    // Attendance
    markAttendance: 'დასწრების მონიშვნა',
    present: 'დამსწრე',
    absent: 'არ დამსწრე',
    selectDate: 'თარიღის არჩევა',
    selectGroup: 'ჯგუფის არჩევა',
    markAllPresent: 'ყველა დამსწრედ მონიშვნა',
    attendanceSheet: 'დასწრების ფურცელი',
    notes: 'შენიშვნა',

    // Roles
    admin: 'ადმინი',
    coach: 'მწვრთნელი',
    student: 'სტუდენტი',

    // Core types for ClassCore
    dance: 'საცეკვაო სტუდია',
    sports: 'სასპორტო სკოლა',
    yoga: 'იოგა ცენტრი',
    fitness: 'ფიტნეს სტუდია',

    // Subscription statuses
    active: 'აქტიური',
    expired: 'ვადაგასული',
    paused: 'შეჩერებული',

    // Auth
    login: 'შესვლა',
    logout: 'გამოსვლა',
    email: 'ელ. ფოსტა',
    password: 'პაროლი',
    signIn: 'სისტემაში შესვლა',
    telegramLogin: 'Telegram-ით შესვლა',
    welcomeBack: 'კეთილი დაბრუნება',
    signInToContinue: 'გაგრძელებისთვის შედით სისტემაში',

    // App
    appName: 'ClassCore',
    tagline: 'სტუდიის მართვა - ახალ დონეზე',
} as const;

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
    dance: GEO.dance,
    sports: GEO.sports,
    yoga: GEO.yoga,
    fitness: GEO.fitness,
};

export const ROLE_LABELS: Record<UserRole, string> = {
    admin: GEO.admin,
    coach: GEO.coach,
    student: GEO.student,
};

export const NAV_ITEMS = [
    { href: '/dashboard', label: GEO.dashboard, icon: 'LayoutDashboard' },
    { href: '/students', label: GEO.students, icon: 'Users' },
    { href: '/attendance', label: GEO.attendance, icon: 'CalendarCheck' },
    { href: '/groups', label: GEO.groups, icon: 'BookOpen' },
    { href: '/settings', label: GEO.settings, icon: 'Settings' },
] as const;
