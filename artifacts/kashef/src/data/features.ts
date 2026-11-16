import { ClipboardList, PackageCheck, ScanText, Scale, Truck, type LucideIcon } from 'lucide-react';

export type FeatureStatus = 'available' | 'planned';

export type Feature = {
  id: string;
  title: string;
  body: string;
  status: FeatureStatus;
  icon: LucideIcon;
  keywords: string;
  href?: string;
  linkLabel?: string;
};

export const FEATURES: readonly Feature[] = [
  { id: 'supplier-save', title: 'حفظ اسم المورد', body: 'أضف اسم مورّدك ويُحفظ في كاشف الآن، مع تأكيد نجاح الحفظ.', status: 'available', icon: Truck, keywords: 'مورد موردين حفظ اسم' },
  { id: 'purchase-orders', title: 'أوامر الشراء', body: 'تسجيل ما طلبته من المورد بالأصناف والكميات. قيد التطوير ولم يُفعّل بعد.', status: 'planned', icon: ClipboardList, keywords: 'أمر شراء طلب كميات أصناف' },
  { id: 'receiving', title: 'تسجيل الاستلام', body: 'تدوين ما وصل فعلًا عند الباب. مخطط له، وغير متاح حاليًا.', status: 'planned', icon: PackageCheck, keywords: 'استلام توريدة وصل كميات' },
  { id: 'extraction', title: 'قراءة نص الفاتورة', body: 'الصق نص فاتورة المورد ليستخرج كاشف البنود بالذكاء الاصطناعي ويتحقق من الحساب. يعمل على النص المنسوخ فقط، ولا يقرأ الصور.', status: 'available', icon: ScanText, keywords: 'فاتورة نص لصق استخراج قراءة تحقق حساب ضريبة خصم', href: '#invoice-analysis', linkLabel: 'جرّب تحليل نص فاتورة' },
  { id: 'matching', title: 'المطابقة وعرض الفروقات', body: 'مقارنة الطلب والاستلام والفاتورة وإظهار الفروقات. المثال في الأعلى توضيحي فقط.', status: 'planned', icon: Scale, keywords: 'مطابقة فروقات مقارنة ثلاثية' },
];
