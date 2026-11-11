import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { isLocked } from "@/lib/lobbyLock";

interface EditGameDateDialogProps {
  lobbyId: string;
  currentDate: string | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (newDate: string) => void;
}

const EditGameDateDialog = ({
  lobbyId,
  currentDate,
  open,
  onOpenChange,
  onSaved,
}: EditGameDateDialogProps) => {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(currentDate ? new Date(currentDate) : undefined);
    }
  }, [open, currentDate]);

  const locked = isLocked(currentDate);
  const isNew = !currentDate;

  const handleSave = async () => {
    if (!date) {
      toast.error("Please pick a date.");
      return;
    }
    if (locked) {
      toast.error("This lobby is already within the 3-day lock window.");
      return;
    }
    setSaving(true);
    const iso = date.toISOString();
    const { error } = await supabase
      .from("lobbies")
      .update({ game_date: iso })
      .eq("id", lobbyId);
    setSaving(false);

    if (error) {
      const msg = error.message || "";
      if (msg.includes("lobby_locked")) {
        toast.error("Lobby is already locked — date can't be changed.");
      } else if (msg.includes("game_date_must_be_future")) {
        toast.error("Game date must be in the future.");
      } else if (msg.includes("game_date_required")) {
        toast.error("A game date is required.");
      } else {
        toast.error("Could not save date.", { description: msg });
      }
      return;
    }

    toast.success(isNew ? "Game date set." : "Game date updated.");
    onSaved?.(iso);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass imperial-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-base uppercase tracking-[0.2em] text-primary text-glow">
            {isNew ? "Set Game Date" : "Edit Game Date"}
          </DialogTitle>
          <DialogDescription className="font-body text-sm text-muted-foreground">
            Picks lock 3 days before the scheduled date. Anyone without a
            faction at lock time is auto-assigned a random one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-body bg-input border-border hover:border-primary/40",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : "Pick the date you'll play"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(d) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return d < today;
                }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="font-display text-xs uppercase tracking-[0.15em]"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!date || saving}
            className="font-display text-xs uppercase tracking-[0.15em]"
          >
            {saving ? "Saving…" : isNew ? "Set Date" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditGameDateDialog;
