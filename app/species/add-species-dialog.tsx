"use client";

import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { createBrowserSupabaseClient } from "@/lib/client-utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type BaseSyntheticEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";



const kingdoms = z.enum(["Animalia", "Plantae", "Fungi", "Protista", "Archaea", "Bacteria"]);

const speciesSchema = z.object({
  scientific_name: z.string().trim().min(1).transform((val) => val.trim()),
  common_name: z
    .string()
    .nullable()
    .transform((val) => (!val || val.trim() === "" ? null : val.trim())),
  kingdom: kingdoms,
  total_population: z.number().int().positive().min(1).nullable(),
  image: z
    .string()
    .url()
    .nullable()
    .transform((val) => (!val || val.trim() === "" ? null : val.trim())),
  description: z
    .string()
    .nullable()
    .transform((val) => (!val || val.trim() === "" ? null : val.trim())),
});

type FormData = z.infer<typeof speciesSchema>;

const defaultValues: Partial<FormData> = {
  scientific_name: "",
  common_name: null,
  kingdom: "Animalia",
  total_population: null,
  image: null,
  description: null,
};



interface WikipediaSearchResult {
  title: string;
  pageid?: number;
}
interface WikipediaSearchResponse {
  query?: { search?: WikipediaSearchResult[] };
}
interface WikipediaSummaryResponse {
  title?: string;
  extract?: string;
  thumbnail?: { source: string };
  type?: string;
}

interface MWQueryPage {
  pageprops?: { wikibase_item?: string };
}
interface MWQueryResp {
  query?: { pages?: Record<string, MWQueryPage> };
}

interface WDQuantityValue {
  amount?: string;
}
interface WDClaimSnak {
  datavalue?: { value?: unknown };
}
interface WDClaim {
  mainsnak?: WDClaimSnak;
}
interface WikidataEntity {
  claims?: Record<string, WDClaim[]>;
}
interface WikidataResp {
  entities?: Record<string, WikidataEntity>;
}
interface WikidataSearchEntity {
  id?: string;
}
interface WikidataSearchResp {
  search?: WikidataSearchEntity[];
}



export default function AddSpeciesDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState<boolean>(false);
  const [wikipediaQuery, setWikipediaQuery] = useState<string>("");
  const [searching, setSearching] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(speciesSchema),
    defaultValues,
    mode: "onChange",
  });


  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      form.reset(defaultValues);
      setWikipediaQuery("");
      setSearching(false);
    }
  };




  function parsePopulation(text: string | undefined): number | null {
    if (!text) return null;

    const units: Record<string, number> = {
      thousand: 1e3,
      k: 1e3,
      million: 1e6,
      m: 1e6,
      billion: 1e9,
      bn: 1e9,
    };

    const patterns: RegExp[] = [

      /(?:population|individuals?|remain(?:ing)?|left|numbers?)\D{0,25}?(?:about|around|approximately|approx\.?|roughly|some|nearly|over|more than|at least|fewer than|less than|~)?\s*([\d,]+(?:\.\d+)?)\s*(million|billion|thousand|m|bn|k)?/i,

      /estimated(?:\s+global)?\s+population\D{0,10}([\d,]+(?:\.\d+)?)\s*(million|billion|thousand|m|bn|k)?/i,
    ];

    for (const re of patterns) {
      const m = text.match(re);
      if (m && m[1]) {
        const numRaw = m[1].replace(/,/g, "");
        const unit = (m[2] ?? "").toLowerCase();
        const base = Number.parseFloat(numRaw);
        if (!Number.isFinite(base)) continue;
        const factor = units[unit] ?? 1;
        const n = Math.round(base * factor);
        if (n > 0) return n;
      }
    }
    return null;
  }


  const wikidataQidByPageId = async (pageid: number): Promise<string | null> => {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageprops&pageids=${pageid}`
    );
    if (!res.ok) return null;
    const json = (await res.json()) as MWQueryResp;
    const pages = json.query?.pages ?? {};
    for (const key of Object.keys(pages)) {
      const qid = pages[key]?.pageprops?.wikibase_item;
      if (qid) return qid;
    }
    return null;
  };


  const wikidataQidByTitle = async (title: string): Promise<string | null> => {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageprops&titles=${encodeURIComponent(
        title
      )}`
    );
    if (!res.ok) return null;
    const json = (await res.json()) as MWQueryResp;
    const pages = json.query?.pages ?? {};
    for (const key of Object.keys(pages)) {
      const qid = pages[key]?.pageprops?.wikibase_item;
      if (qid) return qid;
    }
    return null;
  };


  const searchWikidataQid = async (q: string): Promise<string | null> => {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&origin=*&search=${encodeURIComponent(
        q
      )}`
    );
    if (!res.ok) return null;
    const json = (await res.json()) as WikidataSearchResp;
    return json.search?.[0]?.id ?? null;
  };


  const fetchFromWikidata = async (
    qid: string
  ): Promise<{ scientific?: string | null; population?: number | null }> => {
    const res = await fetch(
      `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(qid)}.json`
    );
    if (!res.ok) return { scientific: null, population: null };

    const json = (await res.json()) as WikidataResp;
    const entity = json.entities?.[qid];


    const sciVal = entity?.claims?.["P225"]?.[0]?.mainsnak?.datavalue?.value;
    const scientific =
      typeof sciVal === "string" && sciVal.trim().length > 0 ? sciVal.trim() : null;


    let population: number | null = null;
    const popClaim = entity?.claims?.["P1082"]?.[0]?.mainsnak?.datavalue?.value as
      | WDQuantityValue
      | undefined;
    if (popClaim?.amount) {
      const n = Number.parseFloat(popClaim.amount.replace("+", ""));
      if (Number.isFinite(n) && n > 0) population = Math.round(n);
    }

    return { scientific, population };
  };



  const handleWikipediaSearch = async (): Promise<void> => {
    const q = wikipediaQuery.trim();
    if (!q) {
      toast({
        title: "Empty search",
        description: "Please enter a species name to search.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSearching(true);


      form.setValue("scientific_name", "");
      form.setValue("common_name", null);
      form.setValue("description", null);
      form.setValue("image", null);
      form.setValue("total_population", null);


      const searchRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
          q
        )}&format=json&origin=*`
      );
      const searchData = (await searchRes.json()) as WikipediaSearchResponse;
      const results = searchData.query?.search ?? [];

      if (results.length === 0) {
        toast({
          title: "No article found",
          description: "No Wikipedia article matches your search term.",
          variant: "destructive",
        });
        return;
      }


      let picked: { title: string; pageid?: number } | null = null;
      let summary: WikipediaSummaryResponse | null = null;

      for (const r of results.slice(0, 5)) {
        const sRes = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(r.title)}`
        );
        if (!sRes.ok) continue;
        const s = (await sRes.json()) as WikipediaSummaryResponse;
        if (s.type === "disambiguation") continue;
        picked = { title: r.title, pageid: r.pageid };
        summary = s;
        break;
      }


      if (!picked || !summary) {
        const r = results[0]!;
        const sRes = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(r.title)}`
        );
        if (!sRes.ok) {
          toast({
            title: "Error fetching article",
            description: "Could not retrieve the article summary.",
            variant: "destructive",
          });
          return;
        }
        picked = { title: r.title, pageid: r.pageid };
        summary = (await sRes.json()) as WikipediaSummaryResponse;
      }


      const articleDescription = summary.extract ?? "";
      const articleImage = summary.thumbnail?.source ?? "";
      const articleCommon = picked.title;

      if (articleDescription) form.setValue("description", articleDescription);
      if (articleImage) form.setValue("image", articleImage);
      if (articleCommon) form.setValue("common_name", articleCommon);


      let qid: string | null = null;

      if (picked.pageid != null) {
        qid = await wikidataQidByPageId(picked.pageid);
      }
      if (!qid) qid = await wikidataQidByTitle(picked.title);
      if (!qid) qid = await searchWikidataQid(picked.title);
      if (!qid) qid = await searchWikidataQid(q);

      let popFromSummary: number | null = parsePopulation(summary.extract);
      let popFromWD: number | null = null;
      let sciFromWD: string | null = null;

      if (qid) {
        const { scientific, population } = await fetchFromWikidata(qid);
        sciFromWD = scientific ?? null;
        popFromWD = population ?? null;
      }


      if (sciFromWD) {
        form.setValue("scientific_name", sciFromWD);
      } else {

        const binomial = picked.title.match(/^[A-Z][a-z]+ [a-z]+$/);
        if (binomial) form.setValue("scientific_name", picked.title);
      }


      const finalPop = popFromWD ?? popFromSummary ?? null;
      if (finalPop && Number.isFinite(finalPop)) {
        form.setValue("total_population", finalPop);
      }

      toast({
        title: "Autofilled from Wikipedia",
        description:
          "Description, image, names, and population (if available) have been populated. Review and edit as needed.",
      });
    } catch (err) {
      console.error("Wikipedia search error:", err);
      toast({
        title: "Search error",
        description: "An error occurred while searching Wikipedia. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };



  const onSubmit = async (input: FormData) => {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.from("species").insert([
      {
        author: userId,
        common_name: input.common_name,
        description: input.description,
        kingdom: input.kingdom,
        scientific_name: input.scientific_name,
        total_population: input.total_population,
        image: input.image,
      },
    ]);

    if (error) {
      toast({
        title: "Something went wrong.",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    form.reset(defaultValues);
    setOpen(false);
    window.location.reload();

    toast({
      title: "New species added!",
      description: `Successfully added ${input.scientific_name}.`,
    });
  };



  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Icons.add className="mr-3 h-5 w-5" />
          Add Species
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Species</DialogTitle>
          <DialogDescription>
            Use Wikipedia to autofill details, then review and click “Add Species”.
          </DialogDescription>
        </DialogHeader>

        
        <div className="mb-4 flex gap-2">
          <Input
            placeholder="Search Wikipedia for species info (e.g., Cheetah)"
            value={wikipediaQuery}
            onChange={(e) => setWikipediaQuery(e.target.value)}
          />
          <Button type="button" onClick={() => void handleWikipediaSearch()} disabled={searching}>
            {searching ? "Searching..." : "Search"}
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={(e: BaseSyntheticEvent) => void form.handleSubmit(onSubmit)(e)}>
            <div className="grid w-full items-center gap-4">
              <FormField
                control={form.control}
                name="scientific_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scientific Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Panthera tigris" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="common_name"
                render={({ field }) => {
                  const { value, ...rest } = field;
                  return (
                    <FormItem>
                      <FormLabel>Common Name</FormLabel>
                      <FormControl>
                        <Input value={value ?? ""} placeholder="Tiger" {...rest} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="kingdom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kingdom</FormLabel>
                    <Select onValueChange={(v) => field.onChange(kingdoms.parse(v))} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a kingdom" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          {kingdoms.options.map((k) => (
                            <SelectItem key={k} value={k}>
                              {k}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="total_population"
                render={({ field }) => {
                  const { value, ...rest } = field;
                  return (
                    <FormItem>
                      <FormLabel>Total population</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={value ?? ""}
                          placeholder="300000"
                          {...rest}
                          onChange={(e) => {
                            const v = e.target.value;
                            field.onChange(v === "" ? null : Number.parseInt(v, 10));
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="image"
                render={({ field }) => {
                  const { value, ...rest } = field;
                  return (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                      <FormControl>
                        <Input value={value ?? ""} placeholder="https://upload.wikimedia.org/.../example.jpg" {...rest} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => {
                  const { value, ...rest } = field;
                  return (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea value={value ?? ""} placeholder="Short species description…" {...rest} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <div className="flex">
                <Button type="submit" className="ml-1 mr-1 flex-auto">
                  Add Species
                </Button>
                <DialogClose asChild>
                  <Button type="button" className="ml-1 mr-1 flex-auto" variant="secondary">
                    Cancel
                  </Button>
                </DialogClose>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
