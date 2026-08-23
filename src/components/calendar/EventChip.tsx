"use client";

import { motion } from "framer-motion";
import type { StockEvent } from "@/lib/types";
import { EVENT_TYPE_META } from "@/lib/types";

export function EventChip({
  event,
  onClick,
}: {
  event: StockEvent;
  onClick: () => void;
}) {
  const meta = EVENT_TYPE_META[event.type];
  return (
    <motion.button
      layoutId={`event-chip-${event.id}`}
      data-event-id={event.id}
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      className={`w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium leading-tight transition data-[highlight=true]:ring-2 data-[highlight=true]:ring-emerald-500 data-[highlight=true]:ring-offset-1 data-[highlight=true]:ring-offset-white dark:data-[highlight=true]:ring-offset-zinc-950 ${meta.chipClass}`}
      title={`${event.time ? event.time + " " : ""}${event.title}`}
    >
      {event.time && (
        <span className="mr-1 tabular-nums opacity-70">{event.time}</span>
      )}
      <span>{event.companyName}</span>
    </motion.button>
  );
}
