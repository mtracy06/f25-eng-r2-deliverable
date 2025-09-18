"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Database } from "@/lib/schema";

import DeleteSpeciesButton from "./delete";
import EditSpeciesDialog from "./edit";

type Species = Database["public"]["Tables"]["species"]["Row"];

export default function SpeciesCard({
  species,
  userId,
  onChanged,
}: {
  species: Species;
  userId: string;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="m-4 w-72 min-w-72 flex-none rounded border-2 p-3 shadow">
      {species.image && (
        <div className="relative h-40 w-full">
          <Image src={species.image} alt={species.scientific_name} fill style={{ objectFit: "cover" }} />
        </div>
      )}
      <h3 className="mt-3 text-2xl font-semibold">{species.scientific_name}</h3>
      <h4 className="text-lg font-light italic">{species.common_name}</h4>
      <p>{species.description ? species.description.slice(0, 150).trim() + "..." : ""}</p>

      <Button className="mt-3 w-full" onClick={() => setOpen(true)}>
        Learn More
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{species.scientific_name}</DialogTitle>
          </DialogHeader>
          {species.image && (
            <div className="relative h-40 w-full">
              <Image src={species.image} alt={species.scientific_name} fill style={{ objectFit: "cover" }} />
            </div>
          )}
          <h4 className="text-lg font-light italic">{species.common_name}</h4>
          <p>
            <strong>Kingdom:</strong> {species.kingdom}
          </p>
          <p>
            <strong>Total Population:</strong> {species.total_population ?? "—"}
          </p>
          <p>
            <strong>Description:</strong> {species.description ?? "—"}
          </p>
        </DialogContent>
      </Dialog>

      <div className="mt-2 flex gap-2">
        <EditSpeciesDialog userId={userId} species={species} onUpdated={onChanged} />
        <DeleteSpeciesButton userId={userId} species={species} onDeleted={onChanged} />
      </div>
    </div>
  );
}
