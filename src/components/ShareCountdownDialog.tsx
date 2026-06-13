import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Copy, Loader2, MessageCircle, Send, Image as ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CountdownItem } from "@/hooks/useCountdownExams";
import {
  buildShareText,
  countdownShareUrl,
  whatsappShareUrl,
  telegramShareUrl,
} from "@/lib/shareCountdown";
import logoColor from "@/assets/logo-color.png";

interface ShareCountdownDialogProps {
  item: CountdownItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const POSTER_SIZE = 1080;
const PREVIEW_SIZE = 280;
const PREVIEW_SCALE = PREVIEW_SIZE / POSTER_SIZE;

type Urgency = "critical" | "soon" | "calm";

function urgencyFor(daysLeft: number): Urgency {
  if (daysLeft <= 7) return "critical";
  if (daysLeft <= 30) return "soon";
  return "calm";
}

// Inline hex gradients (html-to-image renders most reliably from inline styles).
const POSTER_GRADIENT: Record<Urgency, string> = {
  critical: "linear-gradient(135deg, #fb7185 0%, #e11d48 100%)",
  soon: "linear-gradient(135deg, #fbbf24 0%, #f97316 100%)",
  calm: "linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)",
};

export function ShareCountdownDialog({ item, open, onOpenChange }: ShareCountdownDialogProps) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  if (!item) return null;

  const urgency = urgencyFor(item.daysLeft);
  const shareUrl = countdownShareUrl(item);
  const shareText = buildShareText(item);
  const bigNumber = item.daysLeft <= 0 ? "0" : String(item.daysLeft);
  const bigLabel = item.daysLeft <= 0 ? "EXAM IS TODAY" : item.daysLeft === 1 ? "DAY TO GO" : "DAYS TO GO";

  const handleShareImage = async () => {
    if (!posterRef.current) return;
    setGenerating(true);
    try {
      // Lazy-loaded so html-to-image never lands in the main bundle.
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(posterRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        width: POSTER_SIZE,
        height: POSTER_SIZE,
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `countdown-${item.update.slug || item.update.id}.png`, {
        type: "image/png",
      });

      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: item.update.title, text: `${shareText}\n${shareUrl}` });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = file.name;
        a.click();
        toast.success("Image saved — share it in any group!");
      }
    } catch (err) {
      // User cancelling the native share sheet throws AbortError — stay quiet then.
      if ((err as Error)?.name !== "AbortError") {
        toast.error("Couldn't generate the image. Try the link buttons instead.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      toast.success("Link copied!");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share countdown</DialogTitle>
          <DialogDescription className="sr-only">
            Share this exam countdown as an image or link
          </DialogDescription>
        </DialogHeader>

        {/* Poster preview (scaled-down view of the full-res capture target) */}
        <div className="flex justify-center">
          <div
            style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE, overflow: "hidden", borderRadius: 16 }}
            className="shadow-lg"
          >
            <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: "top left" }}>
              {/* ── The actual poster captured to PNG ── */}
              <div
                ref={posterRef}
                style={{
                  width: POSTER_SIZE,
                  height: POSTER_SIZE,
                  background: POSTER_GRADIENT[urgency],
                  color: "#ffffff",
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                  display: "flex",
                  flexDirection: "column",
                  padding: 80,
                  boxSizing: "border-box",
                  position: "relative",
                }}
              >
                {/* Brand row */}
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <img src={logoColor} alt="" width={84} height={84} style={{ borderRadius: 18, background: "#fff", padding: 8 }} />
                  <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -0.5 }}>JobsTrackr</span>
                </div>

                {/* Big number */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ fontSize: item.daysLeft <= 0 ? 220 : 300, fontWeight: 900, lineHeight: 0.9, letterSpacing: -6 }}>
                    {item.daysLeft <= 0 ? "🔥" : bigNumber}
                  </div>
                  <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: 4, opacity: 0.95 }}>{bigLabel}</div>
                </div>

                {/* Exam title + date */}
                <div>
                  <div
                    style={{
                      fontSize: 46,
                      fontWeight: 700,
                      lineHeight: 1.15,
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {item.update.title}
                  </div>
                  <div
                    style={{
                      marginTop: 28,
                      display: "inline-block",
                      background: "rgba(255,255,255,0.22)",
                      borderRadius: 999,
                      padding: "16px 32px",
                      fontSize: 34,
                      fontWeight: 600,
                    }}
                  >
                    📅 {item.eventLabel} · {format(item.examDate, "d MMM yyyy")}
                  </div>
                  <div style={{ marginTop: 40, fontSize: 32, fontWeight: 600, opacity: 0.9 }}>
                    Track the live countdown → jobstrackr.in
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-2 space-y-2">
          <Button onClick={handleShareImage} disabled={generating} className="w-full" size="lg">
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
            {generating ? "Creating image…" : "Share as image"}
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <a href={whatsappShareUrl(item)} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full border-green-500/40 text-green-600 hover:bg-green-500/10 dark:text-green-400">
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </Button>
            </a>
            <a href={telegramShareUrl(item)} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full border-sky-500/40 text-sky-600 hover:bg-sky-500/10 dark:text-sky-400">
                <Send className="mr-2 h-4 w-4" />
                Telegram
              </Button>
            </a>
          </div>

          <Button variant="ghost" onClick={handleCopy} className="w-full">
            <Copy className="mr-2 h-4 w-4" />
            Copy link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
