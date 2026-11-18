import './_group.css';
import './Refreshed.css';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDown, Check, ChevronDown, ClipboardList, FileText, Heart, Menu, Moon, PackageCheck, Plus, ReceiptText, Search, ShieldCheck, ShoppingBag, Sun, X, ScanLine, Truck, Scale, ScanText } from 'lucide-react';

type Locale = 'ar' | 'en';
type PlanId = 'small-restaurant' | 'growth' | 'chain';
const invoiceRows = [
  { item: 'طماطم', unit: 'كغ', ordered: 40, received: 36, billed: 40, price: 4.25 },
  { item: 'جبنة بيضاء', unit: 'علبة', ordered: 12, received: 12, billed: 12, price: 18.5 },
  { item: 'حليب طازج', unit: 'لتر', ordered: 30, received: 30, billed: 30, price: 5.75 },
  { item: 'خبز صامولي', unit: 'كيس', ordered: 25, received: 22, billed: 25, price: 3.2 },
];
const plans: { id: PlanId; name: [string, string]; price: number; audience: [string, string] }[] = [
  { id: 'small-restaurant', name: ['مطعم صغير', 'Small restaurant'], price: 9, audience: ['لمطعم أو مقهى بفرع واحد يبدأ بمراجعة فواتيره.', 'For a single-location restaurant or café starting invoice reviews.'] },
  { id: 'growth', name: ['نمو', 'Growth'], price: 24, audience: ['لمطعم يتعامل مع موردين أكثر ويريد ترتيبًا أوضح.', 'For a restaurant working with more suppliers and seeking clearer organization.'] },
  { id: 'chain', name: ['سلسلة', 'Chain'], price: 59, audience: ['لعدة فروع تُراجع فواتيرها في مكان واحد.', 'For multiple locations reviewing invoices in one place.'] },
];
const featureData = [
  { id: 'supplier-save', Icon: Truck, title: ['حفظ اسم المورد', 'Save supplier name'], body: ['أضف اسم مورّدك ويُحفظ في كاشف الآن، مع تأكيد نجاح الحفظ.', 'Add a supplier name and save it in Kashef, with a clear confirmation.'], status: 'available', keys: 'supplier vendor name مورد موردين حفظ اسم' },
  { id: 'purchase-orders', Icon: ClipboardList, title: ['أوامر الشراء', 'Purchase orders'], body: ['تسجيل ما طلبته من المورد بالأصناف والكميات. قيد التطوير ولم يُفعّل بعد.', 'Record what you ordered by item and quantity. In development; not enabled yet.'], status: 'planned', keys: 'purchase order items quantities أمر شراء طلب كميات أصناف' },
  { id: 'receiving', Icon: PackageCheck, title: ['تسجيل الاستلام', 'Record delivery'], body: ['تدوين ما وصل فعلًا عند الباب. مخطط له، وغير متاح حاليًا.', 'Record what actually arrived at your door. Planned, not currently available.'], status: 'planned', keys: 'receiving delivery quantity استلام توريدة وصل كميات' },
  { id: 'extraction', Icon: ScanText, title: ['قراءة الفواتير', 'Read invoices'], body: ['الصق نص فاتورة المورد أو ارفع صورة أو PDF؛ يستخرج كاشف البنود ويتحقق من الحساب. راجع نتائج الصور يدويًا.', 'Paste invoice text or upload an image or PDF. Kashef extracts line items and checks arithmetic. Review image results manually.'], status: 'available', keys: 'invoice text image pdf extraction حساب فاتورة نص صورة قراءة' },
  { id: 'matching', Icon: Scale, title: ['المطابقة وعرض الفروقات', 'Match and show differences'], body: ['مقارنة الطلب والاستلام والفاتورة وإظهار الفروقات. المثال في الأعلى توضيحي فقط.', 'Compare the order, delivery and invoice to show differences. The example above is illustrative only.'], status: 'planned', keys: 'match comparison differences مطابقة فروقات مقارنة' },
];
const questions: [string, string, string, string][] = [
  ['ما الذي يراجعه كاشف؟', 'What does Kashef review?', 'يقارن كاشف بين ما طلبته، وما استلمته، وما كتبه المورد في الفاتورة.', 'Kashef compares what you ordered, what you received, and what the supplier billed.'],
  ['هل أحتاج خبرة محاسبية؟', 'Do I need accounting experience?', 'لا. تظهر الفروقات بكلمات واضحة لتراجعها قبل الدفع.', 'No. Differences are explained clearly so you can review them before payment.'],
  ['هل يمكنني تجربة الباقات؟', 'Can I try the plans?', 'نعم، الشهر الأول مجاناً. الأسعار المعروضة بالدينار الكويتي.', 'Yes. The first month is free. Prices are shown in Kuwaiti dinars.'],
  ['لمن صُمّم كاشف؟', 'Who is Kashef for?', 'لأصحاب المطاعم والمقاهي والبقالات الذين يراجعون فواتير الموردين.', 'For restaurant, café and grocery owners who review supplier invoices.'],
];
const sampleInvoice = `فاتورة ضريبية (مثال تجريبي غير حقيقي)
المورد: مؤسسة الساحل للتموين - الكويت
رقم الفاتورة: 2025-0417
العملة: دينار كويتي (KWD)

1) طماطم محلية - 12 كغ × 0.450 = 5.400
2) جبنة بيضاء - 6 علبة × 1.875 = 11.250
3) زيت دوار الشمس 1.8 لتر - 4 × 2.125 = 8.500  (خصم على الصنف 0.500)
4) خبز صامولي - 20 كيس × 0.150 = 3.000

المجموع الفرعي: 27.650
خصم 5%: 1.383
رسوم توصيل: 1.000
الإجمالي المستحق: 27.267`;

const copy = {
  ar: {
    skip: 'تخطَّ إلى المحتوى', nav: ['كيف يعمل', 'المميزات', 'الباقات', 'الأسئلة'], mainNav: 'التنقل الرئيسي', brand: 'كاشف', login: 'ابدأ مجاناً',
    heroKicker: 'للمطاعم والمقاهي والبقالات', heroA: 'ادفع لمورّدك', heroB: 'وأنت متأكد.', heroText: 'قارن ما طلبته بما وصل وما في الفاتورة. اكتشف الفرق قبل أن تدفع — ببساطة.',
    how: 'كيف يعمل', reassurance: 'لا تحتاج إلى خبرة محاسبية.', invoiceSource: 'فاتورة مورد خضار وألبان', invoiceTitle: 'مراجعة قبل الدفع', demo: 'مثال توضيحي', headers: ['الصنف', 'طُلب', 'وصل', 'الفاتورة'], impact: 'فرق يستحق المراجعة', caption: 'أرقام افتراضية للتوضيح فقط، وليست بيانات حقيقية أو مراجعة مباشرة.',
    story: '«طلبت أربعين، وصلت ستة وثلاثين، والفاتورة تقول أربعين.»', stats: ['كمية زائدة', 'سعر مختلف', 'فاتورة مكررة'], storyFoot: 'فرق صغير في كل توريدة يتراكم بصمت. كاشف يجعله واضحاً.',
    labelSimple: 'بلا تعقيد', workflowTitle: 'أربع خطوات. مطابقة واحدة.', workflowText: 'كل شيء واضح من البداية: ما طلبته، ما وصلك، وما يطلبه المورد.', stepLabel: 'الخطوات الأربع', steps: [['أمر الشراء', 'سجّل الأصناف والكميات التي طلبتها.'], ['الاستلام', 'أدخل ما وصل إلى بابك فعلاً.'], ['الفاتورة', 'أضف تفاصيل فاتورة المورد.'], ['راجع الفرق', 'شاهد ما يحتاج إلى مراجعة قبل الدفع.']],
    available: 'متاح الآن', analyzeTitle: 'أدخل الفاتورة. نراجع الحساب.', analyzeText: 'الصق نص الفاتورة بأي ترتيب، أو ارفع صورة أو PDF. نقبل حتى القوائم المختصرة مثل «حليب 230»؛ الحقول الناقصة تُترك للمراجعة بدل رفض الفاتورة. الصور الممسوحة تُعلّم دائمًا للمراجعة البصرية.',
    privacyTitle: 'قبل الإرسال', privacy: 'هذا نموذج تجريبي محلي. لا يُرسل النص أو الملف إلى أي خدمة؛ استخدم بيانات غير حساسة فقط.', inputTitle: 'نص الفاتورة (اختياري)', fillSample: 'املأ بمثال تجريبي', placeholder: 'مثلًا:\nحليب 230\nبصل 400\nأو الصق الفاتورة كاملة بأي صيغة نصية', fileLabel: 'ارفع صورة أو PDF', fileHint: 'JPG، PNG، WebP أو PDF', consent: 'أوافق على معالجة هذه البيانات محليًا في هذا النموذج التجريبي، وأؤكد أنها لا تحتوي على معلومات حساسة.', analyze: 'حلّل الفاتورة', clear: 'مسح النص', needConsent: 'يلزم تأكيد الموافقة قبل التحليل.', tooShort: 'أدخل ١٠ أحرف على الأقل أو ارفع ملفًا.', both: 'استخدم النص أو الملف، وليس الاثنين معًا.', fileError: 'اختر صورة أو ملف PDF صالحًا.', analyzing: 'تم استلام المثال. في هذا النموذج لا يتم إرسال البيانات أو تحليلها فعليًا.', result: 'تم إرسال طلب المراجعة التجريبي محليًا. لا توجد نتيجة تحليل فعلية.',
    featureLabel: 'الأداة تتطور بوضوح', featureTitle: 'ما يعمل اليوم، وما نبنيه بعده.', featureText: 'نكتب الحالة بوضوح: بعض المميزات متاح الآن، والباقي مخطط له ولم يُفعّل بعد.', searchLabel: 'ابحث في المميزات', searchPlaceholder: 'ابحث: فاتورة، استلام، مورد…', favOnly: 'المفضلة فقط', availableStatus: 'متاح الآن', plannedStatus: 'مخطط له', empty: 'لا شيء يطابق بحثك', emptyHint: 'جرّب كلمة أخرى، أو اعرض كل المميزات.', reset: 'عرض كل المميزات',
    plansLabel: 'واضحة من البداية', plansTitle: 'باقات بلا مفاجآت.', plansText: 'اختر ما يناسب عملك. الشهر الأول مجاناً، والأسعار بالدينار الكويتي.', plansNotice: 'استكشف الباقات وأضف أكثر من خطة إلى معاينة السلة. لا توجد عملية دفع في هذا النموذج.', firstMonth: 'الشهر الأول مجاناً', monthly: 'شهرياً', add: 'أضف إلى السلة', inCart: 'في السلة، عرض السلة', cartTitle: 'معاينة الباقات', cartEmpty: 'لم تضف أي باقة بعد. اختر خطة لمعاينة السلة.', cartTotal: 'المجموع الشهري', cartNote: 'المعاينة فقط — لا يوجد دفع أو اشتراك أو اتصال بخدمة خارجية.', remove: 'إزالة', clearCart: 'إفراغ السلة', close: 'إغلاق', cartAria: 'فتح السلة', menuOpen: 'فتح القائمة', menuClose: 'إغلاق القائمة', toggleTheme: 'تبديل المظهر', toggleLanguage: 'Switch to English', favorite: 'أضف إلى المفضلة', unfavorite: 'إزالة من المفضلة', faqLabel: 'إجابات واضحة', faqTitle: 'الأسئلة الشائعة',
    ctaTitle: 'ابدأ بمورّد واحد', ctaText: 'جرّب مراجعة فاتورتك القادمة قبل الدفع.', ctaButton: 'ابدأ مجاناً', footer: 'راجع فاتورة المورد قبل أن تدفع.', toastAdded: 'أُضيفت الباقة إلى معاينة السلة.', toastRemoved: 'أُزيلت الباقة من معاينة السلة.', langName: 'EN',
  },
  en: {
    skip: 'Skip to content', nav: ['How it works', 'Features', 'Plans', 'FAQ'], mainNav: 'Main navigation', brand: 'كاشف', login: 'Start for free',
    heroKicker: 'For restaurants, cafés & groceries', heroA: 'Pay your supplier', heroB: 'with confidence.', heroText: 'Compare what you ordered, what arrived and what is on the invoice. Spot the difference before you pay — simply.',
    how: 'How it works', reassurance: 'No accounting experience needed.', invoiceSource: 'Produce & dairy supplier invoice', invoiceTitle: 'Review before payment', demo: 'Illustrative example', headers: ['Item', 'Ordered', 'Received', 'Invoiced'], impact: 'Difference to review', caption: 'Illustrative figures only — not real data or a live review.',
    story: '“We ordered forty, thirty-six arrived, and the invoice says forty.”', stats: ['Extra quantity', 'Price difference', 'Duplicate invoice'], storyFoot: 'A small difference in every delivery quietly adds up. Kashef makes it visible.',
    labelSimple: 'Straightforward', workflowTitle: 'Four steps. One clear match.', workflowText: 'See the full picture: what you ordered, what arrived, and what the supplier billed.', stepLabel: 'The four steps', steps: [['Purchase order', 'Record the items and quantities you ordered.'], ['Receiving', 'Enter what actually arrived at your door.'], ['Invoice', 'Add the supplier invoice details.'], ['Review the difference', 'See what needs your attention before payment.']],
    available: 'Available now', analyzeTitle: 'Add an invoice. Check the math.', analyzeText: 'Paste invoice text in any order, or upload an image or PDF. Short lists like “Milk 230” are accepted; missing fields are left for review rather than rejected. Scanned images are always flagged for visual review.',
    privacyTitle: 'Before you submit', privacy: 'This is a local demo. Text and files are not sent to any service; use non-sensitive sample data only.', inputTitle: 'Invoice text (optional)', fillSample: 'Fill with sample invoice', placeholder: 'For example:\nMilk 230\nOnions 400\nOr paste a full invoice in any text format', fileLabel: 'Upload image or PDF', fileHint: 'JPG, PNG, WebP or PDF', consent: 'I agree to process this data locally in this demo, and confirm it contains no sensitive information.', analyze: 'Review invoice', clear: 'Clear text', needConsent: 'Please confirm consent before reviewing.', tooShort: 'Enter at least 10 characters or upload a file.', both: 'Use text or a file, not both.', fileError: 'Choose a valid image or PDF file.', analyzing: 'Sample received. This mockup does not send or actually analyze data.', result: 'Your local demo review was submitted. No actual analysis result is produced.',
    featureLabel: 'Built with clear status', featureTitle: 'What works today, and what comes next.', featureText: 'We label every feature honestly: some are available now; others are planned and not yet enabled.', searchLabel: 'Search features', searchPlaceholder: 'Search: invoice, receiving, supplier…', favOnly: 'Favorites only', availableStatus: 'Available now', plannedStatus: 'Planned', empty: 'No matching features', emptyHint: 'Try another search, or show all features.', reset: 'Show all features',
    plansLabel: 'Clear from day one', plansTitle: 'Plans without surprises.', plansText: 'Choose what suits your business. The first month is free. Prices are in Kuwaiti dinars.', plansNotice: 'Explore plans and add more than one to your cart preview. There is no checkout in this mockup.', firstMonth: 'First month free', monthly: 'monthly', add: 'Add to cart', inCart: 'In cart, view cart', cartTitle: 'Plan preview', cartEmpty: 'No plans added yet. Choose a plan to preview your cart.', cartTotal: 'Monthly total', cartNote: 'Preview only — no payment, subscription or external service connection.', remove: 'Remove', clearCart: 'Clear cart', close: 'Close', cartAria: 'Open cart', menuOpen: 'Open menu', menuClose: 'Close menu', toggleTheme: 'Toggle theme', toggleLanguage: 'التبديل إلى العربية', favorite: 'Add to favorites', unfavorite: 'Remove from favorites', faqLabel: 'Clear answers', faqTitle: 'Frequently asked questions',
    ctaTitle: 'Start with one supplier', ctaText: 'Try reviewing your next invoice before payment.', ctaButton: 'Start for free', footer: 'Review a supplier invoice before you pay.', toastAdded: 'Plan added to your cart preview.', toastRemoved: 'Plan removed from your cart preview.', langName: 'ع',
  },
} as const;
const word = (locale: Locale, pair: readonly string[]) => pair[locale === 'ar' ? 0 : 1] ?? '';

function Step({ n, Icon, title, body }: { n: string; Icon: typeof ClipboardList; title: string; body: string }) {
  return <li className="kr-step"><span className="kr-step-n">{n}</span><div><h3><Icon className="kr-step-icon" aria-hidden />{title}</h3><p>{body}</p></div></li>;
}

export function Refreshed() {
  const [locale, setLocale] = useState<Locale>(() => {
    try { return localStorage.getItem('kashef-refreshed-locale') === 'en' ? 'en' : 'ar'; } catch { return 'ar'; }
  });
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('kashef-refreshed-theme') === 'dark'; } catch { return false; }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedPlans, setSelectedPlans] = useState<PlanId[]>([]);
  const [query, setQuery] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('kashef-refreshed-favorites') || '[]') as string[]; } catch { return []; }
  });
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const t = copy[locale];
  const isAr = locale === 'ar';

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    try { localStorage.setItem('kashef-refreshed-locale', locale); } catch { /* local preference is optional */ }
  }, [locale, isAr]);
  useEffect(() => {
    try { localStorage.setItem('kashef-refreshed-theme', dark ? 'dark' : 'light'); } catch { /* local preference is optional */ }
  }, [dark]);
  useEffect(() => {
    try { localStorage.setItem('kashef-refreshed-favorites', JSON.stringify(favorites)); } catch { /* local preference is optional */ }
  }, [favorites]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const normalizedQuery = query.toLocaleLowerCase().replace(/[\u064B-\u0652]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
  const visibleFeatures = useMemo(() => featureData.filter((feature) => {
    const searchable = `${feature.title.join(' ')} ${feature.body.join(' ')} ${feature.keys}`.toLocaleLowerCase().replace(/[\u064B-\u0652]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
    return (!onlyFavorites || favorites.includes(feature.id)) && (!normalizedQuery || searchable.includes(normalizedQuery));
  }), [favorites, normalizedQuery, onlyFavorites]);
  const cartTotal = selectedPlans.reduce((sum, id) => sum + (plans.find((plan) => plan.id === id)?.price ?? 0), 0);
  const toggleFavorite = (id: string) => setFavorites((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
  const togglePlan = (id: PlanId) => {
    const had = selectedPlans.includes(id);
    setSelectedPlans((current) => had ? current.filter((entry) => entry !== id) : [...current, id]);
    setCartOpen(true);
    setToast(had ? t.toastRemoved : t.toastAdded);
  };
  const submitInvoice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setFeedback('');
    if (!consent) { setError(t.needConsent); return; }
    if (file && text.trim()) { setError(t.both); return; }
    if (file && !/\.(pdf|jpe?g|png|webp)$/i.test(file.name)) { setError(t.fileError); return; }
    if (!file && text.trim().length < 10) { setError(t.tooShort); return; }
    setFeedback(t.result);
  };

  const links: [string, string][] = [['#how', t.nav[0]], ['#features', t.nav[1]], ['#plans', t.nav[2]], ['#faq', t.nav[3]]];
  const closeMenu = () => setMenuOpen(false);
  const goPlans = () => { setCartOpen(false); document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' }); };

  return <div className="kr" dir={isAr ? 'rtl' : 'ltr'} lang={locale} data-theme={dark ? 'dark' : 'light'}>
    <a className="sr-only focus:not-sr-only" href="#top">{t.skip}</a>
    <header className="kr-header">
      <div className="kr-wrap kr-head-inner">
        <a className="kr-brand" href="#top" aria-label={t.brand}><span className="kr-mark" aria-hidden>ك</span><span>{t.brand}</span></a>
        <nav className="kr-nav" aria-label={t.mainNav}>{links.map(([href, label]) => <a href={href} key={href}>{label}</a>)}</nav>
        <div className="kr-actions">
          <button className="kr-lang" type="button" onClick={() => { setLocale(isAr ? 'en' : 'ar'); closeMenu(); }} aria-label={t.toggleLanguage} title={t.toggleLanguage}>{t.langName}</button>
          <button className="kr-icon-btn" type="button" onClick={() => setDark((value) => !value)} aria-label={t.toggleTheme} title={t.toggleTheme}>{dark ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}</button>
          <button className="kr-icon-btn" type="button" onClick={() => setCartOpen(true)} aria-label={`${t.cartAria}, ${selectedPlans.length}`} title={t.cartAria}><ShoppingBag size={17} aria-hidden />{selectedPlans.length > 0 && <span>{selectedPlans.length}</span>}</button>
          <a className="kr-header-cta" href="#plans">{t.login}</a>
          <button className="kr-icon-btn kr-mobile-toggle" type="button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-label={menuOpen ? t.menuClose : t.menuOpen}>{menuOpen ? <X size={19} aria-hidden /> : <Menu size={19} aria-hidden />}</button>
        </div>
      </div>
      {menuOpen && <nav className="kr-mobile-nav" aria-label={t.mainNav}>{links.map(([href, label]) => <a href={href} key={href} onClick={closeMenu}>{label}</a>)}</nav>}
    </header>

    <main id="top">
      <section className="kr-hero">
        <div className="kr-wrap kr-hero-grid">
          <div>
            <p className="kr-eyebrow">{t.heroKicker}</p>
            <h1>{t.heroA}<br /><span className="kr-highlight">{t.heroB}</span></h1>
            <p className="kr-lead">{t.heroText}</p>
            <div className="kr-hero-actions"><a className="kr-btn kr-btn-primary" href="#plans">{t.login}<ArrowDown size={16} aria-hidden /></a><a className="kr-btn kr-btn-secondary" href="#how">{t.how}</a></div>
            <p className="kr-reassurance"><ShieldCheck size={15} aria-hidden />{t.reassurance}</p>
          </div>
          <figure className="kr-invoice" aria-label={isAr ? 'مثال توضيحي لمراجعة فاتورة المورد' : 'Illustrative supplier invoice review'}>
            <header className="kr-invoice-head"><div><p className="kr-invoice-kicker">{t.invoiceSource}</p><h2 className="kr-invoice-title">{t.invoiceTitle}</h2></div><span className="kr-pill"><span className="kr-pill-dot" aria-hidden />{t.demo}</span></header>
            <div className="kr-table-scroll"><table className="kr-table"><thead><tr>{t.headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{invoiceRows.map((row) => {
              const mismatch = row.billed !== row.received;
              return <tr key={row.item}><td>{row.item} <span style={{ color: 'var(--kr-muted)', fontSize: '.68rem' }}>/ {row.unit}</span></td><td>{row.ordered}</td><td className={mismatch ? 'kr-mismatch' : ''}>{row.received}</td><td className={mismatch ? 'kr-mismatch' : ''}>{row.billed}</td></tr>;
            })}</tbody></table></div>
            <div className="kr-impact"><div className="kr-impact-title"><span>{t.impact}</span><b className="kr-impact-total"><bdi dir="ltr">26.60 KWD</bdi></b></div><ul className="kr-impact-list">{invoiceRows.filter((row) => row.billed !== row.received).map((row) => <li key={row.item}><span>{row.item}: {row.billed} {isAr ? 'في الفاتورة،' : 'billed,'} {row.received} {isAr ? 'وصل' : 'received'}</span><b><bdi dir="ltr">{((row.billed - row.received) * row.price).toFixed(2)} KWD</bdi></b></li>)}</ul></div>
            <figcaption className="kr-caption">{t.caption}</figcaption>
          </figure>
        </div>
      </section>
      <section className="kr-story" aria-label={isAr ? 'أمثلة على الفروقات' : 'Examples of discrepancies'}>
        <div className="kr-wrap kr-story-content"><p className="kr-quote">{t.story}</p><div className="kr-stat-grid">{['04', '01', '02'].map((value, index) => <div className="kr-stat" key={value}><strong>{value}</strong><span>{t.stats[index]}</span></div>)}</div><p className="kr-story-foot">{t.storyFoot}</p></div>
      </section>

      <section className="kr-section" id="how">
        <div className="kr-wrap kr-workflow">
          <div className="kr-section-head"><p className="kr-section-label">{t.labelSimple}</p><h2 className="kr-section-title">{t.workflowTitle}</h2><p className="kr-section-sub">{t.workflowText}</p></div>
          <ol className="kr-steps" aria-label={t.stepLabel}>
            <Step n="١" Icon={ClipboardList} title={word(locale, ['أمر الشراء', 'Purchase order'])} body={t.steps[0][1]} />
            <Step n="٢" Icon={PackageCheck} title={word(locale, ['الاستلام', 'Receiving'])} body={t.steps[1][1]} />
            <Step n="٣" Icon={ReceiptText} title={word(locale, ['الفاتورة', 'Invoice'])} body={t.steps[2][1]} />
            <Step n="٤" Icon={ScanLine} title={t.steps[3][0]} body={t.steps[3][1]} />
          </ol>
        </div>
      </section>

      <section className="kr-section kr-section-soft" id="invoice-analysis">
        <div className="kr-wrap kr-analysis-grid">
          <div className="kr-section-head"><p className="kr-section-label">{t.available}</p><h2 className="kr-section-title">{t.analyzeTitle}</h2><p className="kr-section-sub">{t.analyzeText}</p><div className="kr-note"><strong>{t.privacyTitle}</strong><br />{t.privacy}</div></div>
          <form className="kr-form" onSubmit={submitInvoice} noValidate>
            <div className="kr-form-top"><label htmlFor="kr-invoice-text">{t.inputTitle}</label><button className="kr-small-btn" type="button" onClick={() => { setText(sampleInvoice); setFile(null); setError(''); setFeedback(''); }}>{<FileText size={14} aria-hidden />}{t.fillSample}</button></div>
            <textarea id="kr-invoice-text" className="kr-textarea" value={text} onChange={(event) => { setText(event.target.value); setFeedback(''); setError(''); }} placeholder={t.placeholder} aria-label={t.inputTitle} />
            <div className="kr-file-row"><label htmlFor="kr-invoice-file">{t.fileLabel}</label><input id="kr-invoice-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" aria-label={t.fileLabel} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setText(''); setError(''); setFeedback(''); }} /><span>{t.fileHint}</span>{file && <button className="kr-small-btn" type="button" onClick={() => setFile(null)} aria-label={isAr ? 'إزالة الملف المحدد' : 'Remove selected file'}><X size={14} aria-hidden />{file.name}</button>}</div>
            <label className="kr-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>{t.consent}</span></label>
            <div className="kr-submit-row"><button className="kr-btn kr-btn-primary" type="submit"><ScanLine size={16} aria-hidden />{t.analyze}</button>{text && <button className="kr-btn kr-btn-secondary" type="button" onClick={() => { setText(''); setError(''); setFeedback(''); }}>{t.clear}</button>}</div>
            {error && <p className="kr-feedback kr-error" role="alert">{error}</p>}
            {feedback && <p className="kr-feedback" role="status">{feedback}</p>}
          </form>
        </div>
      </section>

      <section className="kr-section" id="features">
        <div className="kr-wrap">
          <div className="kr-section-head"><p className="kr-section-label">{t.featureLabel}</p><h2 className="kr-section-title">{t.featureTitle}</h2><p className="kr-section-sub">{t.featureText}</p></div>
          <div className="kr-feature-tools">
            <div className="kr-search-wrap"><Search className="kr-search-icon" size={16} aria-hidden /><label className="sr-only" htmlFor="kr-feature-search">{t.searchLabel}</label><input id="kr-feature-search" className="kr-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchPlaceholder} /></div>
            <button className="kr-filter" type="button" aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites((value) => !value)}><Heart size={15} aria-hidden />{t.favOnly} ({favorites.length})</button>
          </div>
          <ul className="kr-feature-grid">{visibleFeatures.length ? visibleFeatures.map((feature) => {
            const favorite = favorites.includes(feature.id);
            const Icon = feature.Icon;
            return <li className="kr-feature" key={feature.id}><div className="kr-feature-head"><span className="kr-feature-icon"><Icon size={18} aria-hidden /></span><button className="kr-fav" type="button" aria-pressed={favorite} aria-label={favorite ? t.unfavorite : t.favorite} onClick={() => toggleFavorite(feature.id)}><Heart size={18} fill={favorite ? 'currentColor' : 'none'} aria-hidden /></button></div><h3>{word(locale, feature.title)}</h3><p>{word(locale, feature.body)}</p><span className={`kr-status ${feature.status === 'planned' ? 'kr-status-planned' : ''}`}><span aria-hidden>{feature.status === 'available' ? '●' : '◷'}</span>{feature.status === 'available' ? t.availableStatus : t.plannedStatus}</span></li>;
          }) : <li className="kr-empty"><strong>{t.empty}</strong><p>{t.emptyHint}</p><button className="kr-small-btn" type="button" onClick={() => { setQuery(''); setOnlyFavorites(false); }}>{t.reset}</button></li>}</ul>
        </div>
      </section>

      <section className="kr-section kr-plans" id="plans">
        <div className="kr-wrap">
          <div className="kr-section-head"><p className="kr-section-label">{t.plansLabel}</p><h2 className="kr-section-title">{t.plansTitle}</h2><p className="kr-section-sub">{t.plansText}</p><div className="kr-plan-notice">{t.plansNotice}</div></div>
          <ul className="kr-plan-grid">{plans.map((plan, index) => {
            const isSelected = selectedPlans.includes(plan.id);
            return <li className={`kr-plan ${index === 1 ? 'kr-plan-featured' : ''}`} key={plan.id}><h3>{word(locale, plan.name)}</h3><p>{word(locale, plan.audience)}</p><div className="kr-price"><strong><bdi dir="ltr">{plan.price}</bdi></strong><span>KWD / {t.monthly}</span></div><span className="kr-free">{t.firstMonth}</span><button className={`kr-btn ${isSelected ? 'kr-btn-secondary' : 'kr-btn-primary'}`} type="button" onClick={() => togglePlan(plan.id)}>{isSelected ? <Check size={16} aria-hidden /> : <Plus size={16} aria-hidden />}{isSelected ? t.inCart : t.add}</button></li>;
          })}</ul>
        </div>
      </section>

      <section className="kr-section" id="faq">
        <div className="kr-wrap kr-faq-layout"><div className="kr-section-head"><p className="kr-section-label">{t.faqLabel}</p><h2 className="kr-section-title">{t.faqTitle}</h2></div>
          <div className="kr-faq-list">{questions.map((question, index) => <div className="kr-faq-item" key={question[0]}><button className="kr-faq-trigger" type="button" aria-expanded={openFaq === index} aria-controls={`kr-faq-answer-${index}`} onClick={() => setOpenFaq((current) => current === index ? null : index)}>{question[isAr ? 0 : 1]}<ChevronDown size={17} aria-hidden style={{ transform: openFaq === index ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} /></button>{openFaq === index && <p className="kr-faq-answer" id={`kr-faq-answer-${index}`}>{question[isAr ? 2 : 3]}</p>}</div>)}</div>
        </div>
      </section>

      <section className="kr-wrap kr-cta"><div><h2>{t.ctaTitle}</h2><p>{t.ctaText}</p></div><a className="kr-btn kr-btn-primary" href="#plans">{t.ctaButton}<ArrowDown size={15} aria-hidden /></a></section>
    </main>
    <footer className="kr-footer"><div className="kr-wrap kr-footer-inner"><a className="kr-footer-brand" href="#top">{t.brand}</a><span>{t.footer}</span><button className="kr-small-btn" type="button" onClick={() => setLocale(isAr ? 'en' : 'ar')} aria-label={t.toggleLanguage}>{t.toggleLanguage}</button></div></footer>

    {cartOpen && <div className="kr-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}><aside className="kr-cart" role="dialog" aria-modal="true" aria-labelledby="kr-cart-title"><header className="kr-cart-head"><h2 id="kr-cart-title">{t.cartTitle}</h2><button className="kr-icon-btn" type="button" aria-label={t.close} onClick={() => setCartOpen(false)}><X size={18} aria-hidden /></button></header>{selectedPlans.length ? <><ul className="kr-cart-list">{selectedPlans.map((id) => {
      const plan = plans.find((entry) => entry.id === id);
      if (!plan) return null;
      return <li className="kr-cart-item" key={id}><span>{word(locale, plan.name)}<br /><strong><bdi dir="ltr">{plan.price} KWD</bdi></strong></span><button className="kr-small-btn" type="button" onClick={() => setSelectedPlans((current) => current.filter((entry) => entry !== id))} aria-label={`${t.remove}: ${word(locale, plan.name)}`}><X size={14} aria-hidden />{t.remove}</button></li>;
    })}</ul><div className="kr-cart-total"><span>{t.cartTotal}</span><b><bdi dir="ltr">{cartTotal} KWD</bdi></b></div><p className="kr-cart-note">{t.cartNote}</p><button className="kr-btn kr-btn-secondary" type="button" onClick={() => setSelectedPlans([])}>{t.clearCart}</button></> : <div className="kr-cart-empty"><ShoppingBag size={26} aria-hidden /><p>{t.cartEmpty}</p><button className="kr-btn kr-btn-primary" type="button" onClick={goPlans}>{t.plansTitle}</button></div>}</aside></div>}
    {toast && <div className="kr-toast" role="status">{toast}</div>}
  </div>;
}
