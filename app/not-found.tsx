import { TennyMark } from "@/src/components/brand";
import { ButtonLink } from "@/src/components/ui/button";

export const metadata = { title: "Page not found" };

// "/" sends a signed-in player on to their dashboard, so one link serves both.
export default function NotFound() {
  return (
    <main
      id="main"
      className="max-w-content mx-auto flex w-full flex-1 flex-col justify-center gap-6 px-4 py-16 sm:px-8"
    >
      <TennyMark height={56} alt="" />
      <p className="type-label text-accent">Error 404</p>
      <h1 className="type-display max-w-[14ch]">This court is empty.</h1>
      <p className="text-muted max-w-prose text-lg">
        The page you were looking for is outside the lines. It may have moved,
        or you may not have access to it.
      </p>
      <ButtonLink href="/" className="self-start">
        Return home
      </ButtonLink>
    </main>
  );
}
