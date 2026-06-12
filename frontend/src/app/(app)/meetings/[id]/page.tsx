import MeetingDetailPage from "./MeetingDetailClient";

// Static export (Tauri) for a runtime-generated dynamic route. The real
// meeting ID is resolved client-side via useParams() in MeetingDetailClient;
// we emit a single placeholder page and disallow other static params so the
// route ships as a client-rendered SPA page.
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <MeetingDetailPage />;
}
