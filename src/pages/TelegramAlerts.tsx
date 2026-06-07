import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Loader2, Send, ShieldCheck, X, AlertTriangle, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { INDIAN_STATES } from "@/constants/filters";
import { BottomNav } from "@/components/BottomNav";
import { useSmartBack } from "@/hooks/useSmartBack";

export default function TelegramAlerts() {
  const navigate = useNavigate();
  const handleBack = useSmartBack("/more");
  const { user, loading: authLoading } = useAuth();
  
  const {
    preferences,
    connection,
    isLoading: preferencesLoading,
    updatePreferences,
    toggleTelegramActive,
    disconnectTelegram,
  } = useNotificationPreferences();

  // Local States for preferences editing
  const [categories, setCategories] = useState({
    ssc: false,
    upsc: false,
    railway: false,
    banking: false,
    defence: false,
    psu: false,
    state_psc: false,
    healthcare: false,
    teaching: false,
    judiciary: false,
    stenographer: false,
  });

  const [alerts, setAlerts] = useState({
    job_notifications: true,
    admit_card_notifications: true,
    result_notifications: true,
    answer_key_notifications: true,
  });

  const [qualifications, setQualifications] = useState({
    tenth_pass: false,
    twelfth_pass: false,
    graduate: false,
    postgraduate: false,
  });

  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  // Load preferences values into state once loaded from Supabase
  useEffect(() => {
    if (preferences) {
      setCategories({
        ssc: preferences.ssc,
        upsc: preferences.upsc,
        railway: preferences.railway,
        banking: preferences.banking,
        defence: preferences.defence,
        psu: preferences.psu,
        state_psc: preferences.state_psc,
        healthcare: preferences.healthcare,
        teaching: preferences.teaching || false,
        judiciary: preferences.judiciary || false,
        stenographer: preferences.stenographer || false,
      });

      setAlerts({
        job_notifications: preferences.job_notifications,
        admit_card_notifications: preferences.admit_card_notifications,
        result_notifications: preferences.result_notifications,
        answer_key_notifications: preferences.answer_key_notifications,
      });

      setQualifications({
        tenth_pass: preferences.tenth_pass,
        twelfth_pass: preferences.twelfth_pass,
        graduate: preferences.graduate,
        postgraduate: preferences.postgraduate,
      });

      setSelectedStates(preferences.preferred_states || []);
    }
  }, [preferences]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePreferences.mutateAsync({
        ...categories,
        ...alerts,
        ...qualifications,
        preferred_states: selectedStates,
      });
    } catch (err) {
      console.error("Save preferences error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectTelegram = () => {
    if (!user?.id) return;
    const botUsername = "jobstrackr_alerts_bot";
    const redirectUrl = `https://t.me/${botUsername}?start=${user.id}`;
    window.open(redirectUrl, "_blank");
  };

  const toggleCategory = (key: keyof typeof categories) => {
    setCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAlert = (key: keyof typeof alerts) => {
    setAlerts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleQualification = (key: keyof typeof qualifications) => {
    setQualifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const addState = (stateName: string) => {
    if (stateName === "All India") {
      setSelectedStates(["All India"]);
    } else {
      setSelectedStates((prev) => {
        const filtered = prev.filter((s) => s !== "All India");
        if (filtered.includes(stateName)) return filtered;
        return [...filtered, stateName];
      });
    }
    setShowStateDropdown(false);
  };

  const removeState = (stateName: string) => {
    setSelectedStates((prev) => prev.filter((s) => s !== stateName));
  };

  if (authLoading || preferencesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isTelegramConnected = !!connection;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-10">
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 bg-primary dark:bg-card px-4 py-4 md:hidden">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="h-10 w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/30 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-primary-foreground dark:text-foreground" />
          </button>
          <h1 className="font-display font-bold text-xl text-primary-foreground dark:text-foreground">Telegram Alerts</h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Desktop Hero Section */}
      <section className="hidden md:block border-b border-border/60 bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--secondary)/0.48)_46%,hsl(var(--primary)/0.12)_100%)]">
        <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
          <div className="flex items-end justify-between gap-8">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <Send className="h-3.5 w-3.5" />
                Instant Alert Dispatch
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground lg:text-4xl">Telegram Alerts</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground lg:text-base">
                Connect your Telegram account and configure your categories, qualifications, and state preferences to receive personalized job notifications.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/85 p-5 shadow-sm backdrop-blur-sm min-w-[240px]">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Alerts Channel Status</p>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {isTelegramConnected ? (connection.is_active ? "Active" : "Paused") : "Not Connected"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isTelegramConnected ? "Linked to Telegram Bot" : "Setup connection below"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="px-4 py-6 space-y-6 md:mx-auto md:max-w-6xl md:px-6 lg:px-8">
        {/* Telegram Bot Connection Card */}
        <Card className="border-0 shadow-card bg-white dark:bg-card overflow-hidden">
          <CardHeader className="bg-primary/5 dark:bg-primary/10 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground">Telegram Alerts Channel</CardTitle>
                <CardDescription className="text-xs">Receive instant updates directly on your Telegram account</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            {isTelegramConnected ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">Connected to Telegram</span>
                    </div>
                    <p className="text-xs text-emerald-600/90 dark:text-emerald-400/90 mt-1">
                      Chat ID: <span className="font-mono">{connection.telegram_chat_id}</span>
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3 justify-between sm:justify-end">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Alerts Status</span>
                      <Switch
                        checked={connection.is_active}
                        onCheckedChange={(checked) => toggleTelegramActive.mutate(checked)}
                        disabled={toggleTelegramActive.isPending}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs text-destructive hover:bg-destructive/10 border-destructive/20 ml-2"
                      onClick={() => disconnectTelegram.mutate()}
                      disabled={disconnectTelegram.isPending}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  💡 You can temporarily pause alerts using the toggle switch above or by typing `/stop` directly to the Telegram bot.
                </p>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">
                  Connect your Telegram account to get real-time alerts whenever new notifications, admit cards, or results matching your preferences are uploaded.
                </p>
                <Button
                  onClick={handleConnectTelegram}
                  className="w-full flex items-center justify-center gap-2 py-5 text-sm rounded-xl shadow-md"
                >
                  <Send className="h-4 w-4" />
                  Connect Telegram Bot
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Pressing Connect redirects you to our verified bot. Tap "Start" in Telegram to finalize connection.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Categories Section */}
        <Card className="border-0 shadow-card bg-white dark:bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Job Categories</CardTitle>
            <CardDescription className="text-xs">Receive updates only for the departments you choose</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: "ssc", label: "SSC" },
                { key: "upsc", label: "UPSC" },
                { key: "railway", label: "Railway" },
                { key: "banking", label: "Banking" },
                { key: "defence", label: "Defence" },
                { key: "psu", label: "PSU" },
                { key: "state_psc", label: "State PSC" },
                { key: "healthcare", label: "Healthcare" },
                { key: "teaching", label: "Teaching" },
                { key: "judiciary", label: "Judiciary" },
                { key: "stenographer", label: "Stenographer" },
              ].map((cat) => {
                const isActive = categories[cat.key as keyof typeof categories];
                return (
                  <Badge
                    key={cat.key}
                    variant={isActive ? "default" : "outline"}
                    className={`cursor-pointer justify-center text-center py-2 px-3 text-xs font-medium rounded-xl transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:bg-secondary/50 border-border/80"
                    }`}
                    onClick={() => toggleCategory(cat.key as keyof typeof categories)}
                  >
                    {isActive && <Check className="h-3.5 w-3.5 mr-1 shrink-0" />}
                    {cat.label}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Alert Types Section */}
        <Card className="border-0 shadow-card bg-white dark:bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Alert Types</CardTitle>
            <CardDescription className="text-xs">Select what type of alerts you wish to receive</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-4">
            {[
              { key: "job_notifications", label: "New Jobs & Vacancies", desc: "Get notified as soon as a new recruitment is posted" },
              { key: "admit_card_notifications", label: "Admit Cards", desc: "Get updates when hall tickets and admit cards are released" },
              { key: "result_notifications", label: "Exam Results", desc: "Get notified when exam results are published" },
              { key: "answer_key_notifications", label: "Answer Keys", desc: "Get notified when official answer keys are uploaded" },
            ].map((alertItem) => (
              <div key={alertItem.key} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-secondary/10 transition-colors">
                <div className="space-y-0.5">
                  <span className="text-sm font-medium text-foreground">{alertItem.label}</span>
                  <p className="text-xs text-muted-foreground max-w-sm sm:max-w-md">{alertItem.desc}</p>
                </div>
                <Switch
                  checked={alerts[alertItem.key as keyof typeof alerts]}
                  onCheckedChange={() => toggleAlert(alertItem.key as keyof typeof alerts)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Qualification Section */}
        <Card className="border-0 shadow-card bg-white dark:bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Qualification Filters</CardTitle>
            <CardDescription className="text-xs">Match updates to your education level</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: "tenth_pass", label: "10th Pass" },
                { key: "twelfth_pass", label: "12th Pass" },
                { key: "graduate", label: "Graduate" },
                { key: "postgraduate", label: "Postgraduate" },
              ].map((qual) => {
                const isActive = qualifications[qual.key as keyof typeof qualifications];
                return (
                  <Badge
                    key={qual.key}
                    variant={isActive ? "default" : "outline"}
                    className={`cursor-pointer justify-center py-2 px-3 text-xs font-medium rounded-xl transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:bg-secondary/50 border-border/80"
                    }`}
                    onClick={() => toggleQualification(qual.key as keyof typeof qualifications)}
                  >
                    {isActive && <Check className="h-3.5 w-3.5 mr-1 shrink-0" />}
                    {qual.label}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* State Filters Section */}
        <Card className="border-0 shadow-card bg-white dark:bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">State Filters</CardTitle>
            <CardDescription className="text-xs">Select preferred states or choose All India to get all vacancies</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-4">
            {/* Selected States Chips */}
            <div className="flex flex-wrap gap-2 min-h-[36px] p-2 border border-border/50 rounded-xl bg-secondary/10">
              {selectedStates.length === 0 ? (
                <span className="text-xs text-muted-foreground my-auto pl-1">No states selected (showing all).</span>
              ) : (
                selectedStates.map((state) => (
                  <Badge
                    key={state}
                    variant="secondary"
                    className="flex items-center gap-1 text-xs py-1 px-2.5 rounded-lg bg-primary/10 border-primary/20 hover:bg-primary/15 transition-all text-primary"
                  >
                    {state}
                    <button
                      onClick={() => removeState(state)}
                      className="h-3.5 w-3.5 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>

            {/* Dropdown triggers */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowStateDropdown(!showStateDropdown)}
                className="text-xs font-medium flex items-center gap-1 border-border/70 rounded-xl"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Preferred State
              </Button>

              {showStateDropdown && (
                <Card className="absolute left-0 mt-1 z-50 w-full max-h-60 overflow-y-auto shadow-lg border border-border rounded-xl bg-white dark:bg-card">
                  <CardContent className="p-1 space-y-0.5">
                    {INDIAN_STATES.map((state) => (
                      <button
                        key={state}
                        onClick={() => addState(state)}
                        className={`w-full text-left py-2 px-3 text-xs hover:bg-secondary/60 transition-colors rounded-lg ${
                          selectedStates.includes(state) ? "font-semibold text-primary" : "text-foreground"
                        }`}
                      >
                        {state}
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </CardContent>
        </Card>

        {/* RLS/Authentication Banner Warning */}
        {!isTelegramConnected && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs border border-amber-500/20">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Setup Connection:</span> To configure these filters and verify delivery, please tap "Connect Telegram Bot" above. Once your account is linked, matched updates will automatically queue up.
            </div>
          </div>
        )}

        {/* Save Preferences Button */}
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-5 text-sm rounded-xl font-medium shadow-md transition-all animate-shimmer"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving Preferences...
            </>
          ) : (
            "Save Notifications Preferences"
          )}
        </Button>
      </main>

      <BottomNav />
    </div>
  );
}
