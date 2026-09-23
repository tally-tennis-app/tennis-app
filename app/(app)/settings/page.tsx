import { signOut } from "@/app/(auth)/actions";
import { ProfileForm } from "@/src/components/players/profile-form";
import { ButtonLink } from "@/src/components/ui/button";
import { PageHeader, Panel, Section } from "@/src/components/ui/structure";
import { SubmitButton } from "@/src/components/ui/submit-button";
import { getViewer } from "@/src/lib/profiles/queries";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await getViewer();

  return (
    <>
      <PageHeader title="Settings" />

      <Section title="Profile" id="profile">
        <Panel className="p-5">
          <ProfileForm viewer={viewer} />
        </Panel>
      </Section>

      <Section title="Account and security" id="account">
        <Panel className="divide-line flex flex-col divide-y">
          <div className="flex flex-col gap-1 p-5">
            <p className="text-ink-strong text-sm font-semibold">Email</p>
            <p>{viewer.email}</p>
            <p className="text-muted text-sm">Only you can see this.</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex flex-col gap-1">
              <p className="text-ink-strong text-sm font-semibold">Password</p>
              <p className="text-muted text-sm">
                Choose a new one at any time.
              </p>
            </div>
            <ButtonLink href="/update-password" variant="secondary" size="sm">
              Change password
            </ButtonLink>
          </div>
          <div className="flex flex-col gap-1 p-5">
            <p className="text-ink-strong text-sm font-semibold">
              Delete account
            </p>
            <p className="text-muted max-w-prose text-sm">
              Account deletion is not available in the app yet. When it is,
              deleting an account will permanently remove your matches, which
              changes your former opponents&apos; ratings.
            </p>
          </div>
        </Panel>
      </Section>

      <Section title="Session" id="session">
        <Panel className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-muted">Signed in as {viewer.displayName}.</p>
          <form action={signOut}>
            <SubmitButton
              variant="secondary"
              size="sm"
              pendingLabel="Signing out…"
            >
              Sign out
            </SubmitButton>
          </form>
        </Panel>
      </Section>
    </>
  );
}
