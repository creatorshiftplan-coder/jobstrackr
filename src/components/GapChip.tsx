import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Keyboard,
  PenTool,
  Laptop,
  Wrench,
  Car,
  Scale,
  Award,
  Briefcase,
  Activity,
  HelpCircle,
  ExternalLink
} from "lucide-react";
import { SkillGap } from "@/hooks/useAlmostEligible";

const iconMap: Record<string, any> = {
  typing: Keyboard,
  stenography: PenTool,
  computer: Laptop,
  iti: Wrench,
  driving: Car,
  law: Scale,
  ncc: Award,
  experience: Briefcase,
  physical: Activity,
  custom: HelpCircle,
};

const guideMap: Record<string, string> = {
  typing: "You can improve your typing speed using free tools like Typing.com or 10FastFingers. Many exams require speed certificates from state agencies or typing institutes. Practice daily to reach 35+ English WPM / 30+ Hindi WPM.",
  stenography: "Stenography requires dedicated shorthand courses. Look for local shorthand coaching centers and practice transcribing dictations at varying speed levels (80, 100, 120 WPM).",
  computer: "Most government jobs accept NIELIT (formerly DOEACC) CCC or O Level computer course certificates. You can apply as a direct candidate on the NIELIT portal and clear the online exam.",
  iti: "ITI Trade certificates are offered by Government and Private Industrial Training Institutes (ITIs) after completing class 10/12 exams. Choose a NCVT/SCVT approved course.",
  driving: "You can apply for a Light Motor Vehicle (LMV) or Heavy Motor Vehicle (HMV) driving license at your local RTO website or through parivahan.gov.in.",
  law: "A Law degree (LLB or LLM) is obtained through passing entrance examinations (like CLAT PG or State Law Entrance) and completing studies at a Bar Council of India (BCI) recognised institution.",
  ncc: "NCC certificates (A, B, or C) can be earned by joining the National Cadet Corps during school or university studies. These give significant bonus marks or direct entries in military/police recruitment.",
  experience: "Gain relevant domain experience in junior posts or contractual employment. Keep all official experience certificates, relieving letters, and salary statements signed by registered authorities.",
  physical: "Standard physical standards (height, chest, running/long jump) are essential for police, forestry, and defense jobs. Follow a structured running program (Couch to 5k) and check specific eligibility heights.",
  custom: "This specialized skill is required by the recruiting body. Check their official recruitment brochure or local training institutes to fulfill this specific criteria.",
};

interface GapChipProps {
  skill: SkillGap;
}

export function GapChip({ skill }: GapChipProps) {
  const [open, setOpen] = useState(false);
  const IconComponent = iconMap[skill.type] || iconMap.custom;
  const guideText = guideMap[skill.type] || guideMap.custom;

  return (
    <>
      <Badge
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        variant="outline"
        className="cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 dark:border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 text-[10px] sm:text-xs transition-all duration-200 active:scale-95 shadow-sm"
      >
        <IconComponent className="h-3 w-3 shrink-0" />
        <span>{skill.label}</span>
      </Badge>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
          <DialogHeader className="flex flex-col items-center text-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <IconComponent className="h-7 w-7 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="font-display font-bold text-lg text-foreground">
              {skill.label}
            </DialogTitle>
            <DialogDescription className="text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/5 px-2.5 py-1 rounded-full border border-amber-500/15">
              Achievable skill gap
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="p-4 bg-muted/30 rounded-xl border border-border/50 text-sm leading-relaxed text-muted-foreground">
              {guideText}
            </div>

            <div className="p-3 bg-secondary/20 rounded-xl border border-border/50 flex items-start gap-2 text-xs">
              <div className="mt-0.5 rounded bg-amber-500/10 p-0.5 text-amber-600 dark:text-amber-400 font-bold">Tip</div>
              <p className="text-muted-foreground leading-normal">
                Earning this skill makes you eligible for this post. Add it to your wizard profile once completed!
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-xl"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                setOpen(false);
                window.open("https://www.google.com/search?q=how+to+get+" + encodeURIComponent(skill.label), "_blank");
              }}
              className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5"
            >
              Learn More
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
