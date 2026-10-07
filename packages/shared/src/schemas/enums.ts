import { z } from 'zod';

// Single source of truth for enum values. The API builds its Postgres enums (pgEnum) from these arrays.
// Adding a value is an API + migration change; removing or renaming one needs a data migration.

export const USER_ROLES = ['admin', 'editor', 'reporter', 'data_editor'] as const;
export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

export const ARTICLE_STATUSES = ['draft', 'in_review', 'scheduled', 'published', 'archived'] as const;
export const articleStatusSchema = z.enum(ARTICLE_STATUSES);
export type ArticleStatus = z.infer<typeof articleStatusSchema>;

export const REVISION_KINDS = [
  'create',
  'update',
  'restore',
  'submit',
  'return_to_draft',
  'publish',
  'schedule',
  'unpublish',
  'autosave',
] as const;
export const revisionKindSchema = z.enum(REVISION_KINDS);
export type RevisionKind = z.infer<typeof revisionKindSchema>;

export const ORGANIZATION_TYPES = ['party', 'committee', 'ministry', 'agency', 'constituency', 'parliament'] as const;
export const organizationTypeSchema = z.enum(ORGANIZATION_TYPES);
export type OrganizationType = z.infer<typeof organizationTypeSchema>;

export const BILL_INITIATORS = ['government', 'mps', 'president'] as const;
export const billInitiatorSchema = z.enum(BILL_INITIATORS);
export type BillInitiator = z.infer<typeof billInitiatorSchema>;

export const BILL_STATUSES = ['submitted', 'in_committee', 'in_plenary', 'passed', 'rejected', 'withdrawn', 'vetoed'] as const;
export const billStatusSchema = z.enum(BILL_STATUSES);
export type BillStatus = z.infer<typeof billStatusSchema>;

export const BILL_STAGES = [
  'submitted',
  'consideration',
  'first_reading',
  'final_reading',
  'passed',
  'rejected',
  'withdrawn',
  'vetoed',
  'veto_overridden',
] as const;
export const billStageSchema = z.enum(BILL_STAGES);
export type BillStage = z.infer<typeof billStageSchema>;

export const SPONSOR_ROLES = ['initiator', 'co_sponsor'] as const;
export const sponsorRoleSchema = z.enum(SPONSOR_ROLES);
export type SponsorRole = z.infer<typeof sponsorRoleSchema>;

export const VOTE_VALUES = ['yes', 'no', 'abstain', 'absent'] as const;
export const voteValueSchema = z.enum(VOTE_VALUES);
export type VoteValue = z.infer<typeof voteValueSchema>;

export const PROMISE_STATUSES = ['kept', 'in_progress', 'broken', 'not_rated'] as const;
export const promiseStatusSchema = z.enum(PROMISE_STATUSES);
export type PromiseStatus = z.infer<typeof promiseStatusSchema>;

export const CORRECTION_ENTITY_TYPES = [
  'article',
  'person',
  'organization',
  'position',
  'bill',
  'vote',
  'statement',
  'promise',
  'declaration',
] as const;
export const correctionEntityTypeSchema = z.enum(CORRECTION_ENTITY_TYPES);
export type CorrectionEntityType = z.infer<typeof correctionEntityTypeSchema>;

export const MEDIA_STATUSES = ['pending', 'processing', 'ready', 'failed'] as const;
export const mediaStatusSchema = z.enum(MEDIA_STATUSES);
export type MediaStatus = z.infer<typeof mediaStatusSchema>;

export const AUDIT_ACTIONS = ['create', 'update', 'delete', 'soft_delete', 'import'] as const;
export const auditActionSchema = z.enum(AUDIT_ACTIONS);
export type AuditAction = z.infer<typeof auditActionSchema>;

export const GENDERS = ['male', 'female'] as const;
export const genderSchema = z.enum(GENDERS);

/** One item of `promises.evidence`. */
export const promiseEvidenceSchema = z.object({
  url: z.url(),
  label: z.string().min(1),
  date: z.iso.date().optional(),
});
export type PromiseEvidence = z.infer<typeof promiseEvidenceSchema>;
