import { notFound } from "next/navigation";
import { MonitorCanvas } from "./MonitorCanvas";

type Params = { id: string };

export default function MonitorPage({ params }: { params: Params }) {
  if (!params.id) return notFound();
  return <MonitorCanvas monitorId={params.id} />;
}

















