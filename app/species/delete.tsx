"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { createBrowserSupabaseClient } from "@/lib/client-utils";
import { useState } from "react";
import type { Database } from "@/lib/schema";

type Species = Database["public"]["Tables"]["species"]["Row"];

export default function DeleteSpeciesButton({
  userId,
  species,
  onDeleted,
}: {
  userId: string;
  species: Species;
  onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);


  if (userId !== species.author) return null;

  const handleDelete = async () => {
    setLoading(true);
    const supabase = createBrowserSupabaseClient();

    const { error } = await supabase.from("species").delete().eq("id", species.id).eq("author", userId);

    setLoading(false);
    setOpen(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Species Deleted", description: `${species.scientific_name} has been removed.` });
    onDeleted?.(); 
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Delete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p>
            Are you sure you want to delete &quot;{species.scientific_name}&quot;? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => void handleDelete()} disabled={loading}>
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
