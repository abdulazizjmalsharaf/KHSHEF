import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { t } from '@/lib/i18n';

export default function NotFound() {
  return (
    <div className="grain flex min-h-screen w-full items-center justify-center bg-background px-4 text-foreground">
      <Card className="w-full max-w-md border-border bg-card">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="font-display text-2xl font-bold text-primary">
              {t('404 Page Not Found')}
            </h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            {t('Did you forget to add the page to the router?')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
