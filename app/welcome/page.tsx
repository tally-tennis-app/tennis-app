import { permanentRedirect } from "next/navigation";

// The landing page moved to "/". Kept so shared links from the pilot resolve.
export default function Welcome() {
  permanentRedirect("/");
}
