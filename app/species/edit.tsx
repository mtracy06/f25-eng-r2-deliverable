"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { createBrowserSupabaseClient } from "@/lib/client-utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState, type BaseSyntheticEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Database } from "@/lib/schema";

const kingdoms = z.enum(["Animalia", "Plantae", "Fungi", "Protista", "Archaea", "Bacteria"]);
type Kingdom = z.infer<typeof kingdoms>;

const speciesSchema = z.object({
  scientific_name: z.string().trim().min(1, "Scientific Name is required"),
  common_name: z.string().nullable().transform((val) => (val?.trim() ? val.trim() : "")),
  kingdom: kingdoms,
  total_population: z
    .union([z.string(), z.number()])
    .nullable()
    .transform((val) => (val === "" || val == null ? "" : Number(val)))
    .refine((val) => val === "" || (typeof val === "number" && Number.isFinite(val) && val > 0), {
      message: "Total Population must be a positive number",
    }),
  image: z.string().url().nullable().transform((val) => (val?.trim() ? val.trim() : "")),
  description: z.string().nullable().transform((val) => (val?.trim() ? val.trim() : "")),
});

type FormData = z.infer<typeof speciesSchema>;
type Species = Database["public"]["Tables"]["species"]["Row"];

export default function EditSpeciesDialog({ userId, species }: { userId: string; species: Species }) {
  const [open, setOpen] = useState<boolean>(false);

  const initialValues: FormData = useMemo(
    () => ({
      scientific_name: species.scientific_name ?? "",
      common_name: species.common_name ?? "",
      kingdom: (species.kingdom as Kingdom) ?? "Animalia",
      total_population: species.total_population ?? "",
      image: species.image ?? "",
      description: species.description ?? "",
    }),
    [species]
  );

  const form = useForm<FormData>({
    resolver: zodResolver(speciesSchema),
    defaultValues: initialValues,
    mode: "onChange",
  });

  if (userId !== species.author) {
    return null;
  }

  useEffect(() => {
    if (open) form.reset(initialValues);
  }, [open, initialValues, form]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) form.reset(initialValues);
  };

  const onSubmit = async (input: FormData) => {
    const supabase = createBrowserSupabaseClient();
    const sanitizedInput = {
      scientific_name: input.scientific_name,
      common_name: input.common_name === "" ? null : input.common_name,
      kingdom: input.kingdom,
      total_population: input.total_population === "" ? null : input.total_population,
      image: input.image === "" ? null : input.image,
      description: input.description === "" ? null : input.description,
    };
    const { error } = await supabase.from("species").update(sanitizedInput).eq("id", species.id).eq("author", userId);
    if (error) {
      toast({ title: "Error updating species", description: error.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    window.location.reload();
    toast({ title: "Species updated!", description: `Successfully updated ${input.scientific_name}.` });
  };

  const numberValue = (v: string | number | null | undefined) => (v === "" || v == null ? "" : String(v));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary">Edit</Button>
      </DialogTrigger>
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Species</DialogTitle>
          <DialogDescription>Modify species details and click Save Changes when done.</DialogDescription>
        </DialogHeader>
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
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="common_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Common Name</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="kingdom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kingdom</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Population</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={numberValue(field.value)}
                        onChange={(e) => field.onChange(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="image"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URL</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex">
                <Button type="submit" className="mr-2">
                  Save Changes
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="secondary" onClick={() => form.reset(initialValues)}>
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
