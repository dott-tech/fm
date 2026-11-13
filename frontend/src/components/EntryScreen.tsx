import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useI18n } from '../i18n'
import { PrimaryButton } from './ui'

// Shared frame for the entry screens (add income/expense, bill or goal form):
// back button + title at the top, and a Save button pinned to the bottom,
// under the thumb.
export function EntryScreen({
  title,
  formId,
  saveLabel,
  saving,
  canSave,
  children,
  backTo = '/',
}: {
  title: string
  formId: string
  saveLabel: string
  saving: boolean
  canSave: boolean
  children: ReactNode
  backTo?: string
}) {
  const { m } = useI18n()
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-4 pb-28">
      <header className="mb-6 flex items-center gap-3">
        <Link
          to={backTo}
          viewTransition
          aria-label={m.common.back}
          className="press -ms-2 grid h-11 w-11 place-items-center rounded-full text-2xl active:bg-surface-2"
        >
          {/* Arrow points the way you came: flipped for right-to-left. */}
          <span className="rtl:rotate-180">←</span>
        </Link>
        <h1 className="text-xl font-bold">{title}</h1>
      </header>

      <div className="rise">{children}</div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-canvas/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-md">
          <PrimaryButton type="submit" form={formId} disabled={saving || !canSave}>
            {saving ? m.common.saving : saveLabel}
          </PrimaryButton>
        </div>
      </div>
    </main>
  )
}
