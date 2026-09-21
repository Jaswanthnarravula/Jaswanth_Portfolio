/** Shared content views — shared/03. Hook-free, server-renderable, slot-based; OS apps supply the idiom. */
export { AboutOverview, type AboutData } from './about';
export { ProjectList, ProjectDetail, type ProjectDetailData } from './projects';
export { ExperienceList, ExperienceDetail, EducationList, EducationDetail, type EducationData } from './experience';
export { SkillsMatrix } from './skills';
export { ContactPanel, type ContactData } from './contact';
export {
  ResumeView,
  ResumeDocument,
  resumeFileLabel,
  formatUpdated,
  type ResumeData,
  type ResumeDocumentData,
  type ResumeFileMeta,
} from './resume';
export { LegalNotice, PrivacyNotice, type LegalData, type PrivacyData, type LegalCredit } from './legal';
export { renderText, type ViewId, type TextViewData } from './text';
export { mailtoUrl, copyText, type CopyOutcome } from './contact-actions';
export { formatPeriod, formatPartialDate, wrap } from './format';
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
