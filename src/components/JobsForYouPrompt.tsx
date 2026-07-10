import { SlimPromptCard } from "@/components/SlimPromptCard";

/**
 * Slim nudge shown on the homepage in place of the "My Active Exams" row when
 * the user hasn't tracked any exams yet — points them at the "Jobs For You"
 * (/for-you) personalization page. Disappears once they track an exam.
 */
export function JobsForYouPrompt() {
  return (
    <SlimPromptCard
      to="/for-you"
      title="Find jobs made for you"
      subtitle="Get jobs matched to your qualification, age & sector"
      cta="Set up"
    />
  );
}

export default JobsForYouPrompt;
