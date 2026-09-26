/** Shared content views — shared/03. Hook-free, server-renderable, slot-based; OS apps supply the idiom. */
export { AboutOverview, glanceRows, nowUpdated, type AboutData } from './about';
export { ProjectCaseStudy, DeepDiveArticle, deepDiveFile } from './case-study';
export { ProjectList, ProjectDetail, type ProjectDetailData } from './projects';
export { ExperienceList, ExperienceDetail, EducationList, EducationDetail, type EducationData } from './experience';
export { SkillsMatrix } from './skills';
export { ContactPanel, type ContactData } from './contact';
export {
  ResumeView,
  ResumeDocument,
  ResumePages,
  resumeFileLabel,
  formatUpdated,
  type ResumeData,
  type ResumePagesProps,
  type ResumeFileMeta,
} from './resume';
export { LegalNotice, PrivacyNotice, type LegalData, type PrivacyData, type LegalCredit } from './legal';
export { renderText, type ViewId, type TextViewData } from './text';
export { mailtoUrl, copyText, type CopyOutcome } from './contact-actions';
export { formatCredential, formatPeriod, formatPartialDate, formatYears, wrap } from './format';
export {
  DEFAULT_SLOTS,
  goHref,
  withSlots,
  type ViewSlots,
  type LinkSlotProps,
  type ActionSlotProps,
  type ContentAction,
  type Density,
  type HeadingLevel,
  type ViewProps,
} from './slots';
export { ContentFor, viewDataFor, type ContentForProps } from './content-for';
export {
  buildInbox,
  replySubject,
  sendTarget,
  MAILTO_BODY_LIMIT,
  CONTINUED_NOTE,
  type InboxData,
  type InboxMessage,
  type InboxMessageId,
  type InboxSender,
  type InboxAttachment,
  type SendTarget,
} from './inbox';
export { buildWorkspace, workspaceName, fileKey, skillHint, type WorkspaceFile, type WorkspaceData } from './workspace';
export { tokenize, inlineMarkdown, type SyntaxLanguage, type Token, type TokenKind, type TokenLine } from './syntax';
