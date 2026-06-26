import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listMerchProducts, type MerchListItem } from "@/lib/merch.functions";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/_authenticated/admin/merch-settings")({
  head: () => ({ meta: [{ title: "Merch Settings — Admin" }, { name: "robots", content: "noindex" }] }),
  component: MerchSettingsPage,
});

type MerchSettings = {
  eyebrow: string;
  title: string;
  description: string;
  product_order: number[];
};

const DEFAULTS: MerchSettings = {
  eyebrow: "Shop",
  title: "WKNA 49 Merch",
  description: "Wear the valley. Every order is printed on demand and shipped within 5–10 business days.",
  product_order: [],
};

function MerchSettingsPage() {
  const qc = useQueryClient();

  const settingsQ = useQuery({
    queryKey: ["admin_merch_settings"],
    queryFn: async (): Promise<MerchSettings> => {
      const { data } = await supabase
        .from("site_content")
        .select("value")
        .eq("key", "merch_settings")
        .maybeSingle();
      return { ...DEFAULTS, ...((data?.value as Partial<MerchSettings>) ?? {}) };
    },
  });

  const productsQ = useQuery({
    queryKey: ["admin_merch_products"],
    queryFn: () => listMerchProducts(),
  });

  const [eyebrow, setEyebrow] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settingsQ.data) {
      setEyebrow(settingsQ.data.eyebrow);
      setTitle(settingsQ.data.title);
      setDescription(settingsQ.data.description);
    }
  }, [settingsQ.data]);

  // Merge saved order with current product list (any new products go at the end).
  useEffect(() => {
    if (!productsQ.data || !settingsQ.data) return;
    const present = new Set(productsQ.data.map((p) => p.id));
    const saved = settingsQ.data.product_order.filter((id) => present.has(id));
    const missing = productsQ.data.map((p) => p.id).filter((id) => !saved.includes(id));
    setOrder([...saved, ...missing]);
  }, [productsQ.data, settingsQ.data]);

  const byId = useMemo(() => {
    const m = new Map<number, MerchListItem>();
    for (const p of productsQ.data ?? []) m.set(p.id, p);
    return m;
  }, [productsQ.data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIndex = prev.indexOf(Number(active.id));
      const newIndex = prev.indexOf(Number(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const save = async () => {
    setSaving(true);
    const value: MerchSettings = {
      eyebrow: eyebrow.trim() || DEFAULTS.eyebrow,
      title: title.trim() || DEFAULTS.title,
      description: description.trim() || DEFAULTS.description,
      product_order: order,
    };
    const { error } = await supabase
      .from("site_content")
      .upsert({ key: "merch_settings", value }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Merch settings saved");
    qc.invalidateQueries({ queryKey: ["admin_merch_settings"] });
    qc.invalidateQueries({ queryKey: ["merch_settings"] });
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-black text-primary">Merch Page Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Change the merch page header copy and drag products to reorder how they appear at <code>/merch</code>.
          New products auto-append to the end of the list.
        </p>
      </div>

      <section className="rounded-lg border bg-white p-5">
        <h2 className="font-display text-xl font-bold text-primary">Header copy</h2>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Eyebrow</span>
            <input
              value={eyebrow}
              onChange={(e) => setEyebrow(e.target.value)}
              className="h-10 rounded-md border px-3"
              placeholder={DEFAULTS.eyebrow}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 rounded-md border px-3"
              placeholder={DEFAULTS.title}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="rounded-md border px-3 py-2"
              placeholder={DEFAULTS.description}
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-5">
        <h2 className="font-display text-xl font-bold text-primary">Product order</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Drag the handle (≡) to reorder. Top of this list = first on the merch page.
        </p>

        {productsQ.isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading products…</p>}
        {productsQ.error && (
          <p className="mt-4 text-sm text-red-600">Couldn't load products: {(productsQ.error as Error).message}</p>
        )}

        {order.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              <ul className="mt-4 space-y-2">
                {order.map((id, idx) => {
                  const p = byId.get(id);
                  if (!p) return null;
                  return <SortableRow key={id} id={id} product={p} index={idx} />;
                })}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-white/95 py-3 backdrop-blur">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-10 rounded-md bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function SortableRow({ id, product, index }: { id: number; product: MerchListItem; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border bg-card p-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex h-10 w-10 cursor-grab items-center justify-center rounded text-lg text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        ≡
      </button>
      <span className="w-8 text-center text-xs font-semibold text-muted-foreground">{index + 1}</span>
      {product.thumbnail_url ? (
        <img src={product.thumbnail_url} alt="" className="h-12 w-12 rounded object-cover" />
      ) : (
        <div className="h-12 w-12 rounded bg-muted" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-primary">{product.name}</p>
        <p className="text-xs text-muted-foreground">
          {product.variants} variant{product.variants === 1 ? "" : "s"}
          {product.min_price ? ` · from $${product.min_price}` : ""}
        </p>
      </div>
    </li>
  );
}
