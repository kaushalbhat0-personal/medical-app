/**
 * Encounter Workspace Components
 * 
 * Reusable sections for the clinical encounter workspace.
 * These components form the building blocks of the Encounter Workspace UI,
 * designed for Phase 2 clinical feature extensibility.
 * 
 * Architecture principles:
 * - Clinical-first hierarchy (diagnosis > treatment > notes > medicines > billing)
 * - Mobile-responsive design
 * - Section-based organization for future extensibility
 * - No role-based authorization (capability-based only)
 */

export { EncounterHeaderSection } from './EncounterHeaderSection';
export { EncounterClinicalSection } from './EncounterClinicalSection';
export { EncounterMedicationSection } from './EncounterMedicationSection';
export { EncounterBillingSection } from './EncounterBillingSection';
export { EncounterTimelineSection } from './EncounterTimelineSection';

// Future extension exports (Phase 2):
// export { EncounterVitalsSection } from './EncounterVitalsSection';
// export { EncounterAttachmentsSection } from './EncounterAttachmentsSection';
// export { EncounterPrescriptionsSection } from './EncounterPrescriptionsSection';
// export { EncounterSoapNotesSection } from './EncounterSoapNotesSection';
// export { EncounterAiSummarySection } from './EncounterAiSummarySection';
