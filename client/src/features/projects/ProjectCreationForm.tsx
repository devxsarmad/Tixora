import { ArrowRight, Search, UserPlus } from 'lucide-react';
import { getInitials } from '../../lib/formatters.js';
import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { TeamMember } from '../organizations/types.js';
import type { ProjectFormValues } from '../workspace/workspaceSchemas.js';

type Props = {
  form: UseFormReturn<ProjectFormValues>;
  members: TeamMember[];
  currentUserId: string;
  isSaving: boolean;
  onSubmit: (values: ProjectFormValues) => Promise<void>;
  onManageMembers: () => void;
  onCancel?: () => void;
};

export function ProjectCreationForm({ form, members, currentUserId, isSaving, onSubmit, onManageMembers, onCancel }: Props) {
  const [search, setSearch] = useState('');
  const selectedIds = form.watch('memberIds');
  const filtered = members.filter((member) => (member.displayName + ' ' + member.email).toLowerCase().includes(search.toLowerCase()));

  return (
    <form className="setup-form vertical onboarding-project" onSubmit={form.handleSubmit(onSubmit)}>
      <fieldset disabled={isSaving} className="m-0 grid min-w-0 gap-4 border-0 p-0">
        <label>Project name<input {...form.register('name')} placeholder="Example: Website launch" aria-invalid={Boolean(form.formState.errors.name)} /></label>
        {form.formState.errors.name ? <span className="field-error">{form.formState.errors.name.message}</span> : null}
        <label>Description (optional)<input {...form.register('description')} placeholder="What will this project deliver?" /></label>
        {form.formState.errors.description ? <span className="field-error">{form.formState.errors.description.message}</span> : null}
        <section className="onboarding-project-members">
          <div className="panel-title-row"><h3>Project members</h3><span className="meta-text">Required · {selectedIds.length} selected</span></div>
          <p className="meta-text">Choose at least one person to assign tasks to. You’ll be added as project manager.</p>
          <label>Search organization members<span className="onboarding-search"><Search size={17} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or email" /></span></label>
          <div className="onboarding-results">
            {filtered.map((member) => (
              <label key={member.id} className="onboarding-person selectable">
                <input type="checkbox" checked={selectedIds.includes(member.id)} onChange={(event) => {
                  const next = event.target.checked ? [...selectedIds, member.id] : selectedIds.filter((id) => id !== member.id);
                  form.setValue('memberIds', next, { shouldDirty: true, shouldValidate: true });
                }} />
                <span className="onboarding-avatar">{getInitials(member.displayName)}</span><span className="onboarding-person-text"><strong>{member.displayName}{member.id === currentUserId ? ' (you)' : ''}</strong><small>{member.email}</small></span>
              </label>
            ))}
            {filtered.length === 0 ? <p className="meta-text">No matching organization members.</p> : null}
          </div>
          {form.formState.errors.memberIds ? <p className="field-error" role="alert">{form.formState.errors.memberIds.message}</p> : null}
          <button type="button" className="ghost-button" onClick={onManageMembers}><UserPlus size={15} aria-hidden="true" /> Add organization members</button>
        </section>
        <div className="onboarding-footer">
          {onCancel ? <button type="button" className="ghost-button" onClick={onCancel}>Cancel</button> : null}
          <button type="submit" className="primary-button" disabled={selectedIds.length === 0}>{isSaving ? 'Creating project...' : <>Create project <ArrowRight size={16} aria-hidden="true" /></>}</button>
        </div>
      </fieldset>
    </form>
  );
}
