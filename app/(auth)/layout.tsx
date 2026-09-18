import Link from "next/link";

import { TennyLockup } from "@/src/components/brand";

// ponytail: placeholder shell until Segment 2 designs the account experience.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-16">
      <Link href="/" aria-label="Tenny home" className="self-start">
        <TennyLockup height={24} alt="" />
      </Link>
      {children}
    </main>
  );
}
