import { lazy, Suspense } from 'react';
import type { ComponentProps } from 'react';
import { useI18n } from '../i18n';
const Scene = lazy(() => import('./StockScene').then(module => ({ default: module.StockView })));
export function StockView(props: ComponentProps<typeof Scene>) {
  const { t } = useI18n();
  return <Suspense fallback={<p>{t.sim.title}…</p>}><Scene {...props} /></Suspense>;
}
