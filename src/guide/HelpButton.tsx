import { useI18n } from '../i18n';
import type { GuideChapter } from './chapters';

export function HelpButton({ chapter, onOpen }: { chapter: GuideChapter; onOpen: (chapter: GuideChapter) => void }) {
  const { t } = useI18n();
  return <button type="button" className="help-button" data-help-chapter={chapter}
    aria-label={`${t.guide.help}: ${t.guide.chapters[chapter]}`} title={`${t.guide.help}: ${t.guide.chapters[chapter]}`}
    onClick={() => onOpen(chapter)}>{t.guide.symbol}</button>;
}
