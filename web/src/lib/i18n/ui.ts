import type { Lang } from '@/lib/content/types'

/** Short UI chrome labels only. Page content always comes from the READMEs. */
export type UiKey =
  | 'explorer'
  | 'openEditors'
  | 'downloadCv'
  | 'live'
  | 'repository'
  | 'language'
  | 'closeTab'
  | 'notFound'
  | 'backHome'
  | 'pageHome'
  | 'pageProjects'
  | 'pageExperience'
  | 'pageSkills'
  | 'education'
  | 'languages'
  | 'certifications'
  | 'links'
  | 'skillsMatrix'
  | 'contact'
  | 'techStack'
  | 'screenshots'
  | 'openImage'
  | 'closeImage'
  | 'previousImage'
  | 'nextImage'
  | 'backToProjects'
  | 'openDashboard'
  | 'dashboardBadge'
  | 'previousAnalysis'
  | 'nextAnalysis'
  | 'outline'
  | 'timeline'
  | 'outlineEmpty'
  | 'timelineEmpty'
  | 'spaces'
  | 'noProblems'
  | 'pageCv'
  | 'summary'
  | 'downloadPdf'
  | 'printCv'
  | 'navAbout'
  | 'navExperience'
  | 'navSkills'
  | 'navProjects'
  | 'navContact'
  | 'folderWorks'
  | 'folderBi'
  | 'folderCertifications'
  | 'activityBar'
  | 'actExplorer'
  | 'actSearch'
  | 'actSourceControl'
  | 'actRunDebug'
  | 'actExtensions'
  | 'actGithub'
  | 'actAccounts'
  | 'actSettings'
  | 'searchPlaceholder'
  | 'noResults'
  | 'toggleSidebar'
  | 'togglePanel'
  | 'toggleSecondarySidebar'
  | 'minimize'
  | 'restore'
  | 'closeWindow'
  | 'portfolio'
  | 'menuBar'
  | 'scripts'
  | 'scriptsEmpty'
  | 'goLive'
  | 'openChanges'
  | 'splitEditor'
  | 'moreActions'
  | 'scrollDown'
  | 'switchToEn'
  | 'switchToVi'
  | 'openOriginal'
  | 'pdfFallback'
  | 'openPdf'
  | 'resizeExplorer'
  | 'skillsNo'
  | 'skillsCategory'
  | 'skillsTools'
  | 'readmeEnglishOnly'
  | 'formName'
  | 'formEmail'
  | 'formCompany'
  | 'formMessage'
  | 'formOptional'
  | 'formNamePlaceholder'
  | 'formEmailPlaceholder'
  | 'formCompanyPlaceholder'
  | 'formMessagePlaceholder'
  | 'formSend'
  | 'formSending'
  | 'formSent'
  | 'formError'
  | 'formInvalid'
  | 'formTooFast'
  | 'formStale'
  | 'formRateLimited'
  | 'formFallback'
  | 'formTitle'
  | 'formOrEmail'

/** Every label is a string, except the title bar's menu row, which is a list of menu names. */
export type UiStrings = Record<Exclude<UiKey, 'menuBar'>, string> & { menuBar: readonly string[] }

const STRINGS: Record<Lang, UiStrings> = {
  en: {
    explorer: 'Explorer',
    openEditors: 'Open editors',
    downloadCv: 'Download CV',
    live: 'Live',
    repository: 'Repository',
    language: 'Language',
    closeTab: 'Close',
    notFound: 'File not found',
    backHome: 'Open About Me',
    pageHome: 'Home',
    pageProjects: 'Projects',
    pageExperience: 'Experience',
    pageSkills: 'Skills',
    education: 'Education',
    languages: 'Languages',
    certifications: 'Certifications',
    links: 'Links',
    skillsMatrix: 'Tech skills',
    contact: 'Contact',
    techStack: 'Tech stack',
    screenshots: 'Screenshots',
    openImage: 'Enlarge screenshot',
    closeImage: 'Close',
    previousImage: 'Previous screenshot',
    nextImage: 'Next screenshot',
    backToProjects: 'All projects',
    openDashboard: 'Open interactive dashboard',
    dashboardBadge: 'Interactive dashboard',
    previousAnalysis: 'Previous',
    nextAnalysis: 'Next',
    outline: 'Outline',
    timeline: 'Timeline',
    outlineEmpty: 'The active editor cannot provide outline information.',
    timelineEmpty: 'The active editor cannot provide timeline information.',
    spaces: 'Spaces: 2',
    noProblems: 'No problems',
    pageCv: 'CV',
    summary: 'Summary',
    downloadPdf: 'Download PDF',
    printCv: 'Print / Save as PDF',
    navAbout: 'About Me',
    navExperience: 'Work Experience',
    navSkills: 'Skills',
    navProjects: 'Projects',
    navContact: 'Contact Me',
    folderWorks: 'My works',
    folderBi: 'BI projects',
    folderCertifications: 'Certifications',
    activityBar: 'Activity bar',
    actExplorer: 'Explorer',
    actSearch: 'Search – find a skill or project',
    actSourceControl: 'Source Control – github.com/voanhduy1710',
    actRunDebug: 'Run and Debug – live projects',
    actExtensions: 'Extensions – tech stack',
    actGithub: 'GitHub',
    actAccounts: 'Accounts – LinkedIn · Email · Download CV',
    actSettings: 'Settings – EN / VI',
    searchPlaceholder: 'Filter by name',
    noResults: 'No matching files.',
    toggleSidebar: 'Toggle Primary Side Bar',
    togglePanel: 'Toggle Panel',
    toggleSecondarySidebar: 'Toggle Secondary Side Bar',
    minimize: 'Minimize',
    restore: 'Restore',
    closeWindow: 'Close',
    portfolio: 'Portfolio',
    menuBar: ['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help'],
    scripts: 'Scripts',
    scriptsEmpty: 'No scripts found.',
    goLive: 'Go Live',
    openChanges: 'Open Changes',
    splitEditor: 'Split Editor Right',
    moreActions: 'More Actions',
    scrollDown: 'Scroll down',
    switchToEn: 'Switch to English',
    switchToVi: 'Switch to Tiếng Việt',
    openOriginal: 'Open original',
    pdfFallback: 'This browser cannot show the PDF here.',
    openPdf: 'Open the PDF',
    resizeExplorer: 'Resize explorer',
    skillsNo: '№',
    skillsCategory: 'Category',
    skillsTools: 'Tech & Tools',
    // The repo READMEs are English: no note needed on the English page.
    readmeEnglishOnly: '',
    formName: 'Name',
    formEmail: 'Email',
    formCompany: 'Company',
    formMessage: 'Message',
    formOptional: 'optional',
    formNamePlaceholder: 'Your name',
    formEmailPlaceholder: 'you@example.com',
    formCompanyPlaceholder: 'Where you work',
    formMessagePlaceholder: 'Leave a message',
    formSend: 'Send',
    formSending: 'Sending…',
    formSent: 'Thanks! Your message was sent. I will reply by email.',
    formError: 'Sorry, the message could not be sent. Please try again later.',
    formInvalid: 'Please check the fields: a name, a valid email and a message of 10–2000 characters (at most 2 links).',
    formTooFast: 'That was quick! Please wait a few seconds and send again.',
    formStale: 'This page has been open too long. Please reload the page and send again.',
    formRateLimited: 'Too many messages from your network. Please try again in a few minutes.',
    formFallback: 'The contact form is not available right now. Email me directly:',
    formTitle: 'Send a message',
    formOrEmail: 'Or email me directly:',
  },
  vi: {
    explorer: 'Trình duyệt tệp',
    openEditors: 'Tệp đang mở',
    downloadCv: 'Tải CV',
    live: 'Trực tuyến',
    repository: 'Mã nguồn',
    language: 'Ngôn ngữ',
    closeTab: 'Đóng',
    notFound: 'Không tìm thấy tệp',
    backHome: 'Mở trang Giới thiệu',
    pageHome: 'Trang chủ',
    pageProjects: 'Dự án',
    pageExperience: 'Kinh nghiệm',
    pageSkills: 'Kỹ năng',
    education: 'Học vấn',
    languages: 'Ngôn ngữ',
    certifications: 'Chứng chỉ',
    links: 'Liên kết',
    skillsMatrix: 'Kỹ năng công nghệ',
    contact: 'Liên hệ',
    techStack: 'Công nghệ',
    screenshots: 'Ảnh chụp màn hình',
    openImage: 'Phóng to ảnh',
    closeImage: 'Đóng',
    previousImage: 'Ảnh trước',
    nextImage: 'Ảnh sau',
    backToProjects: 'Tất cả dự án',
    openDashboard: 'Mở dashboard tương tác',
    dashboardBadge: 'Dashboard tương tác',
    previousAnalysis: 'Trước',
    nextAnalysis: 'Tiếp',
    outline: 'Dàn ý',
    timeline: 'Dòng thời gian',
    outlineEmpty: 'Trình soạn thảo hiện tại không có thông tin dàn ý.',
    timelineEmpty: 'Trình soạn thảo hiện tại không có thông tin dòng thời gian.',
    spaces: 'Dấu cách: 2',
    noProblems: 'Không có vấn đề',
    pageCv: 'CV',
    summary: 'Tóm tắt',
    downloadPdf: 'Tải PDF',
    printCv: 'In / Lưu thành PDF',
    navAbout: 'Giới thiệu',
    navExperience: 'Kinh nghiệm làm việc',
    navSkills: 'Kỹ năng',
    navProjects: 'Dự án',
    navContact: 'Liên hệ',
    folderWorks: 'Dự án của tôi',
    folderBi: 'Dự án BI',
    folderCertifications: 'Chứng chỉ',
    activityBar: 'Thanh hoạt động',
    actExplorer: 'Trình duyệt tệp',
    actSearch: 'Tìm kiếm – tìm kỹ năng hoặc dự án',
    actSourceControl: 'Quản lý mã nguồn – github.com/voanhduy1710',
    actRunDebug: 'Chạy và gỡ lỗi – dự án trực tuyến',
    actExtensions: 'Tiện ích mở rộng – công nghệ',
    actGithub: 'GitHub',
    actAccounts: 'Tài khoản – LinkedIn · Email · Tải CV',
    actSettings: 'Cài đặt – EN / VI',
    searchPlaceholder: 'Lọc theo tên',
    noResults: 'Không có tệp phù hợp.',
    toggleSidebar: 'Ẩn/hiện thanh bên chính',
    togglePanel: 'Ẩn/hiện bảng',
    toggleSecondarySidebar: 'Ẩn/hiện thanh bên phụ',
    minimize: 'Thu nhỏ',
    restore: 'Khôi phục',
    closeWindow: 'Đóng',
    portfolio: 'Portfolio',
    menuBar: ['Tệp', 'Chỉnh sửa', 'Vùng chọn', 'Xem', 'Đi', 'Chạy', 'Terminal', 'Trợ giúp'],
    scripts: 'Scripts',
    scriptsEmpty: 'Không có script nào.',
    goLive: 'Go Live',
    openChanges: 'Mở thay đổi',
    splitEditor: 'Chia trình soạn thảo',
    moreActions: 'Thêm thao tác',
    scrollDown: 'Cuộn xuống',
    switchToEn: 'Chuyển sang English',
    switchToVi: 'Chuyển sang Tiếng Việt',
    openOriginal: 'Mở bản gốc',
    pdfFallback: 'Trình duyệt này không hiển thị được PDF tại đây.',
    openPdf: 'Mở tệp PDF',
    resizeExplorer: 'Đổi độ rộng explorer',
    skillsNo: '№',
    skillsCategory: 'Danh mục',
    skillsTools: 'Công nghệ & Công cụ',
    readmeEnglishOnly: 'README gốc bằng tiếng Anh',
    formName: 'Họ tên',
    formEmail: 'Email',
    formCompany: 'Công ty',
    formMessage: 'Nội dung',
    formOptional: 'không bắt buộc',
    formNamePlaceholder: 'Tên của bạn',
    formEmailPlaceholder: 'ban@example.com',
    formCompanyPlaceholder: 'Nơi bạn làm việc',
    formMessagePlaceholder: 'Để lại lời nhắn',
    formSend: 'Gửi',
    formSending: 'Đang gửi…',
    formSent: 'Cảm ơn bạn! Tin nhắn đã được gửi. Tôi sẽ trả lời qua email.',
    formError: 'Xin lỗi, chưa gửi được tin nhắn. Vui lòng thử lại sau.',
    formInvalid: 'Vui lòng kiểm tra lại: họ tên, email hợp lệ và nội dung 10–2000 ký tự (tối đa 2 liên kết).',
    formTooFast: 'Nhanh quá! Vui lòng đợi vài giây rồi gửi lại.',
    formStale: 'Trang đã mở quá lâu. Vui lòng tải lại trang rồi gửi lại.',
    formRateLimited: 'Mạng của bạn đã gửi quá nhiều tin nhắn. Vui lòng thử lại sau vài phút.',
    formFallback: 'Biểu mẫu liên hệ hiện không khả dụng. Hãy email trực tiếp cho tôi:',
    formTitle: 'Gửi tin nhắn',
    formOrEmail: 'Hoặc email trực tiếp cho tôi:',
  },
}

export function ui(lang: Lang): UiStrings {
  return STRINGS[lang]
}
