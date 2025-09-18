"use client";

import { useState, useEffect, useCallback } from "react";
import { Separator } from "@/components/ui/separator";
import { TypographyH2 } from "@/components/ui/typography";
import { createBrowserSupabaseClient } from "@/lib/client-utils";
import { useRouter } from "next/navigation";
import AddSpeciesDialog from "./add-species-dialog";
import SpeciesCard from "./species-card";
import SpeciesFilter from "./filter";

interface Species {
  id: number;
  scientific_name: string;
  common_name: string | null;
  kingdom: "Animalia" | "Plantae" | "Fungi" | "Protista" | "Archaea" | "Bacteria";
  total_population: number | null;
  image: string | null;
  description: string | null;
  author: string;
}

export default function SpeciesList() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [species, setSpecies] = useState<Species[]>([]);
  const [filteredSpecies, setFilteredSpecies] = useState<Species[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchSpecies = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      router.push("/");
      return;
    }
    setUserId(sessionData.session.user.id);

    const { data: speciesData, error } = await supabase
      .from("species")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error("Error fetching species:", error.message);
      return;
    }

    setSpecies((speciesData as Species[]) || []);
    setFilteredSpecies((speciesData as Species[]) || []);
  }, [router, supabase]);

  useEffect(() => {
    void fetchSpecies();

    // Realtime for INSERT/UPDATE/DELETE
    const realtimeClient = createBrowserSupabaseClient();

    const channel = realtimeClient
      .channel("public:species")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "species" },
        () => void fetchSpecies()
      )
      .subscribe();

    return () => {
      void realtimeClient.removeChannel(channel);
    };
  }, [fetchSpecies]);

  if (!userId) return <div>Loading...</div>;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <TypographyH2>Species List</TypographyH2>
        <AddSpeciesDialog userId={userId} onSpeciesAdded={() => void fetchSpecies()} />
      </div>

      <SpeciesFilter species={species} setFilteredSpecies={setFilteredSpecies} />

      <Separator className="my-4" />

      <div className="flex flex-wrap justify-center">
        {filteredSpecies.map((sp) => (
          <SpeciesCard key={sp.id} species={sp} userId={userId} onChanged={() => void fetchSpecies()} />
        ))}
      </div>
    </>
  );
}
