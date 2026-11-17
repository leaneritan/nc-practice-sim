import { useAppStore } from '../store';
import { en } from './en';
import { ja } from './ja';

export function useI18n() {
  const language = useAppStore(state => state.language);
  return { language, t: language === 'ja' ? ja : en };
}
