import data from "@/content/info/about.json";
import { InfoPage } from "@/components/site/InfoPage";

export const metadata = {
  title: `${data.title} | GoalGrid`,
  description: data.lead,
};

export default function Page() {
  return <InfoPage data={data} />;
}
