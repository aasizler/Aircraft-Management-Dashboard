import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AircraftDetailClient } from "@/components/aircraft/detail-client";
import type { AircraftRow, Meter } from "@/lib/aircraft";

export default async function AircraftDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: a } = await supabase
    .from("aircraft")
    .select("id, reg, type, airport, serial, maint_basis, cost_basis, data")
    .eq("id", id)
    .single();

  if (!a) notFound();

  const { data: meters } = await supabase
    .from("aircraft_meters")
    .select("kind, current, label")
    .eq("aircraft_id", id);

  return (
    <AircraftDetailClient
      aircraft={a as AircraftRow}
      meters={(meters ?? []) as Meter[]}
    />
  );
}
