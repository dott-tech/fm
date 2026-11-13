import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { PrimaryButton } from './ui'

// Shared frame for the add-income / add-expense screens: back button + title
// at the top, and a Save button pinned to the bottom, under the thumb.
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
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-4 pb-28">
      <header className="mb-6 flex items-center gap-3">
        <Link to={backTo} aria-label="Back" className="-ml-2 grid h-11 w-11 place-items-center rounded-full text-2xl">
          ←
        </Link>
        <h1 className="text-xl font-bold">{title}</h1>
      </header>

      {children}

      <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-stone-50/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-md">
          <PrimaryButton type="submit" form={formId} disabled={saving || !canSave}>
            {saving ? 'Saving…' : saveLabel}
          </PrimaryButton>
        </div>
      </div>
    </main>
  )
}
