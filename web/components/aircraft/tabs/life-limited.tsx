"use client";

import { useMemo } from "react";
import { makeLifeLimitedParts, type Insp } from "@/lib/aircraft";
import type { TabProps } from "../detail-client";
import { InspTable } from "../insp-table";

/**
 * Life Limited Parts, as Cirrus IQ lays them out: airworthiness items that
 * expire on the calendar, and general items with overhaul lives in hours or
 * years, whichever comes first. Seeded per class the first time the tab is
 * opened and saved with the first edit; the seed is a starting point the
 * owner activates and corrects to the maintenance manual.
 */
export function LifeLimitedTab({ data, maintHrs, aircraft, save, allow, center, tools }: TabProps & { center?: React.ReactNode; tools?: React.ReactNode }) {
  const stored = data.lifeLimitedParts as Insp[] | undefined;
  const items = useMemo(
    () => stored ?? makeLifeLimitedParts(data.acClass, aircraft.type ?? (data.type as string | null)),
    [stored, data.acClass, aircraft.type, data.type],
  );
  const presets = useMemo(
    () => makeLifeLimitedParts(data.acClass, aircraft.type ?? (data.type as string | null)),
    [data.acClass, aircraft.type, data.type],
  );

  return (
    <>
      <InspTable
        items={items}
        presets={presets}
        save={(next) => save({ ...data, lifeLimitedParts: next })}
        maintHrs={maintHrs}
        canEdit={allow("inspection")}
        groups
        addLabel="Add Part"
        noun="part"
        center={center}
        tools={tools}
      />
    </>
  );
}
