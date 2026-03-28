export type Lang = 'ka' | 'ru' | 'en';

export interface Translations {
    // Navigation — core
    dashboard: string;
    students: string;
    attendance: string;
    groups: string;
    branches: string;
    colors: string;
    group: string;
    allGroups: string;
    filterByGroups: string;
    mainBranch: string;
    settings: string;
    // Navigation — new pages
    calendar: string;
    teachers: string;
    halls: string;
    hallRental: string;
    subscriptions: string;
    billing: string;
    sms_manager: string;
    selectColor: string;
    yearlyRevenue: string;
    attention: string;
    yes: string;
    ok: string;
    // Nav section labels
    navSectionLearning: string;
    navSectionStructure: string;
    navSectionFinance: string;
    navSectionReports: string;
    navSectionSystem: string;
    // Actions
    attendanceTrend: string;
    downloadPdf: string;
    downloadExcel: string;
    aiInsightTitle: string;
    aiInsightDesc: string;
    enableAi: string;
    todayRevenue: string;
    selectedPeriod: string;
    welcomeBack: string;
    active: string;
    new: string;
    analytics: string;
    todayIs: string;
    monthOf: string;
    fromTo: string;
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
    products: string;
    addNew: string;
    // Dashboard
    totalStudents: string;
    activeSubscriptions: string;
    todayAttendance: string;
    monthlyRevenue: string;
    recentActivity: string;
    noActivityToday: string;
    quickActions: string;
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
    expired: string;
    paused: string;
    inactive: string;
    onLeave: string;
    // Teachers
    addTeacher: string;
    teacherName: string;
    noTeacher: string;
    teacherPhone: string;
    teacherPhoto: string;
    specialty: string;
    ratePerHour: string;
    ratePerMonth: string;
    individual: string;
    assignedGroups: string;
    teacherStatus: string;
    academicStaff: string;
    fullSchedule: string;
    attendanceRecording: string;
    capacityShort: string;
    groupName: string;
    // Halls
    addHall: string;
    hallName: string;
    capacity: string;
    hallColor: string;
    hallStatus: string;
    lessonsPerWeek: string;
    hallA: string;
    hallB: string;
    hallStudio: string;
    // Calendar
    addEvent: string;
    dayView: string;
    weekView: string;
    monthView: string;
    todayBtn: string;
    allHalls: string;
    allTeachers: string;
    exportCalendar: string;
    groupClass: string;
    individualClass: string;
    rental: string;
    trialStatus: string;
    minAgo: string;
    contemporaryDance: string;
    threeMonthsPlan: string;
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
    calNewGroup: string;
    calTitle: string;
    calGroupNamePlaceholder: string;
    // Analytics
    revenue: string;
    revenueBySource: string;
    studentGrowth: string;
    attendanceRate: string;
    teacherLoad: string;
    expenses: string;
    rent: string;
    electricity: string;
    gas: string;
    water: string;
    cleaner: string;
    accountant: string;
    manager: string;
    otherExpenses: string;
    totalExpenses: string;
    netProfit: string;
    manageExpenses: string;
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
    platformTitle: string;
    orOtherMethod: string;
    aiInsightDetails: string;
    forgotPassword: string;
    noAccount: string;
    registerNow: string;
    agreeTerms: string;
    secureAccount: string;
    createAccount: string;
    haveAccount: string;
    loginError: string;
    confirmEmail: string;
    invalidCredentials: string;
    createStudio: string;
    startTrial: string;
    checkEmail: string;
    registerSuccessMessage: string;
    success: string;
    studioName: string;
    registerError: string;
    // Branches
    selectBranch: string;
    branchLabel: string;
    branchPlaceholder: string;
    // Registration extra
    registrationSuccess: string;
    yourId: string;
    viewProfile: string;
    requiredField: string;
    photoOptional: string;
    registering: string;
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
    confirmDeleteAttendance: string;
    deleteAttendance: string;
    subscriptionExpired: string;
    expiresToday: string;
    noSubscription: string;
    zeroVisits: string;
    smsSent: string;
    smsFailed: string;
    confirmRemoveFromGroup: string;
    callStudent: string;
    sms: string;
    balance: string;
    issuePlan: string;
    freeze: string;
    freezePrompt: string;
    confirm: string;
    remaining: string;
    day: string;
    balletShoes: string;
    smsTemplateExpiration: string;
    default: string;
    setAsDefault: string;
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
    billingSelectEnterprise: string;
    billingPopular: string;
    billingYearly: string;
    billingChooseChannel: string;
    billingTrial15: string;
    billingSSL: string;
    billingBanks: string;
    billingDataProtected: string;
    billingCancelAnytime: string;
    billingFlittDesc: string;
    billingTBCDesc: string;
    billingBOGDesc: string;
    billingEnterprise: string;
    billingContact: string;
    billingF150: string;
    // Dashboard & Settings additions
    studentDynamicsMonth: string;
    financialOverview: string;
    income: string;
    debtLabel: string;
    stable: string;
    expiring: string;
    trialEnding: string;
    trialEndingDesc: string;
    activeLabel: string;
    newLabel: string;
    churnLabel: string;
    studioSettings: string;
    logoLabel: string;
    logoDesc: string;
    uploadAction: string;
    removeAction: string;
    sidebarShow: string;
    emailDesc: string;
    slugWarning: string;
    reclaimName: string;
    reclaimAction: string;
    registeredFound: string;
    notFoundCloud: string;
    checkingStatus: string;
    forceSyncAction: string;
    syncSuccess: string;
    registrationLink: string;
    registrationLinkDesc: string;
    colorThemes: string;
    colorThemesDesc: string;
    bgColor: string;
    bgColorDesc: string;
    staffAccess: string;
    addStaffAction: string;
    branchManagement: string;
    noAddress: string;
    addNewBranchAction: string;
    interfaceLanguage: string;
    interfaceLanguageDesc: string;
    currencyChangeDesc: string;
    timezoneLabel: string;
    accountLabel: string;
    logoutDesc: string;
    helpSupport: string;
    needHelp: string;
    supportDesc: string;
    newPassword: string;
    confirmPassword: string;
    newPasswordLabel: string;
    confirmPasswordLabel: string;
    passwordChangedSuccessfully: string;
    passwordChangeSuccess: string;
    editBranch: string;
    editBranchTitle: string;
    addBranch: string;
    addNewBranchTitle: string;
    branchNameLabel: string;
    newStaffMember: string;
    addressLabel: string;
    payMethodCash: string;
    payMethodCard: string;
    payMethodTransfer: string;
    paymentLabel: string;
    fromBalance: string;
    onBalance: string;
    payMethodLabel: string;
    billingFSubs: string;
    billingFAtt: string;
    billingFApp: string;
    billingFAdmin: string;
    billingFUnlim: string;
    billingFRental: string;
    billingFPortal: string;
    billingFReports: string;
    billingFEverything: string;
    studioNameLabel: string;
    emailLabel: string;
    urlSlugLabel: string;
    reclaimConfirm: string;
    currencyChangeTitle: string;
    passwordsDoNotMatch: string;
    passwordTooShort: string;
    cloudSyncLabel: string;
    cloudSyncDesc: string;
    twoFactorAuth: string;
    twoFactorDesc: string;
    changePasswordTitle: string;
    editAction: string;
    integrationsLabel: string;
    syncCalendarDesc: string;
    telegramNotifDesc: string;
    newStudentLabel: string;
    newStudentNotifDesc: string;
    lowSessionsLabel: string;
    lowSessionsNotifDesc: string;
    langRegionLabel: string;
    currencyLabel: string;
    logoutLabel: string;
    saveAction: string;
    firstNameLabel: string;
    lastNameLabel: string;
    assignAccess: string;
    accessLevelLabel: string;
    ownerRole: string;
    adminRole: string;
    managerRole: string;
    teacherRole: string;
    receptionistRole: string;
    accountantRole: string;
    featureAccess: string;
    branchAccessRestrictions: string;
    confirmStaffDelete: string;
    removeStaffAction: string;
    deleteBranchPasswordConfirm: string;
    adminPasswordLabel: string;
    branchDeletedSuccessfully: string;
    incorrectPassword: string;
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
    studentPortal: string;
    subscriptionRenewal: string;
    renewNow: string;
    usedSessions: string;
    expiryDate: string;
    paymentSecure: string;
    paymentSuccess: string;
    paymentProcessing: string;
    // Dates
    monday: string; tuesday: string; wednesday: string; thursday: string; friday: string; saturday: string; sunday: string;
    jan: string; feb: string; mar: string; apr: string; may: string; jun: string; jul: string; aug: string; sep: string; oct: string; nov: string; dec: string;
    shortSun: string; shortMon: string; shortTue: string; shortWed: string; shortThu: string; shortFri: string; shortSat: string;
    birthdayNotification: string;
    congratulateThem: string;
    statusChanged: string;
    movedToInactive: string;
    today: string;
    myClass: string;
    reminder: string;
    week: string;
    smsSentTitle: string;
    sentReminder: string;
    studentLabelGeneric: string;
    clientLabelGeneric: string;
    groupSession: string;
    saleActivity: string;
    checkInActivity: string;
    unnamed: string;
    ofStudents: string;
    // Portal extra
    assignedId: string;
    purchasedLessons: string;
    remainingLessons: string;
    teacherComment: string;
    builtForPersistence: string;
    dataNotFound: string;
    authRequired: string;
    enterPhoneForAuth: string;
    incorrectPhone: string;
    qrIdAndCopy: string;
    mySchedule: string;
    studioSchedule: string;
    activeGroups: string;
    yourRegisteredClasses: string;
    noRegisteredClasses: string;
    buyProductInterest: string;
    lessonRequest: string;
    times: string;
    any: string;
    paymentHistory: string;
    style: string;
    ends: string;
    totalAmountPaid: string;
    confirmPhone: string;
    portalLogin: string;
    backToPortal: string;
    getNotifiedBeforeLesson: string;
    authSecurity: string;
    portalSubtitle: string;
    bookedTimes: string;
    instruction: string;
    instructionText: string;
    administration: string;
    yourGroups: string;
    privateChat: string;
    groupChat: string;
    chatWelcome: string;
    bookingRequest: string;
    confirmed: string;
    techSupport: string;
    newBranch: string;
    enterBranchName: string;
    branchNamePlaceholder: string;
    privateLabel: string;
    groupLabel: string;
    chatStartHint: string;
    sendMessageToStart: string;
    activeBranch: string;
    categoryEquipment: string;
    categoryOther: string;
    availableProducts: string;
    noProducts: string;
    outOfStock: string;
    left: string;
    interested: string;
    buyInStudio: string;
    portalError: string;
    errorApology: string;
    refreshPage: string;
    chat: string;
    // Teacher extra
    customSpecialty: string;
    // Attendance extra
    recentAttendance: string;
    subscriptionHistory: string;
    productHistory: string;
    removeFromGroup: string;
    transferGroup: string;
    allFilter: string;
    byFirstName: string;
    byLastName: string;
    noSubscriptionShort: string;
    certShort: string;
    expiresTodayShort: string;
    tryAnotherSearch: string;
    firstNamePlaceholder: string;
    lastNamePlaceholder: string;
    passportExpiry: string;
    unitPcs: string;
    totalTeachersShort: string;
    indSessionsShort: string;
    groupsShort: string;
    activeStudentsShort: string;
    fillRateShort: string;
    teacherSearchPlaceholder: string;
    perHourShort: string;
    perMonthShort: string;
    shareShort: string;
    percentageShort: string;
    indSessionShort: string;
    statsTotal: string;
    statsActive: string;
    statsExpired: string;
    statsNewThisMonth: string;
    average: string;
    averageDaily: string;
    averageMonthly: string;
    averageYearly: string;
    thisMonthAverage: string;
    searchStudentPlaceholder: string;
    priceManagement: string;
    priceManagementDesc: string;
    activeSubs: string;
    typeLabel: string;
    sessionCountLabel: string;
    validityDaysInput: string;
    priceGEL: string;
    sessionsShort: string;
    monthlyShortLabel: string;
    unlimitedShortLabel: string;
    pauseMgmt: string;
    pausePricesDesc: string;
    // Shop
    shop: string;
    inventory: string;
    priceValue: string;
    quantity: string;
    size: string;
    weight: string;
    totalSales: string;
    insufficientStock: string;
    otherCustomer: string;
    unknownClient: string;
    productTitle: string;
    stockValue: string;
    categoryShoes: string;
    categoryClothing: string;
    categoryAccessories: string;
    lowStockLabel: string;
    sellAction: string;
    totalAmount: string;
    editSale: string;
    recentSalesTitle: string;
    noSalesRecorded: string;
    // Analytics
    totalSalaries: string;
    salaryCalculation: string;
    pendingAmount: string;
    teacherTable: string;
    typeTable: string;
    volumeTable: string;
    bonusTable: string;
    statusTable: string;
    salaryEmpty: string;
    popularGroups: string;
    growthTable: string;
    groupsEmpty: string;
    markAsPaid: string;
    markAsPending: string;
    issueSalary: string;
    pay: string;
    totalPaidThisMonth: string;
    totalPendingThisMonth: string;
    revenueOverview: string;
    attendanceRateShort: string;
    smsManager: string;
    smsManagerDesc: string;
    manageTexts: string;
    logsStats: string;
    variablesGuide: string;
    autoSend: string;
    autoSendDesc: string;
    msgTemplates: string;
    saveTexts: string;
    smsSaved: string;
    smsSaveError: string;
    smsError: string;
    logError: string;
    smsSuccess: string;
    totalSentToday: string;
    totalSentHistory: string;
    recentMessages: string;
    logsEmpty: string;
    dateTable: string;
    userTable: string;
    numberTable: string;
    msgIdTable: string;
    sentStatus: string;
    errorStatus: string;
    charCount: string;
    charInfo: string;
    studio: string;
    subscription: string;
    pauseSubscription: string;
    choosePauseDays: string;
    amountDeductedConfirm: string;
    // SuperAdmin
    superAdmin: string;
    studiosCount: string;
    revenueGrowth: string;
    newClients: string;
    churnedClients: string;
    // Footer & Info
    cityBatumi: string;
    phoneLabel: string;
    // Subscription Management
    deleteConfirm: string;
    subscriptionType: string;
    subscriptionVisits: string;
    subscriptionMonthly: string;
    subscriptionStats: string;
    activeSubscriptionsList: string;
    popular: string;
    // Landing Page
    navFeatures: string;
    navPricing: string;
    navAbout: string;
    navContact: string;
    heroNewEra: string;
    heroTitle: string;
    heroSubtitle: string;
    heroStartFree: string;
    heroTrust: string;
    // leadingStudios: string; // Removed duplicate if it exists or just ignore
    leadingStudios: string;
    mainFeatures: string;
    allYourStudioNeeds: string;
    fullControl: string;
    controlDesc: string;
    featureIntuitive: string;
    featureThemes: string;
    featureMobile: string;
    featureMultilang: string;
    plansSubtitle: string;
    readyToScale: string;
    startToday: string;
    consultation: string;
    footerDesc: string;
    product: string;
    georgia: string;
    attendanceDesc: string;
    revenueDesc: string;
    analyticsDesc: string;
    choosePlan: string;
    startTodayAction: string;
    activeStudents: string;
    start: string;
    planStarter: string;
    planGrowth: string;
    planEnterprise: string;
    planStarterDesc: string;
    planGrowthDesc: string;
    planEnterpriseDesc: string;
    allRightsReserved: string;
    // UI Elements
    trialVersion: string;
    daysLeft: string;
    activateSubscription: string;
    paymentPage: string;
    schedule: string;
    searchStudent: string;
    alreadyCheckedIn: string;
    confirmVisit: string;
    yesConfirm: string;
    skip: string;
    close: string;
    notAccounted: string;
    hall: string;
    scanCard: string;
    waitingForScan: string;
    planFeaturesStarter: string[];
    planFeaturesGrowth: string[];
    planFeaturesEnterprise: string[];
    // Specialties
    specGeorgianDance: string;
    specBallroom: string;
    specBallet: string;
    specFitness: string;
    specZumba: string;
    specContemporary: string;
    specHipHop: string;
    specBreakdance: string;
    specYoga: string;
    specOther: string;
    closedShort: string;
    spotsShort: string;
    // HallModal extra
    editHall: string;
    newHall: string;
    uploadHallPhoto: string;
    hallPhoto: string;
    hallNamePlaceholder: string;
    activeStatus: string;
    closedStatus: string;
    deleteHall: string;
    deleteQuestion: string;
    colorIndigo: string;
    colorViolet: string;
    colorPink: string;
    colorYellow: string;
    colorGreen: string;
    colorBlue: string;
    colorRed: string;
    colorTeal: string;
    colorOrange: string;
    // Sidebar/User
    user: string;
    // TeacherModal extra
    editTeacher: string;
    newTeacher: string;
    staffMember: string;
    upload: string;
    maxFileSize: string;
    basicInfo: string;
    fullNamePlaceholder: string;
    phonePlaceholder: string;
    emailPlaceholder: string;
    bioLabel: string;
    bioPlaceholder: string;
    otherSpecialty: string;
    otherSpecialtyPlaceholder: string;
    enterToSave: string;
    noGroupsCreated: string;
    individualLessons: string;
    receivesIndividual: string;
    salaryPercentage: string;
    deleteTeacher: string;
    actionIrreversible: string;
    // GroupModal extra
    editGroup: string;
    newGroup: string;
    addGroupDescription: string;
    difficulty: string;
    difficultyDefault: string;
    difficultyBeginner: string;
    difficultyIntermediate: string;
    difficultyAdvanced: string;
    selectTeacher: string;
    schedulePlaceholder: string;
    groupColor: string;
    chooseAnotherColor: string;
    selectDaysAndTimes: string;
    atLeastOneDay: string;
    calendarUpdateNotice: string;
    deleteGroup: string;
    // SubscriptionModal extra
    editSubscription: string;
    statusPaused: string;
    typeSessions: string;
    typeMonthly: string;
    used: string;
    total: string;
    purchaseDate: string;
    expiryDateLabel: string;
    comment: string;
    commentPlaceholder: string;
    deleteSubConfirm: string;
    // IssueSubscriptionModal extra
    issueSubscription: string;
    newSale: string;
    selectSubType: string;
    groupSubscription: string;
    groupOneTime: string;
    individualSubscription: string;
    individualOneTime: string;
    rentalSubscription: string;
    rentalOneTime: string;
    backToType: string;
    selectClient: string;
    selectPlan: string;
    addToGroup: string;
    discount: string;
    periodDuration: string;
    days: string;
    neverExpires: string;
    lessons: string;
    unlimited: string;
    issueAction: string;
    paidAmountCurrency: string;
    // Billing / SaaS info
    trial: string;
    proPlan: string;
    // SMS
    sendSms: string;
    recipient: string;
    messageText: string;
    messagePlaceholder: string;
    characters: string;
    smsMultiPart: string;
    sending: string;
    send: string;
    // Notifications & Layout
    notifications: string;
    noNotifications: string;
    notifHistoryCount: string;
    historyEmpty: string;
    history: string;
    trash: string;
    more: string;
    student: string;
    teacher: string;
    smsReminders: string;
    studentPanel: string;
    // Student Modal & Info
    newStylePlaceholder: string;
    studentPortalLink: string;
    studentLabel: string;
    noStyleSet: string;
    nfcCard: string;
    noCardAssigned: string;
    scanNfcStatus: string;
    scanNfcAction: string;
    manualInput: string;
    deleteStudent: string;
    deleteWarning: string;
    yesDelete: string;
    purchaseHistory: string;
    noPurchases: string;
    recentVisits: string;
    deleteVisitConfirm: string;
    noVisits: string;
    nfcNotAvailable: string;
    nfcScanError: string;
    georgian: string;
    russian: string;
    english: string;
    addStudentShort: string;
    info: string;
    photo: string;
    deletePhoto: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    preferredLanguage: string;
    socialNetworks: string;
    documents: string;
    passportCopy: string;
    uploaded: string;
    change: string;
    uploadHint: string;
    expiringSoon: string;
    enrolledGroups: string;
    noGroupsFound: string;
    download: string;
    confirmDelete: string;
    purchases: string;
    lessonsUnits: string;
    totalStaff: string;
    activeStaff: string;
    academicSchedule: string;
    attendanceAnalytics: string;
    totalHalls: string;
    sqMeters: string;
    groupSchedule: string;
    revenueStatus: string;
    subManagement: string;
    totalGeneric: string;
    thisMonth: string;
    searchProduct: string;
    sell: string;
    recentSales: string;
    transactionHistory: string;
    noSales: string;
    trial15Days: string;
    sslSecure: string;
    dataProtected: string;
    cancelAnytime: string;
    spots: string;
    // Dashboard & Mini Calendar
    todaySchedule: string;
    allLink: string;
    noEventsToday: string;
    now: string;
    // Calendar — new strings (bidirectional sync & edit popup)
    calGroupClass: string;
    calIndividual: string;
    calRental: string;
    calOther: string;
    calEventEdit: string;
    calEventNew: string;
    calEventType: string;
    calRecurring: string;
    calOneTime: string;
    calEveryWeek: string;
    calGroup: string;
    calGroupOptional: string;
    calHall: string;
    calTeacher: string;
    calDate: string;
    calStartTime: string;
    calEndTime: string;
    calNotes: string;
    calCancel: string;
    calSave: string;
    calAdd: string;
    calDelete: string;
    calEditBtn: string;
    calDeleteOnly: string;
    calDeleteAll: string;
    calDeleteAllDesc: string;
    calDeleteConfirm: string;
    calDeleteTitle: string;
    calBackLink: string;
    calEveryWeekLabel: string;
    // Payment & Balance
    paymentCash: string; paymentCard: string; paymentTransfer: string;
    amountPaid: string; useBalance: string; clientBalance: string;
    overpayment: string; balanceApplied: string; remainingToPay: string;
    totalDue: string; newBalance: string;
    adjust: string;
    // SuperAdmin Login
    adminLogin: string;
    hqLoginSub: string;
    adminEmail: string;
    passcode: string;
    authenticate: string;
    restrictedZone: string;
    accessRestrictedAdmin: string;
    // Landing Page extra
    allFeaturesIncluded: string;
    trialActive: string;
    buyPlan: string;
    landingPlanName: string;
    allowedBranches: string;
    canEditCalendar: string;
    permViewAttendance: string;
    permViewSubscriptions: string;
    permViewStudents: string;
    permViewCalendar: string;
    permEditCalendar: string;
    permViewGroups: string;
    permViewTeachers: string;
    permViewHalls: string;
    permViewShop: string;
    permViewAnalytics: string;
    permViewSMS: string;
    saveAndSync: string;
    revenueTrend: string;
    attendanceAnalysis: string;
    recommendations: string;
    mostPopular: string;
    revenueDynamics: string;
    students3m: string;
    oldLabel: string;
    leftLabel: string;
    thisMonthAve: string;
    reminder30m: string;
    qrCode: string;
    hideQr: string;
    showQr: string;
    viewList: string;
    viewDaily: string;
    viewWeekly: string;
    aiRevenueUp: string;
    aiRevenueStable: string;
    aiAnalysisReady: string;
}


export const translations: Record<Lang, Translations> = {
    ka: {
        // Nav core
        dashboard: 'დაფა',
        students: 'სტუდენტები',
        attendance: 'დასწრება',
        groups: 'ჯგუფები',
        branches: 'ფილიალები',
        colors: 'ფერები',
        group: 'ჯგუფი',
        allGroups: 'ყველა ჯგუფი',
        filterByGroups: 'ჯგუფებად',
        mainBranch: 'მთავარი ფილიალი',
        settings: 'პარამეტრები',
        // Nav new
        calendar: 'კალენდარი',
        teachers: 'მასწავლებლები',
        halls: 'დარბაზები',
        hallRental: 'გაქირავება',
        addNew: 'ახლის დამატება',
        subscriptions: 'აბონიმენტები',
        billing: 'ბილინგი',
        sms_manager: 'SMS მენეჯერი',
        // Nav sections
        navSectionLearning: 'სასწავლო',
        navSectionStructure: 'სტრუქტურა',
        navSectionFinance: 'ფინანსები',
        navSectionReports: 'მოხსენება',
        navSectionSystem: 'სისტემა',
        // Actions
        attendanceTrend: 'დასწრების დინამიკა',
        downloadPdf: 'PDF ჩამოტვირთვა',
        downloadExcel: 'Excel ჩამოტვირთვა',
        aiInsightTitle: 'AI ანალიტიკა',
        aiInsightDesc: 'ჩვენს AI-ს აქვს რამდენიმე რჩევა თქვენი ბიზნესისთვის.',
        aiInsightDetails: 'დეტალურად',
        enableAi: 'AI ანალიტიკის ჩართვა',
        todayRevenue: 'დღევანდელი შემოსავალი',
        selectedPeriod: 'არჩეული პერიოდი',
        welcomeBack: 'მოგესალმებით,',
        active: 'აქტიური',
        new: 'ახალი სტუდენტი',
        analytics: 'ანალიტიკა',
        todayIs: 'დღეს არის',
        monthOf: 'თვის ჭრილში',
        fromTo: 'პერიოდი',
        add: 'დამატება',
        edit: 'ჩასწორება',
        delete: 'წაშლა',
        save: 'შენახვა',
        cancel: 'გაუქმება',
        attention: 'ყურადღება',
        yes: 'დიახ',
        ok: 'კარგი',
        search: 'ძებნა...',
        filter: 'ფილტრი',
        loading: 'იტვირთება...',
        noData: 'მონაცემი ვერ მოიძებნა',
        visit: 'ვიზიტი',
        visits: 'ვიზიტები',
        categories: 'კატეგორიები',
        products: 'პროდუქტები',
        // Dashboard
        totalStudents: 'სულ სტუდენტები',
        activeSubscriptions: 'აქტიური აბონემენტები',
        todayAttendance: 'დასწრება',
        monthlyRevenue: 'თვიური შემოსავალი',
        recentActivity: 'ბოლო აქტივობა',
        noActivityToday: 'დღეს აქტივობები არ დაფიქსირებულა',
        quickActions: 'სწრაფი მოქმედებები',
        // Students
        addStudent: 'სტუდენტის დამატება',
        studentName: 'სახელი',
        studentPhone: 'ტელეფონი',
        studentGroup: 'ჯგუფი',
        studentStatus: 'სტატუსი',
        lastVisit: 'ბოლო ვიზიტი',
        medicalCert: 'სამედიცინო ცნობა',
        partner: 'პარტნიორი',
        danceStyle: 'სტილი',
        allStudents: 'ყველა სტუდენტი',
        // Attendance
        markAttendance: 'დასწრების აღრიცხვა',
        present: 'დამსწრე',
        absent: 'არადამსწრე',
        selectDate: 'თარიღის არჩევა',
        selectGroup: 'ჯგუფის არჩევა',
        markAllPresent: 'ყველას მონიშვნა (დამსწრე)',
        attendanceSheet: 'დასწრების სია',
        notes: 'შენიშვნა',
        clear: 'გასუფთავება',
        // Statuses
        expired: 'ვადაგასული',
        paused: 'შეჩერებული',
        inactive: 'არააქტიური',
        onLeave: 'შვებულება',
        // Teachers
        addTeacher: 'მასწავლებლის დამატება',
        teacherName: 'მასწავლებლის სახელი',
        noTeacher: 'მასწავლებელი არ არის',
        specialty: 'სპეციალობა',
        ratePerHour: 'ანაზღაურება საათში',
        ratePerMonth: 'ანაზღაურება თვეში',
        individual: 'ინდივიდუალური სესია',
        assignedGroups: 'ჯგუფები',
        teacherStatus: 'მასწავლებლის სტატუსი',
        academicStaff: 'აკადემიური პერსონალი',
        fullSchedule: 'სრული განრიგი',
        attendanceRecording: 'დასწრების აღრიცხვა',
        capacityShort: 'ტევადობა',
        groupName: 'ჯგუფის სახელი',
        smsReminders: 'SMS შეხსენებები',
        studentPanel: 'სტუდენტის პანელი',
        // Halls
        addHall: 'დარბაზის დამატება',
        hallName: 'სახელი',
        capacity: 'ტევადობა',
        hallColor: 'ფერი',
        hallStatus: 'სტატუსი',
        lessonsPerWeek: 'გაკვეთილები კვირაში',
        hallA: 'დარბაზი A',
        hallB: 'დარბაზი B',
        hallStudio: 'სტუდია',
        // Calendar
        addEvent: 'ღონისძიების დამატება',
        dayView: 'დღე',
        weekView: 'კვირა',
        monthView: 'თვე',
        todayBtn: 'დღეს',
        allHalls: 'ყველა დარბაზი',
        allTeachers: 'ყველა მასწავლებელი',
        exportCalendar: 'ექსპორტი',
        groupClass: 'ჯგუფური',
        individualClass: 'ინდივიდუალური',
        rental: 'იჯარა',
        trialStatus: 'საცდელი',
        minAgo: '{n} წუთის წინ',
        contemporaryDance: 'Contemporary Dance',
        threeMonthsPlan: '3 თვიანი აბონემენტი',
        recurring: 'განმეორებადი',
        oneTime: 'ერთჯერადი',
        everyWeek: 'ყოველ კვირას',
        // Hall Rental
        addRental: 'ჯავშნის დამატება',
        rentalType: 'ტიპი',
        hourly: 'საათობრივი',
        multiDay: 'მრავალდღიანი',
        monthly: 'ყოველთვიური',
        totalRevenue: 'სრული შემოსავალი',
        paidAmount: 'გადახდილი თანხა',
        // Subscriptions
        addPlan: 'გეგმის დამატება',
        planName: 'გეგმის სახელი',
        price: 'ფასი',
        sessions: 'სესიები',
        validDays: 'ვადა (დღეები)',
        // Analytics
        revenue: 'შემოსავალი',
        revenueBySource: 'შემოსავალი წყაროების მიხედვით',
        studentGrowth: 'სტუდენტების ზრდა',
        attendanceRate: 'დასწრების მაჩვენებელი',
        expenses: 'ხარჯები',
        rent: 'ქირა',
        electricity: 'დენი',
        gas: 'გაზი',
        water: 'წყალი',
        cleaner: 'დამლაგებელი',
        accountant: 'ბუღალტერი',
        manager: 'მენეჯერი',
        otherExpenses: 'სხვა ხარჯები',
        totalExpenses: 'სულ ხარჯები',
        netProfit: 'წმინდა მოგება',
        manageExpenses: 'ხარჯების მართვა',
        teacherLoad: 'მასწავლებლის დატვირთვა',
        exportExcel: 'Excel ექსპორტი',
        exportPdf: 'PDF ექსპორტი',
        // Auth
        login: 'ავტორიზაცია',
        logout: 'გამოსვლა',
        email: 'ელექტრონული ფოსტა',
        password: 'პაროლი',
        signIn: 'სისტემაში შესვლა',
        telegramLogin: 'Telegram-ით',
        signInToContinue: 'გასაგრძელებლად შედით',
        platformTitle: 'სტუდიის მართვის პლატფორმა',
        orOtherMethod: 'ან სხვა მეთოდით',
        forgotPassword: 'დაგავიწყდათ?',
        noAccount: 'არ გაქვთ ანგარიში?',
        registerNow: 'დარეგისტრირდით',
        agreeTerms: 'ვეთანხმები წესებს და პირობებს და მონაცემთა დამუშავების პოლიტიკას.',
        secureAccount: '100% უსაფრთხო და დაცული',
        createAccount: 'ანგარიშის შექმნა',
        haveAccount: 'უკვე გაქვთ ანგარიში?',
        loginError: 'შესვლისას დაფიქსირდა შეცდომა',
        confirmEmail: 'გთხოვთ დაადასტუროთ თქვენი ელ-ფოსტა სისტემაში შესასვლელად.',
        invalidCredentials: 'ელ-ფოსტა ან პაროლი არასწორია.',
        createStudio: 'შექმენი შენი სტუდია',
        startTrial: 'დაიწყე 30 დღიანი უფასო საცდელი პერიოდით',
        checkEmail: 'შეამოწმეთ ელ-ფოსტა',
        registerSuccessMessage: 'რეგისტრაცია თითქმის დასრულებულია. გთხოვთ დაადასტუროთ თქვენი მეილი გამოგზავნილი ბმულით.',
        success: 'წარმატება',
        studioName: 'სტუდიის სახელი',
        registerError: 'რეგისტრაციისას დაფიქსირდა შეცდომა',
        // Org
        dance: 'საცეკვაო სტ.',
        sports: 'სასპ. სკ.',
        yoga: 'იოგა',
        fitness: 'ფიტნეს',
        // Misc
        language: 'ენა',
        todayDate: 'დღევანდელი თარიღი',
        viewAll: 'ყველას ნახვა',
        goTo: 'გადასვლა',
        linkedPages: 'დაკავშირებული გვერდები',
        confirmDeleteAttendance: 'ნამდვილად გსურთ დასწრებების წაშლა?',
        deleteAttendance: 'დასწრებების წაშლა',
        subscriptionExpired: 'აბონემენტი ამოიწურა',
        expiresToday: 'დღეს გადის',
        noSubscription: 'უაბონენტო',
        zeroVisits: '0 ვიზიტი',
        smsSent: 'SMS გაიგზავნა',
        smsFailed: 'SMS ვერ გაიგზავნა',
        confirmRemoveFromGroup: 'ნამდვილად გსურთ ჯგუფიდან ამოშლა?',
        callStudent: 'დარეკვა',
        sms: 'SMS',
        balance: 'ბალანსი',
        issuePlan: 'აბონემენტი',
        freeze: 'შეჩერება',
        freezePrompt: 'რამდენი დღით გსურთ გაგრძელება?',
        confirm: 'დადასტურება',
        remaining: 'დარჩენილია',
        day: 'დღე',
        balletShoes: 'ბალეტის ჩუსტები',
        smsTemplateExpiration: 'SMS შაბლონი ვადის გასვლის შესახებ',
        default: 'ძირითადი',
        setAsDefault: 'ძირითადად დაყენება',
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
        billingSelectEnterprise: 'დაგვიკავშირდით',
        billingPopular: 'პოპულარული',
        billingYearly: '/ წელი',
        billingChooseChannel: 'გაგრძელებისთვის აირჩიეთ გადახდის მეთოდი',
        billingTrial15: '15-დღიანი საცდელი პერიოდი',
        billingSSL: 'SSL დაცული გადახდა',
        billingBanks: 'Bank of Georgia · TBC Bank',
        billingDataProtected: 'მონაცემები დაცულია',
        billingCancelAnytime: 'გაუქმება ნებისმიერ დროს',
        billingFlittDesc: 'TBC ფილიალი · ყოველთვიური გადახდა',
        billingTBCDesc: 'TBC ბანკი · ბარათით',
        billingBOGDesc: 'საქართველოს ბანკი · ბარათით',
        billingEnterprise: 'Enterprise',
        billingContact: 'კავშირი',
        billingF150: '150 სტუდენტამდე',
        billingFSubs: 'აბონემენტის მართვა',
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
        settingsTelegramDesc: 'ავტ. შეტყ. სტუდენტებს',
        collapse: 'დაკეცვა',
        expand: 'გაფართოება',
        studentPortal: 'სტუდენტის პორტალი',
        subscriptionRenewal: 'აბონემენტის განახლება',
        renewNow: 'განახლება',
        usedSessions: 'დარჩენილი სეანსები',
        expiryDate: 'ვადა',
        paymentSecure: 'SSL დაცული გადახდა',
        paymentSuccess: 'წარმატებით განახლდა!',
        paymentProcessing: 'მუშავდება...',
        // Dates
        monday: 'ორშაბათი', tuesday: 'სამშაბათი', wednesday: 'ოთხშაბათი', thursday: 'ხუთშაბათი', friday: 'პარასკევი', saturday: 'შაბათი', sunday: 'კვირა',
        jan: 'იანვარი', feb: 'თებერვალი', mar: 'მარტი', apr: 'აპრილი', may: 'მაისი', jun: 'ივნისი', jul: 'ივლისი', aug: 'აგვისტო', sep: 'სექტემბერი', oct: 'ოქტომბერი', nov: 'ნოემბერი', dec: 'დეკემბერი',
        // Portal extra
        assignedId: 'მონიჭებული ID',
        purchasedLessons: 'შეძენილი გაკვეთილები',
        remainingLessons: 'დარჩენილი გაკვეთილები',
        teacherComment: 'მასწავლებლის კომენტარი',
        builtForPersistence: 'PERSISTENCE SYSTEM',
        dataNotFound: 'მონაცემები ვერ მოიძებნა',
        authRequired: 'საჭიროა ავტორიზაცია',
        enterPhoneForAuth: 'შეიყვანეთ სტუდენტის ბარათზე რეგისტრირებული ტელეფონის ნომერი',
        incorrectPhone: 'არასწორი ნომერი. გთხოვთ სცადოთ თავიდან.',
        qrIdAndCopy: 'QR ID და კოპირება',
        mySchedule: 'ჩემი განრიგი',
        studioSchedule: 'სტუდიის განრიგი',
        activeGroups: 'აქტიური ჯგუფები',
        yourRegisteredClasses: 'თქვენი რეგისტრირებული გაკვეთილები',
        noRegisteredClasses: 'რეგისტრირებული გაკვეთილები ვერ მოიძებნა',
        buyProductInterest: 'პროდუქტის შეძენა მაინტერესებს',
        lessonRequest: 'მოთხოვნა ინდივიდუალურ გაკვეთილზე',
        times: 'დროები',
        any: 'ნებისმიერი',
        paymentHistory: 'გადახდების ისტორია',
        style: 'სტილი',
        ends: 'მთავრდება',
        totalAmountPaid: 'სულ გადახდილია',
        confirmPhone: 'ნომრის დადასტურება',
        portalLogin: 'პორტალზე შესვლა',
        backToPortal: 'უკან დაბრუნება',
        getNotifiedBeforeLesson: 'მიიღეთ შეტყობინება გაკვეთილამდე',
        authSecurity: 'ClassCore უსაფრთხოება',
        portalSubtitle: 'სტუდენტის პორტალი',
        bookedTimes: 'დაჯავშნილი დროები',
        instruction: 'ინსტრუქცია',
        instructionText: 'აირჩიეთ ერთი ან რამდენიმე თავისუფალი დრო კალენდარში და დააჭირეთ დაჯავშნას. მოთხოვნა გაიგზავნება ჩატში.',
        administration: 'ადმინისტრაცია',
        yourGroups: 'თქვენი ჯგუფები',
        privateChat: 'შიდა ჩატი',
        groupChat: 'ჯგუფები',
        chatWelcome: 'მოგვწერეთ ნებისმიერ დროს. ადმინისტრატორი გიპასუხებთ სამუშაო საათებში.',
        bookingRequest: 'ჯავშნის მოთხოვნა',
        confirmed: 'დადასტურებულია',
        techSupport: 'ტექნიკური მხარდაჭერა',
        newBranch: 'ახალი ფილიალი',
        enterBranchName: 'შეიყვანეთ ახალი ფილიალის სახელი მის დასამატებლად.',
        branchNamePlaceholder: 'ფილიალის დასახელება',
        privateLabel: 'პირადი',
        groupLabel: 'ჯგუფური',
        chatStartHint: 'კავშირი დამყარებულია. გააგზავნეთ შეტყობინება დასაწყებად.',
        sendMessageToStart: 'დაწერეთ შეტყობინება',
        activeBranch: 'აქტიური ფილიალი',
        categoryEquipment: 'ინვენტარი',
        categoryOther: 'სხვა',
        availableProducts: 'ხელმისაწვდომი პროდუქტები',
        noProducts: 'პროდუქტები არ არის',
        outOfStock: 'გათავდა',
        left: 'დარჩა',
        interested: 'მაინტერესებს',
        buyInStudio: 'შეძენა — სტუდიაში',
        portalError: 'პორტალის შეცდომა',
        errorApology: 'ბოდიშს გიხდით, დაფიქსირდა პროგრამული ხარვეზი.',
        refreshPage: 'გვერდის განახლება',
        chat: 'ჩატი',
        // Teacher extra
        customSpecialty: 'სპეციალობა',
        teacherPhone: 'მასწავლებლის ტელეფონი',
        teacherPhoto: 'მასწავლებლის ფოტო',
        // Attendance extra
        recentAttendance: 'ბოლო დასწრებები',
        subscriptionHistory: 'შეძენილი აბონემენტები',
        productHistory: 'შეძენილი პროდუქტები',
        removeFromGroup: 'ჯგუფიდან ამოშლა',
        transferGroup: 'სხვა ჯგუფში გადაყვანა',
        allFilter: 'სულ',
        byFirstName: 'სახელით',
        byLastName: 'გვარით',
        noSubscriptionShort: 'აბონემენტის გარეშე',
        certShort: 'ცნობა!',
        expiresTodayShort: 'დღეს გადის!',
        tryAnotherSearch: 'სცადეთ სხვა საძიებო სიტყვა',
        firstNamePlaceholder: 'მაგ: ნინო',
        lastNamePlaceholder: 'ბერიძე',
        passportExpiry: 'პასპორტის ვადა',
        unitPcs: 'ც.',
        totalTeachersShort: 'სულ მასწავლებელი',
        indSessionsShort: 'ინდივიდუალური სესიები',
        groupsShort: 'ჯგუფები',
        activeStudentsShort: 'აქტიური სტუდენტები',
        fillRateShort: 'შევსების მაჩვენებელი',
        teacherSearchPlaceholder: 'სახელი, სპეციალობა...',
        perHourShort: 'საათში',
        perMonthShort: 'თვეში',
        shareShort: 'პროცენტული წილი',
        percentageShort: 'პროცენტული',
        indSessionShort: 'ინდივიდუალური გაკვეთილი',
        statsTotal: 'ჯამში',
        statsActive: 'აქტიური',
        statsExpired: 'ვადაგასული',
        statsNewThisMonth: 'ამ თვეში',
        searchStudentPlaceholder: 'სტუდენტის ძებნა...',
        priceManagement: 'ფასების მართვა',
        priceManagementDesc: 'აბონემენტების ფასები და მართვა',
        activeSubs: 'აქტიური აბონემენტები',
        typeLabel: 'ტიპი',
        sessionCountLabel: 'რაოდენობა',
        validityDaysInput: 'ვადა (დღე)',
        priceGEL: 'ფასი',
        sessionsShort: 'სესიები',
        monthlyShortLabel: 'ყოველთვიური',
        unlimitedShortLabel: 'შეუზღუდავი',
        pauseMgmt: 'შეჩერების მართვა',
        pausePricesDesc: 'რა ღირს აბონემენტის შეჩერება/გაყინვა დასვენების დღეებში?',
        // Shop
        shop: 'მაღაზია',
        inventory: 'მარაგი',
        priceValue: 'ღირებულება',
        quantity: 'რაოდენობა',
        size: 'ზომა',
        weight: 'წონა',
        totalSales: 'სულ გაყიდვები',
        insufficientStock: 'მარაგი არ არის საკმარისი',
        otherCustomer: 'სხვა კლიენტი',
        unknownClient: 'უცნობი',
        productTitle: 'დასახელება',
        stockValue: 'მარაგის რაოდენობა',
        categoryShoes: 'ფეხსაცმელი',
        categoryClothing: 'ტანსაცმელი',
        categoryAccessories: 'აქსესუარები',
        lowStockLabel: 'მცირე',
        sellAction: 'გაყიდვა',
        totalAmount: 'ჯამი',
        editSale: 'გაყიდვის ჩასწორება',
        recentSalesTitle: 'ბოლო გაყიდვები',
        noSalesRecorded: 'გაყიდვები არ ფიქსირდება',
        // Analytics
        totalSalaries: 'სულ ხელფასები',
        salaryCalculation: 'ხელფასების გამოანგარიშება',
        pendingAmount: 'გასაცემი თანხა',
        teacherTable: 'მასწავლებელი',
        typeTable: 'ტიპი',
        volumeTable: 'მოცულობა',
        bonusTable: 'ბონუსი',
        statusTable: 'სტატუსი',
        salaryEmpty: 'ხელფასების მონაცემები არ არის',
        popularGroups: 'პოპულარული ჯგუფები',
        growthTable: 'ზრდა',
        selectColor: 'ფერის არჩევა',
        yearlyRevenue: 'წლიური შემოსავალი',
        groupsEmpty: 'ჯგუფების მონაცემები ცარიელია',
        // SMS
        revenueOverview: 'შემოსავლების მიმოხილვა',
    attendanceRateShort: 'დასწრების მაჩვენებელი',
    smsManager: 'SMS მენეჯერი',
        smsManagerDesc: 'მართეთ ავტომატური შეტყობინებების ტექსტები და სტატისტიკა.',
        manageTexts: 'ტექსტების მართვა',
        logsStats: 'ლოგები & სტატისტიკა',
        variablesGuide: 'როგორ გამოვიყენოთ ცვლადები',
        autoSend: 'ავტომატური გაგზავნა',
        autoSendDesc: 'სისტემა დამოუკიდებლად გააგზავნის შეტყობინებებს (გარდა 23:00 - 10:00 საათებისა).',
        msgTemplates: 'შეტყობინებების შაბლონები',
        saveTexts: 'ტექსტების შენახვა',
        smsSaved: 'SMS ტექსტები წარმატებით შენახულია',
        smsSaveError: 'შენახვისას დაფიქსირდა შეცდომა',
        logError: 'ლოგების ჩატვირთვა ვერ მოხერხდა',
        totalSentToday: 'სულ გაგზავნილი (დღეს)',
        totalSentHistory: 'სულ გაგზავნილი (ისტორია)',
        recentMessages: 'ბოლო შეტყობინებები',
        logsEmpty: 'ლოგები ცარიელია',
        dateTable: 'თარიღი',
        userTable: 'მომხმარებელი',
        numberTable: 'ნომერი',
        msgIdTable: 'შეტყობინება (ID)',
        sentStatus: 'გაგზავნილია',
        errorStatus: 'შეცდომა',
        charCount: 'სიმბოლო',
        charInfo: '(1 SMS ~ 160 ლათინური ან ~70 ქართული სიმბოლო)',
        studio: 'სტუდია',
        subscription: 'აბონემენტი',
        pauseSubscription: 'აბონემენტის დაპაუზება',
        choosePauseDays: 'აირჩიეთ რამდენი დღით გსურთ აბონემენტის შეჩერება',
        amountDeductedConfirm: 'ანგარიშიდან ჩამოიჭრება {amount} {currency}. გსურთ გაგრძელება?',
        // SuperAdmin
        superAdmin: 'ადმინ პანელი',
        studiosCount: 'სულ სტუდიები',
        revenueGrowth: 'ზრდა',
        newClients: 'ახალი კლიენტები',
        churnedClients: 'კლიენტების გადინება',
        // Footer & Info
        cityBatumi: 'ბათუმი',
        phoneLabel: 'ტელ. ნომერი',
        // Subscription Management
        deleteConfirm: 'ნამდვილად გსურთ წაშლა?',
        subscriptionType: 'ტიპი',
        subscriptionVisits: 'ვიზიტები',
        subscriptionMonthly: 'თვიური',
        subscriptionStats: 'ამ თვის სტატისტიკა',
        activeSubscriptionsList: 'აქტიური აბონემენტების სია',
        popular: 'რეკომენდებული',
        // Landing
        navFeatures: 'ფუნქციები',
        navPricing: 'ფასები',
        navAbout: 'ჩვენს შესახებ',
        navContact: 'კონტაქტი',
        heroNewEra: 'სტუდიის მართვის ახალი ეპოქა',
        heroTitle: 'მართეთ თქვენი სტუდია მარტივად',
        heroSubtitle: 'ყველაფერი ერთ სივრცეში: დასწრება, გადახდები, ანალიტიკა და ბევრი სხვა.',
        heroStartFree: 'დაიწყეთ უფასოდ',
        heroTrust: 'სტუდია უკვე გვენდობა',
        leadingStudios: 'წამყვანი სტუდიები გვენდობიან',
        mainFeatures: 'ძირითადი ფუნქციები',
        allYourStudioNeeds: 'ყველაფერი რაც თქვენს სტუდიას სჭირდება',
        fullControl: 'სრული კონტროლი თქვენს ხელთაა',
        controlDesc: 'ჩვენი დეშბორდი შექმნილია მაქსიმალური ეფექტურობისთვის. ერთი შეხედვით ხედავთ სტუდიის ყველა მნიშვნელოვან მაჩვენებელს.',
        featureIntuitive: 'ინტუიციური ინტერფეისი',
        featureThemes: 'მუქი და ღია რეჟიმები',
        featureMobile: 'მობილურით მართვა',
        featureMultilang: 'მრავალენოვანი მხარდაჭერა',
        plansSubtitle: '30-დღიანი უფასო პერიოდი',
        landingPlanName: 'სრული პაკეტი',
        readyToScale: 'მზად ხართ სტუდიის შემდეგ ეტაპზე გადასაყვანად?',
        startToday: 'დაიწყეთ დღესვე',
        startTodayAction: 'დაიწყეთ დღესვე',
        activeStudents: 'აქტიური სტუდენტები',
        start: 'დაწყება',
        consultation: 'კონსულტაცია',
        product: 'პროდუქტი',
        footerDesc: 'საუკეთესო ინსტრუმენტი თქვენი ბიზნესის ზრდისთვის. ჩვენ ვზრუნავთ ტექნიკურ მხარეზე, თქვენ კი — შემოქმედებაზე.',
        georgia: 'საქართველო',
        planStarter: 'Starter',
        planGrowth: 'Growth',
        planEnterprise: 'Enterprise',
        planStarterDesc: 'პატარა სტუდიებისთვის',
        planGrowthDesc: 'მზარდი ბიზნესისთვის',
        planEnterpriseDesc: 'დიდი ქსელებისთვის',
        allRightsReserved: 'ყველა უფლება დაცულია.',
        attendanceDesc: 'QR კოდით ან მექანიკურად — სწრაფი და ზუსტი.',
        revenueDesc: 'აკონტროლეთ შემოსავლები და ჯავშნები რეალურ დროში.',
        analyticsDesc: 'მიიღეთ გადაწყვეტილებები მონაცემებზე დაყრდნობით.',
        choosePlan: 'ერთიანი ტარიფი',
        // UI Extra
        trialVersion: 'საცდელი ვერსია',
        daysLeft: 'დღე დარჩა',
        trial: 'ტესტირება',
        proPlan: 'პრო პაკეტი',
        activateSubscription: 'გააქტიურე სააბონემენტო',
        paymentPage: 'გადახდის გვერდი',
        schedule: 'განრიგი',
        searchStudent: 'მოსწავლის ძებნა',
        alreadyCheckedIn: 'უკვე შემოსულია',
        confirmVisit: 'დავაფიქსიროთ კიდევ ერთი ვიზიტი?',
        yesConfirm: 'დიახ, დაფიქსირება',
        skip: 'გამოტოვება',
        close: 'დახურვა',
        notAccounted: 'აღურიცხავი',
        hall: 'დარბაზი',
        scanCard: 'ბარათი მიადეთ',
        waitingForScan: 'ელოდება RFID ან QR კოდის სკანირებას',
        planFeaturesStarter: ['20 სტუდენტი', '3 ჯგუფი', 'დასწრების აღრიცხვა', 'Email მხარდაჭერა'],
        planFeaturesGrowth: ['შეუზღუდავი სტუდენტები', 'ჯგუფების მართვა', 'ფინანსური ანალიტიკა', 'SMS შეხსენებები', 'პრიორიტეტული მხარდაჭერა'],
        planFeaturesEnterprise: ['მრავალი ფილიალი', 'API წვდომა', 'White-label ოფცია', 'პერსონალური მენეჯერი'],
        // Specialties
        specGeorgianDance: 'ქართული ცეკვა',
        specBallroom: 'სამჯიბრო ცეკვა',
        specBallet: 'ბალეტი',
        specFitness: 'ფიტნესი',
        specZumba: 'ზუმბა',
        specContemporary: 'კონტემპორარი',
        specHipHop: 'ჰიპ-ჰოპი',
        specBreakdance: 'ბრეიქდანსი',
        specYoga: 'იოგა',
        specOther: 'სხვა',
        closedShort: 'დახურული',
        spotsShort: 'ადგილი',
        // HallModal extra
        editHall: 'დარბაზის ჩასწ.',
        newHall: 'ახალი დარბაზი',
        uploadHallPhoto: 'ატვირთეთ დარბაზის ფოტო',
        hallPhoto: 'ფოტო',
        hallNamePlaceholder: 'მაგ: დარბაზი A',
        activeStatus: 'აქტიური',
        closedStatus: 'დახურული',
        deleteHall: 'დარბაზის წაშლა',
        deleteQuestion: 'წავშალოთ?',
        colorIndigo: 'ინდიგო',
        colorViolet: 'იასამანი',
        colorPink: 'ვარდისფ.',
        colorYellow: 'ყვითელი',
        colorGreen: 'მწვანე',
        colorBlue: 'ლურჯი',
        colorRed: 'წითელი',
        colorTeal: 'ტეალი',
        colorOrange: 'ნარინჯი',
        // Sidebar/User
        user: 'მომხმარებელი',
        // TeacherModal extra
        editTeacher: 'მასწავლებლის ჩასწორება',
        newTeacher: 'ახალი მასწავლებელი',
        staffMember: 'სტაფის წევრი',
        upload: 'ატვირთვა',
        maxFileSize: 'JPG, PNG · მაქს 5MB',
        basicInfo: 'ძირითადი ინფო',
        fullNamePlaceholder: 'მაგ: ნინო ბერიძე',
        phonePlaceholder: '577 XX XX XX',
        emailPlaceholder: 'email@gmail.com',
        bioLabel: 'მოკლე ბიო',
        bioPlaceholder: 'მოკლე აღწერა...',
        otherSpecialty: 'მიუთითეთ სხვა სპეციალობა',
        otherSpecialtyPlaceholder: 'მაგ: ქართული ცეკვა',
        enterToSave: 'დააჭირეთ Enter-ს დასამატებლად',
        noGroupsCreated: 'ჯგუფები ჯერ არ არის შექმნილი',
        individualLessons: 'ინდ. გაკვეთილები',
        receivesIndividual: 'ღებულობს ინდივიდუალურ სეანსებს',
        salaryPercentage: 'პროცენტული წილი (Salary %)',
        deleteTeacher: 'მასწავლებლის წაშლა',
        actionIrreversible: 'ეს ქმედება საბოლოოა',
        // GroupModal extra
        editGroup: 'ჯგუფის რედაქტირება',
        newGroup: 'ახალი ჯგუფი',
        addGroupDescription: 'დაამატეთ ახალი სასწავლო ჯგუფი',
        difficulty: 'სირთულე',
        difficultyDefault: 'სტანდარტული',
        difficultyBeginner: 'დამწყები',
        difficultyIntermediate: 'საშუალო',
        difficultyAdvanced: 'პროფესიონალი',
        selectTeacher: 'აირჩიეთ მასწავლებელი',
        schedulePlaceholder: 'მაგ: ორ, ოთხ · 18:00–19:30',
        groupColor: 'ჯგუფის ფერი',
        chooseAnotherColor: 'სხვა ფერის არჩევა',
        selectDaysAndTimes: 'აირჩიეთ დღეები და დროები',
        atLeastOneDay: 'აირჩიეთ მინიმუმ ერთი დღე',
        calendarUpdateNotice: 'შენახვისას კალენდარი ავტომატურად განახლდება',
        deleteGroup: 'ჯგუფის წაშლა',
        // SubscriptionModal extra
        editSubscription: 'აბონემენტის რედაქტირება',
        statusPaused: 'შეჩერებული',
        typeSessions: 'რაოდენობრივი',
        typeMonthly: 'ყოველთვიური',
        used: 'გამოყენებული',
        total: 'სულ',
        purchaseDate: 'შეძენის თარიღი',
        expiryDateLabel: 'მოქმედების ვადა',
        comment: 'კომენტარი',
        commentPlaceholder: 'დაამატეთ შენიშვნა...',
        deleteSubConfirm: 'ნამდვილად გსურთ აბონემენტის წაშლა?',
        // IssueSubscriptionModal extra
        issueSubscription: 'აბონემენტის გამოწერა',
        newSale: 'ახალი',
        selectSubType: 'აირჩიეთ აბონემენტის ტიპი დასაწყებად',
        groupSubscription: 'ჯგუფური აბონემენტი',
        groupOneTime: 'ჯგუფური ერთჯერადი',
        individualSubscription: 'ინდივიდუალური აბონემენტი',
        individualOneTime: 'ინდივ. ერთჯერადი',
        rentalSubscription: 'აბონემენტი იჯარაზე',
        rentalOneTime: 'ერთჯერადი იჯარა',
        backToType: 'უკან დაბრუნება (ტიპის შეცვლა)',
        selectClient: 'კლიენტი',
        selectPlan: 'აბონემენტი (პაკეტი)',
        addToGroup: 'ჯგუფში დამატება',
        discount: 'ფასდაკლება (%)',
        periodDuration: 'ვადა და ხანგრძლივობა',
        days: 'დღეები',
        neverExpires: 'არასდროს გადის ვადა',
        lessons: 'გაკვეთილები',
        unlimited: 'ულიმიტო',
        issueAction: 'გაფორმება (გაყიდვა)',
        paidAmountCurrency: 'გადახდილია: {amount} ლარი',
        // SMS
        sendSms: 'SMS გაგზავნა',
        recipient: 'ადრესატი',
        messageText: 'შეტყობინების ტექსტი',
        messagePlaceholder: 'ჩაწერეთ ტექსტი აქ...',
        characters: 'სიმბოლო',
        smsMultiPart: '160-ზე მეტი (2 SMS)',
        smsSuccess: 'SMS წარმატებით გაიგზავნა!',
        smsError: 'გაგზავნა ვერ მოხერხდა. გადაამოწმეთ ნომერი.',
        sending: 'იგზავნება...',
        send: 'გაგზავნა',
        // Notifications & Layout
        notifications: 'შეტყობინებები',
        noNotifications: 'შეტყობინება არაა',
        notifHistoryCount: 'ისტორიაშია {count} შეტყობინება',
        historyEmpty: 'ისტორია ცარიელია',
        history: 'ისტორია',
        trash: 'ნაგვის ყუთი',
        more: 'მეტი',
        student: 'სტუდენტი',
        teacher: 'მასწავლებელი',
        // Student Modal & Info
        newStylePlaceholder: 'ახალი სტილი...',
        studentPortalLink: 'სტუდენტის პორტალი (Link)',
        studentLabel: 'სტუდენტი',
        noStyleSet: 'სტილი არ არის მითითებული',
        nfcCard: 'NFC / RFID ბარათი',
        noCardAssigned: 'ბარათი არ არის მინიჭებული',
        scanNfcStatus: 'მიათხოვე ბარათი...',
        scanNfcAction: 'სკანირება (Android)',
        manualInput: 'ხელით შეყვანა:',
        deleteStudent: 'სტუდენტის წაშლა',
        deleteWarning: 'ყველა მონაცემი (აბონემენტები, დასწრება) წაიშლება შეუქცევადად.',
        yesDelete: 'დიახ, წაშლა',
        purchaseHistory: 'შესყიდვების ისტორია',
        noPurchases: 'შესყიდვები არ ფიქსირდება',
        recentVisits: 'ბოლო ვიზიტები',
        deleteVisitConfirm: 'წავშალოთ ვიზიტი?',
        noVisits: 'ვიზიტები არ ფიქსირდება',
        nfcNotAvailable: 'NFC ხელმიუწვდომელია — Android Chrome საჭიროა',
        nfcScanError: 'სკანირება ვერ დაიწყო. NFC ჩართულია?',
        georgian: 'ქართული',
        russian: 'Русский',
        english: 'English',
        addStudentShort: 'ახალი სტუდენტის დამატება',
        info: 'ინფო',
        photo: 'ფოტო',
        deletePhoto: 'ფოტოს წაშლა',
        firstName: 'სახელი',
        lastName: 'გვარი',
        birthDate: 'დაბადების თარიღი',
        preferredLanguage: 'სასურველი ენა',
        socialNetworks: 'სოციალური ქსელები',
        documents: 'საბუთები',
        passportCopy: 'პასპორტის ასლი',
        uploaded: 'ატვირთულია',
        change: 'შეცვლა',
        uploadHint: 'ატვირთვა (PDF, JPG)',
        expiringSoon: 'მალე გადის ვადა!',
        enrolledGroups: 'ჩარიცხულია ჯგუფებში',
        noGroupsFound: 'ჯგუფები არ არის მოძიებული',
        download: 'გადმოწერა',
        confirmDelete: 'ნამდვილად გსურთ წაშლა?',
        purchases: 'შესყიდვები',
        lessonsUnits: 'გაკვეთილი',
        totalStaff: 'სულ სტაფი',
        activeStaff: 'აქტიური',
        academicSchedule: 'აკადემიური გრაფიკი',
        attendanceAnalytics: 'დასწრების ანალიტიკა',
        totalHalls: 'სულ',
        sqMeters: 'კვადრატი',
        groupSchedule: 'ჯგ. განრ.',
        revenueStatus: 'შემოსავლების სტატისტიკა',
        subManagement: 'აბონიმენტების მართვა და მონიტორინგი',
        totalGeneric: 'ჯამში',
        thisMonth: 'ამ თვეში',
        searchProduct: 'პროდუქტის ძებნა...',
        sell: 'გაყიდვა',
        recentSales: 'ბოლო გაყიდვები',
        totalPaidThisMonth: 'ამ თვეში სულ გაცემული',
        totalPendingThisMonth: 'სულ გადასახდელი',
        markAsPaid: 'გადახდილად მონიშვნა',
        markAsPending: 'მონიშვნა როგორც გადასახდელი',
        issueSalary: 'ხელფასის გაცემა',
        pay: 'გაცემა',
        transactionHistory: 'ტრანზაქციების ისტორია',
        noSales: 'გაყიდვები არ ფიქსირდება',
        trial15Days: '15-დღიანი ტესტირება',
        sslSecure: 'SSL დაცული გადახდა',
        dataProtected: 'მონაცემები დაცულია',
        cancelAnytime: 'გაუქმება ნებისმიერ დროს',
        spots: 'ადგ.',
        // Dashboard & Mini Calendar
        todaySchedule: 'დღევანდელი განრიგი',
        allLink: 'ყველა →',
        noEventsToday: 'ამ დღეს ღონისძიებები არ არის',
        unnamed: 'უსახელო',
        average: 'საშუალო',
        averageDaily: 'დღიური საშუალო',
        averageMonthly: 'თვიური საშუალო',
        averageYearly: 'წლიური საშუალო',
        thisMonthAverage: 'ამ თვის საშუალო',
        ofStudents: '{count} სტუდენტი {total}-დან',
        birthdayNotification: 'დაბადების დღე',
        congratulateThem: 'მიულოცეთ {name}-ს დაბადების დღე!',
        now: 'ახლა',
        statusChanged: 'სტატუსი შეიცვალა',
        movedToInactive: '{name} გადავიდა არააქტიურებში უაბონემენტობის გამო',
        smsSentTitle: 'SMS გაიგზავნა',
        sentReminder: '{name}-ს გაეგზავნა შეხსენება ({days} დღე)',
        groupSession: 'ჯგუფური მეცადინეობა',
        saleActivity: 'გაყიდვა',
        checkInActivity: 'დასწრება',
        studentLabelGeneric: 'სტუდენტი',
        clientLabelGeneric: 'კლიენტი',
        shortSun: 'კვი', shortMon: 'ორშ', shortTue: 'სამ', shortWed: 'ოთხ', shortThu: 'ხუთ', shortFri: 'პარ', shortSat: 'შაბ',
        // Calendar — new strings
        calGroupClass: 'ჯგუფური გაკვეთილი',
        calIndividual: 'ინდ. გაკვეთილი',
        calRental: 'გაქირავება',
        calOther: 'სხვა',
        calEventEdit: 'ღონისძიების რედაქტირება',
        calEventNew: 'ახალი ღონისძიება',
        calEventType: 'ტიპი',
        calRecurring: 'გამეორება',
        calOneTime: 'ერთჯერადი',
        calEveryWeek: 'ყოველ კვირა',
        calGroup: 'ჯგუფი',
        calGroupOptional: '— ჯგუფი (სურვილისამებრ)',
        calHall: 'დარბაზი',
        calTeacher: 'მასწავლებელი',
        calDate: 'თარიღი',
        calStartTime: 'დასაწყისი',
        calEndTime: 'დასასრული',
        calNotes: 'შენიშვნა...',
        calCancel: 'გაუქმება',
        calSave: 'შენახვა',
        calAdd: 'დამატება',
        calDelete: 'წაშლა',
        calEditBtn: '✏️ რედაქტირება',
        calDeleteOnly: 'მხოლოდ ეს ერთი',
        calDeleteAll: 'ყველა განმეორებადი',
        calDeleteAllDesc: 'ამ ჯგუფის ყველა {start}–{end} გაკვეთილი',
        calDeleteConfirm: 'ნამდვილად წაშლა?',
        calDeleteTitle: 'წაშლა',
        calBackLink: '← უკან',
        calEveryWeekLabel: ' · ყოველ კვირა',
        paymentCash: 'ნაღდი', paymentCard: 'ბარათი', paymentTransfer: 'გადარიცხვა',
        amountPaid: 'გადახდა თანხა', useBalance: 'ბალანსის გამოყენება', clientBalance: 'კლიენტის ბალანსი',
        overpayment: 'ზედმეტი გადახდა', balanceApplied: 'ბალანსიდან აღებული', remainingToPay: 'დასაიხდელი',
        totalDue: 'ჩსასახდელი', newBalance: 'ახალი ბალანსი', adjust: 'კორექტირება',
        calNewGroup: '+ ახალი ჯგუფი',
        calTitle: 'სათაური',
        calGroupNamePlaceholder: 'მაგ: ჰიპ-ჰოპ ბავშვები',
        // SuperAdmin Login
        adminLogin: 'ადმინის ლოგინი',
        hqLoginSub: 'ClassCore სისტემის მართვა',
        adminEmail: 'ადმინის ელ. ფოსტა',
        passcode: 'პაროლი',
        authenticate: 'ავტორიზაცია',
        restrictedZone: 'შეზღუდული წვდომის ზონა',
        accessRestrictedAdmin: 'წვდომა შეზღუდულია ადმინისტრატორისთვის',
        allFeaturesIncluded: 'ყველა ფუნქცია ჩართულია',
        trialActive: 'საცდელი პერიოდი აქტიურია',
        buyPlan: 'პაკეტის შეძენა',
        allowedBranches: 'ნებადართული ფილიალები',
        canEditCalendar: 'კალენდრის რედაქტირების უფლება',
        permViewAttendance: 'დასწრება',
        permViewSubscriptions: 'აბონემენტები',
        permViewStudents: 'სტუდენტები',
        permViewCalendar: 'კალენდარი',
        permEditCalendar: 'კალენდრის რედაქტირება',
        permViewGroups: 'ჯგუფები',
        permViewTeachers: 'მასწავლებლები',
        permViewHalls: 'დარბაზები',
        permViewShop: 'მაღაზია',
        permViewAnalytics: 'ანალიტიკა',
        permViewSMS: 'SMS მენეჯერი',
        // New Translations
        studentDynamicsMonth: 'სტუდენტების დინამიკა (თვე)',
        financialOverview: 'ფინანსური მიმოხილვა',
        income: 'შემოსავალი',
        debtLabel: 'დავალიანება',
        stable: 'სტაბილური',
        expiring: 'იწურება',
        trialEnding: 'საცდელი პერიოდი იწურება',
        trialEndingDesc: '{days} დღე დარჩა სრულ ბლოკამდე. გადადით ბილინგზე გასაგრძელებლად.',
        activeLabel: 'აქტიური',
        newLabel: 'ახალი',
        churnLabel: 'წასული',
        studioSettings: 'სტუდიის პარამეტრები',
        logoLabel: 'ლოგო',
        logoDesc: 'სტუდიის ლოგო (PNG/JPG)',
        uploadAction: 'ატვირთვა',
        removeAction: 'წაშლა',
        sidebarShow: 'გამოჩნდება სადენავ პანელში',
        emailDesc: 'თქვენი ანგარიშის მეილი',
        slugWarning: 'შეცვლა გააფუჭებს არსებულ ლინკებს!',
        reclaimName: 'მისამართის განთავისუფლება',
        reclaimAction: 'განთავისუფლება',
        registeredFound: 'დარეგისტრირებულია',
        notFoundCloud: 'არ მოიძებნა',
        checkingStatus: 'მოწმდება...',
        forceSyncAction: 'სინქრონიზაციის იძულება',
        syncSuccess: 'მონაცემები წარმატებით აიტვირთვა',
        registrationLink: 'რეგისტრაციის ლინკი',
        registrationLinkDesc: 'კლიენტის სარეგისტრაციო ლინკი',
        colorThemes: 'ფერთა პალიტრა',
        colorThemesDesc: 'აირჩიეთ ინტერფეისის ძირითადი ფერი',
        bgColor: 'ფონის ფერი',
        bgColorDesc: 'ინტერფეისის ფონის ფერი',
        staffAccess: 'პერსონალი და წვდომები',
        addStaffAction: 'პერსონალის დამატება',
        branchManagement: 'ფილიალების მართვა',
        noAddress: 'მისამართი არ არის',
        addNewBranchAction: 'ახალი ფილიალის დამატება',
        addNewBranchTitle: 'ახალი ფილიალი',
        editBranch: 'ფილიალის რედაქტირება',
        editBranchTitle: 'ფილიალის რედაქტირება',
        addBranch: 'ფილიალის დამატება',
        interfaceLanguage: 'ინტერფეისის ენა',
        currencyChangeDesc: 'ვალუტის ნიშნის ცვლა',
        timezoneLabel: 'დროის ზონა',
        accountLabel: 'ანგარიში',
        logoutDesc: 'სესიის დასრულება',
        helpSupport: 'დახმარება და მხარდაჭერა',
        needHelp: 'გჭირდებათ დახმარება?',
        supportDesc: 'პირდაპირი ჩატი პლატფორმის ადმინისტრატორთან ნებისმიერი კითხვისთვის.',
        newPassword: 'ახალი პაროლი',
        confirmPassword: 'გაიმეორეთ პაროლი',
        passwordChangedSuccessfully: 'პაროლი წარმატებით შეიცვალა!',
        branchNameLabel: 'ფილიალის სახელი',
        newStaffMember: 'ახალი თანამშრომელი',
        addressLabel: 'მისამართი',
        payMethodCash: 'ნაღდი',
        payMethodCard: 'ბარათი',
        payMethodTransfer: 'გადარიცხვა',
        paymentLabel: 'გადახდა',
        fromBalance: 'ბალანსიდან',
        onBalance: 'ბალანსზე',
        payMethodLabel: 'გადახდის მეთოდი',
        studioNameLabel: 'სტუდიის სახელი',
        emailLabel: 'ელ-ფოსტა',
        urlSlugLabel: 'URL slug',
        reclaimConfirm: 'ნამდვილად გსურთ მისამართის განთავისუფლება?',
        currencyChangeTitle: 'ვალუტის ნიშნის შეცვლა',
        passwordsDoNotMatch: 'პაროლები არ ემთხვევა',
        passwordTooShort: 'პაროლი უნდა იყოს მინიმუმ 6 სიმბოლო',
        cloudSyncLabel: 'ღრუბლოვანი სინქრონიზაცია',
        cloudSyncDesc: 'სტატუსი სხვა მოწყობილობებიდან შესასვლელად',
        twoFactorAuth: 'ორფაქტორიანი ავთ.',
        twoFactorDesc: 'SMS ან Authenticator App-ით',
        changePasswordTitle: 'პაროლის შეცვლა',
        editAction: 'შეცვლა',
        integrationsLabel: 'ინტეგრაციები',
        syncCalendarDesc: 'სინქრონიზაცია კალენდართან',
        telegramNotifDesc: 'შეტყობინებები Telegram-ზე',
        newStudentLabel: 'ახალი სტუდენტი',
        newStudentNotifDesc: 'შეტყობინება ახალი სტუდენტის დამატებისას',
        lowSessionsLabel: 'სესიების ნაკლებობა',
        lowSessionsNotifDesc: 'სტუდენტს 2-ზე ნაკლები სესია დარჩა',
        langRegionLabel: 'ენა და რეგიონი',
        interfaceLanguageDesc: 'ყველა ტექსტის ენა',
        currencyLabel: 'ვალუტა',
        logoutLabel: 'გასვლა',
        saveAction: 'შენახვა',
        firstNameLabel: 'სახელი',
        lastNameLabel: 'გვარი',
        assignAccess: 'მიანიჭეთ წვდომები',
        accessLevelLabel: 'წვდომის დონე (როლი)',
        ownerRole: 'მფლობელი',
        adminRole: 'ადმინისტრატორი',
        managerRole: 'მენეჯერი',
        teacherRole: 'მასწავლებელი',
        receptionistRole: 'რეცეფშენი',
        accountantRole: 'ბუღალტერი',
        featureAccess: 'ფუნქციონალური წვდომა',
        newPasswordLabel: 'ახალი პაროლი',
        confirmPasswordLabel: 'გაიმეორეთ პაროლი',
        passwordChangeSuccess: 'პაროლი წარმატებით შეიცვალა!',
        branchAccessRestrictions: 'წვდომა ფილიალებზე',
        confirmStaffDelete: 'ნამდვილად გსურთ პერსონალის წაშლა?',
        removeStaffAction: 'პერსონალის წაშლა',
        deleteBranchPasswordConfirm: 'ფილიალის წასაშლელად შეიყვანეთ ადმინისტრატორის პაროლი დასადასტურებლად.',
        adminPasswordLabel: 'ადმინისტრატორის პაროლი',
        branchDeletedSuccessfully: 'ფილიალი წარმატებით წაიშალა',
        incorrectPassword: 'პაროლი არასწორია',
        // Branches
        selectBranch: 'აირჩიეთ ფილიალი',
        branchLabel: 'ფილიალი',
        branchPlaceholder: 'რომელ ფილიალში რეგისტრირდება?',
        // Registration extra
        registrationSuccess: 'წარმატებით დარეგისტრირდით',
        yourId: 'თქვენი ID',
        viewProfile: 'პირადი გვერდის ნახვა',
        requiredField: 'სავალდებულოა',
        photoOptional: 'სურვილისამებრ',
        registering: 'დარეგისტრირება...',
        saveAndSync: 'კალენდარში დამატება',
        revenueTrend: 'შემოსავლების ტრენდი',
        attendanceAnalysis: 'დასწრების ანალიზი',
        recommendations: 'რეკომენდაციები',
        mostPopular: 'ყველაზე პოპულარული',
        revenueDynamics: 'შემოსავლების დინამიკა',
        students3m: 'სტუდენტები (3 თვე)',
        oldLabel: 'ძველი',
        leftLabel: 'წავიდა',
        thisMonthAve: 'ამ თვის საშუალო',
        today: 'დღეს',
        myClass: 'ჩემი',
        reminder30m: 'შეტყობინება 30 წუთით ადრე',
        qrCode: 'QR კოდი',
        hideQr: 'დამალვა',
        showQr: 'ჩვენება',
        viewList: 'სია',
        viewDaily: 'დღიური',
        viewWeekly: 'კვირა',
        aiRevenueUp: 'თქვენი შემოსავალი გაიზარდა {percent}%-ით. დეტალებისთვის დააჭირეთ ღილაკს.',
        aiRevenueStable: 'შემოსავალი სტაბილურია. გირჩევთ ახალი ჯგუფების გახსნას.',
        aiAnalysisReady: 'AI ანალიზი მზად არის',
        reminder: 'შეხსენება',
        week: 'კვირა',
    },
    ru: {
        // Nav core
        dashboard: 'Дашборд',
        students: 'Ученики',
        attendance: 'Посещаемость',
        groups: 'Группы',
        branches: 'Филиалы',
        colors: 'Цвета',
        group: 'Группа',
        allGroups: 'Все группы',
        filterByGroups: 'По группам',
        mainBranch: 'Главный филиал',
        settings: 'Настройки',
        // Nav new
        calendar: 'Календарь',
        teachers: 'Преподаватели',
        halls: 'Залы',
        hallRental: 'Аренда зала',
        addNew: 'Добавить новый',
        subscriptions: 'Абонементы',
        billing: 'Биллинг',
        sms_manager: 'SMS Менеджер',
        // Nav sections
        navSectionLearning: 'Учебный',
        navSectionStructure: 'Структура',
        navSectionFinance: 'Финансы',
        navSectionReports: 'Отчёты',
        navSectionSystem: 'Система',
        // Actions
        attendanceTrend: 'Динамика посещаемости',
        downloadPdf: 'Скачать PDF',
        downloadExcel: 'Скачать Excel',
        aiInsightTitle: 'AI Аналитика',
        aiInsightDesc: 'У нашего AI есть несколько советов для вашего бизнеса.',
        aiInsightDetails: 'Подробнее',
        enableAi: 'Включить AI Аналитику',
        todayRevenue: 'Доход за сегодня',
        selectedPeriod: 'Выбранный период',
        welcomeBack: 'С возвращением,',
        active: 'Активно',
        new: 'Новый',
        analytics: 'Аналитика',
        todayIs: 'Сегодня',
        monthOf: 'За месяц',
        fromTo: 'Период',
        add: 'Добавить',
        edit: 'Ред.',
        delete: 'Удалить',
        save: 'Сохранить',
        cancel: 'Отмена',
        attention: 'Внимание',
        yes: 'Да',
        ok: 'ОК',
        search: 'Поиск...',
        filter: 'Фильтр',
        loading: 'Загрузка...',
        noData: 'Данные не найдены',
        visit: 'Визит',
        visits: 'Визиты',
        categories: 'Категории',
        products: 'Продукты',
        // Dashboard
        totalStudents: 'Всего студентов',
        activeSubscriptions: 'Активные абонементы',
        todayAttendance: 'Сегодняшняя посещаемость',
        monthlyRevenue: 'Ежемесячный доход',
        recentActivity: 'Последняя активность',
        noActivityToday: 'Сегодня активности не зафиксировано',
        quickActions: 'Быстрые действия',
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
        markAllPresent: 'Все присутствие',
        attendanceSheet: 'Журнал',
        notes: 'Примечание',
        clear: 'Очистить',
        // Statuses
        expired: 'Истёк',
        paused: 'Пауза',
        inactive: 'Неакт.',
        onLeave: 'Отпуск',
        // Teachers
        addTeacher: 'Доб. препод.',
        noTeacher: 'Преподаватель не назначен',
        teacherName: 'Имя преподавателя',
        teacherPhone: 'Телефон преподавателя',
        teacherPhoto: 'Фото преподавателя',
        specialty: 'Специальность',
        ratePerHour: 'Оплата в час',
        ratePerMonth: 'Оплата в месяц',
        individual: 'Индивидуальная сессия',
        assignedGroups: 'Группы',
        teacherStatus: 'Статус преподавателя',
        academicStaff: 'Академический персонал',
        fullSchedule: 'Полное расписание',
        attendanceRecording: 'Учет посещаемости',
        capacityShort: 'Вмест',
        groupName: 'Название группы',
        smsReminders: 'SMS Напоминания',
        studentPanel: 'Панель Студента',
        calNewGroup: '+ Новая группа',
        calTitle: 'Заголовок',
        calGroupNamePlaceholder: 'Напр: Хип-хоп дети',
        // Halls
        addHall: 'Добавить зал',
        hallName: 'Название',
        capacity: 'Вместимость',
        hallColor: 'Цвет',
        hallStatus: 'Статус',
        lessonsPerWeek: 'Уроков в неделю',
        hallA: 'Зал A',
        hallB: 'Зал B',
        hallStudio: 'Студия',
        // Calendar
        addEvent: 'Добавить событие',
        dayView: 'День',
        weekView: 'Неделя',
        monthView: 'Месяц',
        todayBtn: 'Сегодня',
        allHalls: 'Все залы',
        allTeachers: 'Все преподаватели',
        exportCalendar: 'Экспорт',
        groupClass: 'Групповое',
        individualClass: 'Индивидуальное',
        rental: 'Аренда',
        trialStatus: 'Пробная версия',
        minAgo: '{n} минут назад',
        contemporaryDance: 'Контемпорари',
        threeMonthsPlan: '3-месячный план',
        recurring: 'Повторяющееся',
        oneTime: 'Разовое',
        everyWeek: 'Каждую неделю',
        // Hall Rental
        addRental: 'Добавить аренду',
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
        attendanceRate: 'Посещаемость',
        expenses: 'Расходы',
        rent: 'Аренда',
        electricity: 'Электричество',
        gas: 'Газ',
        water: 'Вода',
        cleaner: 'Уборка',
        accountant: 'Бухгалтер',
        manager: 'Менеджер',
        otherExpenses: 'Другие расходы',
        totalExpenses: 'Всего расходов',
        netProfit: 'Чистая прибыль',
        manageExpenses: 'Управление расходами',
        teacherLoad: 'Нагрузка',
        exportExcel: 'Excel',
        exportPdf: 'PDF',
        // Auth
        login: 'Вход',
        logout: 'Выйти',
        email: 'Эл. почта',
        password: 'Пароль',
        signIn: 'Войти в систему',
        telegramLogin: 'Через Telegram',
        signInToContinue: 'Войдите, чтобы продолжить',
        platformTitle: 'Платформа управления студией',
        orOtherMethod: 'Или другим способом',
        forgotPassword: 'Забыли?',
        noAccount: 'Нет аккаунта?',
        registerNow: 'Зарегистрироваться',
        agreeTerms: 'Я согласен с условиями и политикой обработки данных.',
        secureAccount: '100% надежно и защищено',
        createAccount: 'Создать аккаунт',
        haveAccount: 'Уже есть аккаунт?',
        loginError: 'Ошибка при входе',
        confirmEmail: 'Пожалуйста, подтвердите свой email, чтобы войти.',
        invalidCredentials: 'Неверный email или пароль.',
        createStudio: 'Создайте свою студию',
        startTrial: 'Начните с 30-дневного бесплатного периода',
        checkEmail: 'Проверьте эл. почту',
        registerSuccessMessage: 'Регистрация почти завершена. Пожалуйста, подтвердите свой email по ссылке в письме.',
        success: 'Успешно',
        studioName: 'Название студии',
        registerError: 'Ошибка при регистрации',
        // Org
        dance: 'Танц. студия',
        sports: 'Спорт. школа',
        yoga: 'Йога-центр',
        fitness: 'Фитнес',
        // Misc
        language: 'Язык',
        todayDate: 'Сегодняшняя дата',
        viewAll: 'Посмотреть все',
        goTo: 'Перейти',
        linkedPages: 'Связанные страницы',
        confirmDeleteAttendance: 'Вы действительно хотите удалить посещения?',
        deleteAttendance: 'Удалить посещения',
        subscriptionExpired: 'Абонемент истек',
        expiresToday: 'Истекает сегодня',
        noSubscription: 'Нет абонемента',
        zeroVisits: '0 визитов',
        smsSent: 'СМС отправлено',
        smsFailed: 'СМС не отправлено',
        confirmRemoveFromGroup: 'Вы действительно хотите удалить из группы?',
        callStudent: 'Позвонить',
        sms: 'СМС',
        balance: 'Баланс',
        issuePlan: 'Обслуживание',
        freeze: 'Заморозка',
        freezePrompt: 'На сколько дней вы хотите продлить?',
        confirm: 'Подтвердить',
        remaining: 'Осталось',
        day: 'день',
        balletShoes: 'Балетки',
        smsTemplateExpiration: 'Шаблон SMS об истечении срока',
        default: 'Основной',
        setAsDefault: 'Сделать основным',
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
        billingSelectEnterprise: 'Связаться с нами',
        billingPopular: 'Популярный',
        billingYearly: '/ год',
        billingChooseChannel: 'Выберите способ оплаты для продолжения',
        billingTrial15: '15-дневный пробный период',
        billingSSL: 'SSL защищенный платеж',
        billingBanks: 'Bank of Georgia · TBC Bank',
        billingDataProtected: 'Данные защищены',
        billingCancelAnytime: 'Отмена в любое время',
        billingFlittDesc: 'Филиал TBC · Ежемесячный платеж',
        billingTBCDesc: 'Банк TBC · Картой',
        billingBOGDesc: 'Банк Грузии · Картой',
        billingEnterprise: 'Enterprise',
        billingContact: 'Связаться',
        billingF150: 'До 150 учеников',
        billingFSubs: 'Управление абон.',
        billingFAtt: 'Посещаемость',
        billingFApp: 'Мобильное прил.',
        billingFAdmin: 'админ',
        billingFUnlim: 'Неограничен. учеников',
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
        settingsTelegramDesc: 'Авто. увед. ученикам',
        collapse: 'Свернуть',
        expand: 'Развернуть',
        studentPortal: 'Портал ученика',
        subscriptionRenewal: 'Продление абонемента',
        renewNow: 'Продлить',
        usedSessions: 'Осталось занятий',
        expiryDate: 'Срок',
        paymentSecure: 'SSL защищенный платеж',
        paymentSuccess: 'Успешно продлено!',
        paymentProcessing: 'Обработка...',
        // Dates
        monday: 'Пн', tuesday: 'Вт', wednesday: 'Ср', thursday: 'Чт', friday: 'Пт', saturday: 'Сб', sunday: 'Вс',
        jan: 'Январь', feb: 'Февраль', mar: 'Март', apr: 'Апрель', may: 'Май', jun: 'Июнь', jul: 'Июль', aug: 'Август', sep: 'Сентябрь', oct: 'Октябрь', nov: 'Ноябрь', dec: 'Дек',
        // Portal extra
        assignedId: 'Назначенный ID',
        purchasedLessons: 'Купленные занятия',
        remainingLessons: 'Оставшиеся занятия',
        teacherComment: 'Комментарий учителя',
        builtForPersistence: 'PERSISTENCE SYSTEM',
        dataNotFound: 'Данные не найдены',
        authRequired: 'Требуется авторизация',
        enterPhoneForAuth: 'Введите номер телефона, зарегистрированный на карте студента',
        incorrectPhone: 'Неверный номер. Пожалуйста, попробуйте еще раз.',
        qrIdAndCopy: 'QR ID и копирование',
        mySchedule: 'Мое расписание',
        studioSchedule: 'Расписание студии',
        activeGroups: 'Активные группы',
        yourRegisteredClasses: 'Ваши зарегистрированные занятия',
        noRegisteredClasses: 'Зарегистрированные занятия не найдены',
        buyProductInterest: 'Меня интересует покупка продукта',
        lessonRequest: 'Запрос на индивидуальное занятие',
        times: 'Время',
        any: 'Любой',
        paymentHistory: 'История платежей',
        style: 'Стиль',
        ends: 'Заканчивается',
        totalAmountPaid: 'Всего оплачено',
        confirmPhone: 'Подтверждение номера',
        portalLogin: 'Вход в портал',
        backToPortal: 'Вернуться назад',
        getNotifiedBeforeLesson: 'Получайте уведомления перед занятием',
        authSecurity: 'Безопасность ClassCore',
        portalSubtitle: 'Портал студента',
        bookedTimes: 'Забронированное время',
        instruction: 'Инструкция',
        instructionText: 'Выберите одно или несколько свободных времен в календаре и нажмите забронировать. Запрос будет отправлен в чат.',
        administration: 'Администрация',
        yourGroups: 'Ваши группы',
        privateChat: 'Личный чат',
        groupChat: 'Групповой чат',
        chatWelcome: 'Пишите нам в любое время. Администратор ответит в рабочее время.',
        bookingRequest: 'Запрос на бронирование',
        confirmed: 'Подтверждено',
        techSupport: 'Техподдержка',
        newBranch: 'Новый филиал',
        enterBranchName: 'Введите название нового филиала.',
        branchNamePlaceholder: 'Название филиала',
        privateLabel: 'Личный',
        groupLabel: 'Групповой',
        chatStartHint: 'Связь установлена. Отправьте сообщение, чтобы начать.',
        sendMessageToStart: 'Напишите сообщение',
        activeBranch: 'Активный филиал',
        categoryEquipment: 'Инвентарь',
        categoryOther: 'Другое',
        availableProducts: 'Доступные товары',
        noProducts: 'Товаров нет',
        outOfStock: 'Закончилось',
        left: 'осталось',
        interested: 'Интересует',
        buyInStudio: 'Покупка — в студии',
        portalError: 'Ошибка портала',
        errorApology: 'Приносим извинения, произошла программная ошибка.',
        refreshPage: 'Обновить страницу',
        chat: 'Чат',
        // Teacher extra
        customSpecialty: 'Специальность',
        // Attendance extra
        recentAttendance: 'Последние посещения',
        subscriptionHistory: 'История абонементов',
        productHistory: 'История покупок',
        removeFromGroup: 'Удалить из группы',
        transferGroup: 'Перевести в группу',
        allFilter: 'Все',
        byFirstName: 'По имени',
        byLastName: 'По фамилии',
        noSubscriptionShort: 'Без абонемента',
        certShort: 'Справка!',
        expiresTodayShort: 'Истекает сегодня!',
        tryAnotherSearch: 'Попробуйте другое слово',
        firstNamePlaceholder: 'напр: Нино',
        lastNamePlaceholder: 'Беридзе',
        passportExpiry: 'Срок паспорта',
        unitPcs: 'шт.',
        totalTeachersShort: 'Всего преп.',
        indSessionsShort: 'Инд. сес.',
        groupsShort: 'Группы',
        activeStudentsShort: 'Студенты',
        fillRateShort: 'Загрузка',
        teacherSearchPlaceholder: 'Имя, специальность...',
        perHourShort: 'ч.',
        perMonthShort: 'мес.',
        shareShort: 'доля',
        percentageShort: 'Процент',
        indSessionShort: 'Инд. урок',
        statsTotal: 'Всего',
        statsActive: 'Активные',
        statsExpired: 'Истекшие',
        statsNewThisMonth: 'В этом месяце',
        searchStudentPlaceholder: 'Поиск студента...',
        priceManagement: 'Управление ценами',
        priceManagementDesc: 'Управление тарифами и абонементами',
        activeSubs: 'Активные абонементы',
        typeLabel: 'Тип',
        sessionCountLabel: 'Количество',
        validityDaysInput: 'Срок (дней)',
        priceGEL: 'Цена',
        sessionsShort: 'Сессии',
        monthlyShortLabel: 'Ежемесячный',
        unlimitedShortLabel: 'Безлимитный',
        pauseMgmt: 'Управление заморозкой',
        pausePricesDesc: 'Сколько стоит заморозка абонемента на выходные дни?',
        // Shop
        shop: 'Магазин',
        inventory: 'Инвентарь',
        priceValue: 'Цена',
        quantity: 'Кол-во',
        size: 'Размер',
        weight: 'Вес',
        totalSales: 'Всего продаж',
        insufficientStock: 'Недостаточно на складе',
        otherCustomer: 'Другой клиент',
        unknownClient: 'Неизвестный',
        productTitle: 'Название',
        stockValue: 'Количество',
        categoryShoes: 'Обувь',
        categoryClothing: 'Одежда',
        categoryAccessories: 'Аксессуары',
        lowStockLabel: 'Мало',
        sellAction: 'Продать',
        totalAmount: 'Итого',
        editSale: 'Изменить продажу',
        recentSalesTitle: 'Последние продажи',
        noSalesRecorded: 'Продаж не зафиксировано',
        // Analytics
        totalSalaries: 'Всего зарплат',
        salaryCalculation: 'Расчет зарплат',
        pendingAmount: 'К выплате',
        teacherTable: 'Преподаватель',
        typeTable: 'Тип',
        volumeTable: 'Объем',
        bonusTable: 'Бонус',
        statusTable: 'Статус',
        salaryEmpty: 'Данные о зарплатах пусты',
        popularGroups: 'Популярные группы',
        growthTable: 'Рост',
        selectColor: 'Выбор цвета',
        yearlyRevenue: 'Годовой доход',
        groupsEmpty: 'Данные о группах пусты',
        // SMS
        revenueOverview: 'Обзор доходов',
    attendanceRateShort: 'Посещаемость',
    smsManager: 'SMS Менеджер',
        smsManagerDesc: 'Управляйте текстами автоуведомлений и статистикой.',
        manageTexts: 'Управление текстами',
        logsStats: 'Логи и статистика',
        variablesGuide: 'Как использовать переменные',
        autoSend: 'Автоматическая отправка',
        autoSendDesc: 'Система будет отправлять сообщения самостоятельно (кроме 23:00 - 10:00).',
        msgTemplates: 'Шаблоны сообщений',
        saveTexts: 'Сохранить тексты',
        smsSaved: 'SMS тексты успешно сохранены',
        smsSaveError: 'Ошибка при сохранении',
        logError: 'Не удалось загрузить логи',
        totalSentToday: 'Всего отправлено (сегодня)',
        totalSentHistory: 'Всего отправлено (история)',
        recentMessages: 'Последние сообщения',
        logsEmpty: 'Логи пусты',
        dateTable: 'Дата',
        userTable: 'Пользователь',
        numberTable: 'Номер',
        msgIdTable: 'Сообщение (ID)',
        sentStatus: 'Отправлено',
        errorStatus: 'Ошибка',
        charCount: 'Символов',
        charInfo: '(1 SMS ~ 160 лат. или ~70 кир. символов)',
        studio: 'Студия',
        subscription: 'Абонемент',
        pauseSubscription: 'Приостановка абонемента',
        choosePauseDays: 'Выберите, на сколько дней вы хотите приостановить абонемент',
        amountDeductedConfirm: 'С вашего счета будет списано {amount} {currency}. Вы хотите продолжить?',
        // SuperAdmin
        superAdmin: 'Админ панель',
        studiosCount: 'Всего студий',
        revenueGrowth: 'Рост',
        newClients: 'Новые клиенты',
        churnedClients: 'Ушедшие клиенты',
        // Footer & Info
        cityBatumi: 'Батуми',
        phoneLabel: 'Номер тел.',
        // Subscription Management
        deleteConfirm: 'Вы уверены, что хотите удалить?',
        subscriptionType: 'Тип',
        subscriptionVisits: 'Визиты',
        subscriptionMonthly: 'Ежемесячный',
        subscriptionStats: 'Статистика за месяц',
        activeSubscriptionsList: 'Список активных абонементов',
        popular: 'Рекомендовано',
        // Landing
        navFeatures: 'Функции',
        navPricing: 'Цены',
        navAbout: 'О нас',
        navContact: 'Контакты',
        heroNewEra: 'Новая эра управления студией',
        heroTitle: 'Управляйте своей студией легко',
        heroSubtitle: 'Все в одном месте: посещаемость, платежи, аналитика и многое другое.',
        heroStartFree: 'Начать бесплатно',
        heroTrust: 'студий уже доверяют нам',
        leadingStudios: 'Ведущие студии доверяют нам',
        mainFeatures: 'Основные функции',
        allYourStudioNeeds: 'Все, что нужно вашему студию',
        fullControl: 'Полный контроль в ваших руках',
        controlDesc: 'Наша панель управления создана для максимальной эффективности.',
        featureIntuitive: 'Интуитивный интерфейс',
        featureThemes: 'Темная и светлая темы',
        featureMobile: 'Управление с мобильного',
        featureMultilang: 'Многоязычная поддержка',
        plansSubtitle: '30 дней пробного периода',
        landingPlanName: 'Полный пакет',
        readyToScale: 'Готовы вывести студию на новый уровень?',
        startToday: 'Начните сегодня',
        consultation: 'Консультация',
        product: 'Продукт',
        footerDesc: 'Лучший инструмент для роста вашего бизнеса.',
        planStarter: 'Starter',
        planGrowth: 'Growth',
        planEnterprise: 'Enterprise',
        planStarterDesc: 'Для небольших студий',
        planGrowthDesc: 'Для растущего бизнеса',
        planEnterpriseDesc: 'Для крупных сетей',
        allRightsReserved: 'Все права защищены.',
        attendanceDesc: 'Быстрая и точная регистрация по QR или вручную.',
        revenueDesc: 'Контролируйте доходы и бронирования в реальном времени.',
        analyticsDesc: 'Принимайте решения на основе данных.',
        choosePlan: 'Единый тариф',
        startTodayAction: 'Начните сегодня',
        activeStudents: 'Активные студенты',
        start: 'Начать',
        georgia: 'Грузия',
        // UI Extra
        trialVersion: 'Пробная версия',
        daysLeft: 'дней осталось',
        trial: 'пробный период',
        proPlan: 'про пакет',
        activateSubscription: 'Активировать подписку',
        paymentPage: 'Страница оплаты',
        schedule: 'Расписание',
        searchStudent: 'Поиск ученика',
        alreadyCheckedIn: 'Уже вошел',
        confirmVisit: 'Зафиксировать еще один визит?',
        yesConfirm: 'Да, зафиксировать',
        skip: 'Пропустить',
        close: 'Закрыть',
        notAccounted: 'Не учтено',
        hall: 'Зал',
        scanCard: 'Приложите карту',
        waitingForScan: 'Ожидание сканирования RFID или QR кода',
        planFeaturesStarter: ['20 студентов', '3 группы', 'Учет посещаемости', 'Email поддержка'],
        planFeaturesGrowth: ['Безлимит студентов', 'Управление группами', 'Аналитика', 'SMS уведомления', 'Приоритетная поддержка'],
        planFeaturesEnterprise: ['Филиалы', 'API доступ', 'White-label', 'Персональный менеджер'],
        // Specialties
        specGeorgianDance: 'Грузинские танцы',
        specBallroom: 'Бальные танцы',
        specBallet: 'Балет',
        specFitness: 'Фитнес',
        specZumba: 'Зумба',
        specContemporary: 'Контемпорари',
        specHipHop: 'Хип-хоп',
        specBreakdance: 'Брейк-данс',
        specYoga: 'Йога',
        specOther: 'Другое',
        closedShort: 'Закр.',
        spotsShort: 'мест',
        // HallModal extra
        editHall: 'Редактировать зал',
        newHall: 'Новый зал',
        uploadHallPhoto: 'Загрузите фото зала',
        hallPhoto: 'Фото',
        hallNamePlaceholder: 'Напр: Зал A',
        activeStatus: 'Активен',
        closedStatus: 'Закрыт',
        deleteHall: 'Удалить зал',
        deleteQuestion: 'Удалить?',
        colorIndigo: 'Индиго',
        colorViolet: 'Фиолетовый',
        colorPink: 'Розовый',
        colorYellow: 'Жёлтый',
        colorGreen: 'Зелёный',
        colorBlue: 'Синий',
        colorRed: 'Красный',
        colorTeal: 'Бирюзовый',
        colorOrange: 'Оранжевый',
        // Sidebar/User
        user: 'Пользователь',
        // TeacherModal extra
        editTeacher: 'Редактировать преподавателя',
        newTeacher: 'Новый преподаватель',
        staffMember: 'Сотрудник',
        upload: 'Загрузить',
        maxFileSize: 'JPG, PNG · макс 5MB',
        basicInfo: 'Основная информация',
        fullNamePlaceholder: 'Напр: Нино Беридзе',
        phonePlaceholder: '577 XX XX XX',
        emailPlaceholder: 'email@gmail.com',
        bioLabel: 'Краткое био',
        bioPlaceholder: 'Краткое описание...',
        otherSpecialty: 'Укажите другую специальность',
        otherSpecialtyPlaceholder: 'Напр: Грузинские танцы',
        enterToSave: 'Нажмите Enter чтобы добавить',
        noGroupsCreated: 'Группы еще не созданы',
        individualLessons: 'Инд. занятия',
        receivesIndividual: 'Принимает индивидуальные сеансы',
        salaryPercentage: 'Процент от выручки (Salary %)',
        deleteTeacher: 'Удалить преподавателя',
        actionIrreversible: 'Это действие необратимо',
        // GroupModal extra
        editGroup: 'Редактировать группу',
        newGroup: 'Новая группа',
        addGroupDescription: 'Добавьте новую учебную группу',
        difficulty: 'Сложность',
        difficultyDefault: 'По умолчанию',
        difficultyBeginner: 'Начинающий',
        difficultyIntermediate: 'Средний',
        difficultyAdvanced: 'Продвинутый',
        selectTeacher: 'Выберите преподавателя',
        schedulePlaceholder: 'Напр: Пн, Ср · 18:00–19:30',
        groupColor: 'Цвет группы',
        chooseAnotherColor: 'Выбрать другой цвет',
        selectDaysAndTimes: 'Выберите дни и время',
        atLeastOneDay: 'Выберите хотя бы один день',
        calendarUpdateNotice: 'Календарь обновится автоматически при сохранении',
        deleteGroup: 'Удалить группу',
        // SubscriptionModal extra
        editSubscription: 'Редактировать абонемент',
        statusPaused: 'Приостановлен',
        typeSessions: 'Количественный',
        typeMonthly: 'Ежемесячный',
        used: 'Использовано',
        total: 'Всего',
        purchaseDate: 'Дата покупки',
        expiryDateLabel: 'Срок действия',
        comment: 'Комментарий',
        commentPlaceholder: 'Добавьте заметку...',
        deleteSubConfirm: 'Вы уверены, что хотите удалить абонемент?',
        // IssueSubscriptionModal extra
        issueSubscription: 'Оформление абонемента',
        newSale: 'Новый',
        selectSubType: 'Выберите тип абонемента для начала',
        groupSubscription: 'Групповой абонемент',
        groupOneTime: 'Групповой разовый',
        individualSubscription: 'Индивидуальный абонемент',
        individualOneTime: 'Инд. разовый',
        rentalSubscription: 'Абонемент на аренду',
        rentalOneTime: 'Разовая аренда',
        backToType: 'Назад (смена типа)',
        selectClient: 'Клиент',
        selectPlan: 'Абонемент (пакет)',
        addToGroup: 'Добавить в группу',
        discount: 'Скидка (%)',
        periodDuration: 'Срок и продолжительность',
        days: 'Дней',
        neverExpires: 'Никогда не истекает',
        lessons: 'Уроки',
        unlimited: 'Безлимит',
        issueAction: 'Оформить (продажа)',
        paidAmountCurrency: 'Оплачено: {amount} Лари',
        // SMS
        sendSms: 'Отправка СМС',
        recipient: 'Получатель',
        messageText: 'Текст сообщения',
        messagePlaceholder: 'Введите текст здесь...',
        characters: 'Символов',
        smsMultiPart: 'Больше 160 (2 SMS)',
        smsSuccess: 'SMS успешно отправлено!',
        smsError: 'Не удалось отправить. Проверьте номер.',
        sending: 'Отправка...',
        send: 'Отправить',
        // Notifications & Layout
        notifications: 'Уведомления',
        noNotifications: 'Уведомлений нет',
        notifHistoryCount: 'В истории {count} уведомлений',
        historyEmpty: 'История пуста',
        history: 'История',
        trash: 'Корзина',
        more: 'Больше',
        student: 'Студент',
        teacher: 'Преподаватель',
        // Student Modal & Info
        newStylePlaceholder: 'Новый стиль...',
        studentPortalLink: 'Портал студента (Link)',
        studentLabel: 'Студент',
        noStyleSet: 'Стиль не указан',
        nfcCard: 'NFC / RFID карта',
        noCardAssigned: 'Карта не назначена',
        scanNfcStatus: 'Поднесите карту...',
        scanNfcAction: 'Сканировать (Android)',
        manualInput: 'Ручной ввод:',
        deleteStudent: 'Удалить студента',
        deleteWarning: 'Все данные (абонементы, посещения) будут удалены безвозвратно.',
        yesDelete: 'Да, удалить',
        purchaseHistory: 'История покупок',
        noPurchases: 'Покупок нет',
        recentVisits: 'Последние визиты',
        deleteVisitConfirm: 'Удалить визит?',
        noVisits: 'Визитов нет',
        nfcNotAvailable: 'NFC недоступен — нужен Android Chrome',
        nfcScanError: 'Не удалось начать сканирование. NFC включен?',
        georgian: 'Грузинский',
        russian: 'Русский',
        english: 'Английский',
        addStudentShort: 'Добавить студента',
        info: 'Инфо',
        photo: 'Фото',
        deletePhoto: 'Удалить фото',
        firstName: 'Имя',
        lastName: 'Фамилия',
        birthDate: 'Дата рождения',
        preferredLanguage: 'Предподчтительный язык',
        socialNetworks: 'Социальные сети',
        documents: 'Документы',
        passportCopy: 'Копия паспорта',
        uploaded: 'Загружено',
        change: 'Изменить',
        uploadHint: 'Загрузить (PDF, JPG)',
        expiringSoon: 'Срок скоро истекает!',
        enrolledGroups: 'Зачислен в группы',
        noGroupsFound: 'Группы не найдены',
        download: 'Скачать',
        confirmDelete: 'Вы уверены, что хотите удалить?',
        purchases: 'Покупки',
        lessonsUnits: 'Урок.',
        totalStaff: 'Всего персонала',
        activeStaff: 'Активно',
        academicSchedule: 'Академический график',
        attendanceAnalytics: 'Аналитика посещаемости',
        totalHalls: 'Всего',
        sqMeters: 'кв. метр',
        groupSchedule: 'Расп. групп',
        revenueStatus: 'Статус доход.',
        subManagement: 'Управление и мониторинг абонементов',
        totalGeneric: 'Итого',
        thisMonth: 'В этом месяце',
        searchProduct: 'Поиск товара...',
        sell: 'Продать',
        recentSales: 'Последние продажи',
        totalPaidThisMonth: 'Всего выплачено в этом месяце',
        totalPendingThisMonth: 'Всего к выплате',
        markAsPaid: 'Отметить как выплачено',
        markAsPending: 'Отметить как ожидается',
        issueSalary: 'Выдать зарплату',
        pay: 'Выдать',
        transactionHistory: 'История транзакций',
        noSales: 'Продажи не зафиксированы',
        trial15Days: '15-дневное тестирование',
        sslSecure: 'SSL защищенный платеж',
        dataProtected: 'Данные защищены',
        cancelAnytime: 'Отмена в любое время',
        spots: 'мест',
        todaySchedule: 'Расписание сегодня',
        allLink: 'Все →',
        noEventsToday: 'В этот день занятий нет',
        unnamed: 'Без названия',
        average: 'Среднее',
        averageDaily: 'Среднее в день',
        averageMonthly: 'Среднее в месяц',
        averageYearly: 'Среднее в год',
        thisMonthAverage: 'Среднее за месяц',
        ofStudents: '{count} из {total} студентов',
        birthdayNotification: 'День рождения',
        congratulateThem: 'Поздравьте {name} с днем рождения!',
        now: 'Сейчас',
        statusChanged: 'Статус изменен',
        movedToInactive: '{name} переведен в неактивные из-за отсутствия абонемента',
        smsSentTitle: 'СМС отправлено',
        sentReminder: '{name} отправлено напоминание ({days} дней)',
        groupSession: 'Групповое занятие',
        saleActivity: 'Продажа',
        checkInActivity: 'Отметка',
        studentLabelGeneric: 'Студент',
        clientLabelGeneric: 'Клиент',
        shortSun: 'Вс', shortMon: 'Пн', shortTue: 'Вт', shortWed: 'Ср', shortThu: 'Чт', shortFri: 'Пт', shortSat: 'Сб',
        // Calendar — new strings
        calGroupClass: 'Групповое занятие',
        calIndividual: 'Инд. занятие',
        calRental: 'Аренда',
        calOther: 'Другое',
        calEventEdit: 'Редактирование события',
        calEventNew: 'Новое событие',
        calEventType: 'Тип',
        calRecurring: 'Повторение',
        calOneTime: 'Однократно',
        calEveryWeek: 'Каждую неделю',
        calGroup: 'Группа',
        calGroupOptional: '— Группа (необязательно)',
        calHall: 'Зал',
        calTeacher: 'Преподаватель',
        calDate: 'Дата',
        calStartTime: 'Начало',
        calEndTime: 'Конец',
        calNotes: 'Примечание...',
        calCancel: 'Отмена',
        calSave: 'Сохранить',
        calAdd: 'Добавить',
        calDelete: 'Удалить',
        calEditBtn: '✏️ Редакт.',
        calDeleteOnly: 'Только этот',
        calDeleteAll: 'Все повторяющиеся',
        calDeleteAllDesc: 'Все занятия {start}–{end} этой группы',
        calDeleteConfirm: 'Удалить?',
        calDeleteTitle: 'Удаление',
        calBackLink: '← Назад',
        calEveryWeekLabel: ' · Каждую нед.',
        paymentCash: 'Наличными', paymentCard: 'Картой', paymentTransfer: 'Переводом',
        amountPaid: 'Оплаченная сумма', useBalance: 'Исп. баланс', clientBalance: 'Баланс клиента',
        overpayment: 'Переплата', balanceApplied: 'Списано с баланса', remainingToPay: 'К оплате',
        totalDue: 'Итого', newBalance: 'Новый баланс', adjust: 'Коррект.',
        // SuperAdmin Login
        adminLogin: 'Вход для админа',
        hqLoginSub: 'Управление системой ClassCore',
        adminEmail: 'Email админа',
        passcode: 'Пароль',
        authenticate: 'Авторизация',
        restrictedZone: 'Зона ограниченного доступа',
        accessRestrictedAdmin: 'Доступ ограничен для администратора',
        allFeaturesIncluded: 'Все функции включены',
        trialActive: 'Пробный период активен',
        buyPlan: 'Купить пакет',
        allowedBranches: 'Доступные филиалы',
        canEditCalendar: 'Право редактирования календаря',
        permViewAttendance: 'Посещаемость',
        permViewSubscriptions: 'Абонементы',
        permViewStudents: 'Студенты',
        permViewCalendar: 'Календарь',
        permEditCalendar: 'Редактирование календаря',
        permViewGroups: 'Группы',
        permViewTeachers: 'Преподаватели',
        permViewHalls: 'Залы',
        permViewShop: 'Магазин',
        permViewAnalytics: 'Аналитика',
        permViewSMS: 'SMS менеджер',
        // New Translations
        studentDynamicsMonth: 'Динамика учеников (месяц)',
        financialOverview: 'Финансовый обзор',
        income: 'Доход',
        debtLabel: 'Задолженность',
        stable: 'Стабильно',
        expiring: 'Истекает',
        trialEnding: 'Пробный период истекает',
        trialEndingDesc: 'Осталось {days} дней до полной блокировки. Перейдите к биллингу для продолжения.',
        activeLabel: 'Активные',
        newLabel: 'Новые',
        churnLabel: 'Ушедшие',
        studioSettings: 'Настройки студии',
        logoLabel: 'Логотип',
        logoDesc: 'Логотип студии (PNG/JPG)',
        uploadAction: 'Загрузить',
        removeAction: 'Удалить',
        sidebarShow: 'Отображается в боковой панели',
        emailDesc: 'Email вашего аккаунта',
        slugWarning: 'Смена сломает текущие ссылки!',
        reclaimName: 'Освобождение адреса',
        reclaimAction: 'Освободить',
        registeredFound: 'Зарегистрировано',
        notFoundCloud: 'Не найдено',
        checkingStatus: 'Проверка...',
        forceSyncAction: 'Принудительная синхронизация',
        syncSuccess: 'Данные успешно загружены',
        registrationLink: 'Ссылка регистрации',
        registrationLinkDesc: 'Ссылка регистрации клиента',
        colorThemes: 'Цветовая палитра',
        colorThemesDesc: 'Выберите основной цвет интерфейса',
        bgColor: 'Цвет фона',
        bgColorDesc: 'Цвет фона интерфейса',
        staffAccess: 'Персонал и доступ',
        addStaffAction: 'Добавить персонал',
        branchManagement: 'Управление филиалами',
        noAddress: 'Нет адреса',
        interfaceLanguage: 'Язык интерфейса',
        currencyChangeDesc: 'Смена символа валюты',
        timezoneLabel: 'Часовой пояс',
        accountLabel: 'Аккаунт',
        logoutDesc: 'Завершить сессию',
        helpSupport: 'Помощь и поддержка',
        needHelp: 'Нужна помощь?',
        supportDesc: 'Прямой чат с администратором платформы для любых вопросов.',
        newPassword: 'Новый пароль',
        confirmPassword: 'Повторите пароль',
        passwordChangedSuccessfully: 'Пароль успешно изменён!',
        addNewBranchAction: 'Добавить новый филиал',
        addNewBranchTitle: 'Новый филиал',
        editBranch: 'Редактировать филиал',
        editBranchTitle: 'Редактировать филиал',
        addBranch: 'Добавить филиал',
        branchNameLabel: 'Название филиала',
        newStaffMember: 'Новый сотрудник',
        addressLabel: 'Адрес',
        payMethodCash: 'Наличными',
        payMethodCard: 'Картой',
        payMethodTransfer: 'Переводом',
        paymentLabel: 'Оплата',
        fromBalance: 'С баланса',
        onBalance: 'На баланс',
        payMethodLabel: 'Метод оплаты',
        studioNameLabel: 'Название студии',
        emailLabel: 'Email',
        urlSlugLabel: 'URL slug',
        reclaimConfirm: 'Вы уверены, что хотите освободить адрес?',
        currencyChangeTitle: 'Смена символа валюты',
        passwordsDoNotMatch: 'Пароли не совпадают',
        passwordTooShort: 'Пароль должен быть минимум 6 символов',
        cloudSyncLabel: 'Облачная синхронизация',
        cloudSyncDesc: 'Статус для входа с других устройств',
        twoFactorAuth: 'Двухфакторная аутент.',
        twoFactorDesc: 'Через SMS или Authenticator App',
        changePasswordTitle: 'Изменить пароль',
        editAction: 'Изменить',
        integrationsLabel: 'Интеграции',
        syncCalendarDesc: 'Синхронизация с календарем',
        telegramNotifDesc: 'Уведомления в Telegram',
        newStudentLabel: 'Новый студент',
        newStudentNotifDesc: 'Уведомлять при добавлении нового студента',
        lowSessionsLabel: 'Мало сессий',
        lowSessionsNotifDesc: 'У студента осталось менее 2 сессий',
        langRegionLabel: 'Язык и регион',
        interfaceLanguageDesc: 'Язык всех текстов',
        currencyLabel: 'Валюта',
        logoutLabel: 'Выйти',
        saveAction: 'Сохранить',
        firstNameLabel: 'Имя',
        lastNameLabel: 'Фамилия',
        assignAccess: 'Назначить права',
        accessLevelLabel: 'Уровень доступа (Роль)',
        ownerRole: 'Владелец',
        adminRole: 'Администратор',
        managerRole: 'Менеджер',
        teacherRole: 'Учитель',
        receptionistRole: 'Ресепшн',
        accountantRole: 'Бухгалтер',
        featureAccess: 'Функциональный доступ',
        branchAccessRestrictions: 'Доступ к филиалам',
        confirmStaffDelete: 'Вы уверены, что хотите удалить сотрудника?',
        removeStaffAction: 'Удалить сотрудника',
        deleteBranchPasswordConfirm: 'Для удаления филиала введите пароль администратора для подтверждения.',
        adminPasswordLabel: 'Пароль администратора',
        incorrectPassword: 'Неверный пароль',
        branchDeletedSuccessfully: 'Филиал успешно удален',
        newPasswordLabel: 'Новый пароль',
        confirmPasswordLabel: 'Повторите пароль',
        passwordChangeSuccess: 'Пароль успешно изменён!',
        // Branches
        selectBranch: 'Выберите филиал',
        branchLabel: 'Филиал',
        branchPlaceholder: 'В каком филиале регистрируется?',
        // Registration extra
        registrationSuccess: 'Вы успешно зарегистрированы',
        yourId: 'Ваш ID',
        viewProfile: 'Посмотреть личную страницу',
        requiredField: 'обязательно',
        photoOptional: 'необязательно',
        registering: 'Регистрация...',
        saveAndSync: 'Сохранить в календарь',
        revenueTrend: 'Тренд доходов',
        attendanceAnalysis: 'Анализ посещаемости',
        recommendations: 'Рекомендации',
        mostPopular: 'Самое популярное',
        revenueDynamics: 'Динамика доходов',
        students3m: 'Студенты (3 мес)',
        oldLabel: 'Старые',
        leftLabel: 'Ушли',
        thisMonthAve: 'В этом месяце',
        today: 'Сегодня',
        myClass: 'Мой',
        reminder30m: 'Напоминание за 30 минут',
        qrCode: 'QR Код',
        hideQr: 'Скрыть',
        showQr: 'Показать',
        viewList: 'Список',
        viewDaily: 'Дневной',
        viewWeekly: 'Неделя',
        aiRevenueUp: 'Ваш доход вырос на {percent}%. Нажмите для подробностей.',
        aiRevenueStable: 'Доход стабилен. Рекомендуем открыть новые группы.',
        aiAnalysisReady: 'AI анализ готов',
        reminder: 'Напоминание',
        week: 'Неделя',
    },
    en: {
        // Nav core
        dashboard: 'Dashboard',
        students: 'Students',
        attendance: 'Attendance',
        groups: 'Groups',
        branches: 'Branches',
        colors: 'Colors',
        group: 'Group',
        allGroups: 'All Groups',
        filterByGroups: 'By Groups',
        mainBranch: 'Main Branch',
        settings: 'Settings',
        // Nav new
        calendar: 'Calendar',
        teachers: 'Teachers',
        halls: 'Halls',
        hallRental: 'Hall Rental',
        addNew: 'Add New',
        subscriptions: 'Subscriptions',
        billing: 'Billing',
        sms_manager: 'SMS Manager',
        // Nav sections
        navSectionLearning: 'Learning',
        navSectionStructure: 'Structure',
        navSectionFinance: 'Finance',
        navSectionReports: 'Reports',
        navSectionSystem: 'System',
        // Actions
        attendanceTrend: 'Attendance Trend',
        downloadPdf: 'Download PDF',
        downloadExcel: 'Download Excel',
        aiInsightTitle: 'AI Analytics',
        aiInsightDesc: 'Our AI has some insights for your business.',
        aiInsightDetails: 'Details',
        enableAi: 'Enable AI Analytics',
        todayRevenue: 'Today\'s Revenue',
        selectedPeriod: 'Selected Period',
        welcomeBack: 'Welcome back,',
        active: 'Active',
        new: 'New',
        analytics: 'Analytics',
        todayIs: 'Today is',
        monthOf: 'For the month',
        fromTo: 'Period',
        add: 'Add',
        edit: 'Edit',
        delete: 'Delete',
        save: 'Save',
        cancel: 'Cancel',
        attention: 'Attention',
        yes: 'Yes',
        ok: 'OK',
        search: 'Search...',
        filter: 'Filter',
        loading: 'Loading...',
        noData: 'No data found',
        visit: 'Visit',
        visits: 'Visits',
        categories: 'Categories',
        products: 'Products',
        // Dashboard
        totalStudents: 'Total Students',
        activeSubscriptions: 'Active Subscriptions',
        todayAttendance: "Today's Attendance",
        monthlyRevenue: 'Monthly Revenue',
        recentActivity: 'Recent Activity',
        noActivityToday: 'No activities recorded today',
        quickActions: 'Quick Actions',
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
        expired: 'Expired',
        paused: 'Paused',
        inactive: 'Inactive',
        onLeave: 'On Leave',
        // Teachers
        addTeacher: 'Add Teacher',
        teacherName: 'Teacher Name',
        noTeacher: 'No Teacher',
        teacherPhone: 'Teacher Phone',
        teacherPhoto: 'Teacher Photo',
        specialty: 'Specialty',
        ratePerHour: 'Rate per hour',
        ratePerMonth: 'Rate per month',
        individual: 'Individual sessions',
        assignedGroups: 'Groups',
        teacherStatus: 'Status',
        academicStaff: 'Academic Staff',
        fullSchedule: 'Full Schedule',
        attendanceRecording: 'Attendance Tracking',
        capacityShort: 'Cap',
        groupName: 'Group Name',
        smsReminders: 'SMS Reminders',
        studentPanel: 'Student Panel',
        calNewGroup: '+ New Group',
        calTitle: 'Title',
        calGroupNamePlaceholder: 'e.g. Hip-Hop Kids',
        // Halls
        addHall: 'Add Hall',
        hallName: 'Name',
        capacity: 'Capacity',
        hallColor: 'Color',
        hallStatus: 'Status',
        lessonsPerWeek: 'Lessons per week',
        hallA: 'Hall A',
        hallB: 'Hall B',
        hallStudio: 'Studio',
        // Calendar
        addEvent: 'Add Event',
        dayView: 'Day',
        weekView: 'Week',
        monthView: 'Month',
        todayBtn: 'Today',
        allHalls: 'All Halls',
        allTeachers: 'All Teachers',
        exportCalendar: 'Export',
        groupClass: 'Group Class',
        individualClass: 'Individual Class',
        rental: 'Rental',
        trialStatus: 'Trial Version',
        minAgo: '{n} minutes ago',
        contemporaryDance: 'Contemporary',
        threeMonthsPlan: '3 Months Plan',
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
        attendanceRate: 'Attendance',
        expenses: 'Expenses',
        rent: 'Rent',
        electricity: 'Electricity',
        gas: 'Gas',
        water: 'Water',
        cleaner: 'Cleaner',
        accountant: 'Accountant',
        manager: 'Manager',
        otherExpenses: 'Other Expenses',
        totalExpenses: 'Total Expenses',
        netProfit: 'Net Profit',
        manageExpenses: 'Manage Expenses',
        teacherLoad: 'Load',
        exportExcel: 'Excel',
        exportPdf: 'PDF',
        // Auth
        login: 'Login',
        logout: 'Logout',
        email: 'Email',
        password: 'Password',
        signIn: 'Sign In',
        telegramLogin: 'Via Telegram',
        signInToContinue: 'Sign in to continue',
        platformTitle: 'Studio Management Platform',
        orOtherMethod: 'Or other method',
        forgotPassword: 'Forgot?',
        noAccount: 'No account?',
        registerNow: 'Register',
        agreeTerms: 'I agree to the terms and data processing policy.',
        secureAccount: '100% safe and secure',
        createAccount: 'Create Account',
        haveAccount: 'Already have an account?',
        loginError: 'Error during login',
        confirmEmail: 'Please confirm your email to sign in.',
        invalidCredentials: 'Invalid email or password.',
        createStudio: 'Create your studio',
        startTrial: 'Start with 30-day free trial',
        checkEmail: 'Check your email',
        registerSuccessMessage: 'Registration is almost complete. Please confirm your email via the link sent.',
        success: 'Success',
        studioName: 'Studio Name',
        registerError: 'Error during registration',
        // Org
        dance: 'Dance Studio',
        sports: 'Sports School',
        yoga: 'Yoga Center',
        fitness: 'Fitness Studio',
        // Misc
        language: 'Language',
        todayDate: 'Today\'s Date',
        viewAll: 'View All',
        goTo: 'Go To',
        linkedPages: 'Linked Pages',
        confirmDeleteAttendance: 'Are you sure you want to delete attendances?',
        deleteAttendance: 'Delete Attendances',
        subscriptionExpired: 'Subscription Expired',
        expiresToday: 'Expires Today',
        noSubscription: 'No Subscription',
        zeroVisits: '0 Visits',
        smsSent: 'SMS Sent',
        smsFailed: 'SMS Failed',
        confirmRemoveFromGroup: 'Are you sure you want to remove from group?',
        callStudent: 'Call',
        sms: 'SMS',
        balance: 'Balance',
        issuePlan: 'Issue Plan',
        freeze: 'Freeze',
        freezePrompt: 'How many days do you want to extend?',
        confirm: 'Confirm',
        remaining: 'Remaining',
        day: 'day',
        balletShoes: 'Ballet Shoes',
        smsTemplateExpiration: 'SMS Template for Expiration',
        default: 'Default',
        setAsDefault: 'Set as Default',
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
        billingSelectEnterprise: 'Contact Us',
        billingPopular: 'Popular',
        billingYearly: '/ yr',
        billingChooseChannel: 'Choose a payment channel to continue',
        billingTrial15: '15-day trial',
        billingSSL: 'SSL secured payment',
        billingBanks: 'Bank of Georgia · TBC Bank',
        billingDataProtected: 'Data protected',
        billingCancelAnytime: 'Cancel anytime',
        billingFlittDesc: 'TBC Subsidiary · Monthly payment',
        billingTBCDesc: 'TBC Bank · By card',
        billingBOGDesc: 'Bank of Georgia · By card',
        billingEnterprise: 'Enterprise',
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
        settingsTelegramDesc: 'Auto notifications',
        collapse: 'Collapse',
        expand: 'Expand',
        studentPortal: 'Student Portal',
        subscriptionRenewal: 'Subscription Renewal',
        renewNow: 'Renew Now',
        usedSessions: 'Remaining Sessions',
        expiryDate: 'Expiry Date',
        paymentSecure: 'SSL Secure Payment',
        paymentSuccess: 'Successfully Renewed!',
        paymentProcessing: 'Processing...',
        // Dates
        monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
        jan: 'January', feb: 'February', mar: 'March', apr: 'April', may: 'May', jun: 'June', jul: 'July', aug: 'August', sep: 'September', oct: 'October', nov: 'November', dec: 'Dec',
        // Portal extra
        assignedId: 'Assigned ID',
        purchasedLessons: 'Purchased Lessons',
        remainingLessons: 'Remaining Lessons',
        teacherComment: 'Teacher Comment',
        builtForPersistence: 'PERSISTENCE SYSTEM',
        dataNotFound: 'Data Not Found',
        authRequired: 'Authentication Required',
        enterPhoneForAuth: 'Enter the phone number registered on the student card',
        incorrectPhone: 'Incorrect number. Please try again.',
        qrIdAndCopy: 'QR ID & Copy',
        mySchedule: 'My Schedule',
        studioSchedule: 'Studio Schedule',
        activeGroups: 'Active Groups',
        yourRegisteredClasses: 'Your Registered Classes',
        noRegisteredClasses: 'No registered classes found',
        buyProductInterest: 'I\'m interested in buying this product',
        lessonRequest: 'Individual Lesson Request',
        times: 'Times',
        any: 'Any',
        paymentHistory: 'Payment History',
        style: 'Style',
        ends: 'Ends',
        totalAmountPaid: 'Total Paid',
        confirmPhone: 'Confirm Phone',
        portalLogin: 'Portal Login',
        backToPortal: 'Back to Portal',
        getNotifiedBeforeLesson: 'Get notified before the lesson',
        authSecurity: 'ClassCore Security',
        portalSubtitle: 'Student Portal',
        bookedTimes: 'Booked Times',
        instruction: 'Instruction',
        instructionText: 'Choose one or several free times in the calendar and press book. The request will be sent to the chat.',
        administration: 'Administration',
        yourGroups: 'Your Groups',
        privateChat: 'Private Chat',
        groupChat: 'Group Chat',
        chatWelcome: 'Write to us at any time. The admin will reply during working hours.',
        bookingRequest: 'Booking Request',
        confirmed: 'Confirmed',
        techSupport: 'Technical Support',
        newBranch: 'Add New Branch',
        enterBranchName: 'Enter the name of the new branch to add.',
        branchNamePlaceholder: 'Branch Name',
        privateLabel: 'Private',
        groupLabel: 'Group',
        chatStartHint: 'Connection established. Send a message to start.',
        sendMessageToStart: 'Write a message',
        activeBranch: 'Active Branch',
        categoryEquipment: 'Equipment',
        categoryOther: 'Other',
        availableProducts: 'Available Products',
        noProducts: 'No products available',
        outOfStock: 'Out of stock',
        left: 'left',
        interested: 'Interested',
        buyInStudio: 'Purchase — in studio',
        portalError: 'Portal Error',
        errorApology: 'We apologize, a technical error occurred.',
        refreshPage: 'Refresh Page',
        chat: 'Chat',
        // Teacher extra
        customSpecialty: 'Specialty',
        // Attendance extra
        recentAttendance: 'Recent Attendance',
        subscriptionHistory: 'Subscription History',
        productHistory: 'Product History',
        removeFromGroup: 'Remove from Group',
        transferGroup: 'Transfer Group',
        allFilter: 'All',
        byFirstName: 'By First Name',
        byLastName: 'By Last Name',
        noSubscriptionShort: 'No Subscription',
        certShort: 'Cert!',
        expiresTodayShort: 'Expires Today!',
        tryAnotherSearch: 'Try another search term',
        firstNamePlaceholder: 'e.g. Nino',
        lastNamePlaceholder: 'Beridze',
        passportExpiry: 'Passport Expiry',
        unitPcs: 'pcs.',
        totalTeachersShort: 'Total Teach.',
        indSessionsShort: 'Ind. Sess.',
        groupsShort: 'Groups',
        activeStudentsShort: 'Students',
        fillRateShort: 'Fill Rate',
        teacherSearchPlaceholder: 'Name, specialty...',
        perHourShort: 'hr',
        perMonthShort: 'mo',
        shareShort: 'share',
        percentageShort: 'Percentage',
        indSessionShort: 'Ind. Lesson',
        statsTotal: 'Total',
        statsActive: 'Active',
        statsExpired: 'Expired',
        statsNewThisMonth: 'This Month',
        searchStudentPlaceholder: 'Search student...',
        priceManagement: 'Price Management',
        priceManagementDesc: 'Manage subscription plans and pricing',
        activeSubs: 'Active Subscriptions',
        typeLabel: 'Type',
        sessionCountLabel: 'Quantity',
        validityDaysInput: 'Validity (days)',
        priceGEL: 'Price',
        sessionsShort: 'Sessions',
        monthlyShortLabel: 'Monthly',
        unlimitedShortLabel: 'Unlimited',
        pauseMgmt: 'Freeze Management',
        pausePricesDesc: 'How much does it cost to freeze a subscription?',
        // Shop
        shop: 'Shop',
        inventory: 'Inventory',
        priceValue: 'Price',
        quantity: 'Quantity',
        size: 'Size',
        weight: 'Weight',
        totalSales: 'Total Sales',
        insufficientStock: 'Insufficient stock',
        otherCustomer: 'Other Customer',
        unknownClient: 'Unknown',
        productTitle: 'Title',
        stockValue: 'Quantity',
        categoryShoes: 'Shoes',
        categoryClothing: 'Clothing',
        categoryAccessories: 'Accessories',
        lowStockLabel: 'Low',
        sellAction: 'Sell',
        totalAmount: 'Total',
        editSale: 'Edit Sale',
        recentSalesTitle: 'Recent Sales',
        noSalesRecorded: 'No sales recorded',
        // Analytics
        totalSalaries: 'Total Salaries',
        salaryCalculation: 'Salary Calculation',
        pendingAmount: 'Pending',
        teacherTable: 'Teacher',
        typeTable: 'Type',
        volumeTable: 'Volume',
        bonusTable: 'Bonus',
        statusTable: 'Status',
        salaryEmpty: 'Salary data is empty',
        popularGroups: 'Popular Groups',
        growthTable: 'Growth',
        selectColor: 'Select Color',
        yearlyRevenue: 'Yearly Revenue',
        groupsEmpty: 'Group data is empty',
        // SMS
        revenueOverview: 'Revenue Overview',
    attendanceRateShort: 'Attendance',
    smsManager: 'SMS Manager',
        smsManagerDesc: 'Manage automated notification texts and stats.',
        manageTexts: 'Manage Texts',
        logsStats: 'Logs & Stats',
        variablesGuide: 'How to use variables',
        autoSend: 'Auto Sending',
        autoSendDesc: 'The system will send messages independently (except 23:00 - 10:00).',
        msgTemplates: 'Message Templates',
        saveTexts: 'Save Texts',
        smsSaved: 'SMS texts saved successfully',
        smsSaveError: 'Error occurred while saving',
        logError: 'Failed to load logs',
        totalSentToday: 'Total Sent (Today)',
        totalSentHistory: 'Total Sent (History)',
        recentMessages: 'Recent Messages',
        logsEmpty: 'Logs are empty',
        dateTable: 'Date',
        userTable: 'User',
        numberTable: 'Number',
        msgIdTable: 'Message (ID)',
        sentStatus: 'Sent',
        errorStatus: 'Error',
        charCount: 'Characters',
        charInfo: '(1 SMS ~ 160 Latin or ~70 Georgian chars)',
        studio: 'Studio',
        subscription: 'Subscription',
        pauseSubscription: 'Pause Subscription',
        choosePauseDays: 'Choose how many days you want to pause the subscription',
        amountDeductedConfirm: '{amount} {currency} will be deducted from the account. Do you want to continue?',
        // SuperAdmin
        superAdmin: 'SuperAdmin Panel',
        studiosCount: 'Total Studios',
        revenueGrowth: 'Growth',
        newClients: 'New Clients',
        churnedClients: 'Churned Clients',
        // Footer & Info
        cityBatumi: 'Batumi',
        phoneLabel: 'Phone Number',
        // Subscription Management
        deleteConfirm: 'Are you sure you want to delete?',
        subscriptionType: 'Type',
        subscriptionVisits: 'Visits',
        subscriptionMonthly: 'Monthly',
        subscriptionStats: 'Monthly Statistics',
        activeSubscriptionsList: 'Active Subscriptions List',
        popular: 'Recommended',
        // Landing
        navFeatures: 'Features',
        navPricing: 'Pricing',
        navAbout: 'About',
        navContact: 'Contact',
        heroNewEra: 'New Era of Studio Management',
        heroTitle: 'Manage your studio easily',
        heroSubtitle: 'Everything in one place: attendance, payments, analytics and more.',
        heroStartFree: 'Start Free',
        heroTrust: 'studios already trust us',
        leadingStudios: 'Leading studios trust us',
        mainFeatures: 'Key Features',
        allYourStudioNeeds: 'Everything your studio needs',
        fullControl: 'Full control at your fingertips',
        controlDesc: 'Our dashboard is designed for maximum efficiency.',
        featureIntuitive: 'Intuitive Interface',
        featureThemes: 'Dark & Light Modes',
        featureMobile: 'Mobile Management',
        featureMultilang: 'Multilingual Support',
        plansSubtitle: '30-day free trial included',
        landingPlanName: 'Full Package',
        readyToScale: 'Ready to take your studio to the next level?',
        startToday: 'Start Today',
        consultation: 'Consultation',
        footerDesc: 'The best tool for growing your business. We handle the technical side, you focus on creativity.',
        product: 'Product',
        georgia: 'Georgia',
        attendanceDesc: 'Quick and accurate registration via QR or manually.',
        revenueDesc: 'Monitor revenue and bookings in real-time.',
        analyticsDesc: 'Make data-driven decisions based on insights.',
        choosePlan: 'The All-in-One Plan',
        startTodayAction: 'Start Today',
        activeStudents: 'Active Students',
        start: 'Start',
        planStarter: 'Starter',
        planGrowth: 'Growth',
        planEnterprise: 'Enterprise',
        planStarterDesc: 'For small studios',
        planGrowthDesc: 'For growing business',
        planEnterpriseDesc: 'For large networks',
        allRightsReserved: 'All rights reserved.',
        planFeaturesStarter: ['20 Students', '3 Groups', 'Attendance Tracking', 'Email Support'],
        planFeaturesGrowth: ['Unlimited Students', 'Group Management', 'Financial Analytics', 'SMS Reminders', 'Priority Support'],
        planFeaturesEnterprise: ['Multiple Branches', 'API Access', 'White-label Option', 'Personal Manager'],
        // UI Extra
        trialVersion: 'Trial Version',
        daysLeft: 'days left',
        trial: 'trial',
        proPlan: 'pro plan',
        activateSubscription: 'Activate Subscription',
        paymentPage: 'Payment Page',
        schedule: 'Schedule',
        searchStudent: 'Search Student',
        alreadyCheckedIn: 'Already checked in',
        confirmVisit: 'Record another visit?',
        yesConfirm: 'Yes, record',
        skip: 'Skip',
        close: 'Close',
        notAccounted: 'Not accounted',
        hall: 'Hall',
        scanCard: 'Scan Card',
        waitingForScan: 'Waiting for RFID or QR scan',
        // Specialties
        specGeorgianDance: 'Georgian Dance',
        specBallroom: 'Ballroom Dance',
        specBallet: 'Ballet',
        specFitness: 'Fitness',
        specZumba: 'Zumba',
        specContemporary: 'Contemporary',
        specHipHop: 'Hip-Hop',
        specBreakdance: 'Breakdance',
        specYoga: 'Yoga',
        specOther: 'Other',
        closedShort: 'Clsd.',
        spotsShort: 'spots',
        // HallModal extra
        editHall: 'Edit Hall',
        newHall: 'New Hall',
        uploadHallPhoto: 'Upload Hall Photo',
        hallPhoto: 'Photo',
        hallNamePlaceholder: 'e.g. Hall A',
        activeStatus: 'Active',
        closedStatus: 'Closed',
        deleteHall: 'Delete Hall',
        deleteQuestion: 'Delete?',
        colorIndigo: 'Indigo',
        colorViolet: 'Violet',
        colorPink: 'Pink',
        colorYellow: 'Yellow',
        colorGreen: 'Green',
        colorBlue: 'Blue',
        colorRed: 'Red',
        colorTeal: 'Teal',
        colorOrange: 'Orange',
        // Sidebar/User
        user: 'User',
        // TeacherModal extra
        editTeacher: 'Edit Teacher',
        newTeacher: 'New Teacher',
        staffMember: 'Staff Member',
        upload: 'Upload',
        maxFileSize: 'JPG, PNG · max 5MB',
        basicInfo: 'Basic Info',
        fullNamePlaceholder: 'e.g. Nino Beridze',
        phonePlaceholder: '577 XX XX XX',
        emailPlaceholder: 'email@gmail.com',
        bioLabel: 'Brief Bio',
        bioPlaceholder: 'Short description...',
        otherSpecialty: 'Specialty',
        otherSpecialtyPlaceholder: 'e.g. Georgian Dance',
        enterToSave: 'Press Enter to add',
        noGroupsCreated: 'No groups created yet',
        individualLessons: 'Indiv. Lessons',
        receivesIndividual: 'Accepts individual sessions',
        salaryPercentage: 'Salary Percentage (%)',
        deleteTeacher: 'Delete Teacher',
        actionIrreversible: 'This action is irreversible',
        // GroupModal extra
        editGroup: 'Edit Group',
        newGroup: 'New Group',
        addGroupDescription: 'Add a new study group',
        difficulty: 'Difficulty',
        difficultyDefault: 'Default',
        difficultyBeginner: 'Beginner',
        difficultyIntermediate: 'Intermediate',
        difficultyAdvanced: 'Advanced',
        selectTeacher: 'Select Teacher',
        schedulePlaceholder: 'e.g. Mon, Wed · 18:00–19:30',
        groupColor: 'Group Color',
        chooseAnotherColor: 'Choose another color',
        selectDaysAndTimes: 'Select days and times',
        atLeastOneDay: 'Select at least one day',
        calendarUpdateNotice: 'Calendar will be automatically updated on save',
        deleteGroup: 'Delete Group',
        // SubscriptionModal extra
        editSubscription: 'Edit Subscription',
        statusPaused: 'Paused',
        typeSessions: 'Sessions Based',
        typeMonthly: 'Monthly Based',
        used: 'Used',
        total: 'Total',
        purchaseDate: 'Purchase Date',
        expiryDateLabel: 'Expiry Date',
        comment: 'Comment',
        commentPlaceholder: 'Add a note...',
        deleteSubConfirm: 'Are you sure you want to delete the subscription?',
        // IssueSubscriptionModal extra
        issueSubscription: 'Issue Subscription',
        newSale: 'New',
        selectSubType: 'Select subscription type to start',
        groupSubscription: 'Group Subscription',
        groupOneTime: 'Group One-time',
        individualSubscription: 'Individual Subscription',
        individualOneTime: 'Indiv. One-time',
        rentalSubscription: 'Rental Subscription',
        rentalOneTime: 'One-time Rental',
        backToType: 'Go Back (Change Type)',
        selectClient: 'Client',
        selectPlan: 'Subscription (Package)',
        addToGroup: 'Add to Group',
        discount: 'Discount (%)',
        periodDuration: 'Period & Duration',
        days: 'Days',
        neverExpires: 'Never Expires',
        lessons: 'Lessons',
        unlimited: 'Unlimited',
        issueAction: 'Issue (Sale)',
        paidAmountCurrency: 'Paid: {amount} GEL',
        // SMS
        sendSms: 'Send SMS',
        recipient: 'Recipient',
        messageText: 'Message Text',
        messagePlaceholder: 'Type message here...',
        characters: 'chars',
        smsMultiPart: 'More than 160 (2 SMS)',
        smsSuccess: 'SMS sent successfully!',
        smsError: 'Failed to send. Check number.',
        sending: 'Sending...',
        send: 'Send',
        // Notifications & Layout
        notifications: 'Notifications',
        noNotifications: 'No notifications',
        notifHistoryCount: 'There are {count} messages in history',
        historyEmpty: 'History is empty',
        history: 'History',
        trash: 'Trash',
        more: 'More',
        student: 'Student',
        teacher: 'Teacher',
        newStylePlaceholder: 'New style...',
        studentPortalLink: 'Student Portal (Link)',
        studentLabel: 'Student',
        noStyleSet: 'No style specified',
        nfcCard: 'NFC / RFID Card',
        noCardAssigned: 'No card assigned',
        scanNfcStatus: 'Hold card near device...',
        scanNfcAction: 'Scan (Android)',
        manualInput: 'Manual input:',
        deleteStudent: 'Delete Student',
        deleteWarning: 'All data (subscriptions, attendance) will be deleted permanently.',
        yesDelete: 'Yes, Delete',
        purchaseHistory: 'Purchase History',
        noPurchases: 'No purchases found',
        recentVisits: 'Recent Visits',
        deleteVisitConfirm: 'Delete visit?',
        noVisits: 'No visits found',
        nfcNotAvailable: 'NFC unavailable — Android Chrome required',
        nfcScanError: 'Could not start scan. Is NFC on?',
        georgian: 'Georgian',
        russian: 'Russian',
        english: 'English',
        addStudentShort: 'Add New Student',
        info: 'Info',
        photo: 'Photo',
        deletePhoto: 'Delete Photo',
        firstName: 'First Name',
        lastName: 'Last Name',
        birthDate: 'Birth Date',
        preferredLanguage: 'Preferred Language',
        socialNetworks: 'Social Networks',
        documents: 'Documents',
        passportCopy: 'Passport Copy',
        uploaded: 'Uploaded',
        change: 'Change',
        uploadHint: 'Upload (PDF, JPG)',
        expiringSoon: 'Expiring soon!',
        enrolledGroups: 'Enrolled in Groups',
        noGroupsFound: 'No groups found',
        download: 'Download',
        confirmDelete: 'Are you sure you want to delete?',
        purchases: 'Purchases',
        lessonsUnits: 'Lesson',
        totalStaff: 'Total Staff',
        activeStaff: 'Active',
        academicSchedule: 'Academic Schedule',
        attendanceAnalytics: 'Attendance Analytics',
        totalHalls: 'Total',
        sqMeters: 'sq. meters',
        groupSchedule: 'Group Sched.',
        revenueStatus: 'Rev. Status',
        subManagement: 'Subscription Management & Monitoring',
        totalGeneric: 'Total',
        thisMonth: 'This Month',
        searchProduct: 'Search product...',
        sell: 'Sell',
        recentSales: 'Recent Sales',
        totalPaidThisMonth: 'Total Paid this Month',
        totalPendingThisMonth: 'Total Pending',
        markAsPaid: 'Mark as Paid',
        markAsPending: 'Mark as Pending',
        issueSalary: 'Issue Salary',
        pay: 'Pay',
        transactionHistory: 'Transaction History',
        noSales: 'No sales recorded',
        trial15Days: '15-day trial',
        sslSecure: 'SSL secured payment',
        dataProtected: 'Data protected',
        cancelAnytime: 'Cancel anytime',
        spots: 'spots',
        todaySchedule: "Today's Schedule",
        allLink: 'All →',
        noEventsToday: 'No classes for this day',
        unnamed: 'Unnamed',
        average: 'Average',
        averageDaily: 'Daily Average',
        averageMonthly: 'Monthly Average',
        averageYearly: 'Yearly Average',
        thisMonthAverage: 'Monthly Average',
        ofStudents: '{count} of {total} students',
        birthdayNotification: 'Birthday',
        congratulateThem: 'Wish {name} a happy birthday!',
        now: 'Now',
        statusChanged: 'Status Changed',
        movedToInactive: '{name} moved to inactive (10 days expired)',
        smsSentTitle: 'SMS Sent 📱',
        sentReminder: 'Sent reminder to {name} (day {days})',
        groupSession: 'Group Session',
        saleActivity: 'Sale',
        checkInActivity: 'Check-in',
        studentLabelGeneric: 'Student',
        clientLabelGeneric: 'Client',
        // Calendar — new strings
        calGroupClass: 'Group Class',
        calIndividual: 'Ind. Class',
        calRental: 'Rental',
        calOther: 'Other',
        calEventEdit: 'Edit Event',
        calEventNew: 'New Event',
        calEventType: 'Type',
        calRecurring: 'Recurring',
        calOneTime: 'One-time',
        calEveryWeek: 'Every week',
        calGroup: 'Group',
        calGroupOptional: '— Group (optional)',
        calHall: 'Hall',
        calTeacher: 'Teacher',
        calDate: 'Date',
        calStartTime: 'Start',
        calEndTime: 'End',
        calNotes: 'Notes...',
        calCancel: 'Cancel',
        calSave: 'Save',
        calAdd: 'Add',
        calDelete: 'Delete',
        calEditBtn: '✏️ Edit',
        calDeleteOnly: 'Only this one',
        calDeleteAll: 'All recurring',
        calDeleteAllDesc: 'All {start}–{end} classes of this group',
        calDeleteConfirm: 'Really delete?',
        calDeleteTitle: 'Delete',
        calBackLink: '← Back',
        calEveryWeekLabel: ' · Every week',
        shortSun: 'Sun', shortMon: 'Mon', shortTue: 'Tue', shortWed: 'Wed', shortThu: 'Thu', shortFri: 'Fri', shortSat: 'Sat',
        paymentCash: 'Cash', paymentCard: 'Card', paymentTransfer: 'Bank transfer',
        amountPaid: 'Amount paid', useBalance: 'Use balance', clientBalance: 'Client balance',
        overpayment: 'Overpayment', balanceApplied: 'Applied from balance', remainingToPay: 'Remaining',
        totalDue: 'Total due', newBalance: 'New balance', adjust: 'Adjust',
        // SuperAdmin Login
        adminLogin: 'Admin Login',
        hqLoginSub: 'ClassCore System Command',
        adminEmail: 'Admin Email',
        passcode: 'Passcode',
        authenticate: 'Authenticate',
        restrictedZone: 'Restricted Access Zone',
        accessRestrictedAdmin: 'Access restricted for admin',
        allFeaturesIncluded: 'All features included',
        trialActive: 'Trial period active',
        buyPlan: 'Buy Plan',
        allowedBranches: 'Allowed Branches',
        canEditCalendar: 'Can Edit Calendar',
        permViewAttendance: 'Attendance',
        permViewSubscriptions: 'Subscriptions',
        permViewStudents: 'Students',
        permViewCalendar: 'Calendar',
        permEditCalendar: 'Edit Calendar',
        permViewGroups: 'Groups',
        permViewTeachers: 'Teachers',
        permViewHalls: 'Halls',
        permViewShop: 'Shop',
        permViewAnalytics: 'Analytics',
        permViewSMS: 'SMS Manager',
        // New Translations
        studentDynamicsMonth: 'Student Dynamics (Month)',
        financialOverview: 'Financial Overview',
        income: 'Income',
        debtLabel: 'Debt',
        stable: 'Stable',
        expiring: 'Expiring',
        trialEnding: 'Trial Expiring',
        trialEndingDesc: '{days} days left until full block. Go to billing to continue.',
        activeLabel: 'Active',
        newLabel: 'New',
        churnLabel: 'Churn',
        studioSettings: 'Studio Settings',
        logoLabel: 'Logo',
        logoDesc: 'Studio Logo (PNG/JPG)',
        uploadAction: 'Upload',
        removeAction: 'Remove',
        sidebarShow: 'Shown in Sidebar',
        emailDesc: 'Your account email',
        slugWarning: 'Changing will break existing links!',
        reclaimName: 'Reclaim Name',
        reclaimAction: 'Reclaim',
        registeredFound: 'Registered',
        notFoundCloud: 'Not Found',
        checkingStatus: 'Checking...',
        forceSyncAction: 'Force Sync',
        syncSuccess: 'Data successfully uploaded',
        registrationLink: 'Registration Link',
        registrationLinkDesc: 'Client registration link',
        colorThemes: 'Color Palette',
        colorThemesDesc: 'Choose interface accent color',
        bgColor: 'Background Color',
        bgColorDesc: 'Interface background color',
        staffAccess: 'Staff & Access',
        addStaffAction: 'Add Staff Member',
        branchManagement: 'Branch Management',
        noAddress: 'No Address',
        interfaceLanguage: 'Interface Language',
        currencyChangeDesc: 'Currency Change',
        timezoneLabel: 'Timezone',
        accountLabel: 'Account',
        logoutDesc: 'End your session',
        helpSupport: 'Help & Support',
        needHelp: 'Need Help?',
        supportDesc: 'Direct chat with platform admin for any questions.',
        newPassword: 'New Password',
        confirmPassword: 'Confirm Password',
        passwordChangedSuccessfully: 'Password changed successfully!',
        addNewBranchAction: 'Add New Branch',
        addNewBranchTitle: 'New Branch',
        editBranch: 'Edit Branch',
        editBranchTitle: 'Edit Branch',
        addBranch: 'Add Branch',
        branchNameLabel: 'Branch Name',
        newStaffMember: 'New Staff Member',
        addressLabel: 'Address',
        payMethodCash: 'Cash',
        payMethodCard: 'Card',
        payMethodTransfer: 'Transfer',
        paymentLabel: 'Payment',
        fromBalance: 'From Balance',
        onBalance: 'On Balance',
        payMethodLabel: 'Payment Method',
        studioNameLabel: 'Studio Name',
        emailLabel: 'Email',
        urlSlugLabel: 'URL Slug',
        reclaimConfirm: 'Are you sure you want to reclaim this address?',
        currencyChangeTitle: 'Currency Symbol Change',
        passwordsDoNotMatch: 'Passwords do not match',
        passwordTooShort: 'Password must be at least 6 characters',
        cloudSyncLabel: 'Cloud Sync',
        cloudSyncDesc: 'Status for cross-device access',
        twoFactorAuth: '2-Factor Auth',
        twoFactorDesc: 'Via SMS or Authenticator App',
        changePasswordTitle: 'Change Password',
        editAction: 'Edit',
        integrationsLabel: 'Integrations',
        syncCalendarDesc: 'Sync with calendar',
        telegramNotifDesc: 'Notifications on Telegram',
        newStudentLabel: 'New Student',
        newStudentNotifDesc: 'Notify when a new student is added',
        lowSessionsLabel: 'Low Sessions',
        lowSessionsNotifDesc: 'Student has fewer than 2 sessions left',
        langRegionLabel: 'Language & Region',
        interfaceLanguageDesc: 'Language of all UI text',
        currencyLabel: 'Currency',
        logoutLabel: 'Logout',
        saveAction: 'Save',
        firstNameLabel: 'First Name',
        lastNameLabel: 'Last Name',
        assignAccess: 'Assign Access & Permissions',
        accessLevelLabel: 'Access Level (Role)',
        ownerRole: 'Owner',
        adminRole: 'Admin',
        managerRole: 'Manager',
        teacherRole: 'Teacher',
        receptionistRole: 'Receptionist',
        accountantRole: 'Accountant',
        featureAccess: 'Feature Access Permissions',
        branchAccessRestrictions: 'Branch Access Restrictions',
        confirmStaffDelete: 'Are you sure you want to remove this staff member?',
        removeStaffAction: 'Remove Staff Member',
        deleteBranchPasswordConfirm: 'To delete the branch, enter the admin password to confirm.',
        adminPasswordLabel: 'Admin Password',
        incorrectPassword: 'Incorrect password',
        branchDeletedSuccessfully: 'Branch deleted successfully',
        newPasswordLabel: 'New Password',
        confirmPasswordLabel: 'Confirm Password',
        passwordChangeSuccess: 'Password changed successfully!',
        // Branches
        selectBranch: 'Select branch',
        branchLabel: 'Branch',
        branchPlaceholder: 'Which branch is registering?',
        // Registration extra
        registrationSuccess: 'Registration successful',
        yourId: 'Your ID',
        viewProfile: 'View personal page',
        requiredField: 'required',
        photoOptional: 'optional',
        registering: 'Registering...',
        saveAndSync: 'Save & Sync Calendar',
        revenueTrend: 'Revenue Trend',
        attendanceAnalysis: 'Attendance Analysis',
        recommendations: 'Recommendations',
        mostPopular: 'Most Popular',
        revenueDynamics: 'Revenue Dynamics',
        students3m: 'Students (3 Months)',
        oldLabel: 'Old',
        leftLabel: 'Left',
        thisMonthAve: 'This Month Average',
        today: 'Today',
        myClass: 'My',
        reminder30m: 'Reminder 30m before',
        qrCode: 'QR Code',
        hideQr: 'Hide QR',
        showQr: 'Show QR',
        viewList: 'List',
        viewDaily: 'Daily',
        viewWeekly: 'Weekly',
        aiRevenueUp: 'Your revenue is up {percent}%. Click for details.',
        aiRevenueStable: 'Revenue is stable. Consider opening new groups.',
        aiAnalysisReady: 'AI Analysis Ready',
        reminder: 'Reminder',
        week: 'Week',
    },
};

export const LANG_META: Record<Lang, { flag: string; label: string }> = {
    ka: { flag: '🇬🇪', label: 'ქართული' },
    ru: { flag: '🇷🇺', label: 'Русский' },
    en: { flag: '🇬🇧', label: 'English' },
};
