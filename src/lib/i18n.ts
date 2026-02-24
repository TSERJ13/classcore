export type Lang = 'ka' | 'ru' | 'en';

export interface Translations {
    // Navigation — core
    dashboard: string;
    students: string;
    attendance: string;
    groups: string;
    settings: string;
    // Navigation — new pages
    calendar: string;
    teachers: string;
    halls: string;
    hallRental: string;
    subscriptions: string;
    analytics: string;
    billing: string;
    // Nav section labels
    navSectionLearning: string;
    navSectionStructure: string;
    navSectionFinance: string;
    navSectionReports: string;
    navSectionSystem: string;
    // Actions
    add: string;
    edit: string;
    delete: string;
    save: string;
    cancel: string;
    search: string;
    filter: string;
    loading: string;
    noData: string;
    visit: string;
    visits: string;
    categories: string;
    // Dashboard
    totalStudents: string;
    activeSubscriptions: string;
    todayAttendance: string;
    monthlyRevenue: string;
    recentActivity: string;
    quickActions: string;
    welcomeBack: string;
    // Students
    addStudent: string;
    studentName: string;
    studentPhone: string;
    studentGroup: string;
    studentStatus: string;
    lastVisit: string;
    medicalCert: string;
    partner: string;
    danceStyle: string;
    allStudents: string;
    // Attendance
    markAttendance: string;
    present: string;
    absent: string;
    selectDate: string;
    selectGroup: string;
    markAllPresent: string;
    attendanceSheet: string;
    notes: string;
    clear: string;
    // Statuses
    active: string;
    expired: string;
    paused: string;
    inactive: string;
    onLeave: string;
    // Teachers
    addTeacher: string;
    teacherName: string;
    specialty: string;
    ratePerHour: string;
    ratePerMonth: string;
    individual: string;
    assignedGroups: string;
    teacherStatus: string;
    // Halls
    addHall: string;
    hallName: string;
    capacity: string;
    hallColor: string;
    hallStatus: string;
    lessonsPerWeek: string;
    // Calendar
    addEvent: string;
    weekView: string;
    monthView: string;
    todayBtn: string;
    allHalls: string;
    allTeachers: string;
    exportCalendar: string;
    groupClass: string;
    individualClass: string;
    rental: string;
    recurring: string;
    oneTime: string;
    everyWeek: string;
    // Hall Rental
    addRental: string;
    rentalType: string;
    hourly: string;
    multiDay: string;
    monthly: string;
    totalRevenue: string;
    paidAmount: string;
    // Subscriptions
    addPlan: string;
    planName: string;
    price: string;
    sessions: string;
    validDays: string;
    // Analytics
    revenue: string;
    revenueBySource: string;
    studentGrowth: string;
    attendanceRate: string;
    teacherLoad: string;
    exportExcel: string;
    exportPdf: string;
    // Auth
    login: string;
    logout: string;
    email: string;
    password: string;
    signIn: string;
    telegramLogin: string;
    signInToContinue: string;
    // Org types
    dance: string;
    sports: string;
    yoga: string;
    fitness: string;
    // Misc
    language: string;
    todayDate: string;
    viewAll: string;
    goTo: string;
    linkedPages: string;
    // Hall-rental extra
    paid: string;
    // Billing
    billingHeading: string;
    billingSubheading: string;
    billingMonthly: string;
    billingAnnual: string;
    billingPerMonth: string;
    billingPerYear: string;
    billingSave: string;
    billingTrialDays: string;
    billingTrialWarn: string;
    billingPayMethod: string;
    billingSecure: string;
    billingProceed: string;
    billingSelectStarter: string;
    billingSelectGrowth: string;
    billingContact: string;
    billingF150: string;
    billingFSubs: string;
    billingFAtt: string;
    billingFApp: string;
    billingFAdmin: string;
    billingFUnlim: string;
    billingFRental: string;
    billingFPortal: string;
    billingFReports: string;
    billingFEverything: string;
    // Settings sections
    settingsOrg: string;
    settingsOrgDesc: string;
    settingsNotif: string;
    settingsNotifDesc: string;
    settingsLang: string;
    settingsLangDesc: string;
    settingsSecurity: string;
    settingsSecDesc: string;
    settingsSubDesc: string;
    settingsTelegramDesc: string;
    collapse: string;
    expand: string;
}

export const translations: Record<Lang, Translations> = {
    ka: {
        // Nav core
        dashboard: 'დაფა',
        students: 'სტუდენტები',
        attendance: 'დასწრება',
        groups: 'ჯგუფები',
        settings: 'პარამეტრები',
        // Nav new
        calendar: 'კალენდარი',
        teachers: 'მასწავლებლები',
        halls: 'დარბაზები',
        hallRental: 'გაქირავება',
        subscriptions: 'აბონიმენტები',
        analytics: 'ანალიტიკა',
        billing: 'ბილინგი',
        // Nav sections
        navSectionLearning: 'სასწავლო',
        navSectionStructure: 'სტრუქტურა',
        navSectionFinance: 'ფინანსები',
        navSectionReports: 'მოხსენება',
        navSectionSystem: 'სისტემა',
        // Actions
        add: 'დამატება',
        edit: 'ჩასწ.',
        delete: 'წაშლა',
        save: 'შენახვა',
        cancel: 'გაუქმება',
        search: 'ძებნა...',
        filter: 'ფილტრი',
        loading: 'იტვირთება...',
        noData: 'მონაცემი ვერ მოიძებნა',
        visit: 'ვიზიტი',
        visits: 'ვიზიტები',
        categories: 'კატეგორიები',
        // Dashboard
        totalStudents: 'სულ სტუდ.',
        activeSubscriptions: 'აქტ. გამოწ.',
        todayAttendance: 'დღეს დასწ.',
        monthlyRevenue: 'თვ. შემოს.',
        recentActivity: 'ბოლო აქტ.',
        quickActions: 'სწრაფი მოქ.',
        welcomeBack: 'კეთილი მო.',
        // Students
        addStudent: 'სტუდ. დამ.',
        studentName: 'სახელი',
        studentPhone: 'ტელ.',
        studentGroup: 'ჯგუფი',
        studentStatus: 'სტატ.',
        lastVisit: 'ბოლო ვიზ.',
        medicalCert: 'სამ. ცნობა',
        partner: 'პარტნ.',
        danceStyle: 'სტილი',
        allStudents: 'სულ სტუდ.',
        // Attendance
        markAttendance: 'დასწ. მონ.',
        present: 'დამსწ.',
        absent: 'არ დამსწ.',
        selectDate: 'თარ. არჩ.',
        selectGroup: 'ჯგ. არჩ.',
        markAllPresent: 'ყველა დამსწ.',
        attendanceSheet: 'სია',
        notes: 'შენიშვნა',
        clear: 'გასუფ.',
        // Statuses
        active: 'აქტიური',
        expired: 'ვადაგასული',
        paused: 'შეჩ.',
        inactive: 'არააქტ.',
        onLeave: 'შვებ.',
        // Teachers
        addTeacher: 'მასწ. დამ.',
        teacherName: 'სახელი',
        specialty: 'სპეც.',
        ratePerHour: 'ანაზ./სთ',
        ratePerMonth: 'ანაზ./თვ.',
        individual: 'ინდ. სეს.',
        assignedGroups: 'ჯგ.',
        teacherStatus: 'სტატ.',
        // Halls
        addHall: 'დარბ. დამ.',
        hallName: 'სახელი',
        capacity: 'ტევ.',
        hallColor: 'ფერი',
        hallStatus: 'სტატ.',
        lessonsPerWeek: 'გაკ./კვ.',
        // Calendar
        addEvent: 'ღონ. დამ.',
        weekView: 'კვ.',
        monthView: 'თვ.',
        todayBtn: 'დღეს',
        allHalls: 'ყველა დარბ.',
        allTeachers: 'ყველა მასწ.',
        exportCalendar: 'ექსპ.',
        groupClass: 'ჯგ. გაკ.',
        individualClass: 'ინდ. გაკ.',
        rental: 'გაქ.',
        recurring: 'გამ.',
        oneTime: 'ერთჯ.',
        everyWeek: 'ყ. კვ.',
        // Hall Rental
        addRental: 'ჯავშ. დამ.',
        rentalType: 'ტიპი',
        hourly: 'საათ.',
        multiDay: 'მრ. დღ.',
        monthly: 'თვ.',
        totalRevenue: 'სულ შემ.',
        paidAmount: 'გადახ.',
        // Subscriptions
        addPlan: 'გეგ. დამ.',
        planName: 'გეგ. სახ.',
        price: 'ფასი',
        sessions: 'სეს.',
        validDays: 'ვალ. დღ.',
        // Analytics
        revenue: 'შემ.',
        revenueBySource: 'შემ. წყ.',
        studentGrowth: 'სტ. ზრდა',
        attendanceRate: 'დასწ. %',
        teacherLoad: 'მასწ. ტვ.',
        exportExcel: 'Excel',
        exportPdf: 'PDF',
        // Auth
        login: 'შესვლა',
        logout: 'გამოს.',
        email: 'ელ. ფოსტა',
        password: 'პაროლი',
        signIn: 'სისტ. შ.',
        telegramLogin: 'Telegram-ით',
        signInToContinue: 'გასაგ. შედი',
        // Org
        dance: 'საცეკვაო სტ.',
        sports: 'სასპ. სკ.',
        yoga: 'იოგა',
        fitness: 'ფიტნეს',
        // Misc
        language: 'ენა',
        todayDate: 'დღეს',
        viewAll: 'ყველა',
        goTo: 'გადასვლა',
        linkedPages: 'დაკ. გვ.',
        // Hall-rental extra
        paid: 'გადახდილი',
        // Billing
        billingHeading: 'გამოიწერე ClassCore',
        billingSubheading: 'მარტივი ფასი. გაუქმება ნებისმიერ დროს.',
        billingMonthly: 'ყოველთვიური',
        billingAnnual: 'წლიური',
        billingPerMonth: 'თვე',
        billingPerYear: 'წელი',
        billingSave: 'ზოგავ',
        billingTrialDays: 'დღე დარჩა საცდელამდე',
        billingTrialWarn: 'პერიოდის ამოწურვის შემდეგ ანგარიში დაბლოკდება.',
        billingPayMethod: 'გადახდის მეთოდი',
        billingSecure: 'გადახდა SSL-ით დაცულია.',
        billingProceed: 'გადახდის გვერდზე',
        billingSelectStarter: 'Starter-ის არჩევა',
        billingSelectGrowth: 'Growth-ის არჩევა',
        billingContact: 'კავშირი',
        billingF150: '150 სტუდენტამდე',
        billingFSubs: 'აბონიმენტის მართვა',
        billingFAtt: 'დასწრება',
        billingFApp: 'მობილური აპლ.',
        billingFAdmin: 'ადმინი',
        billingFUnlim: 'შეუზღუდავი სტუდენტი',
        billingFRental: 'დარბაზის გაქირავება',
        billingFPortal: 'კლიენტ პორტალი',
        billingFReports: 'ანგარიშები / PDF',
        billingFEverything: 'ყველაფერი Growth-ში',
        // Settings
        settingsOrg: 'ორგანიზაცია',
        settingsOrgDesc: 'სახელი, ლოგო, ტიპი',
        settingsNotif: 'შეტყობინებები',
        settingsNotifDesc: 'Telegram, ელ. ფოსტა',
        settingsLang: 'ენა და რეგიონი',
        settingsLangDesc: 'ქართული · GMT+4',
        settingsSecurity: 'უსაფრთხოება',
        settingsSecDesc: 'პაროლი, 2FA',
        settingsSubDesc: 'ტარიფები, ვადები',
        settingsTelegramDesc: 'ავტ. შეტყ. სტუდენტებს · @studioflow_bot',
        collapse: 'დაკეცვა',
        expand: 'გაფართოება',
    },

    ru: {
        // Nav core
        dashboard: 'Дашборд',
        students: 'Ученики',
        attendance: 'Посещаемость',
        groups: 'Группы',
        settings: 'Настройки',
        // Nav new
        calendar: 'Календарь',
        teachers: 'Преподаватели',
        halls: 'Залы',
        hallRental: 'Аренда зала',
        subscriptions: 'Абонементы',
        analytics: 'Аналитика',
        billing: 'Оплата',
        // Nav sections
        navSectionLearning: 'Учебный',
        navSectionStructure: 'Структура',
        navSectionFinance: 'Финансы',
        navSectionReports: 'Отчёты',
        navSectionSystem: 'Система',
        // Actions
        add: 'Добавить',
        edit: 'Ред.',
        delete: 'Удалить',
        save: 'Сохранить',
        cancel: 'Отмена',
        search: 'Поиск...',
        filter: 'Фильтр',
        loading: 'Загрузка...',
        noData: 'Данные не найдены',
        visit: 'Визит',
        visits: 'Визиты',
        categories: 'Категории',
        // Dashboard
        totalStudents: 'Всего учен.',
        activeSubscriptions: 'Акт. абон.',
        todayAttendance: 'Сегодня',
        monthlyRevenue: 'Доход/мес.',
        recentActivity: 'Активность',
        quickActions: 'Быстрые',
        welcomeBack: 'Добро пожаловать',
        // Students
        addStudent: 'Доб. ученика',
        studentName: 'Имя',
        studentPhone: 'Телефон',
        studentGroup: 'Группа',
        studentStatus: 'Статус',
        lastVisit: 'Посл. визит',
        medicalCert: 'Мед. справка',
        partner: 'Партнёр',
        danceStyle: 'Стиль',
        allStudents: 'всего уч.',
        // Attendance
        markAttendance: 'Отм. посещ.',
        present: 'Присут.',
        absent: 'Отсут.',
        selectDate: 'Дата',
        selectGroup: 'Группа',
        markAllPresent: 'Все присут.',
        attendanceSheet: 'Журнал',
        notes: 'Примечание',
        clear: 'Очистить',
        // Statuses
        active: 'Активный',
        expired: 'Истёк',
        paused: 'Пауза',
        inactive: 'Неакт.',
        onLeave: 'Отпуск',
        // Teachers
        addTeacher: 'Доб. препод.',
        teacherName: 'Имя',
        specialty: 'Специал.',
        ratePerHour: 'Тариф/час',
        ratePerMonth: 'Тариф/мес.',
        individual: 'Инд. сесс.',
        assignedGroups: 'Группы',
        teacherStatus: 'Статус',
        // Halls
        addHall: 'Доб. зал',
        hallName: 'Название',
        capacity: 'Вместим.',
        hallColor: 'Цвет',
        hallStatus: 'Статус',
        lessonsPerWeek: 'Урок./нед.',
        // Calendar
        addEvent: 'Доб. событие',
        weekView: 'Нед.',
        monthView: 'Мес.',
        todayBtn: 'Сегодня',
        allHalls: 'Все залы',
        allTeachers: 'Все препод.',
        exportCalendar: 'Экспорт',
        groupClass: 'Гр. занятие',
        individualClass: 'Инд. занятие',
        rental: 'Аренда',
        recurring: 'Повтор',
        oneTime: 'Однокр.',
        everyWeek: 'Каж. нед.',
        // Hall Rental
        addRental: 'Доб. аренду',
        rentalType: 'Тип',
        hourly: 'Почасовой',
        multiDay: 'Неск. дней',
        monthly: 'Месяцами',
        totalRevenue: 'Общий д.',
        paidAmount: 'Оплачено',
        // Subscriptions
        addPlan: 'Доб. план',
        planName: 'Назв. плана',
        price: 'Цена',
        sessions: 'Сесс.',
        validDays: 'Дней',
        // Analytics
        revenue: 'Доход',
        revenueBySource: 'По источн.',
        studentGrowth: 'Рост уч.',
        attendanceRate: 'Посещ. %',
        teacherLoad: 'Нагрузка',
        exportExcel: 'Excel',
        exportPdf: 'PDF',
        // Auth
        login: 'Войти',
        logout: 'Выйти',
        email: 'Эл. почта',
        password: 'Пароль',
        signIn: 'Войти в сист.',
        telegramLogin: 'Через Telegram',
        signInToContinue: 'Войдите для продолжения',
        // Org
        dance: 'Танц. студия',
        sports: 'Спорт. школа',
        yoga: 'Йога-центр',
        fitness: 'Фитнес',
        // Misc
        language: 'Язык',
        todayDate: 'Сегодня',
        viewAll: 'Все',
        goTo: 'Перейти',
        linkedPages: 'Связ. стр.',
        // Hall-rental extra
        paid: 'Оплачено',
        // Billing
        billingHeading: 'Подписаться',
        billingSubheading: 'Простые цены. Отмена в любое время.',
        billingMonthly: 'Ежемесячно',
        billingAnnual: 'Ежегодно',
        billingPerMonth: 'мес',
        billingPerYear: 'год',
        billingSave: 'Экономия',
        billingTrialDays: 'дней осталось',
        billingTrialWarn: 'После окончания аккаунт будет заблокирован.',
        billingPayMethod: 'Способ оплаты',
        billingSecure: 'Оплата защищена SSL.',
        billingProceed: 'Перейти к оплате',
        billingSelectStarter: 'Выбрать Starter',
        billingSelectGrowth: 'Выбрать Growth',
        billingContact: 'Связаться',
        billingF150: 'До 150 учеников',
        billingFSubs: 'Управление абон.',
        billingFAtt: 'Посещаемость',
        billingFApp: 'Мобильное прил.',
        billingFAdmin: 'админ',
        billingFUnlim: 'Неогранич. учеников',
        billingFRental: 'Аренда залов',
        billingFPortal: 'Портал клиента',
        billingFReports: 'Отчёты / PDF',
        billingFEverything: 'Всё из Growth',
        // Settings
        settingsOrg: 'Организация',
        settingsOrgDesc: 'Название, лого, тип',
        settingsNotif: 'Уведомления',
        settingsNotifDesc: 'Telegram, Email',
        settingsLang: 'Язык и регион',
        settingsLangDesc: 'Русский · GMT+4',
        settingsSecurity: 'Безопасность',
        settingsSecDesc: 'Пароль, 2FA',
        settingsSubDesc: 'Тарифы, сроки',
        settingsTelegramDesc: 'Авто. увед. ученикам · @studioflow_bot',
        collapse: 'Свернуть',
        expand: 'Развернуть',
    },

    en: {
        // Nav core
        dashboard: 'Dashboard',
        students: 'Students',
        attendance: 'Attendance',
        groups: 'Groups',
        settings: 'Settings',
        // Nav new
        calendar: 'Calendar',
        teachers: 'Teachers',
        halls: 'Halls',
        hallRental: 'Hall Rental',
        subscriptions: 'Subscriptions',
        analytics: 'Analytics',
        billing: 'Billing',
        // Nav sections
        navSectionLearning: 'Learning',
        navSectionStructure: 'Structure',
        navSectionFinance: 'Finance',
        navSectionReports: 'Reports',
        navSectionSystem: 'System',
        // Actions
        add: 'Add',
        edit: 'Edit',
        delete: 'Delete',
        save: 'Save',
        cancel: 'Cancel',
        search: 'Search...',
        filter: 'Filter',
        loading: 'Loading...',
        noData: 'No data found',
        visit: 'Visit',
        visits: 'Visits',
        categories: 'Categories',
        // Dashboard
        totalStudents: 'Total Students',
        activeSubscriptions: 'Active Subs.',
        todayAttendance: "Today's Att.",
        monthlyRevenue: 'Monthly Rev.',
        recentActivity: 'Recent Activity',
        quickActions: 'Quick Actions',
        welcomeBack: 'Welcome back',
        // Students
        addStudent: 'Add Student',
        studentName: 'Name',
        studentPhone: 'Phone',
        studentGroup: 'Group',
        studentStatus: 'Status',
        lastVisit: 'Last Visit',
        medicalCert: 'Medical Cert.',
        partner: 'Partner',
        danceStyle: 'Style',
        allStudents: 'total students',
        // Attendance
        markAttendance: 'Mark Att.',
        present: 'Present',
        absent: 'Absent',
        selectDate: 'Select Date',
        selectGroup: 'Select Group',
        markAllPresent: 'Mark All',
        attendanceSheet: 'Sheet',
        notes: 'Notes',
        clear: 'Clear',
        // Statuses
        active: 'Active',
        expired: 'Expired',
        paused: 'Paused',
        inactive: 'Inactive',
        onLeave: 'On Leave',
        // Teachers
        addTeacher: 'Add Teacher',
        teacherName: 'Name',
        specialty: 'Specialty',
        ratePerHour: 'Rate/hr',
        ratePerMonth: 'Rate/mo.',
        individual: 'Indiv. sessions',
        assignedGroups: 'Groups',
        teacherStatus: 'Status',
        // Halls
        addHall: 'Add Hall',
        hallName: 'Name',
        capacity: 'Capacity',
        hallColor: 'Color',
        hallStatus: 'Status',
        lessonsPerWeek: 'Lessons/wk',
        // Calendar
        addEvent: 'Add Event',
        weekView: 'Wk.',
        monthView: 'Mo.',
        todayBtn: 'Today',
        allHalls: 'All Halls',
        allTeachers: 'All Teachers',
        exportCalendar: 'Export',
        groupClass: 'Group Class',
        individualClass: 'Individual',
        rental: 'Rental',
        recurring: 'Recurring',
        oneTime: 'One-time',
        everyWeek: 'Weekly',
        // Hall Rental
        addRental: 'Add Rental',
        rentalType: 'Type',
        hourly: 'Hourly',
        multiDay: 'Multi-day',
        monthly: 'Monthly',
        totalRevenue: 'Total Rev.',
        paidAmount: 'Paid',
        // Subscriptions
        addPlan: 'Add Plan',
        planName: 'Plan Name',
        price: 'Price',
        sessions: 'Sessions',
        validDays: 'Valid Days',
        // Analytics
        revenue: 'Revenue',
        revenueBySource: 'By Source',
        studentGrowth: 'Growth',
        attendanceRate: 'Att. Rate',
        teacherLoad: 'Load',
        exportExcel: 'Excel',
        exportPdf: 'PDF',
        // Auth
        login: 'Login',
        logout: 'Logout',
        email: 'Email',
        password: 'Password',
        signIn: 'Sign In',
        telegramLogin: 'Sign in with Telegram',
        signInToContinue: 'Sign in to continue',
        // Org
        dance: 'Dance Studio',
        sports: 'Sports School',
        yoga: 'Yoga Center',
        fitness: 'Fitness Studio',
        // Misc
        language: 'Language',
        todayDate: 'Today',
        viewAll: 'View All',
        goTo: 'Go to',
        linkedPages: 'Related',
        // Hall-rental extra
        paid: 'Paid',
        // Billing
        billingHeading: 'Subscribe to ClassCore',
        billingSubheading: 'Simple pricing. Cancel anytime.',
        billingMonthly: 'Monthly',
        billingAnnual: 'Annual',
        billingPerMonth: 'mo',
        billingPerYear: 'yr',
        billingSave: 'Save',
        billingTrialDays: 'days left in trial',
        billingTrialWarn: 'Account will be locked after trial ends.',
        billingPayMethod: 'Payment Method',
        billingSecure: 'Secured with 256-bit SSL.',
        billingProceed: 'Go to Payment',
        billingSelectStarter: 'Choose Starter',
        billingSelectGrowth: 'Choose Growth',
        billingContact: 'Contact Us',
        billingF150: 'Up to 150 students',
        billingFSubs: 'Subscription management',
        billingFAtt: 'Attendance',
        billingFApp: 'Mobile app',
        billingFAdmin: 'admin',
        billingFUnlim: 'Unlimited students',
        billingFRental: 'Hall rental',
        billingFPortal: 'Client portal',
        billingFReports: 'Reports / PDF',
        billingFEverything: 'Everything in Growth',
        // Settings
        settingsOrg: 'Organization',
        settingsOrgDesc: 'Name, logo, type',
        settingsNotif: 'Notifications',
        settingsNotifDesc: 'Telegram, Email',
        settingsLang: 'Language & Region',
        settingsLangDesc: 'English · GMT+4',
        settingsSecurity: 'Security',
        settingsSecDesc: 'Password, 2FA',
        settingsSubDesc: 'Plans, durations',
        settingsTelegramDesc: 'Auto notifications · @studioflow_bot',
        collapse: 'Collapse',
        expand: 'Expand',
    },
};

export const LANG_META: Record<Lang, { flag: string; label: string }> = {
    ka: { flag: '🇬🇪', label: 'ქართული' },
    ru: { flag: '🇷🇺', label: 'Русский' },
    en: { flag: '🇬🇧', label: 'English' },
};
