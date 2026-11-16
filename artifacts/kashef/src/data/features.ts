import { ClipboardList, PackageCheck, ScanText, Scale, Truck, type LucideIcon } from 'lucide-react';

export type FeatureStatus = 'available' | 'planned';

export type Feature = {
  id: string;
  title: string;
  body: string;
  status: FeatureStatus;
  icon: LucideIcon;
  keywords: string;
};

export const FEATURES: readonly Feature[] = [
  { id: 'supplier-save', title: 'حفظ اسم المورد', body: 'أضف اسم مورّدك ويُحفظ في كاشف الآن. هذه هي الخطوة الوحيدة المتاحة حاليًا.', status: 'available', icon: Truck, keywords: 'مورد موردين حفظ اسم' },
  { id: 'purchase-orders', title: 'أوامر الشراء', body: 'تسجيل ما طلبته من المورد بالأصناف والكميات. قيد التطوير ولم يُفعّل بعد.', status: 'planned', icon: ClipboardList, keywords: 'أمر شراء طلب كميات أصناف' },
  { id: 'receiving', title: 'تسجيل الاستلام', body: 'تدوين ما وصل فعلًا عند الباب. مخطط له، وغير متاح حاليًا.', status: 'planned', icon: PackageCheck, keywords: 'استلام توريدة وصل كميات' },
  { id: 'extraction', title: 'قراءة الفاتورة', body: 'استخراج بنود فاتورة المورد من صورتها. مخطط له، وغير متاح حاليًا.', status: 'planned', icon: ScanText, keywords: 'فاتورة صورة استخراج قراءة' },
  { id: 'matching', title: 'المطابقة وعرض الفروقات', body: 'مقارنة الطلب والاستلام والفاتورة وإظهار الفروقات. المثال في الأعلى توضيحي فقط.', status: 'planned', icon: Scale, keywords: 'مطابقة فروقات مقارنة ثلاثية' },
];
