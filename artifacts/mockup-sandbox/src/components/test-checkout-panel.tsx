type Props = {
  open: boolean;
  ids: string[];
  onBusyChange: (busy: boolean) => void;
};

export function TestCheckoutPanel({ open, ids, onBusyChange: _onBusyChange }: Props) {
  if (!open || ids.length === 0) return null;
  return (
    <div className="rounded-xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
      نموذج الدفع التجريبي يظهر هنا داخل التطبيق الأصلي.
    </div>
  );
}
