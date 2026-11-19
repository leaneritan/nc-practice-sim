import { useEffect, useRef } from 'react';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useI18n } from '../i18n';
import { Term } from '../components/Term';
import { terms } from '../i18n/glossary';
import type { TermId } from '../i18n/glossary';
import { chapterIds, parseGuide } from './chapters';
import type { GuideChapter } from './chapters';
import { HelpButton } from './HelpButton';
import en from './en.md?raw';
import ja from './ja.md?raw';

export const guides = { en: parseGuide(en), ja: parseGuide(ja) };
const termId = (href: string | undefined): TermId | null => {
  const id = href?.startsWith('term:') ? href.slice(5) : '';
  return Object.hasOwn(terms, id) ? id as TermId : null;
};
export default function Guide({ chapter, onChapter, onClose }: {
  chapter: GuideChapter; onChapter: (chapter: GuideChapter) => void; onClose: () => void;
}) {
  const { t, language } = useI18n();
  const title = useRef<HTMLHeadingElement>(null);
  const chapters = guides[language];
  const index = chapterIds.indexOf(chapter);
  const current = chapters[index]!;
  const choose = (id: GuideChapter) => {
    onChapter(id);
    if (id === chapter) title.current?.focus();
  };
  useEffect(() => { title.current?.focus(); }, [chapter, language]);
  return <section className="guide panel" aria-label={t.guide.title}>
    <div className="guide-heading"><h2>{t.guide.title}</h2>
      <HelpButton chapter="start" onOpen={choose} />
      <button className="secondary" onClick={onClose}>{t.guide.back}</button>
    </div>
    <p className="hint">{t.guide.holdHint}</p>
    <div className="guide-layout">
      <nav className="guide-nav" aria-label={t.guide.contents}>
        {chapters.map(item => <button key={item.id} aria-current={item.id === chapter ? 'page' : undefined}
          onClick={() => choose(item.id)}>{item.number}. {item.title}</button>)}
      </nav>
      <article className="guide-article" aria-labelledby="guide-chapter-title">
        <h3 id="guide-chapter-title" ref={title} tabIndex={-1}>{current.number}. {current.title}</h3>
        <Markdown remarkPlugins={[remarkGfm]} skipHtml
          urlTransform={url => termId(url) ? url : defaultUrlTransform(url)}
          components={{
            a: ({ href, children }) => {
              const id = termId(href);
              if (id) return <Term id={id} label={String(children)} />;
              const destination = href?.slice(1) as GuideChapter;
              if (href?.startsWith('#') && chapterIds.includes(destination)) return <button className="guide-link" onClick={() => choose(destination)}>{children}</button>;
              return <a href={href}>{children}</a>;
            },
            h3: ({ children }) => <h4>{children}</h4>,
            table: ({ children }) => <div className="guide-table" tabIndex={0} role="region" aria-label={t.guide.table}><table>{children}</table></div>,
            pre: ({ children }) => <pre tabIndex={0}>{children}</pre>,
          }}>{current.markdown}</Markdown>
        <div className="guide-pagination">
          <button className="secondary" disabled={index === 0} onClick={() => choose(chapterIds[index - 1]!)}>{t.previous}</button>
          <span>{current.number} / {chapters.length}</span>
          <button className="secondary" disabled={index === chapters.length - 1} onClick={() => choose(chapterIds[index + 1]!)}>{t.next}</button>
        </div>
      </article>
    </div>
  </section>;
}
