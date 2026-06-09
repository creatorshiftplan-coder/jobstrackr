import React from "react";
import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
   DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield, Wifi, BellRing, Zap, ArrowUpRight, MonitorPlay } from "lucide-react";
import { motion } from "framer-motion";

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: () => void;
  isIOS: boolean;
}

export function InstallModal({ isOpen, onClose, onInstall, isIOS }: InstallModalProps) {
  const features = [
    {
      icon: <Wifi className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
      title: "Offline Capability",
      description: "Browse previously loaded jobs and track active exams without any internet connection."
    },
    {
      icon: <BellRing className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
      title: "Instant Push Alerts",
      description: "Get real-time notification alerts for new vacancies, exam schedules, and admit cards."
    },
    {
      icon: <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
      title: "Blazing Fast Speed",
      description: "Launches instantly from your home screen as a standalone application. No browser lag."
    },
    {
      icon: <MonitorPlay className="h-5 w-5 text-sky-600 dark:text-sky-400" />,
      title: "Quick App Shortcuts",
      description: "Jump straight into Latest Jobs, Saved Jobs, or the Exam Tracker from your app icon."
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-[92%] sm:w-full rounded-2xl p-6 border bg-background shadow-xl overflow-hidden">
        <DialogHeader className="text-center sm:text-left">
          <div className="flex justify-center sm:justify-start items-center gap-2 mb-2 text-primary">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <span className="font-semibold text-[10px] tracking-wider uppercase text-primary/80">
              Install Experience
            </span>
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-bold font-display text-foreground text-center sm:text-left">
            Get JobsTrackr App
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left mt-1">
            Install the JobsTrackr Progressive Web App on your device for the ultimate government job tracking experience.
          </DialogDescription>
        </DialogHeader>

        {/* Brand App Showcase */}
        <div className="my-4 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-secondary/30 dark:from-primary/10 dark:to-secondary/10 border border-border/40 flex items-center gap-4">
          <img
            src="/logo.png"
            alt="JobsTrackr Icon"
            className="h-14 w-14 rounded-xl object-cover shadow-md shrink-0 border border-primary/10 invert dark:invert-0"
          />
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-foreground">JobsTrackr App</h4>
            <p className="text-[11px] text-muted-foreground">Version 2.0.0 • Free Utility App</p>
            <div className="flex gap-1.5 flex-wrap">
              <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium">Standalone Mode</span>
              <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">No Ads</span>
            </div>
          </div>
        </div>

        {/* Feature Highlights list */}
        <div className="space-y-3.5 my-4" role="list" aria-label="PWA Features list">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-start gap-3.5 p-2.5 rounded-xl hover:bg-secondary/20 transition-colors"
            >
              <div className="p-2 bg-background border rounded-lg shadow-sm shrink-0">
                {feature.icon}
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-foreground">{feature.title}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-2.5 mt-5">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:order-1 text-xs py-5 border-border rounded-xl font-medium text-muted-foreground hover:text-foreground"
          >
            Maybe Later
          </Button>
          <Button
            onClick={onInstall}
            className="w-full sm:order-2 text-xs py-5 bg-primary hover:bg-primary/95 text-white flex items-center justify-center gap-1.5 rounded-xl font-bold shadow-md hover:shadow-lg active:scale-95 transition-all"
          >
            Install Now
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default InstallModal;
