import { useContext } from 'react';
import { AssignmentsContext, type AssignmentsContextValue } from './assignmentsContextCore';

// Split out from AssignmentsContext.tsx so that file exports only the
// AssignmentsProvider component — a file mixing a component export with a
// hook export breaks Fast Refresh for the component (react/only-export-components).
export function useAssignments(): AssignmentsContextValue {
  const ctx = useContext(AssignmentsContext);
  if (!ctx) throw new Error('useAssignments must be used within AssignmentsProvider');
  return ctx;
}
