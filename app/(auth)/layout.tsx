import Image from "next/image";
import Link from "next/link";

import { TennyLockup } from "@/src/components/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Fixed navy ground in both themes, so it always uses the reversed art. */}
      <aside className="bg-brand-navy hidden flex-col justify-between p-12 lg:flex">
        <Link href="/" aria-label="Tenny home" className="self-start">
          <Image
            src="/brand/tenny-lockup-horizontal-reversed.svg"
            alt=""
            width={209}
            height={40}
            priority
          />
        </Link>
        <div className="flex flex-col gap-8">
          <Image
            src="/brand/tenny-mark-reversed.svg"
            alt=""
            width={351}
            height={200}
            className="struck-in w-3/5 max-w-sm"
          />
          <p className="text-brand-paper max-w-sm text-3xl leading-tight font-extrabold tracking-tight">
            Scores both players agree on. Standings everyone trusts.
          </p>
        </div>
      </aside>

      <main
        id="main"
        className="flex flex-col px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-12 sm:px-8"
      >
        <Link
          href="/"
          aria-label="Tenny home"
          className="flex min-h-11 items-center self-start lg:hidden"
        >
          <TennyLockup height={28} alt="" priority />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
