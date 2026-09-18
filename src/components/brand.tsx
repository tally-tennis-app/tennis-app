import { getImageProps } from "next/image";

// Extracted from Branding.pdf; see docs/design/ui-direction.md. Never redraw
// these in CSS. Dark variants swap in via prefers-color-scheme.
const assets = {
  mark: ["tenny-mark", 175.5 / 100],
  ball: ["tenny-ball-flat", 104.17 / 100],
  horizontal: ["tenny-lockup-horizontal", 521.87 / 100],
  stacked: ["tenny-lockup-stacked", 125.56 / 100],
} as const;

// Brand rule: below 32px, drop the shade and trails, flat two-tone ball only.
const SMALL_MARK_PX = 32;

type BrandImageProps = {
  /** Rendered height in CSS pixels. Width follows the asset ratio. */
  height: number;
  /** Pass "" when the name "Tenny" is already visible beside the logo. */
  alt?: string;
  priority?: boolean;
  className?: string;
};

function BrandImage({
  kind,
  height,
  alt = "Tenny",
  priority,
  className,
}: BrandImageProps & { kind: keyof typeof assets }) {
  const [file, ratio] = assets[kind];
  const { props } = getImageProps({
    src: `/brand/${file}.svg`,
    alt,
    height,
    width: Math.round(height * ratio),
    priority,
  });

  return (
    <picture>
      <source
        media="(prefers-color-scheme: dark)"
        srcSet={`/brand/${file}-reversed.svg`}
      />
      <img {...props} alt={alt} className={className} />
    </picture>
  );
}

export function TennyMark(props: BrandImageProps) {
  return (
    <BrandImage
      kind={props.height < SMALL_MARK_PX ? "ball" : "mark"}
      {...props}
    />
  );
}

export function TennyLockup({
  orientation = "horizontal",
  ...props
}: BrandImageProps & { orientation?: "horizontal" | "stacked" }) {
  return <BrandImage kind={orientation} {...props} />;
}
